import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

// Standard UUID v4 regex
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

/**
 * Validates whether a string is a standard UUID v4.
 */
export function isValidRequestId(id: string): boolean {
  return UUID_V4_REGEX.test(id);
}

/**
 * Request ID Middleware
 * Validates incoming X-Request-Id header. If valid, reuses it; otherwise generates a new UUID v4.
 * Always sets X-Request-Id header on response and attaches req.id to request context.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const headerValue = req.headers['x-request-id'];

  let requestId: string;
  if (typeof headerValue === 'string' && isValidRequestId(headerValue)) {
    requestId = headerValue;
  } else {
    requestId = randomUUID();
  }

  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}
