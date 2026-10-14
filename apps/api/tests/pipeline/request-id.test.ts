import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { isValidRequestId } from '../../src/middlewares/request-id.middleware.js';

describe('Request ID Pipeline Middleware', () => {
  it('should generate a valid UUID v4 when incoming X-Request-Id is omitted', async () => {
    const res = await request(app).get('/health');

    const requestId = res.headers['x-request-id'];
    expect(requestId).toBeDefined();
    expect(typeof requestId).toBe('string');
    expect(isValidRequestId(requestId)).toBe(true);
  });

  it('should reuse valid incoming X-Request-Id header', async () => {
    const customValidId = '123e4567-e89b-42d3-a456-426614174000';
    const res = await request(app).get('/health').set('X-Request-Id', customValidId);

    expect(res.headers['x-request-id']).toBe(customValidId);
  });

  it('should reject invalid incoming X-Request-Id and generate a brand new valid UUID v4', async () => {
    const malformedId = 'invalid-not-a-uuid-12345';
    const res = await request(app).get('/health').set('X-Request-Id', malformedId);

    const resultingId = res.headers['x-request-id'];
    expect(resultingId).not.toBe(malformedId);
    expect(isValidRequestId(resultingId)).toBe(true);
  });

  it('should include the requestId in error response envelopes', async () => {
    const res = await request(app).get('/api/v1/non-existent-route-for-id');

    expect(res.status).toBe(404);
    expect(res.body.error).toHaveProperty('requestId');
    expect(res.body.error.requestId).toBe(res.headers['x-request-id']);
  });
});
