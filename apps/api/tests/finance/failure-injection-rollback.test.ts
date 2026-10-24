import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { app } from '../../src/app.js';
import {
  setupTestDatabase,
  closeTestDatabase,
  cleanTestTables,
  getTestPool,
} from '../database/test-db-helper.js';
import { createAuthenticatedUser } from './finance-test-helper.js';
import { walletsRepository } from '../../src/modules/wallets/wallets.repository.js';

describe('Financial Module - Failure Injection & Total Transaction Rollback', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanTestTables();
    vi.restoreAllMocks();
  });

  it('forced failure after debit before credit rolls back entire transfer atomically and leaves pool healthy', async () => {
    const sender = await createAuthenticatedUser(app, { initialBalance: 500000 });
    const receiver = await createAuthenticatedUser(app, { initialBalance: 100000 });

    const originalCreateLedgerEntry = walletsRepository.createLedgerEntry.bind(walletsRepository);

    // Seam injection: allow first ledger entry (debit on sender), but fail on second (credit on receiver)
    let callCount = 0;
    vi.spyOn(walletsRepository, 'createLedgerEntry').mockImplementation(async (client, params) => {
      callCount++;
      if (params.referenceType === 'transfer_receive') {
        throw new Error('SIMULATED_FAILURE_AFTER_DEBIT_BEFORE_CREDIT');
      }
      return originalCreateLedgerEntry(client, params);
    });

    const res = await request(app)
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${sender.accessToken}`)
      .set('Idempotency-Key', crypto.randomUUID())
      .send({
        target_wallet_number: receiver.wallet.wallet_number,
        amount: 200000,
      })
      .expect(500);

    expect(res.body.success).toBe(false);
    expect(callCount).toBe(2);

    // Verify TOTAL ROLLBACK in database
    const pool = getTestPool();

    // 1. Sender balance MUST NOT have changed
    const dbSender = await pool.query('SELECT balance::text FROM wallets WHERE id = $1', [
      sender.wallet.id,
    ]);
    expect(dbSender.rows[0].balance).toBe('500000');

    // 2. Receiver balance MUST NOT have changed
    const dbReceiver = await pool.query('SELECT balance::text FROM wallets WHERE id = $1', [
      receiver.wallet.id,
    ]);
    expect(dbReceiver.rows[0].balance).toBe('100000');

    // 3. Zero transfer records in database
    const transfers = await pool.query('SELECT COUNT(*) as count FROM transfers');
    expect(parseInt(transfers.rows[0].count, 10)).toBe(0);

    // 4. Zero transfer ledger entries in database (only the initial topups)
    const ledgerEntries = await pool.query(
      `SELECT COUNT(*) as count FROM wallet_entries WHERE reference_type LIKE 'transfer%'`
    );
    expect(parseInt(ledgerEntries.rows[0].count, 10)).toBe(0);

    // 5. Restore seam and verify connection pool is completely healthy for subsequent transactions
    vi.restoreAllMocks();

    const subsequentRes = await request(app)
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${sender.accessToken}`)
      .set('Idempotency-Key', crypto.randomUUID())
      .send({
        target_wallet_number: receiver.wallet.wallet_number,
        amount: 50000,
      })
      .expect(201);

    expect(subsequentRes.body.success).toBe(true);
    expect(subsequentRes.body.data.amount).toBe(50000);
  });

  it('registration fails atomically if default wallet creation fails (no orphan user)', async () => {
    // Seam injection on walletsRepository.createWallet
    vi.spyOn(walletsRepository, 'createWallet').mockRejectedValueOnce(
      new Error('SIMULATED_WALLET_CREATION_FAILURE')
    );

    const email = 'orphan_test@wallet.local';
    const username = 'orphan_tester';

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        username,
        email,
        password: 'ValidPassword123!',
        full_name: 'Orphan Tester',
      })
      .expect(500);

    expect(res.body.success).toBe(false);

    // Verify user was NOT created (rolled back completely)
    const pool = getTestPool();
    const user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    expect(user.rows.length).toBe(0);

    const wallet = await pool.query('SELECT * FROM wallets WHERE name = $1', ['Dompet Utama']);
    expect(wallet.rows.length).toBe(0);
  });
});
