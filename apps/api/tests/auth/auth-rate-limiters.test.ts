import { describe, it, expect } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { createAuthRouter } from '../../src/modules/auth/auth.router.js';
import { createRateLimiter } from '../../src/middlewares/rate-limiter.middleware.js';
import { requestIdMiddleware } from '../../src/middlewares/request-id.middleware.js';
import { globalErrorHandler } from '../../src/middlewares/error-handler.middleware.js';

function createTestAuthApp(limiters: Parameters<typeof createAuthRouter>[0]): Express {
  const testApp = express();
  testApp.use(requestIdMiddleware);
  testApp.use(express.json());
  testApp.use(cookieParser());

  const router = createAuthRouter(limiters);
  testApp.use('/api/v1/auth', router);
  testApp.use(globalErrorHandler);

  return testApp;
}

describe('Auth Rate Limiters Enforce HTTP 429', () => {
  it('POST /api/v1/auth/login should enforce rate limit and return 429 TOO_MANY_REQUESTS with Retry-After header', async () => {
    const loginLimiter = createRateLimiter({
      windowMs: 60 * 1000,
      max: 2,
      keyGenerator: (req) => `${req.ip}_${req.body?.email || ''}`,
      message: 'Terlalu banyak percobaan login gagal untuk akun ini. Silakan coba lagi nanti.',
    });

    const testApp = createTestAuthApp({ loginLimiter });

    // Request 1: Passes rate limiter
    const res1 = await request(testApp)
      .post('/api/v1/auth/login')
      .send({ email: 'rate_test@wallet.local', password: 'InvalidPassword123!' });
    expect(res1.status).not.toBe(429);

    // Request 2: Passes rate limiter
    const res2 = await request(testApp)
      .post('/api/v1/auth/login')
      .send({ email: 'rate_test@wallet.local', password: 'InvalidPassword123!' });
    expect(res2.status).not.toBe(429);

    // Request 3: Blocked by rate limiter with 429
    const res3 = await request(testApp)
      .post('/api/v1/auth/login')
      .send({ email: 'rate_test@wallet.local', password: 'InvalidPassword123!' });

    expect(res3.status).toBe(429);
    expect(res3.body.success).toBe(false);
    expect(res3.body.error.code).toBe('TOO_MANY_REQUESTS');
    expect(res3.body.error.message).toContain('Terlalu banyak percobaan login');
    expect(res3.headers['retry-after']).toBeDefined();
    expect(Number(res3.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('POST /api/v1/auth/forgot-password should enforce rate limit and return 429 TOO_MANY_REQUESTS with Retry-After header', async () => {
    const forgotPasswordLimiter = createRateLimiter({
      windowMs: 60 * 1000,
      max: 2,
      message: 'Terlalu banyak permintaan pemulihan kata sandi. Silakan coba lagi nanti.',
    });

    const testApp = createTestAuthApp({ forgotPasswordLimiter });

    // Request 1: Passes rate limiter
    const res1 = await request(testApp)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'forgot_rate@wallet.local' });
    expect(res1.status).not.toBe(429);

    // Request 2: Passes rate limiter
    const res2 = await request(testApp)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'forgot_rate@wallet.local' });
    expect(res2.status).not.toBe(429);

    // Request 3: Blocked by rate limiter with 429
    const res3 = await request(testApp)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'forgot_rate@wallet.local' });

    expect(res3.status).toBe(429);
    expect(res3.body.success).toBe(false);
    expect(res3.body.error.code).toBe('TOO_MANY_REQUESTS');
    expect(res3.body.error.message).toContain('Terlalu banyak permintaan pemulihan kata sandi');
    expect(res3.headers['retry-after']).toBeDefined();
    expect(Number(res3.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('POST /api/v1/auth/refresh should enforce rate limit and return 429 TOO_MANY_REQUESTS with Retry-After header', async () => {
    const refreshLimiter = createRateLimiter({
      windowMs: 60 * 1000,
      max: 2,
      message: 'Terlalu banyak permintaan refresh token. Silakan coba lagi nanti.',
    });

    const testApp = createTestAuthApp({ refreshLimiter });

    // Note: /auth/refresh requires CSRF header (X-Requested-With)
    // Request 1: Passes rate limiter
    const res1 = await request(testApp)
      .post('/api/v1/auth/refresh')
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ['refreshToken=dummy_token_1']);
    expect(res1.status).not.toBe(429);

    // Request 2: Passes rate limiter
    const res2 = await request(testApp)
      .post('/api/v1/auth/refresh')
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ['refreshToken=dummy_token_2']);
    expect(res2.status).not.toBe(429);

    // Request 3: Blocked by rate limiter with 429
    const res3 = await request(testApp)
      .post('/api/v1/auth/refresh')
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ['refreshToken=dummy_token_3']);

    expect(res3.status).toBe(429);
    expect(res3.body.success).toBe(false);
    expect(res3.body.error.code).toBe('TOO_MANY_REQUESTS');
    expect(res3.body.error.message).toContain('Terlalu banyak permintaan refresh token');
    expect(res3.headers['retry-after']).toBeDefined();
    expect(Number(res3.headers['retry-after'])).toBeGreaterThan(0);
  });
});
