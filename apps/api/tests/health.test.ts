import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { SHARED_API_VERSION } from '@wallet-app/shared';

describe('API Health Check Endpoint (GET /health)', () => {
  it('should return HTTP 200 with standard health check payload', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toMatchObject({
      status: 'ok',
      service: '@wallet-app/api',
      version: SHARED_API_VERSION,
    });
    expect(response.body.data).toHaveProperty('timestamp');
    expect(response.body.data).toHaveProperty('database');
    expect(response.body.data.database).toMatchObject({
      status: 'connected',
    });
    expect(typeof response.body.data.database.latencyMs).toBe('number');

    // Prove that no credentials, passwords, or connection URLs leak in the payload
    const rawBodyString = JSON.stringify(response.body);
    expect(rawBodyString).not.toContain('change_me');
    expect(rawBodyString).not.toContain('postgresql://');
    expect(rawBodyString).not.toContain('postgres:');
  });
});
