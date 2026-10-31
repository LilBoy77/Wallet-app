import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { authService, hashSha256 } from '../../src/modules/auth/auth.service.js';
import { logger } from '../../src/shared/logging/logger.js';
import { ACTIVITY_ACTIONS } from '../../src/shared/logging/activity-log.helper.js';
import {
  setupTestDatabase,
  closeTestDatabase,
  cleanTestTables,
  getTestPool,
} from '../database/test-db-helper.js';

describe('Auth Module - Failed Login Privacy & Unauthenticated Append-Only Protection', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanTestTables();
    vi.restoreAllMocks();
  });

  it('should NOT insert into activity_logs for unregistered email, logging only SHA-256 of normalized email and IP to app logger', async () => {
    const warnSpy = vi.spyOn(logger, 'warn');
    const pool = getTestPool();

    const rawInputEmail = '  Ghost.Unregistered@Wallet.Local  ';
    const normalizedEmail = 'ghost.unregistered@wallet.local';
    const expectedHash = hashSha256(normalizedEmail);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: rawInputEmail,
        password: 'RandomPassword123!',
      })
      .expect(401);

    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(res.body.error.message).toBe('Email atau kata sandi tidak valid');

    // 1. Append-only activity_logs table MUST have 0 rows
    const logsCountRes = await pool.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM activity_logs'
    );
    expect(parseInt(logsCountRes.rows[0]!.count, 10)).toBe(0);

    // 2. Application logger MUST receive SHA-256 hash of normalized email + IP, with NO raw email across any log call
    const failedLoginCalls = warnSpy.mock.calls.filter(
      ([payload]) =>
        typeof payload === 'object' &&
        payload !== null &&
        (payload as { event?: unknown }).event === ACTIVITY_ACTIONS.USER_LOGIN_FAILED
    );
    expect(failedLoginCalls).toHaveLength(1);

    const [logPayload, logMsg] = failedLoginCalls[0]!;
    expect(logPayload).toMatchObject({
      event: ACTIVITY_ACTIONS.USER_LOGIN_FAILED,
      email_hash: expectedHash,
      reason: 'UNREGISTERED_EMAIL',
    });
    expect(typeof (logPayload as { ip_address?: unknown }).ip_address).toBe('string');

    const serializedAllCalls = JSON.stringify({ calls: warnSpy.mock.calls, logMsg });
    expect(serializedAllCalls.toLowerCase()).not.toContain(normalizedEmail);
    expect(serializedAllCalls).not.toContain('Ghost.Unregistered');
  });

  it('should record USER_LOGIN_FAILED for wrong password on existing account with user_id, IP, and reason INVALID_CREDENTIALS without raw email', async () => {
    const pool = getTestPool();

    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: 'privacy_active_user',
        email: 'privacy.active@wallet.local',
        password: 'CorrectPassword123!',
        full_name: 'Privacy Active User',
      })
      .expect(201);

    const userId = regRes.body.data.id as string;

    await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'privacy.active@wallet.local',
        password: 'WrongPassword999!',
      })
      .expect(401);

    const failedLogs = await pool.query<{
      user_id: string | null;
      action: string;
      ip_address: string | null;
      metadata: Record<string, unknown>;
    }>(`SELECT user_id, action, ip_address, metadata FROM activity_logs WHERE action = $1`, [
      ACTIVITY_ACTIONS.USER_LOGIN_FAILED,
    ]);

    expect(failedLogs.rows.length).toBe(1);
    const logRow = failedLogs.rows[0]!;
    expect(logRow.user_id).toBe(userId);
    expect(typeof logRow.ip_address).toBe('string');
    expect(logRow.ip_address!.length).toBeGreaterThan(0);
    expect(logRow.metadata).toEqual({ reason: 'INVALID_CREDENTIALS' });

    // Confirm zero raw email in ANY activity_logs row metadata (including USER_REGISTERED)
    const allLogs = await pool.query<{ metadata: Record<string, unknown> }>(
      'SELECT metadata FROM activity_logs'
    );
    for (const row of allLogs.rows) {
      const metaJson = JSON.stringify(row.metadata);
      expect(metaJson.toLowerCase()).not.toContain('privacy.active@wallet.local');
      expect(row.metadata.email).toBeUndefined();
    }
  });

  it('should record USER_LOGIN_FAILED with reason ACCOUNT_INACTIVE and no raw email for deactivated and soft-deleted existing accounts', async () => {
    const pool = getTestPool();
    const validHash = await authService.hashPassword('ValidPassword123!');

    const inactiveInsert = await pool.query<{ id: string }>(
      `INSERT INTO users (username, email, password_hash, full_name, role, is_active, deleted_at)
       VALUES ('inactive_audit_user', 'inactive.audit@wallet.local', $1, 'Inactive Audit', 'user', false, NULL)
       RETURNING id`,
      [validHash]
    );
    const inactiveUserId = inactiveInsert.rows[0]!.id;

    const deletedInsert = await pool.query<{ id: string }>(
      `INSERT INTO users (username, email, password_hash, full_name, role, is_active, deleted_at)
       VALUES ('deleted_audit_user', 'deleted.audit@wallet.local', $1, 'Deleted Audit', 'user', true, NOW())
       RETURNING id`,
      [validHash]
    );
    const deletedUserId = deletedInsert.rows[0]!.id;

    const resInactive = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'inactive.audit@wallet.local', password: 'ValidPassword123!' })
      .expect(401);
    expect(resInactive.body.error.message).toBe('Email atau kata sandi tidak valid');

    const resDeleted = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'deleted.audit@wallet.local', password: 'WrongOrRightPassword123!' })
      .expect(401);
    expect(resDeleted.body.error.message).toBe('Email atau kata sandi tidak valid');

    const logs = await pool.query<{
      user_id: string | null;
      action: string;
      ip_address: string | null;
      metadata: Record<string, unknown>;
    }>(
      `SELECT user_id, action, ip_address, metadata
       FROM activity_logs
       WHERE action = $1
       ORDER BY created_at ASC`,
      [ACTIVITY_ACTIONS.USER_LOGIN_FAILED]
    );

    expect(logs.rows.length).toBe(2);
    expect(logs.rows[0]!.user_id).toBe(inactiveUserId);
    expect(logs.rows[0]!.metadata).toEqual({ reason: 'ACCOUNT_INACTIVE' });
    expect(typeof logs.rows[0]!.ip_address).toBe('string');

    expect(logs.rows[1]!.user_id).toBe(deletedUserId);
    expect(logs.rows[1]!.metadata).toEqual({ reason: 'ACCOUNT_INACTIVE' });
    expect(typeof logs.rows[1]!.ip_address).toBe('string');

    const serializedMetadata = JSON.stringify(logs.rows.map((r) => r.metadata));
    expect(serializedMetadata.toLowerCase()).not.toContain('inactive.audit@wallet.local');
    expect(serializedMetadata.toLowerCase()).not.toContain('deleted.audit@wallet.local');
  });
});
