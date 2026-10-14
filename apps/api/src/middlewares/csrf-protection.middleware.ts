import type { Request, Response, NextFunction } from 'express';
import { env, getCorsAllowedOrigins } from '../config/env.js';
import { ForbiddenError } from '../shared/errors/index.js';

/**
 * CSRF Protection Middleware for cookie-authenticated endpoints (e.g. /auth/refresh, /auth/logout).
 *
 * Verifies:
 * 1. Presence of custom header or application/json content-type (which triggers CORS preflight and cannot be forged by standard cross-site form posts).
 * 2. Origin/Referer header match against explicit CORS whitelist.
 */
export function csrfProtection(req: Request, _res: Response, next: NextFunction): void {
  // 1. Validate custom header or JSON content type
  const hasCustomHeader =
    req.headers['x-requested-with'] !== undefined ||
    req.headers['x-csrf-protect'] !== undefined ||
    req.headers['idempotency-key'] !== undefined ||
    (req.headers['content-type'] && req.headers['content-type'].includes('application/json'));

  if (!hasCustomHeader) {
    throw new ForbiddenError(
      'Permintaan ditolak: Header proteksi CSRF (X-Requested-With atau Content-Type application/json) wajib disertakan'
    );
  }

  // 2. Validate Origin or Referer against CORS whitelist if provided
  const origin = req.headers['origin'] as string | undefined;
  const referer = req.headers['referer'] as string | undefined;
  const allowedOrigins = getCorsAllowedOrigins(env.CORS_ORIGIN);

  let requestOrigin: string | null = null;
  if (origin) {
    requestOrigin = origin;
  } else if (referer) {
    try {
      const url = new URL(referer);
      requestOrigin = url.origin;
    } catch {
      throw new ForbiddenError('Format header Referer tidak valid');
    }
  }

  if (requestOrigin) {
    if (!allowedOrigins.includes(requestOrigin)) {
      throw new ForbiddenError(
        `Origin '${requestOrigin}' tidak diizinkan oleh kebijakan keamanan`,
        'ORIGIN_NOT_ALLOWED'
      );
    }
  }

  next();
}
