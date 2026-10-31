import crypto from 'crypto';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { runSeeder } from '../../src/database/seeder.js';
import { ACTIVITY_ACTIONS } from '../../src/shared/logging/activity-log.helper.js';
import {
  setupTestDatabase,
  closeTestDatabase,
  cleanTestTables,
  getTestPool,
} from '../database/test-db-helper.js';
import { createAuthenticatedUser } from './finance-test-helper.js';

function assertSafeIntegerNumber(value: unknown, fieldPath: string): void {
  expect(typeof value, `${fieldPath} must be JSON number`).toBe('number');
  expect(Number.isInteger(value), `${fieldPath} must be integer`).toBe(true);
  expect(Number.isSafeInteger(value), `${fieldPath} must be IEEE-754 safe integer`).toBe(true);
  expect(Object.is(value, -0), `${fieldPath} must not be -0`).toBe(false);
}

describe('Money JSON Serialization Contract (Safe Integer number across all endpoints, idempotency cache, activity_logs & seeder)', () => {
  let incomeCategoryId: string;
  let expenseCategoryId: string;
  let adminToken: string;

  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanTestTables();
    const pool = getTestPool();

    const incRes = await pool.query<{ id: string }>(
      `INSERT INTO categories (name, type, is_system, icon, color)
       VALUES ('Gaji Kontrak', 'income', true, 'briefcase', '#22c55e')
       RETURNING id`
    );
    incomeCategoryId = incRes.rows[0]!.id;

    const expRes = await pool.query<{ id: string }>(
      `INSERT INTO categories (name, type, is_system, icon, color)
       VALUES ('Makan Kontrak', 'expense', true, 'utensils', '#f97316')
       RETURNING id`
    );
    expenseCategoryId = expRes.rows[0]!.id;

    const adminRes = await pool.query<{ id: string }>(
      `INSERT INTO users (username, email, password_hash, full_name, role)
       VALUES ('admin_money_contract', 'admin_money@wallet.local', '$argon2id$mock', 'Admin Money', 'admin')
       RETURNING id`
    );
    const adminId = adminRes.rows[0]!.id;
    const sessionRes = await pool.query<{ family_id: string }>(
      `INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at, is_revoked)
       VALUES ($1, 'hash_admin_money_contract', gen_random_uuid(), NOW() + INTERVAL '7 days', false)
       RETURNING family_id`,
      [adminId]
    );
    adminToken = jwt.sign(
      {
        sub: adminId,
        role: 'admin',
        email: 'admin_money@wallet.local',
        jti: 'admin-money-jti',
        sid: sessionRes.rows[0]!.family_id,
      },
      env.JWT_ACCESS_SECRET,
      { algorithm: 'HS256', expiresIn: '15m', issuer: env.JWT_ISSUER, audience: env.JWT_AUDIENCE }
    );
  });

  it('should return safe integer JSON numbers for every money field across wallets, topup, entries, transactions, transfers, idempotency cache, budgets, and snake_case activity_logs metadata', async () => {
    const sender = await createAuthenticatedUser(app);
    const receiver = await createAuthenticatedUser(app);
    const pool = getTestPool();

    // 1. Wallets GET & PUT
    const getWalletRes = await request(app)
      .get('/api/v1/wallets/my')
      .set('Authorization', `Bearer ${sender.accessToken}`)
      .expect(200);
    assertSafeIntegerNumber(getWalletRes.body.data.balance, 'GET /wallets/my -> balance');

    const putWalletRes = await request(app)
      .put('/api/v1/wallets/my')
      .set('Authorization', `Bearer ${sender.accessToken}`)
      .send({ name: 'Dompet Kontrak Utama' })
      .expect(200);
    assertSafeIntegerNumber(putWalletRes.body.data.balance, 'PUT /wallets/my -> balance');

    // 2. Top-up simulation
    const topupRes = await request(app)
      .post('/api/v1/wallets/my/topup')
      .set('Authorization', `Bearer ${sender.accessToken}`)
      .send({ amount: 2_000_000 })
      .expect(200);
    assertSafeIntegerNumber(topupRes.body.data.balance, 'POST /wallets/my/topup -> balance');
    expect(topupRes.body.data.balance).toBe(2_000_000);

    // 3. Budget CRUD (POST, GET list, GET detail, PUT, DELETE)
    const createBudgetRes = await request(app)
      .post('/api/v1/budgets')
      .set('Authorization', `Bearer ${sender.accessToken}`)
      .send({
        category_id: expenseCategoryId,
        limit_amount: 1_000_000,
        month: 10,
        year: 2026,
      })
      .expect(201);
    const budgetId = createBudgetRes.body.data.id as string;
    for (const key of ['limit_amount', 'spent_amount', 'remaining_amount'] as const) {
      assertSafeIntegerNumber(createBudgetRes.body.data[key], `POST /budgets -> ${key}`);
    }

    // 4. Transactions (income, expense, list, detail, metadata update, void)
    const incomeTxRes = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${sender.accessToken}`)
      .send({
        type: 'income',
        category_id: incomeCategoryId,
        amount: 500_000,
        transaction_date: '2026-10-10T09:00:00.000Z',
        description: 'Gaji Tambahan',
      })
      .expect(201);
    assertSafeIntegerNumber(incomeTxRes.body.data.amount, 'POST /transactions (income) -> amount');

    const expenseTxRes = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${sender.accessToken}`)
      .send({
        type: 'expense',
        category_id: expenseCategoryId,
        amount: 250_000,
        transaction_date: '2026-10-11T12:00:00.000Z',
        description: 'Makan Siang',
      })
      .expect(201);
    const expenseTxId = expenseTxRes.body.data.id as string;
    assertSafeIntegerNumber(
      expenseTxRes.body.data.amount,
      'POST /transactions (expense) -> amount'
    );

    const listTxRes = await request(app)
      .get('/api/v1/transactions')
      .set('Authorization', `Bearer ${sender.accessToken}`)
      .expect(200);
    expect(listTxRes.body.data.length).toBe(2);
    for (const tx of listTxRes.body.data) {
      assertSafeIntegerNumber(tx.amount, 'GET /transactions -> data[].amount');
    }

    const detailTxRes = await request(app)
      .get(`/api/v1/transactions/${expenseTxId}`)
      .set('Authorization', `Bearer ${sender.accessToken}`)
      .expect(200);
    assertSafeIntegerNumber(detailTxRes.body.data.amount, 'GET /transactions/:id -> amount');

    const updateTxRes = await request(app)
      .put(`/api/v1/transactions/${expenseTxId}`)
      .set('Authorization', `Bearer ${sender.accessToken}`)
      .send({ description: 'Makan Siang Klien' })
      .expect(200);
    assertSafeIntegerNumber(updateTxRes.body.data.amount, 'PUT /transactions/:id -> amount');

    // Re-check Budget realization after expense transaction
    const listBudgetsRes = await request(app)
      .get('/api/v1/budgets?month=10&year=2026')
      .set('Authorization', `Bearer ${sender.accessToken}`)
      .expect(200);
    expect(listBudgetsRes.body.data.length).toBe(1);
    for (const key of ['limit_amount', 'spent_amount', 'remaining_amount'] as const) {
      assertSafeIntegerNumber(listBudgetsRes.body.data[0][key], `GET /budgets -> data[0].${key}`);
    }

    const getBudgetRes = await request(app)
      .get(`/api/v1/budgets/${budgetId}`)
      .set('Authorization', `Bearer ${sender.accessToken}`)
      .expect(200);
    for (const key of ['limit_amount', 'spent_amount', 'remaining_amount'] as const) {
      assertSafeIntegerNumber(getBudgetRes.body.data[key], `GET /budgets/:id -> ${key}`);
    }

    const putBudgetRes = await request(app)
      .put(`/api/v1/budgets/${budgetId}`)
      .set('Authorization', `Bearer ${sender.accessToken}`)
      .send({ limit_amount: 1_200_000 })
      .expect(200);
    for (const key of ['limit_amount', 'spent_amount', 'remaining_amount'] as const) {
      assertSafeIntegerNumber(putBudgetRes.body.data[key], `PUT /budgets/:id -> ${key}`);
    }

    // Void income transaction
    const voidTxRes = await request(app)
      .delete(`/api/v1/transactions/${incomeTxRes.body.data.id}`)
      .set('Authorization', `Bearer ${sender.accessToken}`)
      .expect(200);
    assertSafeIntegerNumber(voidTxRes.body.data.amount, 'DELETE /transactions/:id -> amount');

    // Delete budget
    const delBudgetRes = await request(app)
      .delete(`/api/v1/budgets/${budgetId}`)
      .set('Authorization', `Bearer ${sender.accessToken}`)
      .expect(200);
    for (const key of ['limit_amount', 'spent_amount', 'remaining_amount'] as const) {
      assertSafeIntegerNumber(delBudgetRes.body.data[key], `DELETE /budgets/:id -> ${key}`);
    }

    // 5. Transfers (POST initial + idempotency replay + DB idempotency_records cache + GET list + GET detail)
    const idempKey = crypto.randomUUID();
    const transferPayload = {
      target_wallet_number: receiver.wallet.wallet_number,
      amount: 300_000,
      note: 'Transfer Kontrak Uang',
    };

    const createTransferRes = await request(app)
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${sender.accessToken}`)
      .set('Idempotency-Key', idempKey)
      .send(transferPayload)
      .expect(201);
    const transferId = createTransferRes.body.data.id as string;
    assertSafeIntegerNumber(createTransferRes.body.data.amount, 'POST /transfers (201) -> amount');

    const replayTransferRes = await request(app)
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${sender.accessToken}`)
      .set('Idempotency-Key', idempKey)
      .send(transferPayload)
      .expect(200);
    assertSafeIntegerNumber(
      replayTransferRes.body.data.amount,
      'POST /transfers (idempotent replay 200) -> amount'
    );

    const idempCacheDb = await pool.query<{ response_body: { amount: unknown } }>(
      `SELECT response_body FROM idempotency_records WHERE user_id = $1 AND idempotency_key = $2`,
      [sender.user.id, idempKey]
    );
    expect(idempCacheDb.rows.length).toBe(1);
    assertSafeIntegerNumber(
      idempCacheDb.rows[0]!.response_body.amount,
      'idempotency_records.response_body.amount'
    );

    const listTransfersRes = await request(app)
      .get('/api/v1/transfers')
      .set('Authorization', `Bearer ${sender.accessToken}`)
      .expect(200);
    expect(listTransfersRes.body.data.length).toBe(1);
    assertSafeIntegerNumber(
      listTransfersRes.body.data[0].amount,
      'GET /transfers -> data[0].amount'
    );

    const getTransferRes = await request(app)
      .get(`/api/v1/transfers/${transferId}`)
      .set('Authorization', `Bearer ${sender.accessToken}`)
      .expect(200);
    assertSafeIntegerNumber(getTransferRes.body.data.amount, 'GET /transfers/:id -> amount');

    // 6. Wallet Ledger Entries
    const entriesRes = await request(app)
      .get('/api/v1/wallets/my/entries?limit=50')
      .set('Authorization', `Bearer ${sender.accessToken}`)
      .expect(200);
    expect(entriesRes.body.data.length).toBeGreaterThanOrEqual(4);
    for (const entry of entriesRes.body.data) {
      assertSafeIntegerNumber(entry.amount, 'GET /wallets/my/entries -> data[].amount');
      assertSafeIntegerNumber(
        entry.balance_after,
        'GET /wallets/my/entries -> data[].balance_after'
      );
    }

    // 7. Activity Logs metadata (snake_case: amount, new_balance, limit_amount; all safe integer numbers)
    const adminLogsRes = await request(app)
      .get('/api/v1/admin/activity-logs?limit=100')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const logs = adminLogsRes.body.data as Array<{
      user_id: string | null;
      action: string;
      ip_address: string | null;
      metadata: Record<string, unknown>;
    }>;

    // Verify TRANSFER_RECEIVED metadata strictly contains only amount, source_wallet_number, and receiver's own new_balance (zero sender balance/PII/IP)
    const transferReceivedLogs = logs.filter(
      (l) => l.action === ACTIVITY_ACTIONS.TRANSFER_RECEIVED
    );
    expect(transferReceivedLogs).toHaveLength(1);
    const transferReceivedLog = transferReceivedLogs[0]!;
    expect(transferReceivedLog.user_id).toBe(receiver.user.id);
    expect(transferReceivedLog.ip_address).toBeNull();
    expect(Object.keys(transferReceivedLog.metadata).sort()).toEqual([
      'amount',
      'new_balance',
      'source_wallet_number',
    ]);
    expect(transferReceivedLog.metadata).toEqual({
      amount: 300_000,
      source_wallet_number: sender.wallet.wallet_number,
      new_balance: 300_000,
    });

    const actionsWithAmountAndNewBalance = [
      ACTIVITY_ACTIONS.TOPUP_SIMULATION,
      ACTIVITY_ACTIONS.TRANSACTION_CREATED,
      ACTIVITY_ACTIONS.TRANSACTION_VOIDED,
      ACTIVITY_ACTIONS.TRANSFER_SENT,
      ACTIVITY_ACTIONS.TRANSFER_RECEIVED,
    ];

    for (const expectedAction of actionsWithAmountAndNewBalance) {
      const matched = logs.filter((l) => l.action === expectedAction);
      expect(matched.length, `Expected log for ${expectedAction}`).toBeGreaterThanOrEqual(1);
      for (const item of matched) {
        assertSafeIntegerNumber(item.metadata.amount, `${expectedAction} -> metadata.amount`);
        assertSafeIntegerNumber(
          item.metadata.new_balance,
          `${expectedAction} -> metadata.new_balance`
        );
        expect(item.metadata.newBalance).toBeUndefined();
      }
    }

    for (const budgetAction of [ACTIVITY_ACTIONS.BUDGET_CREATED, ACTIVITY_ACTIONS.BUDGET_UPDATED]) {
      const matched = logs.filter((l) => l.action === budgetAction);
      expect(matched.length, `Expected log for ${budgetAction}`).toBeGreaterThanOrEqual(1);
      for (const item of matched) {
        assertSafeIntegerNumber(
          item.metadata.limit_amount,
          `${budgetAction} -> metadata.limit_amount`
        );
        expect(item.metadata.limitAmount).toBeUndefined();
      }
    }
  });

  it('should fail fast with HTTP 500 if a database BIGINT value exceeds Number.MAX_SAFE_INTEGER (2^53 - 1)', async () => {
    const user = await createAuthenticatedUser(app);
    const pool = getTestPool();

    const unsafeBigInt = (BigInt(Number.MAX_SAFE_INTEGER) + 1n).toString(); // 9007199254740992
    await pool.query(`UPDATE wallets SET balance = $1 WHERE id = $2`, [
      unsafeBigInt,
      user.wallet.id,
    ]);

    const res = await request(app)
      .get('/api/v1/wallets/my')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(500);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
  });

  it('should ensure deterministic seeder populates safe integer snake_case money metadata and valid ACTIVITY_ACTIONS', async () => {
    const pool = getTestPool();
    await runSeeder({ connectionString: pool.options.connectionString });

    const validCatalog = new Set<string>(Object.values(ACTIVITY_ACTIONS));
    const seededLogs = await pool.query<{
      action: string;
      metadata: Record<string, unknown>;
    }>('SELECT action, metadata FROM activity_logs');

    expect(seededLogs.rows.length).toBeGreaterThanOrEqual(20);
    for (const row of seededLogs.rows) {
      expect(validCatalog.has(row.action), `Seeded action '${row.action}' must be in catalog`).toBe(
        true
      );
      for (const moneyKey of ['amount', 'new_balance', 'limit_amount']) {
        if (moneyKey in row.metadata) {
          assertSafeIntegerNumber(row.metadata[moneyKey], `Seeder metadata.${moneyKey}`);
        }
      }
      expect(row.metadata.newBalance).toBeUndefined();
      expect(row.metadata.limitAmount).toBeUndefined();
    }
  });
});
