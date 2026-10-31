import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  TEST_DB_URL,
  setupTestDatabase,
  closeTestDatabase,
  getTestPool,
  truncateAllTables,
} from './test-db-helper.js';
import { migrateUp, migrateDown } from '../../src/database/migrator.js';

describe('Phase 6 Database Migration Lifecycle (012 UP -> DOWN -> UP)', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    // Ensure all migrations are applied up at end
    await migrateUp({ connectionString: TEST_DB_URL });
    await closeTestDatabase();
  });

  it('should verify Phase 6 schema elements, rollback cleanly with DOWN, and restore with UP', async () => {
    const pool = getTestPool();

    // 1. Initial State: Migration 012 UP is applied
    // Check budgets.deleted_at exists
    const colBudget = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_name = 'budgets' AND column_name = 'deleted_at'`
    );
    expect(colBudget.rows.length).toBe(1);

    // Check attachments.file_hash exists
    const colAttachment = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_name = 'attachments' AND column_name = 'file_hash'`
    );
    expect(colAttachment.rows.length).toBe(1);

    // Check trigger trg_activity_logs_immutable exists
    const triggerRes = await pool.query<{ trigger_name: string }>(
      `SELECT DISTINCT trigger_name FROM information_schema.triggers 
       WHERE event_object_table = 'activity_logs' AND trigger_name = 'trg_activity_logs_immutable'`
    );
    expect(triggerRes.rows.length).toBe(1);

    // 2. Rollback 1 migration step (012 DOWN)
    const rolledBack = await migrateDown({ steps: 1, connectionString: TEST_DB_URL });
    expect(rolledBack.length).toBe(1);
    expect(rolledBack[0]).toContain('012_phase6_categories_budgets_attachments');

    // Verify deleted_at removed from budgets
    const colBudgetDown = await pool.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_name = 'budgets' AND column_name = 'deleted_at'`
    );
    expect(colBudgetDown.rows.length).toBe(0);

    // Verify file_hash removed from attachments
    const colAttachmentDown = await pool.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_name = 'attachments' AND column_name = 'file_hash'`
    );
    expect(colAttachmentDown.rows.length).toBe(0);

    // Verify trigger dropped
    const triggerDown = await pool.query(
      `SELECT DISTINCT trigger_name FROM information_schema.triggers 
       WHERE event_object_table = 'activity_logs' AND trigger_name = 'trg_activity_logs_immutable'`
    );
    expect(triggerDown.rows.length).toBe(0);

    // 3. Re-apply migration (012 UP)
    const appliedUp = await migrateUp({ connectionString: TEST_DB_URL });
    expect(appliedUp.length).toBe(1);
    expect(appliedUp[0]).toContain('012_phase6_categories_budgets_attachments');

    // Verify objects restored
    const colBudgetRestored = await pool.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_name = 'budgets' AND column_name = 'deleted_at'`
    );
    expect(colBudgetRestored.rows.length).toBe(1);

    const triggerRestored = await pool.query(
      `SELECT DISTINCT trigger_name FROM information_schema.triggers 
       WHERE event_object_table = 'activity_logs' AND trigger_name = 'trg_activity_logs_immutable'`
    );
    expect(triggerRestored.rows.length).toBe(1);
  });

  it('should enforce assertTestDatabaseIsolation before truncateAllTables and guarantee trg_activity_logs_immutable remains active via finally block', async () => {
    const pool = getTestPool();

    // 1. Guard check: truncateAllTables MUST reject immediately if testUrl matches devUrl
    const collisionUrl = 'postgresql://postgres:change_me_local_only@localhost:5432/wallet_app_db';
    await expect(
      truncateAllTables({ testUrl: collisionUrl, devUrl: collisionUrl })
    ).rejects.toThrow(/\[TEST_GUARD_REJECTED\]/);

    // 2. Normal execution: truncateAllTables succeeds and re-enables trg_activity_logs_immutable
    await truncateAllTables();

    const triggerStatusAfterSuccess = await pool.query<{ tgenabled: string }>(
      `SELECT tgenabled FROM pg_trigger WHERE tgname = 'trg_activity_logs_immutable'`
    );
    expect(triggerStatusAfterSuccess.rows.length).toBe(1);
    expect(triggerStatusAfterSuccess.rows[0]!.tgenabled).toBe('O');

    const inserted = await pool.query<{ id: string }>(
      `INSERT INTO activity_logs (action, entity, ip_address)
       VALUES ('USER_LOGIN', 'auth', '127.0.0.1')
       RETURNING id`
    );
    const logId = inserted.rows[0]!.id;

    await expect(
      pool.query(`UPDATE activity_logs SET action = 'USER_LOGOUT' WHERE id = $1`, [logId])
    ).rejects.toThrow(/cannot be updated or deleted/i);

    await expect(pool.query(`DELETE FROM activity_logs WHERE id = $1`, [logId])).rejects.toThrow(
      /cannot be updated or deleted/i
    );

    // 3. Failure injection mid-truncation: finally block MUST still re-enable trg_activity_logs_immutable
    await expect(
      truncateAllTables({
        beforeTruncateHook: async () => {
          throw new Error('SIMULATED_TRUNCATE_FAILURE');
        },
      })
    ).rejects.toThrow('SIMULATED_TRUNCATE_FAILURE');

    const triggerStatusAfterError = await pool.query<{ tgenabled: string }>(
      `SELECT tgenabled FROM pg_trigger WHERE tgname = 'trg_activity_logs_immutable'`
    );
    expect(triggerStatusAfterError.rows[0]!.tgenabled).toBe('O');

    await expect(pool.query(`DELETE FROM activity_logs WHERE id = $1`, [logId])).rejects.toThrow(
      /cannot be updated or deleted/i
    );
  });
});
