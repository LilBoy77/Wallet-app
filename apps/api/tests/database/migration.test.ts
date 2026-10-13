import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TEST_DB_URL, ensureTestDatabaseExists, closeTestDatabase } from './test-db-helper.js';
import { migrateUp, migrateDown, getMigrationStatus } from '../../src/database/migrator.js';

describe('Database Migration Lifecycle Test', () => {
  beforeAll(async () => {
    await ensureTestDatabaseExists();
  });

  afterAll(async () => {
    // Ensure test database is migrated up and clean after this test
    await migrateUp({ connectionString: TEST_DB_URL });
    await closeTestDatabase();
  });

  it('should cleanly perform up -> down (all) -> up on test database', async () => {
    // 1. Rollback all existing migrations to empty state
    const rolledBackInitial = await migrateDown({ all: true, connectionString: TEST_DB_URL });
    expect(rolledBackInitial).toBeDefined();

    // Verify all are pending
    const statusEmpty = await getMigrationStatus({ connectionString: TEST_DB_URL });
    expect(statusEmpty.length).toBeGreaterThanOrEqual(8);
    expect(statusEmpty.every((s) => !s.applied)).toBe(true);

    // 2. Migrate up to latest
    const appliedFirst = await migrateUp({ connectionString: TEST_DB_URL });
    expect(appliedFirst.length).toBe(statusEmpty.length);

    // Verify all are applied
    const statusApplied = await getMigrationStatus({ connectionString: TEST_DB_URL });
    expect(statusApplied.every((s) => s.applied)).toBe(true);

    // 3. Rollback all down again
    const rolledBackSecond = await migrateDown({ all: true, connectionString: TEST_DB_URL });
    expect(rolledBackSecond.length).toBe(statusApplied.length);

    // Verify all pending again
    const statusEmptyAgain = await getMigrationStatus({ connectionString: TEST_DB_URL });
    expect(statusEmptyAgain.every((s) => !s.applied)).toBe(true);

    // 4. Re-apply all up
    const appliedSecond = await migrateUp({ connectionString: TEST_DB_URL });
    expect(appliedSecond.length).toBe(statusEmptyAgain.length);

    const statusFinal = await getMigrationStatus({ connectionString: TEST_DB_URL });
    expect(statusFinal.every((s) => s.applied)).toBe(true);
  });
});
