import type { Pool, PoolClient } from 'pg';
import type { UserRole } from '@wallet-app/shared';

export interface UserRecord {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface RefreshTokenRecord {
  id: string;
  user_id: string;
  token_hash: string;
  family_id: string | null;
  expires_at: Date;
  is_revoked: boolean;
  created_at: Date;
}

export interface PasswordResetRecord {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  is_used: boolean;
  created_at: Date;
}

export class AuthRepository {
  async findUserById(client: Pool | PoolClient, id: string): Promise<UserRecord | null> {
    const res = await client.query<UserRecord>(
      `SELECT id, username, email, password_hash, full_name, role, is_active, is_verified, created_at, updated_at, deleted_at
       FROM users
       WHERE id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }

  async findUserByEmail(client: Pool | PoolClient, email: string): Promise<UserRecord | null> {
    const res = await client.query<UserRecord>(
      `SELECT id, username, email, password_hash, full_name, role, is_active, is_verified, created_at, updated_at, deleted_at
       FROM users
       WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL`,
      [email]
    );
    return res.rows[0] || null;
  }

  async findUserByUsername(
    client: Pool | PoolClient,
    username: string
  ): Promise<UserRecord | null> {
    const res = await client.query<UserRecord>(
      `SELECT id, username, email, password_hash, full_name, role, is_active, is_verified, created_at, updated_at, deleted_at
       FROM users
       WHERE LOWER(username) = LOWER($1) AND deleted_at IS NULL`,
      [username]
    );
    return res.rows[0] || null;
  }

  async createUser(
    client: Pool | PoolClient,
    data: {
      username: string;
      email: string;
      passwordHash: string;
      fullName: string;
    }
  ): Promise<UserRecord> {
    const res = await client.query<UserRecord>(
      `INSERT INTO users (username, email, password_hash, full_name, role, is_active, is_verified)
       VALUES ($1, $2, $3, $4, 'user', true, true)
       RETURNING id, username, email, password_hash, full_name, role, is_active, is_verified, created_at, updated_at, deleted_at`,
      [data.username, data.email, data.passwordHash, data.fullName]
    );
    return res.rows[0]!;
  }

  async updateUserPassword(
    client: Pool | PoolClient,
    userId: string,
    passwordHash: string
  ): Promise<void> {
    await client.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [passwordHash, userId]);
  }

  async createRefreshToken(
    client: Pool | PoolClient,
    data: {
      userId: string;
      tokenHash: string;
      familyId: string;
      expiresAt: Date;
    }
  ): Promise<RefreshTokenRecord> {
    const res = await client.query<RefreshTokenRecord>(
      `INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at, is_revoked)
       VALUES ($1, $2, $3, $4, false)
       RETURNING id, user_id, token_hash, family_id, expires_at, is_revoked, created_at`,
      [data.userId, data.tokenHash, data.familyId, data.expiresAt]
    );
    return res.rows[0]!;
  }

  async findRefreshTokenForUpdate(
    client: PoolClient,
    tokenHash: string
  ): Promise<RefreshTokenRecord | null> {
    const res = await client.query<RefreshTokenRecord>(
      `SELECT id, user_id, token_hash, family_id, expires_at, is_revoked, created_at
       FROM refresh_tokens
       WHERE token_hash = $1
       FOR UPDATE`,
      [tokenHash]
    );
    return res.rows[0] || null;
  }

  async revokeRefreshToken(client: Pool | PoolClient, tokenId: string): Promise<void> {
    await client.query(`UPDATE refresh_tokens SET is_revoked = true WHERE id = $1`, [tokenId]);
  }

  async revokeAllUserRefreshTokens(client: Pool | PoolClient, userId: string): Promise<void> {
    await client.query(`UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1`, [userId]);
  }

  async revokeRefreshTokenFamily(client: Pool | PoolClient, familyId: string): Promise<void> {
    await client.query(`UPDATE refresh_tokens SET is_revoked = true WHERE family_id = $1`, [
      familyId,
    ]);
  }

  async createPasswordReset(
    client: Pool | PoolClient,
    data: {
      userId: string;
      tokenHash: string;
      expiresAt: Date;
    }
  ): Promise<PasswordResetRecord> {
    const res = await client.query<PasswordResetRecord>(
      `INSERT INTO password_resets (user_id, token_hash, expires_at, is_used)
       VALUES ($1, $2, $3, false)
       RETURNING id, user_id, token_hash, expires_at, is_used, created_at`,
      [data.userId, data.tokenHash, data.expiresAt]
    );
    return res.rows[0]!;
  }

  async findPasswordResetForUpdate(
    client: PoolClient,
    tokenHash: string
  ): Promise<PasswordResetRecord | null> {
    const res = await client.query<PasswordResetRecord>(
      `SELECT id, user_id, token_hash, expires_at, is_used, created_at
       FROM password_resets
       WHERE token_hash = $1
       FOR UPDATE`,
      [tokenHash]
    );
    return res.rows[0] || null;
  }

  async markPasswordResetUsed(client: Pool | PoolClient, id: string): Promise<void> {
    await client.query(`UPDATE password_resets SET is_used = true WHERE id = $1`, [id]);
  }

  async invalidateActivePasswordResetsForUser(
    client: Pool | PoolClient,
    userId: string
  ): Promise<void> {
    await client.query(
      `UPDATE password_resets SET is_used = true WHERE user_id = $1 AND is_used = false`,
      [userId]
    );
  }

  async recordActivityLog(
    client: Pool | PoolClient,
    data: {
      userId: string | null;
      action: string;
      entity: string;
      entityId?: string | null;
      metadata?: Record<string, unknown>;
      ipAddress?: string | null;
    }
  ): Promise<void> {
    await client.query(
      `INSERT INTO activity_logs (user_id, action, entity, entity_id, metadata, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        data.userId,
        data.action,
        data.entity,
        data.entityId || null,
        JSON.stringify(data.metadata || {}),
        data.ipAddress || null,
      ]
    );
  }
}

export const authRepository = new AuthRepository();
