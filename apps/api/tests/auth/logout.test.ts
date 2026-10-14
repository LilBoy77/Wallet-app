import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import {
  setupTestDatabase,
  closeTestDatabase,
  cleanTestTables,
  getTestPool,
} from '../database/test-db-helper.js';
import { hashSha256 } from '../../src/modules/auth/auth.service.js';

describe('Auth Module - Logout & Logout-All (/api/v1/auth/logout, /logout-all)', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanTestTables();
  });

  function extractRefreshTokenFromCookies(cookiesHeader: string[] | string | undefined): string {
    const raw = Array.isArray(cookiesHeader)
      ? cookiesHeader.join('; ')
      : String(cookiesHeader || '');
    const match = raw.match(/refreshToken=([^;]+)/);
    if (!match || !match[1]) {
      throw new Error('refreshToken cookie not found in response');
    }
    return match[1];
  }

  it('should logout single session: revoke refresh token in DB and clear client cookie', async () => {
    // 1. Register & Login
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: 'logout_user',
        email: 'logout@wallet.local',
        password: 'ValidPassword123!',
        full_name: 'Logout User',
      })
      .expect(201);

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'logout@wallet.local', password: 'ValidPassword123!' })
      .expect(200);

    const refreshToken = extractRefreshTokenFromCookies(loginRes.headers['set-cookie']);

    // 2. Call logout with cookie and custom CSRF header
    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', `refreshToken=${refreshToken}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .expect(200);

    expect(logoutRes.body.success).toBe(true);
    expect(logoutRes.body.message).toBe('Logout berhasil');

    // Verify cookie was cleared (Expires in past or empty)
    const clearCookieHeader = String(logoutRes.headers['set-cookie'] || '');
    expect(clearCookieHeader).toContain('refreshToken=;');

    // Verify database token was marked as revoked
    const pool = getTestPool();
    const tokenDb = await pool.query(
      'SELECT is_revoked FROM refresh_tokens WHERE token_hash = $1',
      [hashSha256(refreshToken)]
    );
    expect(tokenDb.rows[0].is_revoked).toBe(true);

    // 3. Attempting to refresh with the logged out token must fail
    await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refreshToken=${refreshToken}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .expect(401);
  });

  it('should logout-all: revoke all refresh tokens for user across all sessions/devices', async () => {
    // 1. Register user
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: 'multi_session_user',
        email: 'multisession@wallet.local',
        password: 'ValidPassword123!',
        full_name: 'Multi Session User',
      })
      .expect(201);

    // 2. Login session 1 (e.g. Chrome)
    const login1 = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'multisession@wallet.local', password: 'ValidPassword123!' })
      .expect(200);
    const tokenSession1 = extractRefreshTokenFromCookies(login1.headers['set-cookie']);
    const accessToken = login1.body.data.tokens.access_token;

    // 3. Login session 2 (e.g. Mobile)
    const login2 = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'multisession@wallet.local', password: 'ValidPassword123!' })
      .expect(200);
    const tokenSession2 = extractRefreshTokenFromCookies(login2.headers['set-cookie']);

    // Verify both tokens are active in DB
    const pool = getTestPool();
    const activeTokensBefore = await pool.query(
      'SELECT COUNT(*) FROM refresh_tokens WHERE user_id = $1 AND is_revoked = false',
      [login1.body.data.user.id]
    );
    expect(Number(activeTokensBefore.rows[0].count)).toBe(2);

    // 4. Call logout-all using Bearer token
    const logoutAllRes = await request(app)
      .post('/api/v1/auth/logout-all')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(logoutAllRes.body.success).toBe(true);
    expect(logoutAllRes.body.message).toContain('Seluruh sesi berhasil dicabut');

    // 5. Verify ALL tokens for user in DB are now revoked
    const activeTokensAfter = await pool.query(
      'SELECT COUNT(*) FROM refresh_tokens WHERE user_id = $1 AND is_revoked = false',
      [login1.body.data.user.id]
    );
    expect(Number(activeTokensAfter.rows[0].count)).toBe(0);

    // 6. Both sessions are now rejected on refresh
    await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refreshToken=${tokenSession1}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .expect(401);

    await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refreshToken=${tokenSession2}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .expect(401);
  });
});
