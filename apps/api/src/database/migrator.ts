import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg, { type PoolClient } from 'pg';
import { env } from '../config/env.js';
import { sanitizeConnectionString } from './index.js';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.resolve(__dirname, 'migrations');
const MIGRATION_LOCK_ID = 884729104; // Arbitrary 32-bit integer for pg_advisory_lock

export interface MigrationFile {
  name: string;
  upPath: string;
  downPath: string;
}

export interface MigrationStatusItem {
  name: string;
  applied: boolean;
  appliedAt: Date | null;
}

/**
 * Returns sorted list of all available migration definitions.
 */
export function getMigrationFiles(): MigrationFile[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Migrations directory not found at: ${MIGRATIONS_DIR}`);
  }

  const files = fs.readdirSync(MIGRATIONS_DIR);
  const upFiles = files.filter((f) => f.endsWith('.up.sql')).sort();

  return upFiles.map((upFile) => {
    const baseName = upFile.replace(/\.up\.sql$/, '');
    const downFile = `${baseName}.down.sql`;
    const downPath = path.join(MIGRATIONS_DIR, downFile);

    if (!fs.existsSync(downPath)) {
      throw new Error(`Missing corresponding rollback migration file: ${downFile}`);
    }

    return {
      name: baseName,
      upPath: path.join(MIGRATIONS_DIR, upFile),
      downPath,
    };
  });
}

/**
 * Creates client connection to target database for migration runner.
 */
async function getMigrationClient(
  customConnectionString?: string
): Promise<{ client: PoolClient; pool: pg.Pool }> {
  const connectionString =
    customConnectionString || (env.NODE_ENV === 'test' ? env.TEST_DATABASE_URL : env.DATABASE_URL);
  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 5000,
  });

  try {
    const client = await pool.connect();
    return { client, pool };
  } catch (error) {
    const sanitized = sanitizeConnectionString(connectionString);
    console.error(
      `[MIGRATOR] Failed to connect to database ${sanitized}:`,
      (error as Error).message
    );
    await pool.end();
    throw error;
  }
}

/**
 * Ensures schema_migrations tracking table exists.
 */
async function ensureMigrationsTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

/**
 * Runs pending migrations up.
 */
export async function migrateUp(
  options: {
    target?: string;
    connectionString?: string;
  } = {}
): Promise<string[]> {
  const { client, pool } = await getMigrationClient(options.connectionString);
  const appliedList: string[] = [];

  try {
    // Acquire exclusive advisory lock
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    await ensureMigrationsTable(client);

    const { rows: appliedRows } = await client.query<{ name: string }>(
      'SELECT name FROM schema_migrations ORDER BY id ASC'
    );
    const appliedSet = new Set(appliedRows.map((r) => r.name));

    const migrationFiles = getMigrationFiles();

    for (const migration of migrationFiles) {
      if (appliedSet.has(migration.name)) {
        continue;
      }

      console.log(`[MIGRATOR] Applying migration UP: ${migration.name}...`);
      const sql = fs.readFileSync(migration.upPath, 'utf-8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [migration.name]);
        await client.query('COMMIT');
        appliedList.push(migration.name);
        console.log(`[MIGRATOR] Applied UP: ${migration.name} ✓`);
      } catch (migrationError) {
        await client.query('ROLLBACK');
        console.error(
          `[MIGRATOR] Error applying migration ${migration.name}:`,
          (migrationError as Error).message
        );
        throw migrationError;
      }

      if (options.target && migration.name === options.target) {
        break;
      }
    }

    if (appliedList.length === 0) {
      console.log('[MIGRATOR] Database is already up to date. No pending migrations.');
    }

    return appliedList;
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]);
    } catch {
      // Ignore unlock errors during teardown
    }
    client.release();
    await pool.end();
  }
}

/**
 * Rolls back applied migrations down.
 */
export async function migrateDown(
  options: {
    steps?: number;
    all?: boolean;
    connectionString?: string;
  } = {}
): Promise<string[]> {
  const { client, pool } = await getMigrationClient(options.connectionString);
  const rolledBackList: string[] = [];

  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    await ensureMigrationsTable(client);

    const { rows: appliedRows } = await client.query<{ name: string }>(
      'SELECT name FROM schema_migrations ORDER BY id DESC'
    );

    if (appliedRows.length === 0) {
      console.log('[MIGRATOR] No applied migrations found to rollback.');
      return [];
    }

    const migrationMap = new Map<string, MigrationFile>();
    for (const m of getMigrationFiles()) {
      migrationMap.set(m.name, m);
    }

    const stepsToRollback = options.all ? appliedRows.length : options.steps || 1;
    const targets = appliedRows.slice(0, stepsToRollback);

    for (const applied of targets) {
      const migration = migrationMap.get(applied.name);
      if (!migration) {
        throw new Error(
          `Cannot rollback unknown migration: ${applied.name} (file missing on disk)`
        );
      }

      console.log(`[MIGRATOR] Reverting migration DOWN: ${migration.name}...`);
      const sql = fs.readFileSync(migration.downPath, 'utf-8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('DELETE FROM schema_migrations WHERE name = $1', [migration.name]);
        await client.query('COMMIT');
        rolledBackList.push(migration.name);
        console.log(`[MIGRATOR] Reverted DOWN: ${migration.name} ✓`);
      } catch (rollbackError) {
        await client.query('ROLLBACK');
        console.error(
          `[MIGRATOR] Error reverting migration ${migration.name}:`,
          (rollbackError as Error).message
        );
        throw rollbackError;
      }
    }

    return rolledBackList;
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]);
    } catch {
      // Ignore unlock errors
    }
    client.release();
    await pool.end();
  }
}

/**
 * Returns current status of all migrations (applied or pending).
 */
export async function getMigrationStatus(
  options: {
    connectionString?: string;
  } = {}
): Promise<MigrationStatusItem[]> {
  const { client, pool } = await getMigrationClient(options.connectionString);

  try {
    await ensureMigrationsTable(client);

    const { rows: appliedRows } = await client.query<{ name: string; applied_at: Date }>(
      'SELECT name, applied_at FROM schema_migrations ORDER BY id ASC'
    );

    const appliedMap = new Map<string, Date>();
    for (const r of appliedRows) {
      appliedMap.set(r.name, r.applied_at);
    }

    const migrationFiles = getMigrationFiles();
    return migrationFiles.map((m) => {
      const appliedAt = appliedMap.get(m.name) || null;
      return {
        name: m.name,
        applied: !!appliedAt,
        appliedAt,
      };
    });
  } finally {
    client.release();
    await pool.end();
  }
}
