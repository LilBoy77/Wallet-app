import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('API Error Handling & 404 Route Not Found', () => {
  it('should return 404 with standard envelope on undefined route', async () => {
    const response = await request(app).get('/api/v1/non-existent-route-404');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: "Rute 'GET /api/v1/non-existent-route-404' tidak ditemukan",
        details: null,
        requestId: expect.any(String),
      },
    });
  });
});
