import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';

describe('Security Headers (Helmet) & CORS Whitelist Policy', () => {
  it('should include Helmet security headers on HTTP responses', async () => {
    const res = await request(app).get('/health');

    expect(res.headers).toHaveProperty('x-content-type-options', 'nosniff');
    expect(res.headers).toHaveProperty('x-frame-options');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('should allow requests from whitelisted origin with credentials and expose X-Request-Id', async () => {
    const res = await request(app).get('/health').set('Origin', 'http://localhost:5173');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('should correctly handle CORS preflight OPTIONS request for allowed origin', async () => {
    const res = await request(app)
      .options('/health')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Content-Type,Authorization');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-allow-methods']).toContain('POST');
  });

  it('should reject requests from unauthorized origins with HTTP 403 ORIGIN_NOT_ALLOWED', async () => {
    const res = await request(app)
      .get('/health')
      .set('Origin', 'http://malicious-site.example.com');

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('ORIGIN_NOT_ALLOWED');
    expect(res.body.error.message).toContain('tidak diizinkan oleh kebijakan CORS');
  });
});
