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

describe('Auth Module - JWT Access Token Verification & Real-time DB Checks', () => {
  let validUserId: string;

  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanTestTables();

    // Create an active test user
    const pool = getTestPool();
    const res = await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name, role, is_active)
       VALUES ('jwt_tester', 'jwt@wallet.local', '$argon2id$mock', 'JWT Tester', 'user', true)
       RETURNING id`
    );
    validUserId = res.rows[0].id;
  });

  it('should accept a valid pinned HS256 JWT with correct issuer and audience', async () => {
    const token = jwt.sign(
      { sub: validUserId, role: 'user', email: 'jwt@wallet.local', jti: 'test-jti' },
      env.JWT_ACCESS_SECRET,
      { algorithm: 'HS256', expiresIn: '15m', issuer: env.JWT_ISSUER, audience: env.JWT_AUDIENCE }
    );

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(validUserId);
    expect(res.body.data.username).toBe('jwt_tester');
  });

  it('should reject missing or non-Bearer authorization header with 401 UNAUTHORIZED', async () => {
    // Missing
    await request(app).get('/api/v1/auth/me').expect(401);

    // Basic format instead of Bearer
    await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Basic dXNlcjpwYXNz')
      .expect(401);
  });

  it('should reject expired JWT token with 401 UNAUTHORIZED', async () => {
    const expiredToken = jwt.sign(
      { sub: validUserId, role: 'user', email: 'jwt@wallet.local', jti: 'expired-jti' },
      env.JWT_ACCESS_SECRET,
      { algorithm: 'HS256', expiresIn: '-1s', issuer: env.JWT_ISSUER, audience: env.JWT_AUDIENCE }
    );

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(401);

    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(res.body.error.message).toContain('kedaluwarsa');
  });

  it('should reject JWT signed with invalid secret with 401 UNAUTHORIZED', async () => {
    const forgedToken = jwt.sign(
      { sub: validUserId, role: 'user', email: 'jwt@wallet.local', jti: 'forged-jti' },
      'wrong_fake_secret_key_at_least_32_characters_long_for_test',
      { algorithm: 'HS256', expiresIn: '15m', issuer: env.JWT_ISSUER, audience: env.JWT_AUDIENCE }
    );

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${forgedToken}`)
      .expect(401);

    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(res.body.error.message).toContain('tidak valid atau tanda tangan rusak');
  });

  it('should reject JWT with algorithm "none" with 401 UNAUTHORIZED', async () => {
    // Unsecured token (header {"alg": "none"})
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        sub: validUserId,
        role: 'user',
        email: 'jwt@wallet.local',
        iss: env.JWT_ISSUER,
        aud: env.JWT_AUDIENCE,
      })
    ).toString('base64url');
    const noneToken = `${header}.${payload}.`;

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${noneToken}`)
      .expect(401);

    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('should reject JWT with algorithm mismatch (pinned HS256 enforcement)', async () => {
    // Attempt signing with HS384 instead of pinned HS256
    const hs384Token = jwt.sign(
      { sub: validUserId, role: 'user', email: 'jwt@wallet.local', jti: 'hs384-jti' },
      env.JWT_ACCESS_SECRET,
      { algorithm: 'HS384', expiresIn: '15m', issuer: env.JWT_ISSUER, audience: env.JWT_AUDIENCE }
    );

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${hs384Token}`)
      .expect(401);

    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('should reject JWT with invalid issuer or audience', async () => {
    // Wrong issuer
    const wrongIssuerToken = jwt.sign(
      { sub: validUserId, role: 'user', email: 'jwt@wallet.local', jti: 'test-jti' },
      env.JWT_ACCESS_SECRET,
      {
        algorithm: 'HS256',
        expiresIn: '15m',
        issuer: 'attacker-issuer',
        audience: env.JWT_AUDIENCE,
      }
    );

    await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${wrongIssuerToken}`)
      .expect(401);

    // Wrong audience
    const wrongAudienceToken = jwt.sign(
      { sub: validUserId, role: 'user', email: 'jwt@wallet.local', jti: 'test-jti' },
      env.JWT_ACCESS_SECRET,
      { algorithm: 'HS256', expiresIn: '15m', issuer: env.JWT_ISSUER, audience: 'wrong-audience' }
    );

    await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${wrongAudienceToken}`)
      .expect(401);
  });

  it('should immediately reject request if user was deactivated or soft-deleted in DB despite holding valid token', async () => {
    const validToken = jwt.sign(
      { sub: validUserId, role: 'user', email: 'jwt@wallet.local', jti: 'test-jti' },
      env.JWT_ACCESS_SECRET,
      { algorithm: 'HS256', expiresIn: '15m', issuer: env.JWT_ISSUER, audience: env.JWT_AUDIENCE }
    );

    // 1. Deactivate user in DB
    const pool = getTestPool();
    await pool.query('UPDATE users SET is_active = false WHERE id = $1', [validUserId]);

    const resInactive = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${validToken}`)
      .expect(401);

    expect(resInactive.body.error.message).toContain('dinonaktifkan');

    // 2. Reactivate and then soft-delete user
    await pool.query('UPDATE users SET is_active = true, deleted_at = NOW() WHERE id = $1', [
      validUserId,
    ]);

    const resDeleted = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${validToken}`)
      .expect(401);

    expect(resDeleted.body.error.message).toContain('telah dihapus');
  });
});
