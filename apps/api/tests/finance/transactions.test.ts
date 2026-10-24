import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import {
  setupTestDatabase,
  closeTestDatabase,
  cleanTestTables,
  getTestPool,
} from '../database/test-db-helper.js';
import { createAuthenticatedUser } from './finance-test-helper.js';

describe('Financial Module - Transactions & Void Logic (/api/v1/transactions)', () => {
  let incomeCategoryId: string;
  let expenseCategoryId: string;

  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanTestTables();

    const pool = getTestPool();
    const catIncome = await pool.query(
      `INSERT INTO categories (name, type, color, icon)
       VALUES ('Gaji Bulanan', 'income', '#10B981', 'wallet')
       RETURNING id`
    );
    incomeCategoryId = catIncome.rows[0].id;

    const catExpense = await pool.query(
      `INSERT INTO categories (name, type, color, icon)
       VALUES ('Makanan & Minuman', 'expense', '#EF4444', 'utensils')
       RETURNING id`
    );
    expenseCategoryId = catExpense.rows[0].id;
  });

  it('should create an income transaction, update wallet balance, and append a credit ledger entry', async () => {
    const session = await createAuthenticatedUser(app);

    const res = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        type: 'income',
        category_id: incomeCategoryId,
        amount: 5000000,
        description: 'Gaji bulan ini',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.amount).toBe(5000000);
    expect(res.body.data.type).toBe('income');
    expect(res.body.data.status).toBe('COMPLETED');
    expect(res.body.data.category.name).toBe('Gaji Bulanan');

    // Verify wallet balance in DB
    const pool = getTestPool();
    const dbWallet = await pool.query('SELECT balance::text FROM wallets WHERE id = $1', [
      session.wallet.id,
    ]);
    expect(dbWallet.rows[0].balance).toBe('5000000');

    // Verify ledger entry
    const entries = await pool.query(
      'SELECT * FROM wallet_entries WHERE wallet_id = $1 ORDER BY created_at DESC',
      [session.wallet.id]
    );
    expect(entries.rows.length).toBe(1);
    expect(entries.rows[0].entry_type).toBe('credit');
    expect(entries.rows[0].reference_type).toBe('transaction');
    expect(entries.rows[0].amount).toBe('5000000');
    expect(entries.rows[0].balance_after).toBe('5000000');
  });

  it('should create an expense transaction, deduct balance, and append a debit ledger entry', async () => {
    const session = await createAuthenticatedUser(app, { initialBalance: 1000000 });

    const res = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        type: 'expense',
        category_id: expenseCategoryId,
        amount: 250000,
        description: 'Makan malam',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.amount).toBe(250000);
    expect(res.body.data.type).toBe('expense');
    expect(res.body.data.status).toBe('COMPLETED');

    // Verify wallet balance in DB
    const pool = getTestPool();
    const dbWallet = await pool.query('SELECT balance::text FROM wallets WHERE id = $1', [
      session.wallet.id,
    ]);
    expect(dbWallet.rows[0].balance).toBe('750000');

    // Verify ledger entry
    const entries = await pool.query(
      'SELECT * FROM wallet_entries WHERE wallet_id = $1 ORDER BY created_at DESC',
      [session.wallet.id]
    );
    expect(entries.rows.length).toBe(2); // Topup + Expense
    expect(entries.rows[0].entry_type).toBe('debit');
    expect(entries.rows[0].amount).toBe('250000');
    expect(entries.rows[0].balance_after).toBe('750000');
  });

  it('should reject expense transaction exceeding balance with 400 and leave balance unchanged', async () => {
    const session = await createAuthenticatedUser(app, { initialBalance: 100000 });

    const res = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        type: 'expense',
        category_id: expenseCategoryId,
        amount: 500000,
        description: 'Beli barang mahal',
      })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INSUFFICIENT_BALANCE');

    // Verify balance remains 100000
    const pool = getTestPool();
    const dbWallet = await pool.query('SELECT balance::text FROM wallets WHERE id = $1', [
      session.wallet.id,
    ]);
    expect(dbWallet.rows[0].balance).toBe('100000');

    // Verify no new transaction was created
    const txCount = await pool.query(
      'SELECT COUNT(*) as count FROM transactions WHERE wallet_id = $1',
      [session.wallet.id]
    );
    expect(parseInt(txCount.rows[0].count, 10)).toBe(0);
  });

  it('should update non-financial metadata but prevent editing amount or type', async () => {
    const session = await createAuthenticatedUser(app, { initialBalance: 500000 });

    const createRes = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        type: 'expense',
        category_id: expenseCategoryId,
        amount: 100000,
        description: 'Original note',
      })
      .expect(201);

    const txId = createRes.body.data.id;

    // Try updating metadata along with malicious financial changes
    const updateRes = await request(app)
      .put(`/api/v1/transactions/${txId}`)
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        description: 'Updated note after review',
        amount: 10, // Must be ignored
        type: 'income', // Must be ignored
      })
      .expect(200);

    expect(updateRes.body.success).toBe(true);
    expect(updateRes.body.data.description).toBe('Updated note after review');
    expect(updateRes.body.data.amount).toBe(100000); // Unaltered
    expect(updateRes.body.data.type).toBe('expense'); // Unaltered

    // Check DB directly
    const pool = getTestPool();
    const dbTx = await pool.query(
      'SELECT amount::text, type, description FROM transactions WHERE id = $1',
      [txId]
    );
    expect(dbTx.rows[0].amount).toBe('100000');
    expect(dbTx.rows[0].type).toBe('expense');
    expect(dbTx.rows[0].description).toBe('Updated note after review');
  });

  it('should void an expense transaction and refund the balance with a compensating credit ledger entry', async () => {
    const session = await createAuthenticatedUser(app, { initialBalance: 500000 });

    const createRes = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        type: 'expense',
        category_id: expenseCategoryId,
        amount: 150000,
        description: 'Makan siang salah catat',
      })
      .expect(201);

    const txId = createRes.body.data.id;

    // Void the transaction
    const voidRes = await request(app)
      .delete(`/api/v1/transactions/${txId}`)
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);

    expect(voidRes.body.success).toBe(true);
    expect(voidRes.body.data.status).toBe('VOIDED');
    expect(voidRes.body.data.deleted_at).toBeDefined();

    // Verify wallet balance is refunded back to 500000
    const pool = getTestPool();
    const dbWallet = await pool.query('SELECT balance::text FROM wallets WHERE id = $1', [
      session.wallet.id,
    ]);
    expect(dbWallet.rows[0].balance).toBe('500000');

    // Verify compensating ledger entry
    const entries = await pool.query(
      'SELECT * FROM wallet_entries WHERE wallet_id = $1 ORDER BY created_at DESC',
      [session.wallet.id]
    );
    expect(entries.rows[0].entry_type).toBe('credit');
    expect(entries.rows[0].reference_type).toBe('transaction_void');
    expect(entries.rows[0].amount).toBe('150000');
    expect(entries.rows[0].balance_after).toBe('500000');
  });

  it('should void an income transaction and deduct the balance with a compensating debit ledger entry', async () => {
    const session = await createAuthenticatedUser(app, { initialBalance: 100000 });

    const createRes = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        type: 'income',
        category_id: incomeCategoryId,
        amount: 400000,
        description: 'Bonus keliru',
      })
      .expect(201);

    const txId = createRes.body.data.id;

    // Void the income transaction
    const voidRes = await request(app)
      .delete(`/api/v1/transactions/${txId}`)
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);

    expect(voidRes.body.success).toBe(true);
    expect(voidRes.body.data.status).toBe('VOIDED');

    // Balance should be back to 100000
    const pool = getTestPool();
    const dbWallet = await pool.query('SELECT balance::text FROM wallets WHERE id = $1', [
      session.wallet.id,
    ]);
    expect(dbWallet.rows[0].balance).toBe('100000');

    // Verify compensating ledger entry
    const entries = await pool.query(
      'SELECT * FROM wallet_entries WHERE wallet_id = $1 ORDER BY created_at DESC',
      [session.wallet.id]
    );
    expect(entries.rows[0].entry_type).toBe('debit');
    expect(entries.rows[0].reference_type).toBe('transaction_void');
    expect(entries.rows[0].amount).toBe('400000');
    expect(entries.rows[0].balance_after).toBe('100000');
  });

  it('should reject voiding an already voided transaction (terminal state)', async () => {
    const session = await createAuthenticatedUser(app, { initialBalance: 200000 });

    const createRes = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        type: 'expense',
        category_id: expenseCategoryId,
        amount: 50000,
      })
      .expect(201);

    const txId = createRes.body.data.id;

    // First void -> 200 OK
    await request(app)
      .delete(`/api/v1/transactions/${txId}`)
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);

    // Second void -> 400 BadRequest
    const res = await request(app)
      .delete(`/api/v1/transactions/${txId}`)
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('TRANSACTION_ALREADY_VOIDED');
  });

  it('should hide voided transactions from default listing and enforce column sort whitelist', async () => {
    const session = await createAuthenticatedUser(app, { initialBalance: 500000 });

    // Create 2 transactions
    const t1 = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        type: 'expense',
        category_id: expenseCategoryId,
        amount: 50000,
        description: 'Beli Kopi',
      })
      .expect(201);

    await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        type: 'expense',
        category_id: expenseCategoryId,
        amount: 75000,
        description: 'Beli Teh',
      })
      .expect(201);

    // Void t1
    await request(app)
      .delete(`/api/v1/transactions/${t1.body.data.id}`)
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);

    // Default list -> only active COMPLETED transactions
    const listRes = await request(app)
      .get('/api/v1/transactions')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);

    expect(listRes.body.data.length).toBe(1);
    expect(listRes.body.data[0].description).toBe('Beli Teh');

    // List with status=ALL -> shows both
    const allRes = await request(app)
      .get('/api/v1/transactions?status=ALL')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);

    expect(allRes.body.data.length).toBe(2);

    // Sort by amount asc
    const sortRes = await request(app)
      .get('/api/v1/transactions?status=ALL&sort_by=amount&sort_order=asc')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);

    expect(sortRes.body.data[0].amount).toBe(50000);
    expect(sortRes.body.data[1].amount).toBe(75000);
  });

  it('should prevent IDOR access to another user transaction', async () => {
    const userA = await createAuthenticatedUser(app, { initialBalance: 300000 });
    const userB = await createAuthenticatedUser(app, { initialBalance: 300000 });

    const createRes = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({
        type: 'expense',
        category_id: expenseCategoryId,
        amount: 25000,
        description: 'User A Secret Transaction',
      })
      .expect(201);

    const txId = createRes.body.data.id;

    // User B attempts to read User A's transaction
    await request(app)
      .get(`/api/v1/transactions/${txId}`)
      .set('Authorization', `Bearer ${userB.accessToken}`)
      .expect(404);

    // User B attempts to update User A's transaction
    await request(app)
      .put(`/api/v1/transactions/${txId}`)
      .set('Authorization', `Bearer ${userB.accessToken}`)
      .send({ description: 'Hacked by B' })
      .expect(404);

    // User B attempts to void User A's transaction
    await request(app)
      .delete(`/api/v1/transactions/${txId}`)
      .set('Authorization', `Bearer ${userB.accessToken}`)
      .expect(404);
  });

  it('should reject voiding an income transaction if current balance is insufficient to reverse, leaving balance and status intact without partial effects', async () => {
    // 1. Initial wallet funded with 100,000 IDR
    const session = await createAuthenticatedUser(app, { initialBalance: 100000 });

    // 2. Add income transaction of 500,000 IDR -> balance becomes 600,000 IDR
    const incomeRes = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        type: 'income',
        category_id: incomeCategoryId,
        amount: 500000,
        description: 'Pemasukan proyek',
      })
      .expect(201);

    const incomeTxId = incomeRes.body.data.id;

    // 3. Spend 550,000 IDR on an expense -> balance becomes 50,000 IDR
    await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        type: 'expense',
        category_id: expenseCategoryId,
        amount: 550000,
        description: 'Beli laptop bekas',
      })
      .expect(201);

    // Verify current balance is indeed 50,000
    const pool = getTestPool();
    const beforeVoidWallet = await pool.query('SELECT balance::text FROM wallets WHERE id = $1', [
      session.wallet.id,
    ]);
    expect(beforeVoidWallet.rows[0].balance).toBe('50000');

    // 4. Attempt to void the 500,000 IDR income transaction.
    // Since balance is only 50,000, subtracting 500,000 would cause negative balance.
    // Must be rejected with 400 INSUFFICIENT_BALANCE!
    const voidRes = await request(app)
      .delete(`/api/v1/transactions/${incomeTxId}`)
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(400);

    expect(voidRes.body.success).toBe(false);
    expect(voidRes.body.error.code).toBe('INSUFFICIENT_BALANCE');
    expect(voidRes.body.error.message).toContain('Saldo dompet tidak mencukupi untuk membatalkan transaksi pemasukan');

    // 5. Verify NO partial effects:
    // Wallet balance strictly unchanged at 50,000 IDR (never negative!)
    const afterVoidWallet = await pool.query('SELECT balance::text FROM wallets WHERE id = $1', [
      session.wallet.id,
    ]);
    expect(afterVoidWallet.rows[0].balance).toBe('50000');

    // Transaction status remains COMPLETED (NOT VOIDED, deleted_at is NULL)
    const txDb = await pool.query('SELECT status, deleted_at FROM transactions WHERE id = $1', [
      incomeTxId,
    ]);
    expect(txDb.rows[0].status).toBe('COMPLETED');
    expect(txDb.rows[0].deleted_at).toBeNull();

    // No compensating ledger entry was created
    const compensatingEntries = await pool.query(
      `SELECT * FROM wallet_entries WHERE reference_id = $1 AND reference_type = 'transaction_void'`,
      [incomeTxId]
    );
    expect(compensatingEntries.rows.length).toBe(0);
  });

  it('should reject creating or updating a transaction using a custom category owned by another user with 404 NOT_FOUND', async () => {
    const userA = await createAuthenticatedUser(app, { initialBalance: 500000 });
    const userB = await createAuthenticatedUser(app, { initialBalance: 500000 });
    const pool = getTestPool();

    // Create a private custom category belonging strictly to userA
    const catRes = await pool.query(
      `INSERT INTO categories (user_id, name, type, color, icon)
       VALUES ($1, 'User A Private Category', 'expense', '#8B5CF6', 'lock')
       RETURNING id`,
      [userA.user.id]
    );
    const userAPrivateCategoryId = catRes.rows[0].id;

    // 1. User B attempts to CREATE a transaction using User A's private category
    const createRes = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${userB.accessToken}`)
      .send({
        type: 'expense',
        category_id: userAPrivateCategoryId,
        amount: 50000,
        description: 'Attempting to use user A category',
      })
      .expect(404);

    expect(createRes.body.success).toBe(false);
    expect(createRes.body.error.message).toContain('Kategori tidak ditemukan atau telah dihapus');

    // 2. User B creates a valid transaction with system expense category
    const validTx = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${userB.accessToken}`)
      .send({
        type: 'expense',
        category_id: expenseCategoryId,
        amount: 25000,
        description: 'Valid expense',
      })
      .expect(201);

    // 3. User B attempts to UPDATE the transaction metadata with User A's private category
    const updateRes = await request(app)
      .put(`/api/v1/transactions/${validTx.body.data.id}`)
      .set('Authorization', `Bearer ${userB.accessToken}`)
      .send({
        category_id: userAPrivateCategoryId,
        description: 'Hacked category update',
      })
      .expect(404);

    expect(updateRes.body.success).toBe(false);
    expect(updateRes.body.error.message).toContain('Kategori tidak ditemukan atau telah dihapus');
  });

  it('should prevent mass assignment on transaction creation (ignoring client-supplied balance, status, owner, wallet_id)', async () => {
    const victim = await createAuthenticatedUser(app, { initialBalance: 1000000 });
    const attacker = await createAuthenticatedUser(app, { initialBalance: 200000 });

    // Attacker tries to inject mass-assignment fields:
    // - balance: 999999999
    // - status: VOIDED
    // - wallet_id: victim.wallet.id
    // - user_id: victim.user.id
    // - deleted_at: '2026-01-01T00:00:00Z'
    const res = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${attacker.accessToken}`)
      .send({
        type: 'expense',
        category_id: expenseCategoryId,
        amount: 50000,
        description: 'Mass assignment attempt',
        balance: 999999999,
        status: 'VOIDED',
        wallet_id: victim.wallet.id,
        user_id: victim.user.id,
        deleted_at: '2026-01-01T00:00:00Z',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    // Verified that wallet_id belongs to attacker, NOT victim
    expect(res.body.data.wallet_id).toBe(attacker.wallet.id);
    expect(res.body.data.wallet_id).not.toBe(victim.wallet.id);
    // Status is COMPLETED, NOT the injected VOIDED
    expect(res.body.data.status).toBe('COMPLETED');
    expect(res.body.data.deleted_at).toBeNull();

    // Verify DB integrity
    const pool = getTestPool();
    const attackerWallet = await pool.query('SELECT balance::text FROM wallets WHERE id = $1', [
      attacker.wallet.id,
    ]);
    const victimWallet = await pool.query('SELECT balance::text FROM wallets WHERE id = $1', [
      victim.wallet.id,
    ]);

    // Attacker balance deducted by 50,000 (200,000 - 50,000 = 150,000), not overwritten by 999999999
    expect(attackerWallet.rows[0].balance).toBe('150000');
    // Victim balance remains completely untouched at 1,000,000
    expect(victimWallet.rows[0].balance).toBe('1000000');
  });

  it('should reject income transaction exceeding maximum per-transaction limit with 400 LIMIT_EXCEEDED', async () => {
    const session = await createAuthenticatedUser(app);

    const res = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        type: 'income',
        category_id: incomeCategoryId,
        amount: 50_000_001, // exceeds 50,000,000 max limit
        description: 'Exceeding income limit',
      })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('LIMIT_EXCEEDED');
  });
});

