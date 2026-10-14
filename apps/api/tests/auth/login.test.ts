import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import {
  setupTestDatabase,
  closeTestDatabase,
  cleanTestTables,
  getTestPool,
} from '../database/test-db-helper.js';
import { runSeeder } from '../../src/database/seeder.js';
import { createRateLimiter } from '../../src/middlewares/rate-limiter.middleware.js';
import express from 'express';
import { authService } from '../../src/modules/auth/auth.service.js';

describe('Auth Module - Login (/api/v1/auth/login)', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanTestTables();
  });

  it('should successfully login an existing user and set HttpOnly refresh cookie', async () => {
    // 1. Register a user first
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: 'login_tester',
        email: 'tester@wallet.local',
        password: 'ValidPassword123!',
        full_name: 'Login Tester',
      })
      .expect(201);

    // 2. Perform login
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'tester@wallet.local',
        password: 'ValidPassword123!',
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Login berhasil');
    expect(res.body.data.user.email).toBe('tester@wallet.local');
    expect(res.body.data.tokens.access_token).toBeDefined();
    expect(res.body.data.tokens.token_type).toBe('Bearer');
    expect(res.body.data.tokens.expires_in).toBe(900);

    // Verify Set-Cookie header for refresh token
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const cookieHeader = Array.isArray(cookies) ? cookies.join('; ') : String(cookies);
    expect(cookieHeader).toContain('refreshToken=');
    expect(cookieHeader.toLowerCase()).toContain('httponly');
    expect(cookieHeader.toLowerCase()).toContain('path=/api/v1/auth');
    expect(cookieHeader.toLowerCase()).toContain('samesite=lax');

    // Verify Cache-Control: no-store
    expect(res.headers['cache-control']).toBe('no-store');

    // Verify database only stores token hash, not raw token
    const pool = getTestPool();
    const dbTokens = await pool.query('SELECT * FROM refresh_tokens WHERE user_id = $1', [
      res.body.data.user.id,
    ]);
    expect(dbTokens.rows.length).toBe(1);
    expect(dbTokens.rows[0].token_hash).toHaveLength(64); // SHA-256 hex string length
    expect(cookieHeader).not.toContain(dbTokens.rows[0].token_hash); // Raw token is NOT the hash
  });

  it('should return identical generic error messages for nonexistent email and wrong password', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: 'existing_user',
        email: 'existing@wallet.local',
        password: 'RealPassword123!',
        full_name: 'Existing User',
      })
      .expect(201);

    // Skenario A: Email ada, password salah
    const resWrongPass = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'existing@wallet.local',
        password: 'WrongPassword999!',
      })
      .expect(401);

    // Skenario B: Email tidak terdaftar
    const resNoEmail = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'notfound@wallet.local',
        password: 'RandomPassword999!',
      })
      .expect(401);

    // Assert: status, code, dan message IDENTIK untuk mencegah user enumeration
    expect(resWrongPass.body.error.code).toBe('UNAUTHORIZED');
    expect(resNoEmail.body.error.code).toBe('UNAUTHORIZED');
    expect(resWrongPass.body.error.message).toBe(resNoEmail.body.error.message);
    expect(resWrongPass.body.error.message).toBe('Email atau kata sandi tidak valid');
  });

  it('should reject login for soft-deleted and deactivated users with 401 UNAUTHORIZED', async () => {
    const pool = getTestPool();

    const validHash = await authService.hashPassword('AnyPassword123!');

    // 1. Soft-deleted user
    await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name, role, is_active, deleted_at)
       VALUES ('deleted_user', 'deleted@wallet.local', $1, 'Deleted User', 'user', true, NOW())`,
      [validHash]
    );

    const resDeleted = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'deleted@wallet.local', password: 'AnyPassword123!' })
      .expect(401);

    expect(resDeleted.body.error.code).toBe('UNAUTHORIZED');

    // 2. Deactivated user (is_active = false)
    await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name, role, is_active, deleted_at)
       VALUES ('inactive_user', 'inactive@wallet.local', $1, 'Inactive User', 'user', false, null)`,
      [validHash]
    );

    const resInactive = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'inactive@wallet.local', password: 'AnyPassword123!' })
      .expect(401);

    expect(resInactive.body.error.code).toBe('UNAUTHORIZED');
  });

  it('should authenticate development seed users and automatically upgrade bcrypt hash to argon2id', async () => {
    // Run deterministic seeder on test DB
    const pool = getTestPool();
    await runSeeder({ connectionString: pool.options.connectionString });

    // 1. Verify admin seed login
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@walletapp.local', password: 'Admin123!' })
      .expect(200);

    expect(adminRes.body.data.user.role).toBe('admin');

    // Check that admin password hash in DB was upgraded from bcrypt ($2a$) to argon2id ($argon2id$)
    const adminDb = await pool.query('SELECT password_hash FROM users WHERE email = $1', [
      'admin@walletapp.local',
    ]);
    expect(adminDb.rows[0].password_hash).toMatch(/^\$argon2id\$/);

    // 2. Verify normal user seed login
    const userRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'user01@walletapp.local', password: 'User123!' })
      .expect(200);

    expect(userRes.body.data.user.role).toBe('user');

    // 3. User 19 (seeded as soft-deleted) must be rejected
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'user19@walletapp.local', password: 'User123!' })
      .expect(401);
  });

  it('should hit rate limiter and return 429 TOO_MANY_REQUESTS with Retry-After header', async () => {
    const testApp = express();
    testApp.use(express.json());

    // Custom tight limiter for testing rate limit enforcement
    const tightLimiter = createRateLimiter({
      windowMs: 60 * 1000,
      max: 2,
      message: 'Rate limit exceeded for testing',
    });

    testApp.post('/test-limit', tightLimiter, (_req, res) => {
      res.status(200).json({ success: true });
    });

    // Request 1: OK
    await request(testApp).post('/test-limit').send({}).expect(200);
    // Request 2: OK
    await request(testApp).post('/test-limit').send({}).expect(200);
    // Request 3: Blocked (429)
    const res = await request(testApp).post('/test-limit').send({}).expect(429);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('TOO_MANY_REQUESTS');
    expect(res.headers['retry-after']).toBeDefined();
  });
});
