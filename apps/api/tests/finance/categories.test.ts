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

describe('Categories Module (/api/v1/categories)', () => {
  let systemIncomeCatId: string;
  let systemExpenseCatId: string;

  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanTestTables();

    const pool = getTestPool();
    // Seed system categories
    const res1 = await pool.query(
      `INSERT INTO categories (name, type, color, icon, is_system, user_id)
       VALUES ('Gaji Sistem', 'income', '#10B981', 'briefcase', true, NULL)
       RETURNING id`
    );
    systemIncomeCatId = res1.rows[0].id;

    const res2 = await pool.query(
      `INSERT INTO categories (name, type, color, icon, is_system, user_id)
       VALUES ('Makan Sistem', 'expense', '#EF4444', 'utensils', true, NULL)
       RETURNING id`
    );
    systemExpenseCatId = res2.rows[0].id;
  });

  describe('GET /api/v1/categories', () => {
    it('should list system categories and user-specific categories', async () => {
      const userA = await createAuthenticatedUser(app);
      const userB = await createAuthenticatedUser(app);

      // User A creates custom category
      await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({
          name: 'Freelance Design',
          type: 'income',
          color: '#3B82F6',
          icon: 'laptop',
        })
        .expect(201);

      // User B creates custom category
      await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .send({
          name: 'Buku & Kursus',
          type: 'expense',
          color: '#8B5CF6',
          icon: 'book',
        })
        .expect(201);

      // Fetch as User A
      const resA = await request(app)
        .get('/api/v1/categories')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .expect(200);

      expect(resA.body.success).toBe(true);
      const namesA = resA.body.data.map((c: { name: string }) => c.name);
      expect(namesA).toContain('Gaji Sistem');
      expect(namesA).toContain('Makan Sistem');
      expect(namesA).toContain('Freelance Design');
      expect(namesA).not.toContain('Buku & Kursus'); // User B's category not visible to User A

      // Filter by type=expense
      const resFilter = await request(app)
        .get('/api/v1/categories?type=expense')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .expect(200);

      expect(resFilter.body.data.every((c: { type: string }) => c.type === 'expense')).toBe(true);
      expect(resFilter.body.data.some((c: { name: string }) => c.name === 'Makan Sistem')).toBe(
        true
      );
      expect(resFilter.body.data.some((c: { name: string }) => c.name === 'Gaji Sistem')).toBe(
        false
      );
    });
  });

  describe('GET /api/v1/categories/:id', () => {
    it('should allow viewing system categories and own custom categories', async () => {
      const user = await createAuthenticatedUser(app);

      // Get system category
      const resSys = await request(app)
        .get(`/api/v1/categories/${systemIncomeCatId}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(resSys.body.data.id).toBe(systemIncomeCatId);
      expect(resSys.body.data.is_system).toBe(true);

      // Create and get custom category
      const createRes = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          name: 'Hobi Fotografi',
          type: 'expense',
        })
        .expect(201);

      const customId = createRes.body.data.id;
      const resCustom = await request(app)
        .get(`/api/v1/categories/${customId}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(resCustom.body.data.name).toBe('Hobi Fotografi');
    });

    it('should return 404 when requesting another user custom category (IDOR)', async () => {
      const userA = await createAuthenticatedUser(app);
      const userB = await createAuthenticatedUser(app);

      const createRes = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({
          name: 'Kategori Privat User A',
          type: 'expense',
        })
        .expect(201);

      const categoryId = createRes.body.data.id;

      // User B tries to view User A's category
      await request(app)
        .get(`/api/v1/categories/${categoryId}`)
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .expect(404);
    });
  });

  describe('POST /api/v1/categories', () => {
    it('should enforce unique category name per user and per type', async () => {
      const user = await createAuthenticatedUser(app);

      // 1. Create first category
      await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          name: 'Investasi Saham',
          type: 'income',
        })
        .expect(201);

      // 2. Duplicate same name and type should fail with 409 Conflict
      const dupRes = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          name: 'Investasi Saham',
          type: 'income',
        })
        .expect(409);

      expect(dupRes.body.success).toBe(false);

      // 3. Same name with DIFFERENT type ('expense') is allowed
      await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          name: 'Investasi Saham',
          type: 'expense',
        })
        .expect(201);
    });

    it('should allow reusing name after soft deleting previous category', async () => {
      const user = await createAuthenticatedUser(app);

      // Create
      const res1 = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          name: 'Langganan Streaming',
          type: 'expense',
        })
        .expect(201);

      const catId = res1.body.data.id;

      // Delete (soft-delete)
      await request(app)
        .delete(`/api/v1/categories/${catId}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      // Re-create with exact same name and type should succeed
      const res2 = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          name: 'Langganan Streaming',
          type: 'expense',
        })
        .expect(201);

      expect(res2.body.data.name).toBe('Langganan Streaming');
      expect(res2.body.data.id).not.toBe(catId);
    });
  });

  describe('PUT /api/v1/categories/:id', () => {
    it('should reject modification of system categories with 403 Forbidden', async () => {
      const user = await createAuthenticatedUser(app);

      const res = await request(app)
        .put(`/api/v1/categories/${systemExpenseCatId}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          name: 'Hacked System Category',
        })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Kategori');
    });

    it('should prevent IDOR when user B updates user A category', async () => {
      const userA = await createAuthenticatedUser(app);
      const userB = await createAuthenticatedUser(app);

      const resA = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({
          name: 'Tabungan A',
          type: 'income',
        })
        .expect(201);

      await request(app)
        .put(`/api/v1/categories/${resA.body.data.id}`)
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .send({
          name: 'Hacked by B',
        })
        .expect(404);
    });
  });

  describe('DELETE /api/v1/categories/:id', () => {
    it('should reject deletion of system categories with 403 Forbidden', async () => {
      const user = await createAuthenticatedUser(app);

      const res = await request(app)
        .delete(`/api/v1/categories/${systemIncomeCatId}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Kategori');
    });

    it('should soft-delete custom category successfully', async () => {
      const user = await createAuthenticatedUser(app);

      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          name: 'Untuk Dihapus',
          type: 'expense',
        })
        .expect(201);

      const catId = res.body.data.id;

      await request(app)
        .delete(`/api/v1/categories/${catId}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      // Verify category no longer returned in list
      const listRes = await request(app)
        .get('/api/v1/categories')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(listRes.body.data.some((c: { id: string }) => c.id === catId)).toBe(false);
    });
  });

  describe('Cross-Validation: Transactions Service Category Type Match', () => {
    it('should reject creating expense transaction with income category (400)', async () => {
      const session = await createAuthenticatedUser(app, { initialBalance: 1_000_000 });

      const res = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({
          type: 'expense',
          category_id: systemIncomeCatId, // mismatch!
          amount: 50_000,
          description: 'Mencoba belanja pakai kategori gaji',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Tipe kategori');
    });

    it('should reject creating income transaction with expense category (400)', async () => {
      const session = await createAuthenticatedUser(app);

      const res = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({
          type: 'income',
          category_id: systemExpenseCatId, // mismatch!
          amount: 500_000,
          description: 'Mencoba dapat uang pakai kategori makan',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Tipe kategori');
    });

    it('should prevent soft-deleted category from being selected for new transactions while preserving old transactions', async () => {
      const session = await createAuthenticatedUser(app, { initialBalance: 1_000_000 });

      // 1. Create a custom category
      const catRes = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({
          name: 'Katering Kantor',
          type: 'expense',
          color: '#F97316',
          icon: 'coffee',
        })
        .expect(201);

      const categoryId = catRes.body.data.id;

      // 2. Create transaction using this category
      const txRes = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({
          type: 'expense',
          category_id: categoryId,
          amount: 150_000,
          description: 'Makan siang catering',
        })
        .expect(201);

      const txId = txRes.body.data.id;
      expect(txRes.body.data.category.name).toBe('Katering Kantor');

      // 3. Soft-delete the category
      await request(app)
        .delete(`/api/v1/categories/${categoryId}`)
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(200);

      // 4. Attempt to create a NEW transaction with the soft-deleted category -> must fail with 404 NOT_FOUND
      const newTxRes = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({
          type: 'expense',
          category_id: categoryId,
          amount: 50_000,
          description: 'Transaksi baru dengan kategori terhapus',
        })
        .expect(404);

      expect(newTxRes.body.success).toBe(false);
      expect(newTxRes.body.error.message).toContain('Kategori tidak ditemukan atau telah dihapus');

      // 5. The PRE-EXISTING transaction still retrieves successfully and retains historical category data
      const oldTxRes = await request(app)
        .get(`/api/v1/transactions/${txId}`)
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(200);

      expect(oldTxRes.body.success).toBe(true);
      expect(oldTxRes.body.data.id).toBe(txId);
      expect(oldTxRes.body.data.category.name).toBe('Katering Kantor');
      expect(oldTxRes.body.data.amount).toBe(150_000);
    });
  });
});
