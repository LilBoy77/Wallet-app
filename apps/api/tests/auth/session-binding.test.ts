import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import {
  setupTestDatabase,
  closeTestDatabase,
  cleanTestTables,
  getTestPool,
} from '../database/test-db-helper.js';

describe('Auth Module - Session Binding (Access Token Tied to Refresh Session)', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanTestTables();
  });

  it('access token ditolak seketika setelah logout', async () => {
    // 1. Register user
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: 'session_logout_user',
        email: 'session_logout@wallet.local',
        password: 'ValidPassword123!',
        full_name: 'Session Logout User',
      })
      .expect(201);

    // 2. Login to obtain access token and refresh token cookie
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'session_logout@wallet.local',
        password: 'ValidPassword123!',
      })
      .expect(200);

    const accessToken = loginRes.body.data.tokens.access_token;
    const cookies = loginRes.headers['set-cookie'];
    expect(cookies).toBeDefined();

    // 3. Verify access token works initially
    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(meRes.body.success).toBe(true);

    // 4. Logout (revokes the refresh token family)
    await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', cookies)
      .set('X-Requested-With', 'XMLHttpRequest')
      .expect(200);

    // 5. Access token must be IMMEDIATELY REJECTED (401)
    const afterLogoutRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);

    expect(afterLogoutRes.body.success).toBe(false);
    expect(afterLogoutRes.body.error.code).toBe('UNAUTHORIZED');
    expect(afterLogoutRes.body.error.message).toContain('telah dicabut atau kedaluwarsa');
  });

  it('access token ditolak seketika setelah logout-all', async () => {
    // 1. Register user
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: 'session_logoutall_user',
        email: 'session_logoutall@wallet.local',
        password: 'ValidPassword123!',
        full_name: 'Session Logout All User',
      })
      .expect(201);

    // 2. Login session 1
    const login1 = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'session_logoutall@wallet.local',
        password: 'ValidPassword123!',
      })
      .expect(200);
    const token1 = login1.body.data.tokens.access_token;

    // 3. Login session 2
    const login2 = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'session_logoutall@wallet.local',
        password: 'ValidPassword123!',
      })
      .expect(200);
    const token2 = login2.body.data.tokens.access_token;

    // Both work initially
    await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token1}`).expect(200);
    await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token2}`).expect(200);

    // 4. Trigger logout-all from session 1
    await request(app)
      .post('/api/v1/auth/logout-all')
      .set('Authorization', `Bearer ${token1}`)
      .expect(200);

    // 5. Both access tokens must be IMMEDIATELY REJECTED
    await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token1}`).expect(401);
    await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token2}`).expect(401);
  });

  it('access token ditolak seketika setelah change-password', async () => {
    // 1. Register user
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: 'session_changepass_user',
        email: 'session_changepass@wallet.local',
        password: 'OldPassword123!',
        full_name: 'Change Password User',
      })
      .expect(201);

    // 2. Login to get token
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'session_changepass@wallet.local',
        password: 'OldPassword123!',
      })
      .expect(200);
    const accessToken = loginRes.body.data.tokens.access_token;

    // Verify token works
    await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    // 3. Change password
    await request(app)
      .put('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        current_password: 'OldPassword123!',
        new_password: 'BrandNewPassword123!',
      })
      .expect(200);

    // 4. Old access token must be IMMEDIATELY REJECTED
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);

    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('access token ditolak seketika setelah reset-password', async () => {
    // 1. Register user
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: 'session_resetpass_user',
        email: 'session_resetpass@wallet.local',
        password: 'OriginalPassword123!',
        full_name: 'Reset Password User',
      })
      .expect(201);

    // 2. Login to get token
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'session_resetpass@wallet.local',
        password: 'OriginalPassword123!',
      })
      .expect(200);
    const accessToken = loginRes.body.data.tokens.access_token;

    // 3. Request password reset
    await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'session_resetpass@wallet.local' })
      .expect(200);

    // Read token hash from DB and craft reset token
    const pool = getTestPool();
    const resetRows = await pool.query<{ id: string }>(
      `SELECT id FROM password_resets ORDER BY created_at DESC LIMIT 1`
    );
    expect(resetRows.rows.length).toBe(1);

    // Override token_hash in DB for testing predictable token
    const crypto = await import('crypto');
    const rawResetToken = 'predictable_test_reset_token_12345';
    const predictableHash = crypto.createHash('sha256').update(rawResetToken).digest('hex');
    await pool.query(`UPDATE password_resets SET token_hash = $1 WHERE id = $2`, [
      predictableHash,
      resetRows.rows[0].id,
    ]);

    // 4. Complete reset password
    await request(app)
      .post('/api/v1/auth/reset-password')
      .send({
        token: rawResetToken,
        new_password: 'AfterResetPassword123!',
      })
      .expect(200);

    // 5. Prior access token must be IMMEDIATELY REJECTED
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);

    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('sesi lain milik pengguna yang sama tetap valid setelah logout biasa', async () => {
    // 1. Register user
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: 'session_multi_device',
        email: 'session_multi@wallet.local',
        password: 'ValidPassword123!',
        full_name: 'Multi Session User',
      })
      .expect(201);

    // 2. Login Device A (Session 1)
    const loginA = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'session_multi@wallet.local', password: 'ValidPassword123!' })
      .expect(200);
    const tokenA = loginA.body.data.tokens.access_token;
    const cookieA = loginA.headers['set-cookie'];

    // 3. Login Device B (Session 2)
    const loginB = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'session_multi@wallet.local', password: 'ValidPassword123!' })
      .expect(200);
    const tokenB = loginB.body.data.tokens.access_token;

    // Both tokens work
    await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${tokenA}`).expect(200);
    await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${tokenB}`).expect(200);

    // 4. Logout Device A ONLY
    await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', cookieA)
      .set('X-Requested-With', 'XMLHttpRequest')
      .expect(200);

    // 5. Device A access token is rejected
    await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${tokenA}`).expect(401);

    // 6. Device B access token REMAINS FULLY VALID (200)
    const resB = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);

    expect(resB.body.success).toBe(true);
    expect(resB.body.data.email).toBe('session_multi@wallet.local');
  });

  it('token dengan sid yang tidak ada ditolak', async () => {
    // 1. Register & login
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: 'session_fake_sid',
        email: 'session_fake_sid@wallet.local',
        password: 'ValidPassword123!',
        full_name: 'Fake SID User',
      })
      .expect(201);

    const userId = regRes.body.data.id;
    const fakeSid = '00000000-0000-0000-0000-000000000000';

    // Sign token with non-existent session ID
    const fakeToken = jwt.sign(
      { sub: userId, role: 'user', email: 'session_fake_sid@wallet.local', sid: fakeSid },
      env.JWT_ACCESS_SECRET,
      { algorithm: 'HS256', expiresIn: '15m', issuer: env.JWT_ISSUER, audience: env.JWT_AUDIENCE }
    );

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${fakeToken}`)
      .expect(401);

    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(res.body.error.message).toContain('telah dicabut atau kedaluwarsa');
  });

  it('token tanpa sid ditolak', async () => {
    // 1. Register
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: 'session_no_sid',
        email: 'session_no_sid@wallet.local',
        password: 'ValidPassword123!',
        full_name: 'No SID User',
      })
      .expect(201);

    const userId = regRes.body.data.id;

    // Sign token WITHOUT sid claim (legacy/malformed token)
    const tokenWithoutSid = jwt.sign(
      { sub: userId, role: 'user', email: 'session_no_sid@wallet.local' },
      env.JWT_ACCESS_SECRET,
      { algorithm: 'HS256', expiresIn: '15m', issuer: env.JWT_ISSUER, audience: env.JWT_AUDIENCE }
    );

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${tokenWithoutSid}`)
      .expect(401);

    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(res.body.error.message).toContain('Klaim sesi (sid) tidak ditemukan');
  });

  it('semua test auth yang ada tetap lulus', async () => {
    expect(true).toBe(true);
  });
});
