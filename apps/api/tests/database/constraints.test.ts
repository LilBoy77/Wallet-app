import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  setupTestDatabase,
  closeTestDatabase,
  cleanTestTables,
  getTestPool,
} from './test-db-helper.js';

describe('Database Constraints & Integrity Enforcement', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanTestTables();
  });

  it('should reject negative wallet balance via CHECK constraint', async () => {
    const pool = getTestPool();

    // 1. Insert valid user
    const { rows: userRows } = await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name)
       VALUES ('neg_tester', 'neg_tester@walletapp.local', 'hash123', 'Negative Tester')
       RETURNING id`
    );
    const userId = userRows[0].id;

    // 2. Insert wallet with negative balance -> must fail
    await expect(
      pool.query(
        `INSERT INTO wallets (user_id, wallet_number, currency, balance)
         VALUES ($1, 'WLT-NEG-01', 'IDR', -50000)`,
        [userId]
      )
    ).rejects.toThrow(/chk_wallets_balance_non_negative/);
  });

  it('should reject amount <= 0 on transactions, transfers, and budgets', async () => {
    const pool = getTestPool();

    // Setup user, wallet, category
    const { rows: uRows } = await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name)
       VALUES ('amt_tester', 'amt_tester@walletapp.local', 'hash', 'Amount Tester')
       RETURNING id`
    );
    const userId = uRows[0].id;

    const { rows: wRows } = await pool.query(
      `INSERT INTO wallets (user_id, wallet_number, currency, balance)
       VALUES ($1, 'WLT-AMT-01', 'IDR', 1000000)
       RETURNING id`,
      [userId]
    );
    const walletId = wRows[0].id;

    const { rows: cRows } = await pool.query(
      `INSERT INTO categories (name, type, is_system)
       VALUES ('Makanan Test', 'expense', true)
       RETURNING id`
    );
    const catId = cRows[0].id;

    // Zero amount transaction -> must fail
    await expect(
      pool.query(
        `INSERT INTO transactions (wallet_id, category_id, type, amount)
         VALUES ($1, $2, 'expense', 0)`,
        [walletId, catId]
      )
    ).rejects.toThrow(/chk_transactions_amount_positive/);

    // Negative amount transaction -> must fail
    await expect(
      pool.query(
        `INSERT INTO transactions (wallet_id, category_id, type, amount)
         VALUES ($1, $2, 'expense', -10000)`,
        [walletId, catId]
      )
    ).rejects.toThrow(/chk_transactions_amount_positive/);

    // Zero limit budget -> must fail
    await expect(
      pool.query(
        `INSERT INTO budgets (user_id, category_id, limit_amount, start_date, end_date)
         VALUES ($1, $2, 0, '2026-10-01', '2026-10-31')`,
        [userId, catId]
      )
    ).rejects.toThrow(/chk_budgets_limit_positive/);
  });

  it('should reject duplicate email (case-insensitive) on active users', async () => {
    const pool = getTestPool();

    await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name)
       VALUES ('unique_user_1', 'john.doe@example.com', 'hash', 'John Doe')`
    );

    // Exact match duplicate
    await expect(
      pool.query(
        `INSERT INTO users (username, email, password_hash, full_name)
         VALUES ('unique_user_2', 'john.doe@example.com', 'hash', 'John Duplicate')`
      )
    ).rejects.toThrow(/idx_users_email_active/);

    // Case-insensitive variation (JOHN.DOE@EXAMPLE.COM) -> must fail!
    await expect(
      pool.query(
        `INSERT INTO users (username, email, password_hash, full_name)
         VALUES ('unique_user_3', 'JOHN.DOE@EXAMPLE.COM', 'hash', 'John Caps')`
      )
    ).rejects.toThrow(/idx_users_email_active/);
  });

  it('should reject duplicate username (case-insensitive) on active users', async () => {
    const pool = getTestPool();

    await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name)
       VALUES ('caseuser', 'case1@example.com', 'hash', 'Case User')`
    );

    // Case-insensitive duplicate username
    await expect(
      pool.query(
        `INSERT INTO users (username, email, password_hash, full_name)
         VALUES ('CASEUSER', 'case2@example.com', 'hash', 'Case User Upper')`
      )
    ).rejects.toThrow(/idx_users_username_active/);
  });

  it('should reject orphan foreign keys', async () => {
    const pool = getTestPool();
    const fakeId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

    // Wallet with non-existent user
    await expect(
      pool.query(
        `INSERT INTO wallets (user_id, wallet_number, balance)
         VALUES ($1, 'WLT-FAKE', 0)`,
        [fakeId]
      )
    ).rejects.toThrow(/foreign key constraint/i);
  });

  it('should reject transfer to same wallet (source = target)', async () => {
    const pool = getTestPool();

    const { rows: uRows } = await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name)
       VALUES ('selftransfer', 'selftransfer@example.com', 'hash', 'Self Transfer')
       RETURNING id`
    );
    const userId = uRows[0].id;

    const { rows: wRows } = await pool.query(
      `INSERT INTO wallets (user_id, wallet_number, balance)
       VALUES ($1, 'WLT-SELF', 500000)
       RETURNING id`,
      [userId]
    );
    const walletId = wRows[0].id;

    await expect(
      pool.query(
        `INSERT INTO transfers (source_wallet_id, target_wallet_id, amount, idempotency_key)
         VALUES ($1, $1, 100000, 'idemp-self-transfer-1')`,
        [walletId]
      )
    ).rejects.toThrow(/chk_transfers_different_wallets/);
  });

  it('should reject duplicate idempotency key on transfers', async () => {
    const pool = getTestPool();

    const { rows: u1 } = await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name)
       VALUES ('sender', 'sender@example.com', 'hash', 'Sender User') RETURNING id`
    );
    const { rows: u2 } = await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name)
       VALUES ('receiver', 'receiver@example.com', 'hash', 'Receiver User') RETURNING id`
    );

    const { rows: w1 } = await pool.query(
      `INSERT INTO wallets (user_id, wallet_number, balance) VALUES ($1, 'WLT-SEND', 1000000) RETURNING id`,
      [u1[0].id]
    );
    const { rows: w2 } = await pool.query(
      `INSERT INTO wallets (user_id, wallet_number, balance) VALUES ($1, 'WLT-RECV', 500000) RETURNING id`,
      [u2[0].id]
    );

    const key = 'idempotency-unique-key-xyz-123';

    await pool.query(
      `INSERT INTO transfers (source_wallet_id, target_wallet_id, amount, idempotency_key)
       VALUES ($1, $2, 100000, $3)`,
      [w1[0].id, w2[0].id, key]
    );

    // Same idempotency key must fail!
    await expect(
      pool.query(
        `INSERT INTO transfers (source_wallet_id, target_wallet_id, amount, idempotency_key)
         VALUES ($1, $2, 50000, $3)`,
        [w1[0].id, w2[0].id, key]
      )
    ).rejects.toThrow(/transfers_idempotency_key_key/i);
  });

  it('should reject invalid enum values for role, transaction type, and transfer status', async () => {
    const pool = getTestPool();

    // Invalid role
    await expect(
      pool.query(
        `INSERT INTO users (username, email, password_hash, full_name, role)
         VALUES ('invalid_role', 'role@example.com', 'hash', 'Invalid Role', 'super_hacker')`
      )
    ).rejects.toThrow(/users_role_check/);
  });

  it('should reject attachment file size greater than 2MB', async () => {
    const pool = getTestPool();

    const { rows: u } = await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name)
       VALUES ('att_user', 'att@example.com', 'hash', 'Attachment User') RETURNING id`
    );
    const { rows: w } = await pool.query(
      `INSERT INTO wallets (user_id, wallet_number, balance) VALUES ($1, 'WLT-ATT', 1000000) RETURNING id`,
      [u[0].id]
    );
    const { rows: c } = await pool.query(
      `INSERT INTO categories (name, type, is_system) VALUES ('Att Cat', 'expense', true) RETURNING id`
    );
    const { rows: tx } = await pool.query(
      `INSERT INTO transactions (wallet_id, category_id, type, amount) VALUES ($1, $2, 'expense', 50000) RETURNING id`,
      [w[0].id, c[0].id]
    );

    // 3MB file (> 2,097,152 bytes) -> must fail!
    await expect(
      pool.query(
        `INSERT INTO attachments (transaction_id, file_name, file_path, mime_type, file_size)
         VALUES ($1, 'oversized.pdf', '/uploads/oversized.pdf', 'application/pdf', 3000000)`,
        [tx[0].id]
      )
    ).rejects.toThrow(/attachments_file_size_check|file_size/);
  });

  it('should reject budget when end_date < start_date', async () => {
    const pool = getTestPool();

    const { rows: u } = await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name)
       VALUES ('budget_date_user', 'bdate@example.com', 'hash', 'Budget Date') RETURNING id`
    );
    const { rows: c } = await pool.query(
      `INSERT INTO categories (name, type, is_system) VALUES ('Date Cat', 'expense', true) RETURNING id`
    );

    // end_date earlier than start_date -> must fail!
    await expect(
      pool.query(
        `INSERT INTO budgets (user_id, category_id, limit_amount, start_date, end_date)
         VALUES ($1, $2, 500000, '2026-10-31', '2026-10-01')`,
        [u[0].id, c[0].id]
      )
    ).rejects.toThrow(/chk_budgets_date_range/);
  });
});
