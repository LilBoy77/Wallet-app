import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDatabase, closeTestDatabase, TEST_DB_URL } from './test-db-helper.js';
import { runSeeder } from '../../src/database/seeder.js';
import { runDatabaseVerification } from '../../src/database/scripts/verify.js';

describe('Seed Data Integrity & Business Consistency (db:verify Test)', () => {
  beforeAll(async () => {
    await setupTestDatabase();
    // Seed the test database
    await runSeeder({ connectionString: TEST_DB_URL });
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  it('should pass 100% of consistency and integrity checks in db:verify', async () => {
    const { success, checks } = await runDatabaseVerification(TEST_DB_URL);

    // Assert that every single check passed
    for (const check of checks) {
      expect(check.passed, `Integrity check failed: ${check.name} - ${check.details}`).toBe(true);
    }

    expect(success).toBe(true);
  });
});
