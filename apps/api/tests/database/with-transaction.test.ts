import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { query, withTransaction, getPool, closePool } from '../../src/database/index.js';
import { ERROR_CODES } from '../../src/shared/errors/error-catalog.js';

describe('withTransaction Managed Database Transaction Helper', () => {
  beforeAll(async () => {
    await query("DELETE FROM users WHERE email LIKE '%tx_test%'");
  });

  afterAll(async () => {
    await query("DELETE FROM users WHERE email LIKE '%tx_test%'");
    await closePool();
  });

  it('should commit successfully when callback succeeds', async () => {
    const testEmail = 'commit_tx_test@example.local';

    await withTransaction(async (client) => {
      await client.query(
        "INSERT INTO users (username, email, password_hash, full_name) VALUES ('commit_tx_user', $1, 'hash', 'Tx Commit')",
        [testEmail]
      );
    });

    // Verify record exists in database
    const check = await query('SELECT * FROM users WHERE email = $1', [testEmail]);
    expect(check.rows.length).toBe(1);
    expect(check.rows[0].email).toBe(testEmail);
  });

  it('should rollback transaction and not persist data when an error is thrown', async () => {
    const testEmail = 'rollback_tx_test@example.local';

    const txPromise = withTransaction(async (client) => {
      await client.query(
        "INSERT INTO users (username, email, password_hash, full_name) VALUES ('rollback_tx_user', $1, 'hash', 'Tx Rollback')",
        [testEmail]
      );
      throw new Error('Simulated business failure requiring rollback');
    });

    await expect(txPromise).rejects.toThrow('Simulated business failure requiring rollback');

    // Verify record was rolled back and does not exist in DB
    const check = await query('SELECT * FROM users WHERE email = $1', [testEmail]);
    expect(check.rows.length).toBe(0);
  });

  it('should always release the client back to the pool on success or failure', async () => {
    const pool = getPool();
    const initialIdleCount = pool.idleCount;

    // Successful transaction
    await withTransaction(async (client) => {
      await client.query('SELECT 1');
    });

    expect(pool.idleCount).toBeGreaterThanOrEqual(initialIdleCount);

    // Failed transaction
    try {
      await withTransaction(async (client) => {
        await client.query('SELECT 1');
        throw new Error('Failure test');
      });
    } catch {
      // Expected
    }

    // Client must still be released back to the pool
    expect(pool.idleCount).toBeGreaterThanOrEqual(initialIdleCount);
  });

  it('should detect and reject nested transactions with explicit AppError', async () => {
    const nestedTxPromise = withTransaction(async (client) => {
      // Attempting to invoke nested withTransaction passing the active client
      return await withTransaction(
        async (_innerClient) => {
          return 'nested-success';
        },
        {},
        client
      );
    });

    await expect(nestedTxPromise).rejects.toMatchObject({
      code: ERROR_CODES.NESTED_TRANSACTION_NOT_SUPPORTED,
      message: expect.stringContaining('Nested transactions are not supported'),
    });
  });

  it('should support explicit isolation levels (REPEATABLE READ, SERIALIZABLE)', async () => {
    const result = await withTransaction(
      async (client) => {
        const res = await client.query('SHOW transaction_isolation');
        return res.rows[0].transaction_isolation;
      },
      { isolationLevel: 'REPEATABLE READ' }
    );

    expect(result.toLowerCase()).toBe('repeatable read');
  });

  it('should perform bounded retries when retryable serialization error occurs and maxRetries > 0', async () => {
    let attempts = 0;

    const result = await withTransaction(
      async (_client) => {
        attempts++;
        if (attempts < 2) {
          // Simulate serialization failure (40001)
          const err = new Error('could not serialize access due to concurrent update');
          Object.assign(err, { code: '40001' });
          throw err;
        }
        return 'success_after_retry';
      },
      { maxRetries: 2, retryDelayMs: 10 }
    );

    expect(result).toBe('success_after_retry');
    expect(attempts).toBe(2);
  });
});
