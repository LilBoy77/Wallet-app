import { ERROR_CODES, type ErrorCode } from './error-catalog.js';

export interface FieldErrorDetail {
  field: string;
  message: string;
}

/**
 * Base Application Error
 * All operational, controlled application errors extend this class.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code: ErrorCode = ERROR_CODES.INTERNAL_SERVER_ERROR,
    details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;

    // Capture standard stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 400 Bad Request
 */
export class BadRequestError extends AppError {
  constructor(message = 'Permintaan tidak valid', details?: unknown) {
    super(message, 400, ERROR_CODES.BAD_REQUEST, details);
  }
}

/**
 * 401 Unauthorized
 */
export class UnauthorizedError extends AppError {
  constructor(message = 'Kredensial atau token autentikasi tidak valid', details?: unknown) {
    super(message, 401, ERROR_CODES.UNAUTHORIZED, details);
  }
}

/**
 * 403 Forbidden
 */
export class ForbiddenError extends AppError {
  constructor(message = 'Akses ke sumber daya ini ditolak', details?: unknown) {
    super(message, 403, ERROR_CODES.FORBIDDEN, details);
  }
}

/**
 * 404 Not Found
 */
export class NotFoundError extends AppError {
  constructor(message = 'Sumber daya tidak ditemukan', details?: unknown) {
    super(message, 404, ERROR_CODES.NOT_FOUND, details);
  }
}

/**
 * 409 Conflict
 */
export class ConflictError extends AppError {
  constructor(message = 'Terjadi konflik data atau sumber daya sudah ada', details?: unknown) {
    super(message, 409, ERROR_CODES.CONFLICT, details);
  }
}

/**
 * 413 Payload Too Large
 */
export class PayloadTooLargeError extends AppError {
  constructor(
    message = 'Ukuran muatan request melebihi batas maksimal yang diizinkan',
    details?: unknown
  ) {
    super(message, 413, ERROR_CODES.PAYLOAD_TOO_LARGE, details);
  }
}

/**
 * 415 Unsupported Media Type
 */
export class UnsupportedMediaTypeError extends AppError {
  constructor(message = 'Format media atau berkas tidak didukung', details?: unknown) {
    super(message, 415, ERROR_CODES.UNSUPPORTED_MEDIA_TYPE, details);
  }
}

/**
 * 422 Validation Error (specifically for schema/input validation failures)
 */
export class ValidationError extends AppError {
  constructor(message = 'Validasi input gagal', details?: FieldErrorDetail[]) {
    super(message, 422, ERROR_CODES.VALIDATION_ERROR, details);
  }
}

/**
 * 422 Unprocessable Entity (business logic validation failures)
 */
export class UnprocessableEntityError extends AppError {
  constructor(message = 'Permintaan tidak dapat diproses', details?: unknown) {
    super(message, 422, ERROR_CODES.UNPROCESSABLE_ENTITY, details);
  }
}

/**
 * 429 Too Many Requests
 */
export class TooManyRequestsError extends AppError {
  public readonly retryAfterSeconds?: number;

  constructor(
    message = 'Terlalu banyak permintaan, silakan coba lagi nanti',
    retryAfterSeconds?: number,
    details?: unknown
  ) {
    super(message, 429, ERROR_CODES.TOO_MANY_REQUESTS, details);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * 500 Internal Server Error
 */
export class InternalServerError extends AppError {
  constructor(message = 'Terjadi kesalahan internal pada server', details?: unknown) {
    super(message, 500, ERROR_CODES.INTERNAL_SERVER_ERROR, details);
  }
}

/**
 * 503 Service Unavailable
 */
export class ServiceUnavailableError extends AppError {
  constructor(message = 'Layanan sementara tidak dapat diakses', details?: unknown) {
    super(message, 503, ERROR_CODES.SERVICE_UNAVAILABLE, details);
  }
}
