import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import {
  setupTestDatabase,
  closeTestDatabase,
  cleanTestTables,
  getTestPool,
} from '../database/test-db-helper.js';
import { createAuthenticatedUser } from './finance-test-helper.js';

describe('Budgets Module (/api/v1/budgets)', () => {
  let expenseCatId: string;
  let incomeCatId: string;

  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanTestTables();

    const pool = getTestPool();
    const res1 = await pool.query(
      `INSERT INTO categories (name, type, color, icon, is_system, user_id)
       VALUES ('Makanan & Minuman', 'expense', '#EF4444', 'utensils', true, NULL)
       RETURNING id`
    );
    expenseCatId = res1.rows[0].id;

    const res2 = await pool.query(
      `INSERT INTO categories (name, type, color, icon, is_system, user_id)
       VALUES ('Gaji Bulanan', 'income', '#10B981', 'briefcase', true, NULL)
       RETURNING id`
    );
    incomeCatId = res2.rows[0].id;
  });

  describe('POST /api/v1/budgets', () => {
    it('should create a budget for an expense category', async () => {
      const user = await createAuthenticatedUser(app);

      const res = await request(app)
        .post('/api/v1/budgets')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          category_id: expenseCatId,
          limit_amount: 2_000_000,
          month: 10,
          year: 2026,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.category_id).toBe(expenseCatId);
      expect(res.body.data.limit_amount).toBe(2_000_000);
      expect(res.body.data.month).toBe(10);
      expect(res.body.data.year).toBe(2026);
      expect(res.body.data.spent_amount).toBe(0);
      expect(res.body.data.remaining_amount).toBe(2_000_000);
      expect(res.body.data.percentage).toBe(0);
      expect(res.body.data.percentage_bps).toBe(0);
      expect(res.body.data.is_exceeded).toBe(false);
    });

    it('should reject creating budget for an income category with 400 Bad Request', async () => {
      const user = await createAuthenticatedUser(app);

      const res = await request(app)
        .post('/api/v1/budgets')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          category_id: incomeCatId,
          limit_amount: 1_000_000,
          month: 10,
          year: 2026,
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('pengeluaran');
    });

    it('should reject duplicate budget for the same category and month with 409 Conflict', async () => {
      const user = await createAuthenticatedUser(app);

      await request(app)
        .post('/api/v1/budgets')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          category_id: expenseCatId,
          limit_amount: 1_500_000,
          month: 10,
          year: 2026,
        })
        .expect(201);

      const dupRes = await request(app)
        .post('/api/v1/budgets')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          category_id: expenseCatId,
          limit_amount: 2_500_000,
          month: 10,
          year: 2026,
        })
        .expect(409);

      expect(dupRes.body.success).toBe(false);
      expect(dupRes.body.error.message).toContain('sudah ada');
    });

    it('should allow recreating budget for same month after soft-deleting previous one', async () => {
      const user = await createAuthenticatedUser(app);

      const res1 = await request(app)
        .post('/api/v1/budgets')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          category_id: expenseCatId,
          limit_amount: 1_000_000,
          month: 10,
          year: 2026,
        })
        .expect(201);

      const budgetId = res1.body.data.id;

      // Soft delete
      await request(app)
        .delete(`/api/v1/budgets/${budgetId}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      // Recreate
      const res2 = await request(app)
        .post('/api/v1/budgets')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          category_id: expenseCatId,
          limit_amount: 3_000_000,
          month: 10,
          year: 2026,
        })
        .expect(201);

      expect(res2.body.data.id).not.toBe(budgetId);
      expect(res2.body.data.limit_amount).toBe(3_000_000);
    });
  });

  describe('Realization & Timezone Boundary Calculation', () => {
    it('should calculate realization accurately, strictly respecting Asia/Jakarta month boundaries and excluding voided/income tx', async () => {
      const user = await createAuthenticatedUser(app, { initialBalance: 10_000_000 });
      const pool = getTestPool();

      // Create budget for October 2026 (limit 1,000,000)
      const budgetRes = await request(app)
        .post('/api/v1/budgets')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          category_id: expenseCatId,
          limit_amount: 1_000_000,
          month: 10,
          year: 2026,
        })
        .expect(201);

      const budgetId = budgetRes.body.data.id;

      // 1. Transaction strictly inside October: 2026-10-15 12:00:00 WIB (+07) -> 200,000
      await pool.query(
        `INSERT INTO transactions (wallet_id, category_id, type, amount, status, description, transaction_date)
         VALUES ($1, $2, 'expense', 200000, 'COMPLETED', 'Makan Siang', '2026-10-15T12:00:00+07:00')`,
        [user.wallet.id, expenseCatId]
      );

      // 2. Boundary Test A: Exactly at start of month: 2026-10-01 00:00:00 WIB (+07) -> 150,000 (INCLUDED)
      await pool.query(
        `INSERT INTO transactions (wallet_id, category_id, type, amount, status, description, transaction_date)
         VALUES ($1, $2, 'expense', 150000, 'COMPLETED', 'Awal Bulan', '2026-10-01T00:00:00+07:00')`,
        [user.wallet.id, expenseCatId]
      );

      // 3. Boundary Test B: 1 second before month start: 2026-09-30 23:59:59 WIB (+07) -> 50,000 (EXCLUDED)
      await pool.query(
        `INSERT INTO transactions (wallet_id, category_id, type, amount, status, description, transaction_date)
         VALUES ($1, $2, 'expense', 50000, 'COMPLETED', 'Akhir September', '2026-09-30T23:59:59+07:00')`,
        [user.wallet.id, expenseCatId]
      );

      // 4. Boundary Test C: Exactly at end of month: 2026-10-31 23:59:59.999 WIB (+07) -> 250,000 (INCLUDED)
      await pool.query(
        `INSERT INTO transactions (wallet_id, category_id, type, amount, status, description, transaction_date)
         VALUES ($1, $2, 'expense', 250000, 'COMPLETED', 'Akhir Oktober', '2026-10-31T23:59:59.999+07:00')`,
        [user.wallet.id, expenseCatId]
      );

      // 5. Boundary Test D: 1 second into November: 2026-11-01 00:00:00 WIB (+07) -> 80,000 (EXCLUDED)
      await pool.query(
        `INSERT INTO transactions (wallet_id, category_id, type, amount, status, description, transaction_date)
         VALUES ($1, $2, 'expense', 80000, 'COMPLETED', 'Awal November', '2026-11-01T00:00:00+07:00')`,
        [user.wallet.id, expenseCatId]
      );

      // 6. VOIDED transaction inside October: 2026-10-20 -> 500,000 (EXCLUDED)
      await pool.query(
        `INSERT INTO transactions (wallet_id, category_id, type, amount, status, description, transaction_date)
         VALUES ($1, $2, 'expense', 500000, 'VOIDED', 'Transaksi Dibatalkan', '2026-10-20T10:00:00+07:00')`,
        [user.wallet.id, expenseCatId]
      );

      // Expected realization sum = 200,000 + 150,000 + 250,000 = 600,000
      // Limit = 1,000,000
      // Remaining = 400,000
      // Percentage = 60%
      // Basis points = 6000 bps
      const res = await request(app)
        .get(`/api/v1/budgets/${budgetId}?month=10&year=2026`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.spent_amount).toBe(600_000);
      expect(res.body.data.remaining_amount).toBe(400_000);
      expect(res.body.data.percentage).toBe(60);
      expect(res.body.data.percentage_bps).toBe(6000);
      expect(res.body.data.is_exceeded).toBe(false);
    });

    it('should enforce half-open interval [start_date, end_date + 1 day) with sub-millisecond precision (23:59:59.9995 counted, next-day 00:00:00 excluded) using configured BUDGET_TIMEZONE', async () => {
      const user = await createAuthenticatedUser(app, { initialBalance: 10_000_000 });
      const pool = getTestPool();

      // Create budget for October 2026 (2026-10-01 .. 2026-10-31)
      const budgetRes = await request(app)
        .post('/api/v1/budgets')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          category_id: expenseCatId,
          limit_amount: 1_000_000,
          month: 10,
          year: 2026,
        })
        .expect(201);

      const budgetId = budgetRes.body.data.id;

      // 1. Sub-millisecond edge on end_date: 2026-10-31 23:59:59.9995 in Asia/Jakarta (+07:00) -> MUST BE COUNTED
      await pool.query(
        `INSERT INTO transactions (wallet_id, category_id, type, amount, status, description, transaction_date)
         VALUES ($1, $2, 'expense', 125000, 'COMPLETED', 'Sub-ms akhir end_date', '2026-10-31 23:59:59.9995+07')`,
        [user.wallet.id, expenseCatId]
      );

      // 2. Exact midnight of day after end_date: 2026-11-01 00:00:00 in Asia/Jakarta (+07:00) -> MUST NOT BE COUNTED
      await pool.query(
        `INSERT INTO transactions (wallet_id, category_id, type, amount, status, description, transaction_date)
         VALUES ($1, $2, 'expense', 300000, 'COMPLETED', 'Tepat 00:00:00 hari berikutnya', '2026-11-01 00:00:00+07')`,
        [user.wallet.id, expenseCatId]
      );

      // Verify detail endpoint (Asia/Jakarta)
      const detailRes = await request(app)
        .get(`/api/v1/budgets/${budgetId}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(detailRes.body.data.spent_amount).toBe(125_000);
      expect(detailRes.body.data.remaining_amount).toBe(875_000);

      // Verify list endpoint (Asia/Jakarta)
      const listRes = await request(app)
        .get('/api/v1/budgets?month=10&year=2026')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      const listed = listRes.body.data.find((b: { id: string }) => b.id === budgetId);
      expect(listed).toBeDefined();
      expect(listed.spent_amount).toBe(125_000);

      // 3. Prove BUDGET_TIMEZONE parameter (AT TIME ZONE) drives realization (not hardcoded +07):
      // '2026-11-01 00:00:00+07' equals '2026-10-31 17:00:00+00' (still Oct 31 in UTC!).
      // Also insert '2026-10-31 23:59:59.9995+00' (counted in UTC) and '2026-11-01 00:00:00+00' (excluded in UTC).
      await pool.query(
        `INSERT INTO transactions (wallet_id, category_id, type, amount, status, description, transaction_date)
         VALUES ($1, $2, 'expense', 75000, 'COMPLETED', 'Sub-ms akhir end_date UTC', '2026-10-31 23:59:59.9995+00'),
                ($1, $2, 'expense', 90000, 'COMPLETED', 'Awal hari berikutnya UTC', '2026-11-01 00:00:00+00')`,
        [user.wallet.id, expenseCatId]
      );

      const originalTimezone = env.BUDGET_TIMEZONE;
      try {
        env.BUDGET_TIMEZONE = 'UTC';
        const utcRes = await request(app)
          .get(`/api/v1/budgets/${budgetId}`)
          .set('Authorization', `Bearer ${user.accessToken}`)
          .expect(200);

        // Under UTC [2026-10-01 00:00Z, 2026-11-01 00:00Z):
        // - 2026-10-31 23:59:59.9995+07 (= 16:59:59.9995Z): 125,000 (INCLUDED)
        // - 2026-11-01 00:00:00+07      (= 17:00:00.0000Z): 300,000 (INCLUDED in UTC!)
        // - 2026-10-31 23:59:59.9995+00 (= 23:59:59.9995Z):  75,000 (INCLUDED in UTC!)
        // - 2026-11-01 00:00:00+00      (= 00:00:00.0000Z):  90,000 (EXCLUDED in UTC!)
        expect(utcRes.body.data.spent_amount).toBe(500_000);
      } finally {
        env.BUDGET_TIMEZONE = originalTimezone;
      }
    });

    it('should mark is_exceeded as true when spent exceeds limit, without blocking transactions', async () => {
      const user = await createAuthenticatedUser(app, { initialBalance: 5_000_000 });

      // Create budget with limit 500,000
      const budgetRes = await request(app)
        .post('/api/v1/budgets')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          category_id: expenseCatId,
          limit_amount: 500_000,
          month: 10,
          year: 2026,
        })
        .expect(201);

      const budgetId = budgetRes.body.data.id;

      // Create expense transaction for 750,000 via API (should succeed because limit is informative)
      const txRes = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          type: 'expense',
          category_id: expenseCatId,
          amount: 750_000,
          description: 'Belanja melebihi budget',
          transaction_date: new Date('2026-10-10T10:00:00+07:00').toISOString(),
        })
        .expect(201);

      expect(txRes.body.success).toBe(true);

      // Verify budget realization reflects overspend
      const checkRes = await request(app)
        .get(`/api/v1/budgets/${budgetId}?month=10&year=2026`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(checkRes.body.data.spent_amount).toBe(750_000);
      expect(checkRes.body.data.remaining_amount).toBe(0);
      expect(checkRes.body.data.percentage).toBe(150);
      expect(checkRes.body.data.percentage_bps).toBe(15000);
      expect(checkRes.body.data.is_exceeded).toBe(true);
    });
  });

  describe('PUT /api/v1/budgets/:id', () => {
    it('should update budget limit_amount successfully', async () => {
      const user = await createAuthenticatedUser(app);

      const budgetRes = await request(app)
        .post('/api/v1/budgets')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          category_id: expenseCatId,
          limit_amount: 1_000_000,
          month: 10,
          year: 2026,
        })
        .expect(201);

      const budgetId = budgetRes.body.data.id;

      const updateRes = await request(app)
        .put(`/api/v1/budgets/${budgetId}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          limit_amount: 2_500_000,
        })
        .expect(200);

      expect(updateRes.body.success).toBe(true);
      expect(updateRes.body.data.limit_amount).toBe(2_500_000);
    });
  });

  describe('IDOR & Isolation Tests', () => {
    it('should return 404 when user B accesses, updates, or deletes user A budget', async () => {
      const userA = await createAuthenticatedUser(app);
      const userB = await createAuthenticatedUser(app);

      const budgetRes = await request(app)
        .post('/api/v1/budgets')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({
          category_id: expenseCatId,
          limit_amount: 1_000_000,
          month: 10,
          year: 2026,
        })
        .expect(201);

      const budgetId = budgetRes.body.data.id;

      // User B GET -> 404
      await request(app)
        .get(`/api/v1/budgets/${budgetId}`)
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .expect(404);

      // User B PUT -> 404
      await request(app)
        .put(`/api/v1/budgets/${budgetId}`)
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .send({ limit_amount: 9_999_999 })
        .expect(404);

      // User B DELETE -> 404
      await request(app)
        .delete(`/api/v1/budgets/${budgetId}`)
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .expect(404);
    });
  });

  describe('Budget Date Semantics, Realization Boundaries & Database Exclusion Guard', () => {
    it('should calculate realization strictly within budget start_date and end_date (free range independent of current calendar month)', async () => {
      const user = await createAuthenticatedUser(app, { initialBalance: 10_000_000 });
      const pool = getTestPool();

      // Create budget with custom free date range: 2026-05-10 to 2026-05-20 (limit 1,000,000)
      const budgetRes = await request(app)
        .post('/api/v1/budgets')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          category_id: expenseCatId,
          limit_amount: 1_000_000,
          start_date: '2026-05-10',
          end_date: '2026-05-20',
        })
        .expect(201);

      const budgetId = budgetRes.body.data.id;

      // 1. Transaction in same calendar month (May) but BEFORE start_date (2026-05-05) -> 400,000 (EXCLUDED)
      await pool.query(
        `INSERT INTO transactions (wallet_id, category_id, type, amount, status, description, transaction_date)
         VALUES ($1, $2, 'expense', 400000, 'COMPLETED', 'Sebelum Periode', '2026-05-05T12:00:00+07:00')`,
        [user.wallet.id, expenseCatId]
      );

      // 2. Transaction strictly INSIDE range (2026-05-15) -> 350,000 (INCLUDED)
      await pool.query(
        `INSERT INTO transactions (wallet_id, category_id, type, amount, status, description, transaction_date)
         VALUES ($1, $2, 'expense', 350000, 'COMPLETED', 'Di Dalam Periode', '2026-05-15T12:00:00+07:00')`,
        [user.wallet.id, expenseCatId]
      );

      // 3. Transaction in same calendar month (May) but AFTER end_date (2026-05-25) -> 250,000 (EXCLUDED)
      await pool.query(
        `INSERT INTO transactions (wallet_id, category_id, type, amount, status, description, transaction_date)
         VALUES ($1, $2, 'expense', 250000, 'COMPLETED', 'Setelah Periode', '2026-05-25T12:00:00+07:00')`,
        [user.wallet.id, expenseCatId]
      );

      // Verify GET /budgets/:id calculates spent_amount strictly on 2026-05-10..2026-05-20
      const detailRes = await request(app)
        .get(`/api/v1/budgets/${budgetId}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(detailRes.body.success).toBe(true);
      expect(detailRes.body.data.spent_amount).toBe(350_000);
      expect(detailRes.body.data.remaining_amount).toBe(650_000);
      expect(detailRes.body.data.percentage).toBe(35);
      expect(detailRes.body.data.percentage_bps).toBe(3500);

      // Verify list budgets for May 2026 also shows 350,000
      const listRes = await request(app)
        .get('/api/v1/budgets?month=5&year=2026')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      const found = listRes.body.data.find((b: { id: string }) => b.id === budgetId);
      expect(found).toBeDefined();
      expect(found.spent_amount).toBe(350_000);
    });

    it('should prevent overlapping budget periods atomically at database level during concurrent creations', async () => {
      const user = await createAuthenticatedUser(app);

      // Launch 2 simultaneous requests with overlapping date ranges for the same user and category
      // Range 1: 2026-07-01 to 2026-07-31
      // Range 2: 2026-07-15 to 2026-08-15
      const [res1, res2] = await Promise.all([
        request(app)
          .post('/api/v1/budgets')
          .set('Authorization', `Bearer ${user.accessToken}`)
          .send({
            category_id: expenseCatId,
            limit_amount: 1_000_000,
            start_date: '2026-07-01',
            end_date: '2026-07-31',
          }),
        request(app)
          .post('/api/v1/budgets')
          .set('Authorization', `Bearer ${user.accessToken}`)
          .send({
            category_id: expenseCatId,
            limit_amount: 1_500_000,
            start_date: '2026-07-15',
            end_date: '2026-08-15',
          }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      // Exactly one request must succeed (201) and one must be rejected (409 Conflict)
      expect(statuses).toEqual([201, 409]);

      const errorRes = res1.status === 409 ? res1 : res2;
      expect(errorRes.body.success).toBe(false);
      expect(['CONFLICT', 'DUPLICATE_ENTRY']).toContain(errorRes.body.error.code);
    });

    it('should reject creating budget for soft-deleted category, while existing budgets for soft-deleted category remain accessible with historical realization', async () => {
      const user = await createAuthenticatedUser(app, { initialBalance: 5_000_000 });
      const pool = getTestPool();

      // 1. Create a custom category
      const catRes = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          name: 'Langganan Gym',
          type: 'expense',
          color: '#10B981',
          icon: 'dumbbell',
        })
        .expect(201);

      const customCatId = catRes.body.data.id;

      // 2. Create budget for this custom category
      const budgetRes = await request(app)
        .post('/api/v1/budgets')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          category_id: customCatId,
          limit_amount: 800_000,
          month: 11,
          year: 2026,
        })
        .expect(201);

      const budgetId = budgetRes.body.data.id;

      // 3. Create a transaction under this custom category (300,000)
      await pool.query(
        `INSERT INTO transactions (wallet_id, category_id, type, amount, status, description, transaction_date)
         VALUES ($1, $2, 'expense', 300000, 'COMPLETED', 'Bayar Gym Member', '2026-11-05T10:00:00+07:00')`,
        [user.wallet.id, customCatId]
      );

      // 4. Soft-delete the category
      await request(app)
        .delete(`/api/v1/categories/${customCatId}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      // 5. Attempting to create a NEW budget with the soft-deleted category must be rejected (404 Not Found)
      const newBudgetRes = await request(app)
        .post('/api/v1/budgets')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          category_id: customCatId,
          limit_amount: 500_000,
          month: 12,
          year: 2026,
        })
        .expect(404);

      expect(newBudgetRes.body.success).toBe(false);
      expect(newBudgetRes.body.error.message).toContain('Kategori');

      // 6. The EXISTING budget for the soft-deleted category remains fully accessible with realization intact
      const existingBudgetRes = await request(app)
        .get(`/api/v1/budgets/${budgetId}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(existingBudgetRes.body.success).toBe(true);
      expect(existingBudgetRes.body.data.id).toBe(budgetId);
      expect(existingBudgetRes.body.data.category_name).toBe('Langganan Gym');
      expect(existingBudgetRes.body.data.spent_amount).toBe(300_000);
      expect(existingBudgetRes.body.data.remaining_amount).toBe(500_000);
    });
  });
});
