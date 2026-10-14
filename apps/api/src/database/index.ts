import pg, { type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import { env } from '../config/env.js';
import { AppError } from '../shared/errors/app-error.js';
import { ERROR_CODES } from '../shared/errors/error-catalog.js';
import { logger } from '../shared/logging/logger.js';

const { Pool } = pg;

let poolInstance: pg.Pool | null = null;

export type IsolationLevel = 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';

export interface TransactionOptions {
  isolationLevel?: IsolationLevel;
  readOnly?: boolean;
  maxRetries?: number;
  retryDelayMs?: number;
}

// Symbol used to tag client instances in transaction to detect nested transactions
const IN_TRANSACTION_TAG = Symbol('IN_TRANSACTION');

interface TaggedClient extends PoolClient {
  [IN_TRANSACTION_TAG]?: boolean;
}

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
      logger.error(
        { err, database: sanitized },
        `[DATABASE_POOL_ERROR] Unexpected error on idle client for ${sanitized}`
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
    if (env.LOG_LEVEL === 'debug' && env.NODE_ENV !== 'test') {
      logger.debug({ err: err.message }, '[DATABASE_QUERY_ERROR]');
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
export async function beginTransaction(
  client?: PoolClient,
  options?: TransactionOptions
): Promise<PoolClient> {
  const targetClient = (client || (await getClient())) as TaggedClient;

  if (targetClient[IN_TRANSACTION_TAG]) {
    throw new AppError(
      'Nested transactions are not supported. A transaction is already active on this client.',
      500,
      ERROR_CODES.NESTED_TRANSACTION_NOT_SUPPORTED
    );
  }

  let beginSql = 'BEGIN';
  if (options?.isolationLevel) {
    beginSql += ` ISOLATION LEVEL ${options.isolationLevel}`;
  }
  if (options?.readOnly) {
    beginSql += ' READ ONLY';
  }

  await targetClient.query(beginSql);
  targetClient[IN_TRANSACTION_TAG] = true;
  return targetClient;
}

/**
 * Commits a transaction and releases client.
 */
export async function commitTransaction(client: PoolClient): Promise<void> {
  const tagged = client as TaggedClient;
  try {
    await tagged.query('COMMIT');
  } finally {
    tagged[IN_TRANSACTION_TAG] = false;
    tagged.release();
  }
}

/**
 * Rolls back a transaction and releases client.
 */
export async function rollbackTransaction(client: PoolClient): Promise<void> {
  const tagged = client as TaggedClient;
  try {
    await tagged.query('ROLLBACK');
  } finally {
    tagged[IN_TRANSACTION_TAG] = false;
    tagged.release();
  }
}

/**
 * Sleep helper for retry delay with exponential backoff and jitter.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executes a callback within a managed database transaction with isolation support,
 * rejection of nested transactions, and bounded retry for serialization/deadlock errors.
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
  options: TransactionOptions = {},
  existingClient?: PoolClient
): Promise<T> {
  // 1. Detect and reject nested transactions
  if (existingClient) {
    const tagged = existingClient as TaggedClient;
    if (tagged[IN_TRANSACTION_TAG]) {
      throw new AppError(
        'Nested transactions are not supported. A database transaction is already active on this client.',
        500,
        ERROR_CODES.NESTED_TRANSACTION_NOT_SUPPORTED
      );
    }
  }

  const maxRetries = Math.max(0, options.maxRetries ?? 0);
  const baseDelay = options.retryDelayMs ?? 50;
  let attempt = 0;

  while (true) {
    const client = (existingClient || (await getClient())) as TaggedClient;
    let inTx = false;
    let shouldRetry = false;
    let backoffMs = 0;

    try {
      let beginSql = 'BEGIN';
      if (options.isolationLevel) {
        beginSql += ` ISOLATION LEVEL ${options.isolationLevel}`;
      }
      if (options.readOnly) {
        beginSql += ' READ ONLY';
      }

      await client.query(beginSql);
      client[IN_TRANSACTION_TAG] = true;
      inTx = true;

      const result = await callback(client);

      await client.query('COMMIT');
      client[IN_TRANSACTION_TAG] = false;
      inTx = false;

      return result;
    } catch (error: unknown) {
      if (inTx) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // Ignore rollback errors if transaction was aborted by server
        } finally {
          client[IN_TRANSACTION_TAG] = false;
        }
      }

      // Check if error is retryable (40001 serialization_failure or 40P01 deadlock_detected)
      const errCode = (error as { code?: string }).code;
      const isRetryable = errCode === '40001' || errCode === '40P01';

      if (isRetryable && attempt < maxRetries) {
        attempt++;
        backoffMs = baseDelay * Math.pow(2, attempt) + Math.floor(Math.random() * 25);
        logger.warn(
          { attempt, maxRetries, errCode, backoffMs },
          '[TRANSACTION_RETRY] Serialization or deadlock detected, retrying transaction'
        );
        shouldRetry = true;
      } else {
        throw error;
      }
    } finally {
      if (!existingClient) {
        client.release();
      }
    }

    if (shouldRetry) {
      await sleep(backoffMs);
      continue;
    }
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

export const pool: pg.Pool = new Proxy({} as pg.Pool, {
  get: (_target, prop: string | symbol) => {
    const instance = getPool();
    const value = Reflect.get(instance, prop);
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});
