import crypto from 'crypto';
import argon2 from 'argon2';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type {
  RegisterInput,
  LoginInput,
  ChangePasswordInput,
  ResetPasswordInput,
  UserProfileResponse,
  AuthTokens,
} from '@wallet-app/shared';
import { env } from '../../config/env.js';
import { pool, withTransaction } from '../../database/index.js';
import { authRepository, type UserRecord } from './auth.repository.js';
import { mailService } from '../../shared/mail/mail.service.js';
import { UnauthorizedError, ConflictError, BadRequestError } from '../../shared/errors/index.js';

// Precomputed dummy hash for timing-attack mitigation on login
let dummyArgon2Hash: string;
void argon2
  .hash('dummy_timing_protection_password_2026', {
    type: argon2.argon2id,
    memoryCost: env.ARGON2_MEMORY_COST,
    timeCost: env.ARGON2_TIME_COST,
    parallelism: env.ARGON2_PARALLELISM,
  })
  .then((h) => {
    dummyArgon2Hash = h;
  });

export function hashSha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function toUserProfileResponse(user: UserRecord): UserProfileResponse {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    is_active: user.is_active,
    is_verified: user.is_verified,
    created_at: user.created_at.toISOString(),
    updated_at: user.updated_at.toISOString(),
  };
}

export class AuthService {
  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: env.ARGON2_MEMORY_COST,
      timeCost: env.ARGON2_TIME_COST,
      parallelism: env.ARGON2_PARALLELISM,
    });
  }

  async verifyPassword(
    password: string,
    hash: string
  ): Promise<{ valid: boolean; needsRehash: boolean }> {
    if (hash.startsWith('$argon2')) {
      try {
        const valid = await argon2.verify(hash, password);
        const needsRehash = argon2.needsRehash(hash, {
          memoryCost: env.ARGON2_MEMORY_COST,
          timeCost: env.ARGON2_TIME_COST,
          parallelism: env.ARGON2_PARALLELISM,
        });
        return { valid, needsRehash };
      } catch {
        return { valid: false, needsRehash: false };
      }
    }

    if (hash.startsWith('$2a$') || hash.startsWith('$2b$')) {
      const valid = bcrypt.compareSync(password, hash);
      return { valid, needsRehash: true }; // Automatically upgrade seed bcrypt hashes to argon2id
    }

    return { valid: false, needsRehash: false };
  }

  async verifyDummyPassword(password: string): Promise<void> {
    if (!dummyArgon2Hash) {
      dummyArgon2Hash = await this.hashPassword('dummy_timing_protection_password_2026');
    }
    await argon2.verify(dummyArgon2Hash, password);
  }

  mintAccessToken(user: UserRecord): string {
    const payload = {
      sub: user.id,
      role: user.role,
      email: user.email,
      jti: crypto.randomUUID(),
    };

    return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
      algorithm: 'HS256',
      expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    });
  }

  generateOpaqueToken(): { rawToken: string; tokenHash: string } {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashSha256(rawToken);
    return { rawToken, tokenHash };
  }

  async register(input: RegisterInput, ip: string): Promise<UserProfileResponse> {
    // 1. Check duplicate email (case-insensitive)
    const existingEmail = await authRepository.findUserByEmail(pool, input.email);
    if (existingEmail) {
      throw new ConflictError('Email sudah terdaftar dalam sistem', 'DUPLICATE_ENTRY');
    }

    // 2. Check duplicate username (case-insensitive)
    const existingUsername = await authRepository.findUserByUsername(pool, input.username);
    if (existingUsername) {
      throw new ConflictError('Username sudah digunakan oleh akun lain', 'DUPLICATE_ENTRY');
    }

    // 3. Hash password with argon2id
    const passwordHash = await this.hashPassword(input.password);

    // 4. Create user
    const newUser = await authRepository.createUser(pool, {
      username: input.username,
      email: input.email,
      passwordHash,
      fullName: input.full_name,
    });

    // 5. Audit log
    await authRepository.recordActivityLog(pool, {
      userId: newUser.id,
      action: 'USER_REGISTERED',
      entity: 'users',
      entityId: newUser.id,
      metadata: { username: newUser.username, email: newUser.email },
      ipAddress: ip,
    });

    return toUserProfileResponse(newUser);
  }

  async login(
    input: LoginInput,
    ip: string
  ): Promise<{
    user: UserProfileResponse;
    tokens: AuthTokens;
    rawRefreshToken: string;
  }> {
    const user = await authRepository.findUserByEmail(pool, input.email);

    if (!user) {
      // Execute dummy timing verification to prevent account enumeration
      await this.verifyDummyPassword(input.password);
      await authRepository.recordActivityLog(pool, {
        userId: null,
        action: 'USER_LOGIN_FAILED',
        entity: 'auth',
        metadata: { email: input.email, reason: 'INVALID_CREDENTIALS' },
        ipAddress: ip,
      });
      throw new UnauthorizedError('Email atau kata sandi tidak valid');
    }

    const { valid, needsRehash } = await this.verifyPassword(input.password, user.password_hash);
    if (!valid) {
      await authRepository.recordActivityLog(pool, {
        userId: user.id,
        action: 'USER_LOGIN_FAILED',
        entity: 'auth',
        metadata: { email: user.email, reason: 'INVALID_CREDENTIALS' },
        ipAddress: ip,
      });
      throw new UnauthorizedError('Email atau kata sandi tidak valid');
    }

    // Deactivated / Soft-deleted users cannot login
    if (user.deleted_at !== null) {
      throw new UnauthorizedError('Akun pengguna dinonaktifkan atau telah dihapus');
    }

    if (!user.is_active) {
      throw new UnauthorizedError('Akun pengguna dinonaktifkan oleh administrator');
    }

    // Auto-rehash password if cost parameters changed or upgrading from bcrypt
    if (needsRehash) {
      const newHash = await this.hashPassword(input.password);
      await authRepository.updateUserPassword(pool, user.id, newHash);
    }

    // Generate Refresh Token session (Family ID)
    const { rawToken, tokenHash } = this.generateOpaqueToken();
    const familyId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await authRepository.createRefreshToken(pool, {
      userId: user.id,
      tokenHash,
      familyId,
      expiresAt,
    });

    const accessToken = this.mintAccessToken(user);

    await authRepository.recordActivityLog(pool, {
      userId: user.id,
      action: 'USER_LOGIN_SUCCESS',
      entity: 'auth',
      metadata: { email: user.email },
      ipAddress: ip,
    });

    return {
      user: toUserProfileResponse(user),
      tokens: {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 900, // 15 mins (in seconds)
      },
      rawRefreshToken: rawToken,
    };
  }

  async refresh(
    rawRefreshToken: string,
    ip: string
  ): Promise<{
    user: UserProfileResponse;
    tokens: AuthTokens;
    newRawRefreshToken: string;
  }> {
    const tokenHash = hashSha256(rawRefreshToken);

    const result = await withTransaction(async (client) => {
      // 1. Fetch token record with row-level lock (FOR UPDATE)
      const tokenRecord = await authRepository.findRefreshTokenForUpdate(client, tokenHash);

      if (!tokenRecord) {
        return { notFound: true as const };
      }

      // 2. Token Reuse Detection: If already revoked, invalidate entire session family
      if (tokenRecord.is_revoked) {
        if (tokenRecord.family_id) {
          await authRepository.revokeRefreshTokenFamily(client, tokenRecord.family_id);
        } else {
          await authRepository.revokeAllUserRefreshTokens(client, tokenRecord.user_id);
        }

        await authRepository.recordActivityLog(client, {
          userId: tokenRecord.user_id,
          action: 'TOKEN_REUSE_DETECTED',
          entity: 'refresh_tokens',
          entityId: tokenRecord.id,
          metadata: { familyId: tokenRecord.family_id },
          ipAddress: ip,
        });

        return { reuseDetected: true as const };
      }

      // 3. Expiration Check
      if (new Date() > tokenRecord.expires_at) {
        return { expired: true as const };
      }

      // 4. Fetch user
      const user = await authRepository.findUserById(client, tokenRecord.user_id);
      if (!user || !user.is_active || user.deleted_at !== null) {
        await authRepository.revokeRefreshToken(client, tokenRecord.id);
        return { userInactive: true as const };
      }

      // 5. Revoke current token
      await authRepository.revokeRefreshToken(client, tokenRecord.id);

      // 6. Issue rotated token with same family_id
      const { rawToken: newRawToken, tokenHash: newTokenHash } = this.generateOpaqueToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      const familyId = tokenRecord.family_id || crypto.randomUUID();

      await authRepository.createRefreshToken(client, {
        userId: user.id,
        tokenHash: newTokenHash,
        familyId,
        expiresAt,
      });

      const accessToken = this.mintAccessToken(user);

      await authRepository.recordActivityLog(client, {
        userId: user.id,
        action: 'TOKEN_REFRESH_SUCCESS',
        entity: 'auth',
        metadata: { familyId },
        ipAddress: ip,
      });

      return {
        user: toUserProfileResponse(user),
        tokens: {
          access_token: accessToken,
          token_type: 'Bearer' as const,
          expires_in: 900,
        },
        newRawRefreshToken: newRawToken,
      };
    });

    if ('notFound' in result) {
      throw new UnauthorizedError('Token sesi tidak valid atau telah kedaluwarsa');
    }

    if ('reuseDetected' in result) {
      throw new UnauthorizedError(
        'Penyalahgunaan token terdeteksi. Seluruh sesi telah dibatalkan demi keamanan.'
      );
    }

    if ('expired' in result) {
      throw new UnauthorizedError('Token sesi telah kedaluwarsa');
    }

    if ('userInactive' in result) {
      throw new UnauthorizedError('Akun pengguna tidak aktif atau telah dinonaktifkan');
    }

    return result;
  }

  async logout(
    rawRefreshToken: string | undefined,
    userId: string | undefined,
    ip: string
  ): Promise<void> {
    if (rawRefreshToken) {
      const tokenHash = hashSha256(rawRefreshToken);
      const res = await pool.query<{ id: string; user_id: string }>(
        `SELECT id, user_id FROM refresh_tokens WHERE token_hash = $1`,
        [tokenHash]
      );
      const firstRow = res.rows[0];
      if (firstRow) {
        await authRepository.revokeRefreshToken(pool, firstRow.id);
        if (!userId) {
          userId = firstRow.user_id;
        }
      }
    }

    if (userId) {
      await authRepository.recordActivityLog(pool, {
        userId,
        action: 'USER_LOGOUT',
        entity: 'auth',
        ipAddress: ip,
      });
    }
  }

  async logoutAll(userId: string, ip: string): Promise<void> {
    await authRepository.revokeAllUserRefreshTokens(pool, userId);
    await authRepository.recordActivityLog(pool, {
      userId,
      action: 'USER_LOGOUT_ALL',
      entity: 'auth',
      ipAddress: ip,
    });
  }

  async changePassword(userId: string, input: ChangePasswordInput, ip: string): Promise<void> {
    const user = await authRepository.findUserById(pool, userId);
    if (!user) {
      throw new UnauthorizedError('Pengguna tidak ditemukan');
    }

    const { valid } = await this.verifyPassword(input.current_password, user.password_hash);
    if (!valid) {
      throw new BadRequestError('Kata sandi saat ini tidak sesuai');
    }

    const newHash = await this.hashPassword(input.new_password);

    await withTransaction(async (client) => {
      await authRepository.updateUserPassword(client, userId, newHash);
      // Invalidate all active sessions for security
      await authRepository.revokeAllUserRefreshTokens(client, userId);
      await authRepository.recordActivityLog(client, {
        userId,
        action: 'PASSWORD_CHANGED',
        entity: 'users',
        entityId: userId,
        ipAddress: ip,
      });
    });
  }

  async forgotPassword(email: string, ip: string): Promise<void> {
    const user = await authRepository.findUserByEmail(pool, email);

    if (user && user.is_active && user.deleted_at === null) {
      // Invalidate existing unused tokens for this user
      await authRepository.invalidateActivePasswordResetsForUser(pool, user.id);

      const { rawToken, tokenHash } = this.generateOpaqueToken();
      const expiresAt = new Date(Date.now() + env.PASSWORD_RESET_EXPIRES_MINUTES * 60 * 1000);

      await authRepository.createPasswordReset(pool, {
        userId: user.id,
        tokenHash,
        expiresAt,
      });

      // Reset URL is strictly built from configured APP_BASE_URL (ignoring client Host header)
      const resetUrl = `${env.APP_BASE_URL}/reset-password?token=${rawToken}`;

      await mailService.sendMail({
        to: user.email,
        subject: 'Pemulihan Kata Sandi Wallet App',
        text: `Halo ${user.full_name},\n\nAnda menerima email ini karena ada permintaan pemulihan kata sandi. Silakan gunakan tautan berikut dalam ${env.PASSWORD_RESET_EXPIRES_MINUTES} menit:\n\n${resetUrl}\n\nJika bukan Anda yang meminta, abaikan pesan ini.`,
        html: `<p>Halo <b>${user.full_name}</b>,</p><p>Gunakan tautan berikut untuk menyetel ulang kata sandi Anda (berlaku ${env.PASSWORD_RESET_EXPIRES_MINUTES} menit):</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
      });

      await authRepository.recordActivityLog(pool, {
        userId: user.id,
        action: 'PASSWORD_RESET_REQUESTED',
        entity: 'password_resets',
        metadata: { email: user.email },
        ipAddress: ip,
      });
    } else {
      // For nonexistent or deactivated email, record log with null userId
      await authRepository.recordActivityLog(pool, {
        userId: null,
        action: 'PASSWORD_RESET_REQUESTED',
        entity: 'password_resets',
        metadata: { email },
        ipAddress: ip,
      });
    }
  }

  async resetPassword(input: ResetPasswordInput, ip: string): Promise<void> {
    const tokenHash = hashSha256(input.token);

    await withTransaction(async (client) => {
      const resetRecord = await authRepository.findPasswordResetForUpdate(client, tokenHash);

      if (!resetRecord || resetRecord.is_used || new Date() > resetRecord.expires_at) {
        throw new BadRequestError('Token pemulihan kata sandi tidak valid atau telah kedaluwarsa');
      }

      await authRepository.markPasswordResetUsed(client, resetRecord.id);

      const newHash = await this.hashPassword(input.new_password);
      await authRepository.updateUserPassword(client, resetRecord.user_id, newHash);

      // Invalidate all refresh tokens upon password reset
      await authRepository.revokeAllUserRefreshTokens(client, resetRecord.user_id);

      await authRepository.recordActivityLog(client, {
        userId: resetRecord.user_id,
        action: 'PASSWORD_RESET_COMPLETED',
        entity: 'users',
        entityId: resetRecord.user_id,
        ipAddress: ip,
      });
    });
  }
}

export const authService = new AuthService();
