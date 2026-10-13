import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  setupTestDatabase,
  closeTestDatabase,
  cleanTestTables,
  getTestPool,
} from './test-db-helper.js';

describe('Append-Only Ledger Immutability Enforcement (wallet_entries)', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanTestTables();
  });

  it('should allow INSERT of new ledger entries but reject UPDATE and DELETE at database level', async () => {
    const pool = getTestPool();

    // 1. Setup user and wallet
    const { rows: u } = await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name)
       VALUES ('ledger_user', 'ledger@example.com', 'hash', 'Ledger User') RETURNING id`
    );
    const { rows: w } = await pool.query(
      `INSERT INTO wallets (user_id, wallet_number, balance)
       VALUES ($1, 'WLT-LEDGER-01', 500000) RETURNING id`,
      [u[0].id]
    );
    const walletId = w[0].id;

    // 2. INSERT into wallet_entries is permitted
    const { rows: entry } = await pool.query(
      `INSERT INTO wallet_entries (wallet_id, reference_type, entry_type, amount, balance_after)
       VALUES ($1, 'topup_simulation', 'credit', 500000, 500000)
       RETURNING id, amount, balance_after`,
      [walletId]
    );

    expect(entry[0].id).toBeDefined();
    const entryId = entry[0].id;

    // 3. Attempt to UPDATE ledger entry -> MUST be rejected by trigger!
    await expect(
      pool.query(`UPDATE wallet_entries SET amount = 999999 WHERE id = $1`, [entryId])
    ).rejects.toThrow(
      /wallet_entries is an append-only audit ledger and cannot be updated or deleted/
    );

    // 4. Attempt to DELETE ledger entry -> MUST be rejected by trigger!
    await expect(pool.query(`DELETE FROM wallet_entries WHERE id = $1`, [entryId])).rejects.toThrow(
      /wallet_entries is an append-only audit ledger and cannot be updated or deleted/
    );

    // 5. Verify the original row is intact and untouched
    const { rows: check } = await pool.query(
      `SELECT amount, balance_after FROM wallet_entries WHERE id = $1`,
      [entryId]
    );
    expect(parseInt(check[0].amount, 10)).toBe(500000);
    expect(parseInt(check[0].balance_after, 10)).toBe(500000);
  });
});
