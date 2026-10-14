import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { app } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import {
  setupTestDatabase,
  closeTestDatabase,
  cleanTestTables,
  getTestPool,
} from '../database/test-db-helper.js';
import { hashSha256 } from '../../src/modules/auth/auth.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outboxDir = path.resolve(__dirname, '../../.outbox');

describe('Auth Module - Password Change, Forgot, and Reset', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanTestTables();
    // Clean outbox files before test
    if (fs.existsSync(outboxDir)) {
      const files = await fs.promises.readdir(outboxDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          await fs.promises.unlink(path.join(outboxDir, file));
        }
      }
    }
  });

  it('should change password with valid current password and revoke all active refresh tokens', async () => {
    // 1. Register & Login
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: 'change_pw_user',
        email: 'changepw@wallet.local',
        password: 'OldPassword123!',
        full_name: 'Change PW User',
      })
      .expect(201);

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'changepw@wallet.local', password: 'OldPassword123!' })
      .expect(200);

    const accessToken = loginRes.body.data.tokens.access_token;
    const userId = loginRes.body.data.user.id;

    // 2. Attempt change with WRONG current password -> 400
    const failRes = await request(app)
      .put('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        current_password: 'WrongCurrentPassword123!',
        new_password: 'NewStrongPassword123!',
      })
      .expect(400);

    expect(failRes.body.error.message).toContain('saat ini tidak sesuai');

    // 3. Change with CORRECT current password -> 200
    const successRes = await request(app)
      .put('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        current_password: 'OldPassword123!',
        new_password: 'NewStrongPassword123!',
      })
      .expect(200);

    expect(successRes.body.success).toBe(true);
    expect(successRes.body.message).toContain('berhasil diubah');

    // 4. Verify all active refresh tokens revoked in DB
    const pool = getTestPool();
    const activeTokens = await pool.query(
      'SELECT COUNT(*) FROM refresh_tokens WHERE user_id = $1 AND is_revoked = false',
      [userId]
    );
    expect(Number(activeTokens.rows[0].count)).toBe(0);

    // 5. Old password no longer works for login
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'changepw@wallet.local', password: 'OldPassword123!' })
      .expect(401);

    // 6. New password successfully logs in
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'changepw@wallet.local', password: 'NewStrongPassword123!' })
      .expect(200);
  });

  it('should return identical response on forgot-password for existing vs nonexistent email', async () => {
    // Register existing user
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: 'forgot_user',
        email: 'exist@wallet.local',
        password: 'Password123!',
        full_name: 'Forgot User',
      })
      .expect(201);

    // Request for existing email
    const resExist = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'exist@wallet.local' })
      .expect(200);

    // Request for nonexistent email
    const resNonExist = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'doesnotexist@wallet.local' })
      .expect(200);

    // Identical response prevents email enumeration
    expect(resExist.body.success).toBe(true);
    expect(resNonExist.body.success).toBe(true);
    expect(resExist.body.message).toBe(resNonExist.body.message);
    expect(resExist.body.message).toContain('Jika email terdaftar pada sistem kami');
  });

  it('should generate reset link using APP_BASE_URL (ignoring spoofed Host header) and store token as SHA-256 hash', async () => {
    // 1. Register user
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: 'host_header_user',
        email: 'hostuser@wallet.local',
        password: 'Password123!',
        full_name: 'Host User',
      })
      .expect(201);

    // 2. Request forgot-password with spoofed Host header
    await request(app)
      .post('/api/v1/auth/forgot-password')
      .set('Host', 'evil-phishing-host.attacker.com')
      .send({ email: 'hostuser@wallet.local' })
      .expect(200);

    // 3. Inspect outbox file
    const files = await fs.promises.readdir(outboxDir);
    const mailFiles = files.filter((f) => f.includes('to_hostuser_wallet_local'));
    expect(mailFiles.length).toBe(1);

    const emailContent = JSON.parse(
      await fs.promises.readFile(path.join(outboxDir, mailFiles[0]!), 'utf-8')
    );

    // Assert: reset URL MUST use env.APP_BASE_URL, and MUST NOT contain spoofed Host header
    expect(emailContent.text).toContain(env.APP_BASE_URL);
    expect(emailContent.text).not.toContain('evil-phishing-host.attacker.com');

    // Extract raw token from reset link
    const tokenMatch = emailContent.text.match(/token=([a-f0-9]+)/);
    expect(tokenMatch).not.toBeNull();
    const rawResetToken = tokenMatch![1];
    expect(rawResetToken.length).toBe(64); // 256-bit hex

    // 4. Verify database: raw token is NOT stored in password_resets, ONLY its SHA-256 hash
    const pool = getTestPool();
    const rawMatchInDb = await pool.query(
      'SELECT COUNT(*) FROM password_resets WHERE token_hash = $1',
      [rawResetToken]
    );
    expect(Number(rawMatchInDb.rows[0].count)).toBe(0);

    const hashMatchInDb = await pool.query(
      'SELECT COUNT(*) FROM password_resets WHERE token_hash = $1',
      [hashSha256(rawResetToken)]
    );
    expect(Number(hashMatchInDb.rows[0].count)).toBe(1);
  });

  it('should reset password with valid token, mark token used (single-use), and revoke existing sessions', async () => {
    // 1. Register & Login
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: 'reset_flow_user',
        email: 'resetflow@wallet.local',
        password: 'OriginalPassword123!',
        full_name: 'Reset Flow User',
      })
      .expect(201);

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'resetflow@wallet.local', password: 'OriginalPassword123!' })
      .expect(200);
    const userId = loginRes.body.data.user.id;

    // 2. Request forgot-password
    await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'resetflow@wallet.local' })
      .expect(200);

    const files = await fs.promises.readdir(outboxDir);
    const mailFile = files.find((f) => f.includes('to_resetflow_wallet_local'))!;
    const emailContent = JSON.parse(
      await fs.promises.readFile(path.join(outboxDir, mailFile), 'utf-8')
    );
    const rawResetToken = emailContent.text.match(/token=([a-f0-9]+)/)![1];

    // 3. Reset password successfully
    const resetRes = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({
        token: rawResetToken,
        new_password: 'NewlyResetPassword123!',
      })
      .expect(200);

    expect(resetRes.body.success).toBe(true);
    expect(resetRes.body.message).toContain('berhasil diperbarui');

    // 4. Token is single-use: Reusing the same token must fail with 400 BAD_REQUEST
    await request(app)
      .post('/api/v1/auth/reset-password')
      .send({
        token: rawResetToken,
        new_password: 'AnotherPassword123!',
      })
      .expect(400);

    // 5. Existing sessions were revoked upon reset
    const pool = getTestPool();
    const activeTokens = await pool.query(
      'SELECT COUNT(*) FROM refresh_tokens WHERE user_id = $1 AND is_revoked = false',
      [userId]
    );
    expect(Number(activeTokens.rows[0].count)).toBe(0);

    // 6. Login succeeds with new password and fails with original password
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'resetflow@wallet.local', password: 'OriginalPassword123!' })
      .expect(401);

    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'resetflow@wallet.local', password: 'NewlyResetPassword123!' })
      .expect(200);
  });

  it('should invalidate previous reset token when a new reset token is requested', async () => {
    // 1. Register
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: 'supersede_user',
        email: 'supersede@wallet.local',
        password: 'Password123!',
        full_name: 'Supersede User',
      })
      .expect(201);

    // 2. Request first token
    await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'supersede@wallet.local' })
      .expect(200);

    let files = await fs.promises.readdir(outboxDir);
    const file1 = files.find((f) => f.includes('to_supersede_wallet_local'))!;
    const content1 = JSON.parse(await fs.promises.readFile(path.join(outboxDir, file1), 'utf-8'));
    const token1 = content1.text.match(/token=([a-f0-9]+)/)![1];

    // Remove first mail file to isolate second mail file
    await fs.promises.unlink(path.join(outboxDir, file1));

    // 3. Request second token (superseding the first)
    await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'supersede@wallet.local' })
      .expect(200);

    files = await fs.promises.readdir(outboxDir);
    const file2 = files.find((f) => f.includes('to_supersede_wallet_local'))!;
    const content2 = JSON.parse(await fs.promises.readFile(path.join(outboxDir, file2), 'utf-8'));
    const token2 = content2.text.match(/token=([a-f0-9]+)/)![1];

    expect(token1).not.toBe(token2);

    // 4. First token is invalidated and must be rejected
    await request(app)
      .post('/api/v1/auth/reset-password')
      .send({
        token: token1,
        new_password: 'NewPassword123!',
      })
      .expect(400);

    // 5. Second token succeeds
    await request(app)
      .post('/api/v1/auth/reset-password')
      .send({
        token: token2,
        new_password: 'NewPassword123!',
      })
      .expect(200);
  });
});
