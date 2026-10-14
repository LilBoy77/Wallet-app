import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { SHARED_API_VERSION } from '@wallet-app/shared';
import * as dbModule from '../src/database/index.js';

describe('Health Endpoints (/health and /health/ready)', () => {
  it('GET /health: should return 200 with liveness payload', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: {
        status: 'ok',
        timestamp: expect.any(String),
        service: '@wallet-app/api',
        version: SHARED_API_VERSION,
      },
      message: 'Service is alive',
    });
    expect(res.headers).toHaveProperty('x-request-id');
  });

  it('GET /health/ready: should return 200 when database is healthy', async () => {
    const res = await request(app).get('/health/ready');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      status: 'ok',
      service: '@wallet-app/api',
      version: SHARED_API_VERSION,
      database: {
        status: 'connected',
      },
    });
    expect(typeof res.body.data.database.latencyMs).toBe('number');

    // Never leak credentials or internal URLs
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('postgresql://');
    expect(raw).not.toContain('password');
    expect(raw).not.toContain('change_me');
  });

  it('GET /health/ready: should return 503 when database is unreachable without leaking details', async () => {
    // Mock checkDatabaseHealth to simulate DB outage
    const spy = vi.spyOn(dbModule, 'checkDatabaseHealth').mockResolvedValueOnce({
      connected: false,
      latencyMs: 150,
    });

    const res = await request(app).get('/health/ready');

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.data.status).toBe('degraded');
    expect(res.body.data.database.status).toBe('disconnected');
    expect(res.body.message).toContain('Service degraded');

    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('postgresql://');
    expect(raw).not.toContain('password');

    spy.mockRestore();
  });
});
