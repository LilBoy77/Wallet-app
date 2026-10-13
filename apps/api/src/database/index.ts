import pg, { type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import { env } from '../config/env.js';

const { Pool } = pg;

let poolInstance: pg.Pool | null = null;

/**
 * Sanitizes a PostgreSQL connection URL to prevent leaking credentials in logs or error messages.
 */
export function sanitizeConnectionString(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    if (url.password) {
      url.password = '***';
    }
    return url.toString();
  } catch {
    return '[SANITIZED_CONNECTION_STRING]';
  }
}

/**
 * Obtains or initializes the singleton pg.Pool instance.
 */
export function getPool(connectionString?: string): pg.Pool {
  if (!poolInstance) {
    const targetUrl =
      connectionString || (env.NODE_ENV === 'test' ? env.TEST_DATABASE_URL : env.DATABASE_URL);
    poolInstance = new Pool({
      connectionString: targetUrl,
      max: env.NODE_ENV === 'test' ? 10 : 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    poolInstance.on('error', (err) => {
      const sanitized = sanitizeConnectionString(targetUrl);
      console.error(
        `[DATABASE_POOL_ERROR] Unexpected error on idle client for ${sanitized}:`,
        err.message
      );
    });
  }

  return poolInstance;
}

/**
 * Executes a parameterized query using the pool.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const pool = getPool();
  try {
    return await pool.query<T>(text, params);
  } catch (error: unknown) {
    const err = error as Error;
    // Log sanitized error message without connection details
    if (env.LOG_LEVEL === 'debug' && env.NODE_ENV !== 'test') {
      console.error('[DATABASE_QUERY_ERROR]', err.message);
    }
    throw error;
  }
}

/**
 * Acquires a client directly from the pool for transactional operations.
 */
export async function getClient(): Promise<PoolClient> {
  const pool = getPool();
  return await pool.connect();
}

/**
 * Starts a transaction on a dedicated PoolClient.
 */
export async function beginTransaction(client?: PoolClient): Promise<PoolClient> {
  const targetClient = client || (await getClient());
  await targetClient.query('BEGIN');
  return targetClient;
}

/**
 * Commits a transaction and releases client.
 */
export async function commitTransaction(client: PoolClient): Promise<void> {
  try {
    await client.query('COMMIT');
  } finally {
    client.release();
  }
}

/**
 * Rolls back a transaction and releases client.
 */
export async function rollbackTransaction(client: PoolClient): Promise<void> {
  try {
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }
}

/**
 * Executes a callback within a managed database transaction.
 */
export async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback errors if transaction was already aborted
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Gracefully drains and closes the database connection pool.
 */
export async function closePool(): Promise<void> {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
  }
}

/**
 * Checks database connectivity without leaking connection string.
 */
export async function checkDatabaseHealth(): Promise<{ connected: boolean; latencyMs: number }> {
  const start = Date.now();
  try {
    const pool = getPool();
    await pool.query('SELECT 1');
    const latencyMs = Date.now() - start;
    return { connected: true, latencyMs };
  } catch {
    return { connected: false, latencyMs: Date.now() - start };
  }
}
