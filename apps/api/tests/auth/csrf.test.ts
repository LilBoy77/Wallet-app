import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { setupTestDatabase, closeTestDatabase } from '../database/test-db-helper.js';

describe('Auth Module - CSRF Protection for Cookie Endpoints (/refresh, /logout)', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  it('should reject POST /auth/refresh when custom CSRF header is missing with 403 FORBIDDEN', async () => {
    // Missing X-Requested-With or Content-Type application/json
    const res = await request(app).post('/api/v1/auth/refresh').expect(403);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(res.body.error.message).toContain('Header proteksi CSRF');
  });

  it('should reject POST /auth/logout when custom CSRF header is missing with 403 FORBIDDEN', async () => {
    const res = await request(app).post('/api/v1/auth/logout').expect(403);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(res.body.error.message).toContain('Header proteksi CSRF');
  });

  it('should reject request when Origin is from unauthorized third-party site with 403 ORIGIN_NOT_ALLOWED', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Origin', 'http://malicious-phishing-site.example.com')
      .expect(403);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('ORIGIN_NOT_ALLOWED');
  });

  it('should reject request when Referer is from unauthorized site with 403 ORIGIN_NOT_ALLOWED', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Referer', 'http://malicious-phishing-site.example.com/attack')
      .expect(403);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('ORIGIN_NOT_ALLOWED');
  });

  it('should allow request through CSRF guard when whitelisted Origin and custom header are present', async () => {
    // When both Origin is whitelisted and custom header is provided, CSRF guard passes.
    // (It will then proceed to controller which checks for cookie)
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Origin', 'http://localhost:5173');

    // Should NOT be 403. Because cookie is missing, controller returns 401 UNAUTHORIZED
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
