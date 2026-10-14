import { describe, it, expect } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { z } from 'zod';
import {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  PayloadTooLargeError,
  TooManyRequestsError,
  InternalServerError,
  asyncHandler,
} from '../../src/shared/errors/index.js';
import {
  globalErrorHandler,
  notFoundHandler,
  requestIdMiddleware,
  validate,
} from '../../src/middlewares/index.js';

function createTestErrorApp(): Express {
  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json({ limit: '50b' })); // Small limit to easily test 413

  // Test routes throwing various errors
  app.get('/test/app-error', () => {
    throw new AppError(
      'Custom app error occurred',
      418,
      'I_AM_A_TEAPOT' as unknown as import('../../src/shared/errors/index.js').ErrorCode,
      { foo: 'bar' }
    );
  });

  app.get('/test/validation-error', () => {
    throw new ValidationError('Validation failed', [
      { field: 'email', message: 'Email tidak valid' },
    ]);
  });

  app.get('/test/unauthorized', () => {
    throw new UnauthorizedError('Token expired');
  });

  app.get('/test/forbidden', () => {
    throw new ForbiddenError('Access forbidden');
  });

  app.get('/test/not-found', () => {
    throw new NotFoundError('User not found');
  });

  app.get('/test/conflict', () => {
    throw new ConflictError('Username already exists');
  });

  app.get('/test/payload-too-large', () => {
    throw new PayloadTooLargeError('File size exceeds 2MB limit');
  });

  app.get('/test/too-many-requests', () => {
    throw new TooManyRequestsError('Rate limit exceeded', 60);
  });

  app.get('/test/internal-server-error', () => {
    throw new InternalServerError('Database failure');
  });

  app.get('/test/unexpected-crash', () => {
    throw new Error('Unexpected raw system error');
  });

  app.get(
    '/test/async-error',
    asyncHandler(async () => {
      await Promise.resolve();
      throw new Error('Async unhandled error');
    })
  );

  // Route with Zod validator middleware
  const bodySchema = z.object({
    amount: z.number().positive('Nominal harus lebih besar dari 0'),
    target: z.string().min(3, 'Target minimal 3 karakter'),
  });

  app.post('/test/zod-validate', validate({ body: bodySchema }), (_req, res) => {
    res.json({ success: true });
  });

  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  return app;
}

describe('Error Model & Global Error Handler Mapping', () => {
  const testApp = createTestErrorApp();

  it('should map custom AppError to HTTP status and standard envelope', async () => {
    const res = await request(testApp).get('/test/app-error');

    expect(res.status).toBe(418);
    expect(res.body).toMatchObject({
      success: false,
      error: {
        code: 'I_AM_A_TEAPOT',
        message: 'Custom app error occurred',
        details: { foo: 'bar' },
      },
    });
    expect(res.body.error).toHaveProperty('requestId');
  });

  it('should map ValidationError to HTTP 422 with field details', async () => {
    const res = await request(testApp).get('/test/validation-error');

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: [{ field: 'email', message: 'Email tidak valid' }],
      },
    });
  });

  it('should map UnauthorizedError to HTTP 401', async () => {
    const res = await request(testApp).get('/test/unauthorized');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('should map ForbiddenError to HTTP 403', async () => {
    const res = await request(testApp).get('/test/forbidden');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('should map NotFoundError to HTTP 404', async () => {
    const res = await request(testApp).get('/test/not-found');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('should map ConflictError to HTTP 409', async () => {
    const res = await request(testApp).get('/test/conflict');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('should map PayloadTooLargeError to HTTP 413', async () => {
    const res = await request(testApp).get('/test/payload-too-large');
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('should map TooManyRequestsError to HTTP 429', async () => {
    const res = await request(testApp).get('/test/too-many-requests');
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('TOO_MANY_REQUESTS');
  });

  it('should map Zod schema validation failures to HTTP 422 with structured field details', async () => {
    const res = await request(testApp)
      .post('/test/zod-validate')
      .send({ amount: -50, target: 'a' });

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Input yang diberikan tidak valid',
        details: [
          { field: 'amount', message: 'Nominal harus lebih besar dari 0' },
          { field: 'target', message: 'Target minimal 3 karakter' },
        ],
      },
    });
  });

  it('should return 400 for malformed JSON request bodies', async () => {
    const res = await request(testApp)
      .post('/test/zod-validate')
      .set('Content-Type', 'application/json')
      .send('{"invalid_json": true,');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
    expect(res.body.error.message).toContain('Format JSON');
  });

  it('should return 413 when payload exceeds body size limit', async () => {
    // Our testApp has 50b limit
    const largePayload = { data: 'A'.repeat(150) };
    const res = await request(testApp).post('/test/zod-validate').send(largePayload);

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('should return 404 with standard envelope for undefined routes', async () => {
    const res = await request(testApp).get('/api/v1/unknown-route-path');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: "Rute 'GET /api/v1/unknown-route-path' tidak ditemukan",
      },
    });
    expect(res.body.error).toHaveProperty('requestId');
  });

  it('should catch unhandled errors from asyncHandler and return 500', async () => {
    const res = await request(testApp).get('/test/async-error');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
  });

  it('in production mode: should sanitize 500 responses without leaking stack trace or system messages', async () => {
    const originalEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';

    try {
      const res = await request(testApp).get('/test/unexpected-crash');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Terjadi kesalahan internal pada server',
          details: null,
          requestId: expect.any(String),
        },
      });

      const bodyStr = JSON.stringify(res.body);
      expect(bodyStr).not.toContain('stack');
      expect(bodyStr).not.toContain('Unexpected raw system error');
    } finally {
      process.env['NODE_ENV'] = originalEnv;
    }
  });
});
