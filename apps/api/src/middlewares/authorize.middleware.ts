import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '@wallet-app/shared';
import type { AuthenticatedUser } from './authenticate.middleware.js';
import { UnauthorizedError, ForbiddenError } from '../shared/errors/index.js';

/**
 * Middleware: Enforces Role-Based Access Control (RBAC).
 * Returns 401 if request has not been authenticated.
 * Returns 403 if authenticated user's role is not within the allowed roles.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('Autentikasi diperlukan sebelum mengakses rute ini');
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError(
        `Akses ditolak: Peran '${req.user.role}' tidak memiliki izin mengakses sumber daya ini`
      );
    }

    next();
  };
}

/**
 * Helper: Asserts that the authenticated user is either the owner of the resource or an admin.
 * Throws ForbiddenError (HTTP 403) if neither condition is satisfied.
 */
export function assertOwnerOrAdmin(
  user: AuthenticatedUser | undefined,
  resourceOwnerId: string
): boolean {
  if (!user) {
    throw new UnauthorizedError('Autentikasi diperlukan');
  }

  if (user.role === 'admin') {
    return true;
  }

  if (user.id === resourceOwnerId) {
    return true;
  }

  throw new ForbiddenError(
    'Akses ditolak: Anda tidak memiliki izin untuk mengelola sumber daya milik pengguna lain'
  );
}
