import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import {
  setupTestDatabase,
  closeTestDatabase,
  cleanTestTables,
  getTestPool,
} from '../database/test-db-helper.js';
import { env } from '../../src/config/env.js';
import { createAuthenticatedUser } from './finance-test-helper.js';

describe('Financial Module - Wallets & Ledger Entries (/api/v1/wallets)', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanTestTables();
  });

  it('should retrieve authenticated user wallet with zero initial balance and valid wallet number', async () => {
    const session = await createAuthenticatedUser(app);

    const res = await request(app)
      .get('/api/v1/wallets/my')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.id).toBe(session.wallet.id);
    expect(res.body.data.wallet_number).toMatch(/^WAL-[0-9A-F]{8}$/);
    expect(res.body.data.currency).toBe('IDR');
    expect(res.body.data.balance).toBe(0);
    expect(res.body.data.name).toBe('Dompet Utama');
    expect(res.body.data.is_active).toBe(true);
  });

  it('should reject unauthorized access without token with 401', async () => {
    const res = await request(app).get('/api/v1/wallets/my').expect(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('should simulate top-up with valid amount and append credit ledger entry', async () => {
    const session = await createAuthenticatedUser(app);

    const topupRes = await request(app)
      .post('/api/v1/wallets/my/topup')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ amount: 500000 })
      .expect(200);

    expect(topupRes.body.success).toBe(true);
    expect(topupRes.body.data.balance).toBe(500000);

    // Verify database snapshot balance
    const pool = getTestPool();
    const dbWallet = await pool.query('SELECT balance::text FROM wallets WHERE id = $1', [
      session.wallet.id,
    ]);
    expect(dbWallet.rows[0].balance).toBe('500000');

    // Verify ledger entry
    const entriesRes = await pool.query(
      'SELECT * FROM wallet_entries WHERE wallet_id = $1 ORDER BY created_at DESC',
      [session.wallet.id]
    );
    expect(entriesRes.rows.length).toBe(1);
    expect(entriesRes.rows[0].entry_type).toBe('credit');
    expect(entriesRes.rows[0].reference_type).toBe('topup_simulation');
    expect(entriesRes.rows[0].amount).toBe('500000');
    expect(entriesRes.rows[0].balance_after).toBe('500000');
  });

  it('should reject top-up with negative, zero, float, or excessive amount with 422', async () => {
    const session = await createAuthenticatedUser(app);

    // Negative
    await request(app)
      .post('/api/v1/wallets/my/topup')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ amount: -10000 })
      .expect(422);

    // Zero
    await request(app)
      .post('/api/v1/wallets/my/topup')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ amount: 0 })
      .expect(422);

    // Float / Decimal
    await request(app)
      .post('/api/v1/wallets/my/topup')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ amount: 100.5 })
      .expect(422);

    // Beyond max system limit
    await request(app)
      .post('/api/v1/wallets/my/topup')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ amount: 2_000_000_000_000 })
      .expect(422);
  });

  it('should update wallet metadata (name)', async () => {
    const session = await createAuthenticatedUser(app);

    const updateRes = await request(app)
      .put('/api/v1/wallets/my')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ name: 'Dompet Operasional Harian' })
      .expect(200);

    expect(updateRes.body.success).toBe(true);
    expect(updateRes.body.data.name).toBe('Dompet Operasional Harian');
  });

  it('should retrieve wallet audit ledger entries with pagination', async () => {
    const session = await createAuthenticatedUser(app, { initialBalance: 200000 });

    // Perform another topup to have multiple entries
    await request(app)
      .post('/api/v1/wallets/my/topup')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ amount: 300000 })
      .expect(200);

    const res = await request(app)
      .get('/api/v1/wallets/my/entries?page=1&limit=10')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBe(2);
    expect(res.body.pagination.total_items).toBe(2);
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.data[0].balance_after).toBe(500000);
    expect(res.body.data[1].balance_after).toBe(200000);
  });

  it('should prevent mass assignment on wallet balance, id, and user_id', async () => {
    const session = await createAuthenticatedUser(app);

    const res = await request(app)
      .put('/api/v1/wallets/my')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        name: 'Hacked Name',
        balance: 999999999,
        user_id: '00000000-0000-0000-0000-000000000000',
        id: '00000000-0000-0000-0000-000000000000',
      })
      .expect(200);

    expect(res.body.data.name).toBe('Hacked Name');
    expect(res.body.data.balance).toBe(0); // Balance MUST NOT change
    expect(res.body.data.id).toBe(session.wallet.id); // ID MUST NOT change
    expect(res.body.data.user_id).toBe(session.user.id); // user_id MUST NOT change
  });

  it('should reject topup when ENABLE_TOPUP_SIMULATION is disabled with 403 TOPUP_SIMULATION_DISABLED', async () => {
    const session = await createAuthenticatedUser(app);

    const originalFlag = env.ENABLE_TOPUP_SIMULATION;
    try {
      (env as any).ENABLE_TOPUP_SIMULATION = false;

      const res = await request(app)
        .post('/api/v1/wallets/my/topup')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({ amount: 100000 })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('TOPUP_SIMULATION_DISABLED');
      expect(res.body.error.message).toContain('Simulasi topup dinonaktifkan');
    } finally {
      (env as any).ENABLE_TOPUP_SIMULATION = originalFlag;
    }
  });

  it('should reject topup exceeding maximum per-transaction limit with 400 LIMIT_EXCEEDED', async () => {
    const session = await createAuthenticatedUser(app);

    const res = await request(app)
      .post('/api/v1/wallets/my/topup')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ amount: env.TOPUP_MAX_AMOUNT_PER_TX + 1 })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('LIMIT_EXCEEDED');
    expect(res.body.error.message).toContain('melebihi batas maksimal per transaksi');
  });
});

