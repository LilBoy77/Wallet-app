import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../shared/errors/app-error.js';
import { ERROR_CODES, type ErrorCode } from '../shared/errors/error-catalog.js';
import { formatZodIssues } from './validator.middleware.js';
import { logger } from '../shared/logging/logger.js';
import { env } from '../config/env.js';

interface PostgresErrorMapping {
  statusCode: number;
  code: ErrorCode;
  message: string;
}

/**
 * Maps PostgreSQL SQLSTATE error codes to safe client responses.
 * Never leaks table names, constraint names, or raw SQL queries to the client.
 */
export function mapPostgresError(pgCode: string): PostgresErrorMapping | null {
  switch (pgCode) {
    case '23505': // unique_violation
      return {
        statusCode: 409,
        code: ERROR_CODES.DUPLICATE_ENTRY,
        message: 'Data yang dimasukkan sudah ada dalam sistem (konflik unik)',
      };
    case '23503': // foreign_key_violation
      return {
        statusCode: 422,
        code: ERROR_CODES.FOREIGN_KEY_VIOLATION,
        message: 'Data referensi relasional tidak valid atau masih digunakan oleh entitas lain',
      };
    case '23514': // check_violation
      return {
        statusCode: 422,
        code: ERROR_CODES.CHECK_CONSTRAINT_VIOLATION,
        message: 'Data yang dimasukkan melanggar batasan validasi sistem',
      };
    case '23502': // not_null_violation
      return {
        statusCode: 400,
        code: ERROR_CODES.BAD_REQUEST,
        message: 'Kolom wajib tidak boleh bernilai kosong',
      };
    case '22P02': // invalid_text_representation
      return {
        statusCode: 400,
        code: ERROR_CODES.INVALID_PARAMETER,
        message: 'Format parameter atau identifier yang dimasukkan tidak valid',
      };
    case '40001': // serialization_failure
    case '40P01': // deadlock_detected
      return {
        statusCode: 409,
        code: ERROR_CODES.TRANSACTION_CONCURRENCY_ERROR,
        message:
          'Terjadi konflik transaksi konkuren pada database, silakan coba beberapa saat lagi',
      };
    case '57014': // query_canceled
      return {
        statusCode: 504,
        code: ERROR_CODES.QUERY_TIMEOUT,
        message: 'Eksekusi query dibatalkan karena batas waktu terlampaui',
      };
    default:
      return null;
  }
}

/**
 * Global Error Handler Middleware
 * Centralized exception translator that ensures every error conforms strictly to API_CONTRACT.md.
 */
export function globalErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = req.id || null;

  let statusCode = 500;
  let errorCode: ErrorCode = ERROR_CODES.INTERNAL_SERVER_ERROR;
  let message = 'Terjadi kesalahan internal pada server';
  let details: unknown = null;

  // 1. AppError (and subclasses)
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    errorCode = err.code;
    message = err.message;
    details = err.details || null;
  }
  // 2. Zod Validation Error
  else if (err instanceof ZodError || (err as { name?: string }).name === 'ZodError') {
    statusCode = 422;
    errorCode = ERROR_CODES.VALIDATION_ERROR;
    message = 'Input yang diberikan tidak valid';
    details = formatZodIssues(err as ZodError);
  }
  // 3. Invalid JSON Body (SyntaxError from express.json())
  else if (err instanceof SyntaxError && 'body' in (err as object)) {
    statusCode = 400;
    errorCode = ERROR_CODES.INVALID_JSON;
    message = 'Format JSON pada request payload tidak valid';
  }
  // 4. Payload Too Large (from express.json() limit)
  else if (
    (err as { type?: string }).type === 'entity.too.large' ||
    (err as { status?: number }).status === 413
  ) {
    statusCode = 413;
    errorCode = ERROR_CODES.PAYLOAD_TOO_LARGE;
    message = 'Ukuran payload request melebihi batas maksimal yang diizinkan';
  }
  // 5. PostgreSQL Database Error
  else if (typeof (err as { code?: unknown }).code === 'string') {
    const pgMapping = mapPostgresError((err as { code: string }).code);
    if (pgMapping) {
      statusCode = pgMapping.statusCode;
      errorCode = pgMapping.code;
      message = pgMapping.message;
    }
  }

  // Handle generic error message sanitization in production for 500 errors
  const isProduction = (process.env['NODE_ENV'] || env.NODE_ENV) === 'production';
  if (isProduction && statusCode >= 500) {
    message = 'Terjadi kesalahan internal pada server';
    details = null;
  } else if (statusCode >= 500 && !(err instanceof AppError)) {
    // In dev / test, preserve original message for developer clarity if not an AppError
    message = (err as Error).message || message;
  }

  // Structured Logging
  if (statusCode >= 500) {
    logger.error(
      {
        requestId,
        err,
        statusCode,
        code: errorCode,
      },
      `[SERVER_EXCEPTION] ${message}`
    );
  } else {
    logger.warn(
      {
        requestId,
        statusCode,
        code: errorCode,
        message,
        details,
      },
      `[CLIENT_ERROR] ${message}`
    );
  }

  // Standard JSON Response Envelope
  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message,
      details,
      requestId,
    },
  });
}
