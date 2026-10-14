import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { UserRole } from '@wallet-app/shared';
import { env } from '../config/env.js';
import { pool } from '../database/index.js';
import { UnauthorizedError } from '../shared/errors/index.js';

export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Middleware: Verifies JWT Access Token and checks user real-time status & role from the database.
 * Denies requests if user is soft-deleted or deactivated.
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError(
      'Token otentikasi tidak ditemukan atau format tidak valid (wajib Bearer)'
    );
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    throw new UnauthorizedError('Token otentikasi kosong');
  }

  let decoded: jwt.JwtPayload;
  try {
    decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    }) as jwt.JwtPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Token otentikasi telah kedaluwarsa');
    }
    if (err instanceof jwt.JsonWebTokenError) {
      throw new UnauthorizedError('Token otentikasi tidak valid atau tanda tangan rusak');
    }
    throw new UnauthorizedError('Verifikasi token otentikasi gagal');
  }

  const userId = decoded.sub;
  if (!userId) {
    throw new UnauthorizedError('Klaim sub tidak ditemukan pada token');
  }

  // Real-time Database Verification: Ensures immediate revocation on user deactivation, soft delete, or role change
  const queryResult = await pool.query(
    `SELECT id, username, email, full_name, role, is_active, deleted_at
     FROM users
     WHERE id = $1`,
    [userId]
  );

  if (queryResult.rows.length === 0) {
    throw new UnauthorizedError('Pengguna tidak ditemukan dalam sistem');
  }

  const user = queryResult.rows[0];

  if (user.deleted_at !== null) {
    throw new UnauthorizedError('Akun pengguna telah dihapus');
  }

  if (!user.is_active) {
    throw new UnauthorizedError('Akun pengguna dinonaktifkan oleh administrator');
  }

  req.user = {
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.full_name,
    role: user.role as UserRole,
  };

  next();
}
