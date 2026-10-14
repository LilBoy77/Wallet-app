import type { Request, Response } from 'express';
import { ERROR_CODES } from '../shared/errors/error-catalog.js';

/**
 * 404 Route Not Found Middleware
 * Catch-all handler for undefined routes with standard error envelope.
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      code: ERROR_CODES.NOT_FOUND,
      message: `Rute '${req.method} ${req.originalUrl}' tidak ditemukan`,
      details: null,
      requestId: req.id || null,
    },
  });
}
