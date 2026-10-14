import type { Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env.js';
import { ERROR_CODES } from '../shared/errors/error-catalog.js';

export interface RateLimiterFactoryOptions {
  windowMs?: number;
  max?: number;
  message?: string;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request, res: Response) => string;
}

/**
 * Factory for creating configured rate limiters.
 * Returns standard 429 envelope format matching API_CONTRACT.md with Retry-After header.
 */
export function createRateLimiter(options: RateLimiterFactoryOptions = {}) {
  const windowMs = options.windowMs ?? env.RATE_LIMIT_WINDOW_MS;
  const max = options.max ?? env.RATE_LIMIT_MAX_REQUESTS;
  const defaultMessage =
    options.message ??
    `Terlalu banyak permintaan dari IP ini, silakan coba lagi setelah ${Math.ceil(windowMs / 1000)} detik`;

  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: options.keyGenerator,
    validate: { keyGeneratorIpFallback: false },
    skipFailedRequests: options.skipFailedRequests ?? false,
    handler: (req, res) => {
      // Calculate remaining retry-after seconds
      const retryAfterSeconds = Math.ceil(windowMs / 1000);
      res.setHeader('Retry-After', String(retryAfterSeconds));

      res.status(429).json({
        success: false,
        error: {
          code: ERROR_CODES.TOO_MANY_REQUESTS,
          message: defaultMessage,
          details: null,
          requestId: req.id || null,
        },
      });
    },
  });
}

/**
 * Global API rate limiter for the entire application.
 */
export const globalRateLimiter = createRateLimiter();
