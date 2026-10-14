import cors, { type CorsOptions } from 'cors';
import { env, getCorsAllowedOrigins } from '../config/env.js';
import { ForbiddenError } from '../shared/errors/app-error.js';
import { ERROR_CODES } from '../shared/errors/error-catalog.js';

/**
 * Creates configured CORS middleware using explicit origin whitelist from env.
 * Enforces security: No wildcard '*' when credentials: true.
 * Rejects unknown origins explicitly with standard error.
 */
export function createCorsMiddleware() {
  const allowedOrigins = getCorsAllowedOrigins(env.CORS_ORIGIN);

  const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no origin (such as mobile apps, curl, or server-to-server)
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      const corsError = new ForbiddenError(
        `Origin '${origin}' tidak diizinkan oleh kebijakan CORS`,
        { allowedOrigins }
      );
      // Attach code for explicit identification
      Object.assign(corsError, { code: ERROR_CODES.ORIGIN_NOT_ALLOWED });
      return callback(corsError);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 86400, // 24 hours preflight cache
  };

  return cors(corsOptions);
}
