import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import {
  ACTIVITY_ACTIONS,
  type RecordActivityParams,
} from '../../src/shared/logging/activity-log.helper.js';
import {
  setupTestDatabase,
  closeTestDatabase,
  cleanTestTables,
  getTestPool,
} from '../database/test-db-helper.js';
import { createAuthenticatedUser } from '../finance/finance-test-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.resolve(__dirname, '../../src');
const OUTBOX_DIR = path.resolve(__dirname, '../../.outbox');

const VALID_PNG_BUFFER = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2d420000000049454e44ae426082',
  'hex'
);

function getAllTypeScriptFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllTypeScriptFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

function findLiteralLogActionViolations(source: string): string[] {
  const violations: string[] = [];
  const callRegex = /\b(?:recordActivity|recordActivityLog)\s*\(\s*[^,]+,\s*\{([\s\S]*?)\}\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = callRegex.exec(source)) !== null) {
    const objectBody = match[1] ?? '';
    if (/\baction\s*:\s*['"`]/.test(objectBody)) {
      violations.push(`String literal passed to action property: ${match[0].slice(0, 120)}`);
    } else if (!/\baction\s*:\s*ACTIVITY_ACTIONS\.[A-Z0-9_]+\b/.test(objectBody)) {
      violations.push(
        `Call does not reference ACTIVITY_ACTIONS.<KEY> on action property: ${match[0].slice(0, 120)}`
      );
    }
  }
  return violations;
}

describe('Activity Logs Module (/api/v1/activity-logs & /api/v1/admin/activity-logs)', () => {
  let adminUserId: string;
  let adminToken: string;

  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanTestTables();

    const pool = getTestPool();

    // Create an Admin user for admin audit testing
    const adminRes = await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name, role)
       VALUES ('admin_audit', 'admin_audit@wallet.local', '$argon2id$mock', 'Admin Auditor', 'admin')
       RETURNING id`
    );
    adminUserId = adminRes.rows[0].id;

    const adminSession = await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at, is_revoked)
       VALUES ($1, 'hash_admin_audit_${Date.now()}', gen_random_uuid(), NOW() + INTERVAL '7 days', false)
       RETURNING family_id`,
      [adminUserId]
    );

    adminToken = jwt.sign(
      {
        sub: adminUserId,
        role: 'admin',
        email: 'admin_audit@wallet.local',
        jti: 'admin-audit-jti',
        sid: adminSession.rows[0].family_id,
      },
      env.JWT_ACCESS_SECRET,
      { algorithm: 'HS256', expiresIn: '15m', issuer: env.JWT_ISSUER, audience: env.JWT_AUDIENCE }
    );
  });

  describe('Automatic Activity Recording & Sensitive Data Redaction', () => {
    it('should automatically record financial and auth activities without sensitive information', async () => {
      // 1. User registers & logs in (creates auth session & default wallet)
      const user = await createAuthenticatedUser(app, { initialBalance: 1_000_000 });

      // 2. User creates category
      const catRes = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          name: 'Tagihan Listrik',
          type: 'expense',
          color: '#EAB308',
          icon: 'zap',
        })
        .expect(201);

      // 3. User creates budget
      await request(app)
        .post('/api/v1/budgets')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          category_id: catRes.body.data.id,
          limit_amount: 500_000,
          month: 10,
          year: 2026,
        })
        .expect(201);

      // 4. User queries their activity logs
      const logsRes = await request(app)
        .get('/api/v1/activity-logs')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(logsRes.body.success).toBe(true);
      expect(logsRes.body.data.length).toBeGreaterThanOrEqual(2);

      // Verify that all returned logs belong to user
      for (const log of logsRes.body.data) {
        expect(log.user_id).toBe(user.user.id);

        // Verify sensitive keys are strictly absent from metadata
        const metadataStr = JSON.stringify(log.metadata || {});
        expect(metadataStr).not.toContain('password');
        expect(metadataStr).not.toContain('token_hash');
        expect(metadataStr).not.toContain('refresh_token');
        expect(metadataStr).not.toContain('access_token');
        expect(metadataStr).not.toContain('ValidPassword123!');
      }
    });

    it('should isolate user logs so User A cannot view User B logs via GET /activity-logs', async () => {
      const userA = await createAuthenticatedUser(app);
      const userB = await createAuthenticatedUser(app);

      // User A creates a category
      await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({
          name: 'Kategori User A',
          type: 'income',
        })
        .expect(201);

      // User B fetches their logs
      const logsB = await request(app)
        .get('/api/v1/activity-logs')
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .expect(200);

      const aLogsInB = logsB.body.data.filter(
        (l: { user_id: string | null }) => l.user_id === userA.user.id
      );
      expect(aLogsInB.length).toBe(0);
    });
  });

  describe('Admin Operational Audit (/api/v1/admin/activity-logs)', () => {
    it('should allow admin to inspect all activity logs across users with filtering', async () => {
      const userA = await createAuthenticatedUser(app);
      const userB = await createAuthenticatedUser(app);

      // User A creates category
      await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ name: 'Cat A', type: 'expense' })
        .expect(201);

      // User B creates category
      await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .send({ name: 'Cat B', type: 'income' })
        .expect(201);

      // Admin queries all logs
      const adminRes = await request(app)
        .get('/api/v1/admin/activity-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(adminRes.body.success).toBe(true);
      const userIds = adminRes.body.data.map((l: { user_id: string | null }) => l.user_id);
      expect(userIds).toContain(userA.user.id);
      expect(userIds).toContain(userB.user.id);

      // Admin filter by user_id
      const filterRes = await request(app)
        .get(`/api/v1/admin/activity-logs?user_id=${userA.user.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(
        filterRes.body.data.every((l: { user_id: string | null }) => l.user_id === userA.user.id)
      ).toBe(true);
    });

    it('should deny non-admin users from accessing /api/v1/admin/activity-logs with 403 Forbidden', async () => {
      const user = await createAuthenticatedUser(app);

      const res = await request(app)
        .get('/api/v1/admin/activity-logs')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('Database Trigger Immutability Enforcement', () => {
    it('should reject UPDATE operations on activity_logs with trigger error', async () => {
      const pool = getTestPool();

      // Insert raw activity log
      const insertRes = await pool.query(
        `INSERT INTO activity_logs (action, entity, ip_address)
         VALUES ('TEST_ACTION', 'test_entity', '127.0.0.1')
         RETURNING id`
      );
      const logId = insertRes.rows[0].id;

      // Attempt direct SQL update
      await expect(
        pool.query(`UPDATE activity_logs SET action = 'HACKED' WHERE id = $1`, [logId])
      ).rejects.toThrow(/cannot be updated or deleted/i);
    });

    it('should reject DELETE operations on activity_logs with trigger error', async () => {
      const pool = getTestPool();

      // Insert raw activity log
      const insertRes = await pool.query(
        `INSERT INTO activity_logs (action, entity, ip_address)
         VALUES ('TEST_ACTION_DELETE', 'test_entity', '127.0.0.1')
         RETURNING id`
      );
      const logId = insertRes.rows[0].id;

      // Attempt direct SQL delete
      await expect(pool.query(`DELETE FROM activity_logs WHERE id = $1`, [logId])).rejects.toThrow(
        /cannot be updated or deleted/i
      );
    });
  });

  describe('Transactional Atomicity, Action Catalog & Query Whitelisting', () => {
    it('should rollback activity log when operation fails inside database transaction (no orphan logs)', async () => {
      const user = await createAuthenticatedUser(app);
      const pool = getTestPool();

      // Attempt creating a transaction that purposefully triggers a failure (e.g. invalid amount / schema failure)
      // or using withTransaction directly
      const beforeCountRes = await pool.query<{ count: string }>(
        'SELECT COUNT(*) as count FROM activity_logs'
      );
      const countBefore = parseInt(beforeCountRes.rows[0].count, 10);

      // Attempt to register with duplicate email (fails during transaction after user insert)
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          username: user.user.username, // duplicate username
          email: 'duplicate_user_test@wallet.local',
          password: 'ValidPassword123!',
          full_name: 'Duplicate Tester',
        })
        .expect(409);

      const afterCountRes = await pool.query<{ count: string }>(
        'SELECT COUNT(*) as count FROM activity_logs'
      );
      const countAfter = parseInt(afterCountRes.rows[0].count, 10);

      // Verify no orphaned activity log was persisted for the aborted registration
      expect(countAfter).toBe(countBefore);
    });

    it('should emit only cataloged ACTIVITY_ACTIONS across real HTTP operations and cover every cataloged event (25/25)', async () => {
      const pool = getTestPool();
      const catalogValues = Object.values(ACTIVITY_ACTIONS);
      expect(catalogValues.length).toBe(25);

      const extractRefreshCookie = (header: string[] | string | undefined): string => {
        const raw = Array.isArray(header) ? header.join('; ') : String(header ?? '');
        const match = raw.match(/refreshToken=([^;]+)/);
        if (!match?.[1]) {
          throw new Error('Missing refreshToken cookie');
        }
        return match[1];
      };

      const actorEmail = 'catalog_actor@wallet.local';

      try {
        // 1. Register actor & peer (USER_REGISTERED)
        await request(app)
          .post('/api/v1/auth/register')
          .send({
            username: 'catalog_actor',
            email: actorEmail,
            password: 'InitialPassword123!',
            full_name: 'Catalog Actor',
          })
          .expect(201);

        const peer = await createAuthenticatedUser(app);

        // 2. Failed login on existing account (USER_LOGIN_FAILED)
        await request(app)
          .post('/api/v1/auth/login')
          .send({ email: actorEmail, password: 'WrongPassword999!' })
          .expect(401);

        // 3. Successful login (USER_LOGIN)
        const login1 = await request(app)
          .post('/api/v1/auth/login')
          .send({ email: actorEmail, password: 'InitialPassword123!' })
          .expect(200);
        const rt1 = extractRefreshCookie(login1.headers['set-cookie']);

        // 4. Refresh token rotation (TOKEN_REFRESHED)
        const refreshRes = await request(app)
          .post('/api/v1/auth/refresh')
          .set('Cookie', `refreshToken=${rt1}`)
          .set('X-Requested-With', 'XMLHttpRequest')
          .expect(200);
        expect(refreshRes.body.success).toBe(true);

        // 5. Replay revoked refresh token (TOKEN_REUSE_DETECTED)
        await request(app)
          .post('/api/v1/auth/refresh')
          .set('Cookie', `refreshToken=${rt1}`)
          .set('X-Requested-With', 'XMLHttpRequest')
          .expect(401);

        // 6. Re-login & Change Password (PASSWORD_CHANGED)
        const login2 = await request(app)
          .post('/api/v1/auth/login')
          .send({ email: actorEmail, password: 'InitialPassword123!' })
          .expect(200);
        await request(app)
          .put('/api/v1/auth/change-password')
          .set('Authorization', `Bearer ${login2.body.data.tokens.access_token}`)
          .send({
            current_password: 'InitialPassword123!',
            new_password: 'ChangedPassword123!',
          })
          .expect(200);

        // 7. Forgot Password & Reset Password (PASSWORD_RESET_REQUESTED, PASSWORD_RESET_COMPLETED)
        if (fs.existsSync(OUTBOX_DIR)) {
          for (const f of fs.readdirSync(OUTBOX_DIR)) {
            if (f.includes('to_catalog_actor_wallet_local')) {
              fs.unlinkSync(path.join(OUTBOX_DIR, f));
            }
          }
        }
        await request(app)
          .post('/api/v1/auth/forgot-password')
          .send({ email: actorEmail })
          .expect(200);

        const mailFile = fs
          .readdirSync(OUTBOX_DIR)
          .find((f) => f.includes('to_catalog_actor_wallet_local'));
        expect(mailFile).toBeDefined();
        const mailJson = JSON.parse(fs.readFileSync(path.join(OUTBOX_DIR, mailFile!), 'utf-8')) as {
          text: string;
        };
        const rawResetToken = mailJson.text.match(/token=([a-f0-9]+)/)![1]!;

        await request(app)
          .post('/api/v1/auth/reset-password')
          .send({
            token: rawResetToken,
            new_password: 'FinalPassword123!',
          })
          .expect(200);

        // 8. Re-login -> Logout-all (USER_LOGOUT_ALL)
        const login3 = await request(app)
          .post('/api/v1/auth/login')
          .send({ email: actorEmail, password: 'FinalPassword123!' })
          .expect(200);
        await request(app)
          .post('/api/v1/auth/logout-all')
          .set('Authorization', `Bearer ${login3.body.data.tokens.access_token}`)
          .expect(200);

        // 9. Re-login -> Logout single session (USER_LOGOUT)
        const login4 = await request(app)
          .post('/api/v1/auth/login')
          .send({ email: actorEmail, password: 'FinalPassword123!' })
          .expect(200);
        const rt4 = extractRefreshCookie(login4.headers['set-cookie']);
        await request(app)
          .post('/api/v1/auth/logout')
          .set('Cookie', `refreshToken=${rt4}`)
          .set('X-Requested-With', 'XMLHttpRequest')
          .expect(200);

        // 10. Active session for financial & CRUD operations
        const login5 = await request(app)
          .post('/api/v1/auth/login')
          .send({ email: actorEmail, password: 'FinalPassword123!' })
          .expect(200);
        const token = login5.body.data.tokens.access_token as string;

        // Wallets: TOPUP_SIMULATION & WALLET_UPDATE
        await request(app)
          .post('/api/v1/wallets/my/topup')
          .set('Authorization', `Bearer ${token}`)
          .send({ amount: 1_500_000 })
          .expect(200);

        await request(app)
          .put('/api/v1/wallets/my')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: 'Dompet Katalog' })
          .expect(200);

        // Categories: CATEGORY_CREATED, CATEGORY_UPDATED, CATEGORY_DELETED
        const catRes = await request(app)
          .post('/api/v1/categories')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: 'Kategori Katalog', type: 'expense', icon: 'tag', color: '#f97316' })
          .expect(201);
        const catId = catRes.body.data.id as string;

        await request(app)
          .put(`/api/v1/categories/${catId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ name: 'Kategori Katalog Revisi' })
          .expect(200);

        const tempCatRes = await request(app)
          .post('/api/v1/categories')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: 'Kategori Sementara', type: 'expense' })
          .expect(201);
        await request(app)
          .delete(`/api/v1/categories/${tempCatRes.body.data.id}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        // Budgets: BUDGET_CREATED, BUDGET_UPDATED, BUDGET_DELETED
        const bdgRes = await request(app)
          .post('/api/v1/budgets')
          .set('Authorization', `Bearer ${token}`)
          .send({ category_id: catId, limit_amount: 800_000, month: 10, year: 2026 })
          .expect(201);
        const bdgId = bdgRes.body.data.id as string;

        await request(app)
          .put(`/api/v1/budgets/${bdgId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ limit_amount: 900_000 })
          .expect(200);

        await request(app)
          .delete(`/api/v1/budgets/${bdgId}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        // Transactions & Attachments: TRANSACTION_CREATED, TRANSACTION_METADATA_UPDATED,
        // ATTACHMENT_UPLOADED, ATTACHMENT_DELETED, TRANSACTION_VOIDED
        const txRes = await request(app)
          .post('/api/v1/transactions')
          .set('Authorization', `Bearer ${token}`)
          .send({
            type: 'expense',
            category_id: catId,
            amount: 125_000,
            description: 'Belanja Katalog',
          })
          .expect(201);
        const txId = txRes.body.data.id as string;

        await request(app)
          .put(`/api/v1/transactions/${txId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ description: 'Belanja Katalog Diperbarui' })
          .expect(200);

        const attRes = await request(app)
          .post('/api/v1/attachments')
          .set('Authorization', `Bearer ${token}`)
          .field('transaction_id', txId)
          .attach('file', VALID_PNG_BUFFER, 'receipt.png')
          .expect(201);

        await request(app)
          .delete(`/api/v1/attachments/${attRes.body.data.id}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        await request(app)
          .delete(`/api/v1/transactions/${txId}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        // Transfers: TRANSFER_SENT & TRANSFER_RECEIVED
        await request(app)
          .post('/api/v1/transfers')
          .set('Authorization', `Bearer ${token}`)
          .set('Idempotency-Key', crypto.randomUUID())
          .send({
            target_wallet_number: peer.wallet.wallet_number,
            amount: 200_000,
            note: 'Transfer Katalog',
          })
          .expect(201);

        // Verify ALL actually emitted actions in PostgreSQL match ACTIVITY_ACTIONS 1-to-1
        const emittedRes = await pool.query<{ action: string }>(
          'SELECT DISTINCT action FROM activity_logs ORDER BY action ASC'
        );
        const emittedActions = emittedRes.rows.map((r) => r.action);
        const catalogSet = new Set<string>(catalogValues);

        for (const emitted of emittedActions) {
          expect(
            catalogSet.has(emitted),
            `Emitted action '${emitted}' is outside ACTIVITY_ACTIONS catalog`
          ).toBe(true);
        }

        expect(new Set(emittedActions)).toEqual(catalogSet);
      } finally {
        if (fs.existsSync(OUTBOX_DIR)) {
          for (const f of fs.readdirSync(OUTBOX_DIR)) {
            if (f.includes('to_catalog_actor_wallet_local')) {
              try {
                fs.unlinkSync(path.join(OUTBOX_DIR, f));
              } catch {
                // ignore
              }
            }
          }
        }
      }
    });

    it('structural guard: action parameter enforces union compile check and zero source files call log recording with string literals', () => {
      // 1. Compile-time union enforcement proof (@ts-expect-error fails tsc if literal outside union were allowed)
      const validParam: RecordActivityParams = {
        action: ACTIVITY_ACTIONS.USER_LOGIN,
        entity: 'auth',
      };
      expect(validParam.action).toBe('USER_LOGIN');

      // @ts-expect-error Out-of-catalog string literal must fail TypeScript compilation
      const invalidCompileCheck: RecordActivityParams = {
        action: 'OUT_OF_CATALOG_ACTION_LITERAL',
        entity: 'auth',
      };
      expect(invalidCompileCheck.entity).toBe('auth');

      // 2. Verify detector catches single-quote, double-quote, and template-literal action calls
      expect(
        findLiteralLogActionViolations(
          `await recordActivity(pool, { userId, action: 'USER_LOGIN_SUCCESS', entity: 'auth' });`
        ).length
      ).toBe(1);
      expect(
        findLiteralLogActionViolations(
          `await authRepository.recordActivityLog(client, { userId, action: \`RAW_TEMPLATE\`, entity: 'auth' });`
        ).length
      ).toBe(1);

      // 3. Scan every TypeScript file under apps/api/src
      const allSrcFiles = getAllTypeScriptFiles(SRC_DIR);
      const helperPath = path.resolve(SRC_DIR, 'shared/logging/activity-log.helper.ts');
      const seederPath = path.resolve(SRC_DIR, 'database/seeder.ts');
      const violations: string[] = [];

      for (const file of allSrcFiles) {
        const resolved = path.resolve(file);
        const rel = path.relative(SRC_DIR, file).replace(/\\/g, '/');
        const content = fs.readFileSync(file, 'utf-8');

        // Direct SQL INSERT INTO activity_logs is permitted ONLY in activity-log.helper.ts and seeder.ts
        if (
          resolved !== helperPath &&
          resolved !== seederPath &&
          /INSERT\s+INTO\s+activity_logs/i.test(content)
        ) {
          violations.push(
            `${rel}: Direct INSERT INTO activity_logs outside activity-log.helper.ts`
          );
        }

        // In seeder.ts, verify no string literal actions are defined
        if (resolved === seederPath && /\baction\s*:\s*['"`]/.test(content)) {
          violations.push(`${rel}: String literal action found in database seeder`);
        }

        // Across all source files, verify recordActivity / recordActivityLog calls never pass string literals
        const fileViolations = findLiteralLogActionViolations(content);
        for (const v of fileViolations) {
          violations.push(`${rel}: ${v}`);
        }
      }

      expect(violations).toEqual([]);
    });

    it('should enforce strict sort and filter whitelists on activity log queries', async () => {
      // Admin requests activity logs with invalid sort field -> must fail with 422 VALIDATION_ERROR
      const invalidSortRes = await request(app)
        .get('/api/v1/admin/activity-logs?sort_by=malicious_column_injection')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(422);

      expect(invalidSortRes.body.success).toBe(false);
      expect(invalidSortRes.body.error.code).toBe('VALIDATION_ERROR');

      // Valid sort by action asc -> 200 OK
      const validSortRes = await request(app)
        .get('/api/v1/admin/activity-logs?sort_by=action&order=asc')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(validSortRes.body.success).toBe(true);
      expect(Array.isArray(validSortRes.body.data)).toBe(true);
    });
  });
});
