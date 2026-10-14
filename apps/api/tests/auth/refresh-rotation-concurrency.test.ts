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

describe('Auth Module - Refresh Token Rotation, Reuse Detection & Concurrency', () => {
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

  it('should successfully rotate refresh token, return new access token, and mark old token revoked', async () => {
    // 1. Register & Login
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: 'refresh_user',
        email: 'refresh@wallet.local',
        password: 'ValidPassword123!',
        full_name: 'Refresh User',
      })
      .expect(201);

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'refresh@wallet.local', password: 'ValidPassword123!' })
      .expect(200);

    const initialToken = extractRefreshTokenFromCookies(loginRes.headers['set-cookie']);

    // 2. Perform token refresh with custom CSRF header
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refreshToken=${initialToken}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .expect(200);

    expect(refreshRes.body.success).toBe(true);
    expect(refreshRes.body.data.tokens.access_token).toBeDefined();

    const rotatedToken = extractRefreshTokenFromCookies(refreshRes.headers['set-cookie']);
    expect(rotatedToken).not.toBe(initialToken);

    // Verify database state: old token must be revoked, new token active
    const pool = getTestPool();
    const oldHash = hashSha256(initialToken);
    const newHash = hashSha256(rotatedToken);

    const oldTokenDb = await pool.query('SELECT * FROM refresh_tokens WHERE token_hash = $1', [
      oldHash,
    ]);
    const newTokenDb = await pool.query('SELECT * FROM refresh_tokens WHERE token_hash = $1', [
      newHash,
    ]);

    expect(oldTokenDb.rows[0].is_revoked).toBe(true);
    expect(newTokenDb.rows[0].is_revoked).toBe(false);
    expect(oldTokenDb.rows[0].family_id).toBe(newTokenDb.rows[0].family_id);

    // Verify raw tokens NEVER appear in database
    const rawScan = await pool.query(
      'SELECT COUNT(*) FROM refresh_tokens WHERE token_hash = $1 OR token_hash = $2',
      [initialToken, rotatedToken]
    );
    expect(Number(rawScan.rows[0].count)).toBe(0);
  });

  it('should detect token reuse: attempting to use old revoked token revokes entire session family', async () => {
    // 1. Register & Login
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: 'reuse_victim',
        email: 'reuse@wallet.local',
        password: 'ValidPassword123!',
        full_name: 'Reuse Victim',
      })
      .expect(201);

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'reuse@wallet.local', password: 'ValidPassword123!' })
      .expect(200);

    const token1 = extractRefreshTokenFromCookies(loginRes.headers['set-cookie']);

    // 2. Legitimate refresh: token1 -> token2
    const refreshRes1 = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refreshToken=${token1}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .expect(200);

    const token2 = extractRefreshTokenFromCookies(refreshRes1.headers['set-cookie']);

    // 3. Attacker replays token1 (already rotated/revoked)
    const attackRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refreshToken=${token1}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .expect(401);

    expect(attackRes.body.error.code).toBe('UNAUTHORIZED');
    expect(attackRes.body.error.message).toContain('Penyalahgunaan token terdeteksi');

    // 4. Verify that session family was revoked: token2 should now ALSO be revoked!
    const pool = getTestPool();
    const token2Db = await pool.query('SELECT * FROM refresh_tokens WHERE token_hash = $1', [
      hashSha256(token2),
    ]);
    expect(token2Db.rows[0].is_revoked).toBe(true);

    // 5. Legitimate client attempting to use token2 is now rejected
    await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refreshToken=${token2}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .expect(401);
  });

  it('should reject expired refresh tokens with 401 UNAUTHORIZED', async () => {
    // 1. Register & Login
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: 'expired_user',
        email: 'expired@wallet.local',
        password: 'ValidPassword123!',
        full_name: 'Expired User',
      })
      .expect(201);

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'expired@wallet.local', password: 'ValidPassword123!' })
      .expect(200);

    const token = extractRefreshTokenFromCookies(loginRes.headers['set-cookie']);

    // Expire token in database
    const pool = getTestPool();
    await pool.query(
      `UPDATE refresh_tokens SET expires_at = NOW() - INTERVAL '1 hour' WHERE token_hash = $1`,
      [hashSha256(token)]
    );

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refreshToken=${token}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .expect(401);

    expect(res.body.error.message).toContain('kedaluwarsa');
  });

  it('should handle race condition: when two concurrent refresh requests use same token, exactly one succeeds', async () => {
    // 1. Setup user & session
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: 'race_user',
        email: 'race@wallet.local',
        password: 'ValidPassword123!',
        full_name: 'Race User',
      })
      .expect(201);

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'race@wallet.local', password: 'ValidPassword123!' })
      .expect(200);

    const sharedToken = extractRefreshTokenFromCookies(loginRes.headers['set-cookie']);

    // 2. Fire two simultaneous refresh requests in parallel
    const [res1, res2] = await Promise.all([
      request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', `refreshToken=${sharedToken}`)
        .set('X-Requested-With', 'XMLHttpRequest'),
      request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', `refreshToken=${sharedToken}`)
        .set('X-Requested-With', 'XMLHttpRequest'),
    ]);

    const statuses = [res1.status, res2.status].sort();

    // Critical assertion: EXACTLY ONE succeeded (200), and the other failed (401)
    expect(statuses).toEqual([200, 401]);
  });
});
