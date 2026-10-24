import pg from 'pg';
import { env } from '../../src/config/env.js';
import { migrateUp } from '../../src/database/migrator.js';

const { Pool } = pg;

export const TEST_DB_URL =
  env.TEST_DATABASE_URL || 'postgresql://postgres:change_me_local_only@localhost:5432/wallet_test';

let testPoolInstance: pg.Pool | null = null;

/**
 * Validates that test database URL is strictly separate from development database URL.
 */
export function assertTestDatabaseIsolation(
  testUrl: string = TEST_DB_URL,
  devUrl: string = env.DATABASE_URL
): void {
  const testParsed = new URL(testUrl);
  const devParsed = new URL(devUrl);
  const testDbName = testParsed.pathname.replace('/', '').toLowerCase();
  const devDbName = devParsed.pathname.replace('/', '').toLowerCase();

  if (testDbName === devDbName) {
    throw new Error(
      `[TEST_GUARD_REJECTED] Tests must NOT run against development database ('${devDbName}'). Please specify a separate TEST_DATABASE_URL (e.g. 'wallet_test').`
    );
  }
}

/**
 * Creates the test database if it does not already exist.
 */
export async function ensureTestDatabaseExists(): Promise<void> {
  assertTestDatabaseIsolation();
  const url = new URL(TEST_DB_URL);
  const targetDbName = url.pathname.replace('/', '');

  // Connect to administrative 'postgres' database to check/create targetDbName
  const adminUrl = new URL(TEST_DB_URL);
  adminUrl.pathname = '/postgres';

  const adminPool = new Pool({
    connectionString: adminUrl.toString(),
    connectionTimeoutMillis: 5000,
  });

  try {
    const { rows } = await adminPool.query<{ count: string }>(
      'SELECT count(*) FROM pg_database WHERE datname = $1',
      [targetDbName]
    );

    if (parseInt(rows[0].count, 10) === 0) {
      console.log(`[TEST_DB_HELPER] Creating test database '${targetDbName}'...`);
      await adminPool.query(`CREATE DATABASE "${targetDbName}"`);
    }
  } finally {
    await adminPool.end();
  }
}

/**
 * Gets or initializes the test database connection pool.
 */
export function getTestPool(): pg.Pool {
  if (!testPoolInstance) {
    assertTestDatabaseIsolation();
    testPoolInstance = new Pool({
      connectionString: TEST_DB_URL,
      max: 10,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 5000,
    });
  }
  return testPoolInstance;
}

/**
 * Sets up test database with full migrations and empty state.
 */
export async function setupTestDatabase(): Promise<pg.Pool> {
  await ensureTestDatabaseExists();
  await migrateUp({ connectionString: TEST_DB_URL });
  return getTestPool();
}

/**
 * Closes the test database pool.
 */
export async function closeTestDatabase(): Promise<void> {
  if (testPoolInstance) {
    await testPoolInstance.end();
    testPoolInstance = null;
  }
}

/**
 * Cleans all application tables in the test database for test isolation.
 */
export async function cleanTestTables(): Promise<void> {
  const pool = getTestPool();
  const client = await pool.connect();
  try {
    const tables = [
      'idempotency_records',
      'password_resets',
      'notifications',
      'activity_logs',
      'refresh_tokens',
      'attachments',
      'transaction_tags',
      'tags',
      'wallet_entries',
      'transfers',
      'transactions',
      'budgets',
      'categories',
      'wallets',
      'users',
    ];
    await client.query('ALTER TABLE wallet_entries DISABLE TRIGGER trg_wallet_entries_no_delete');
    await client.query(`TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE`);
    await client.query('ALTER TABLE wallet_entries ENABLE TRIGGER trg_wallet_entries_no_delete');
  } finally {
    client.release();
  }
}
