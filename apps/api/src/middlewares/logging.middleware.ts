import type { Request, Response, NextFunction } from 'express';
import { logger } from '../shared/logging/logger.js';
import { env } from '../config/env.js';

/**
 * Structured HTTP Request Logging Middleware
 * Logs incoming requests and completion metrics safely without recording request bodies or secrets.
 */
export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  // In test environment, skip noisy request logging unless debug level is set
  if (env.NODE_ENV === 'test' && env.LOG_LEVEL !== 'debug') {
    return next();
  }

  const startTime = Date.now();
  const sanitizedPath = req.originalUrl.split('?')[0];

  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    const statusCode = res.statusCode;
    const logData = {
      requestId: req.id,
      method: req.method,
      path: sanitizedPath,
      statusCode,
      durationMs,
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    };

    if (statusCode >= 500) {
      logger.error(
        logData,
        `HTTP ${req.method} ${sanitizedPath} -> ${statusCode} (${durationMs}ms)`
      );
    } else if (statusCode >= 400) {
      logger.warn(
        logData,
        `HTTP ${req.method} ${sanitizedPath} -> ${statusCode} (${durationMs}ms)`
      );
    } else {
      logger.info(
        logData,
        `HTTP ${req.method} ${sanitizedPath} -> ${statusCode} (${durationMs}ms)`
      );
    }
  });

  next();
}
