import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createRateLimiter } from '../../src/middlewares/rate-limiter.middleware.js';
import { requestIdMiddleware } from '../../src/middlewares/request-id.middleware.js';
import { globalErrorHandler } from '../../src/middlewares/error-handler.middleware.js';

describe('Rate Limiter Middleware & Factory (429 Envelope)', () => {
  it('should enforce limit and return HTTP 429 with standard envelope and Retry-After header', async () => {
    const testApp = express();
    testApp.use(requestIdMiddleware);

    // Limit to exactly 2 requests per window
    const strictLimiter = createRateLimiter({
      windowMs: 60000,
      max: 2,
      message: 'Ambang batas request terlampaui',
    });

    testApp.use('/test/limited', strictLimiter, (_req, res) => {
      res.json({ success: true });
    });
    testApp.use(globalErrorHandler);

    // 1st request: OK
    const res1 = await request(testApp).get('/test/limited');
    expect(res1.status).toBe(200);

    // 2nd request: OK
    const res2 = await request(testApp).get('/test/limited');
    expect(res2.status).toBe(200);

    // 3rd request: BLOCKED with 429
    const res3 = await request(testApp).get('/test/limited');
    expect(res3.status).toBe(429);
    expect(res3.body).toMatchObject({
      success: false,
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Ambang batas request terlampaui',
        details: null,
      },
    });
    expect(res3.headers).toHaveProperty('retry-after');
    expect(Number(res3.headers['retry-after'])).toBeGreaterThan(0);
    expect(res3.body.error).toHaveProperty('requestId');
  });
});
