import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
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

describe('Financial Module - Transfer Idempotency & Concurrency Coordination', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanTestTables();
  });

  it('sequential requests with same key and same payload return original response with zero new effect', async () => {
    const sender = await createAuthenticatedUser(app, { initialBalance: 1000000 });
    const receiver = await createAuthenticatedUser(app, { initialBalance: 100000 });
    const idempotencyKey = crypto.randomUUID();

    const payload = {
      target_wallet_number: receiver.wallet.wallet_number,
      amount: 200000,
      note: 'Pembayaran langganan',
    };

    // 1. First execution -> 201 Created
    const res1 = await request(app)
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${sender.accessToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload)
      .expect(201);

    expect(res1.body.success).toBe(true);
    expect(res1.body.data.amount).toBe(200000);
    const initialTransferId = res1.body.data.id;

    // 2. Second execution (replay) -> 200 OK with identical payload
    const res2 = await request(app)
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${sender.accessToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload)
      .expect(200);

    expect(res2.body.success).toBe(true);
    expect(res2.body.data.id).toBe(initialTransferId);
    expect(res2.body.data.amount).toBe(200000);
    expect(res2.body.message).toContain('idempotent replay');

    // 3. Verify exactly 1 transfer record exists in DB
    const pool = getTestPool();
    const txRecords = await pool.query('SELECT * FROM transfers WHERE idempotency_key = $1', [
      idempotencyKey,
    ]);
    expect(txRecords.rows.length).toBe(1);

    // 4. Verify sender was debited only once (1,000,000 - 200,000 = 800,000)
    const dbSender = await pool.query('SELECT balance::text FROM wallets WHERE id = $1', [
      sender.wallet.id,
    ]);
    expect(dbSender.rows[0].balance).toBe('800000');

    // 5. Exactly 2 ledger entries (1 debit, 1 credit)
    const ledgerEntries = await pool.query('SELECT * FROM wallet_entries WHERE reference_id = $1', [
      initialTransferId,
    ]);
    expect(ledgerEntries.rows.length).toBe(2);
  });

  it('same key with different payload triggers 409 IDEMPOTENCY_CONFLICT', async () => {
    const sender = await createAuthenticatedUser(app, { initialBalance: 1000000 });
    const receiver1 = await createAuthenticatedUser(app);
    const receiver2 = await createAuthenticatedUser(app);
    const idempotencyKey = crypto.randomUUID();

    // 1. Initial request with receiver1
    await request(app)
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${sender.accessToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        target_wallet_number: receiver1.wallet.wallet_number,
        amount: 100000,
      })
      .expect(201);

    // 2. Second request with same key but different receiver
    const conflictRes = await request(app)
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${sender.accessToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        target_wallet_number: receiver2.wallet.wallet_number,
        amount: 100000,
      })
      .expect(409);

    expect(conflictRes.body.success).toBe(false);
    expect(conflictRes.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('different users with the exact same idempotency key operate independently without conflict', async () => {
    const userA = await createAuthenticatedUser(app, { initialBalance: 500000 });
    const userB = await createAuthenticatedUser(app, { initialBalance: 500000 });
    const receiver = await createAuthenticatedUser(app);

    const sharedKey = 'shared-order-key-invoice-999';

    // User A executes with sharedKey
    const resA = await request(app)
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .set('Idempotency-Key', sharedKey)
      .send({
        target_wallet_number: receiver.wallet.wallet_number,
        amount: 100000,
      })
      .expect(201);

    // User B executes with same sharedKey
    const resB = await request(app)
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${userB.accessToken}`)
      .set('Idempotency-Key', sharedKey)
      .send({
        target_wallet_number: receiver.wallet.wallet_number,
        amount: 150000,
      })
      .expect(201);

    expect(resA.body.data.id).not.toBe(resB.body.data.id);
    expect(resA.body.data.amount).toBe(100000);
    expect(resB.body.data.amount).toBe(150000);

    // Both users successfully debited
    const pool = getTestPool();
    const balA = await pool.query('SELECT balance::text FROM wallets WHERE id = $1', [
      userA.wallet.id,
    ]);
    const balB = await pool.query('SELECT balance::text FROM wallets WHERE id = $1', [
      userB.wallet.id,
    ]);
    expect(balA.rows[0].balance).toBe('400000');
    expect(balB.rows[0].balance).toBe('350000');
  });

  it('20 concurrent requests with identical idempotency key produce exactly one financial effect', async () => {
    const sender = await createAuthenticatedUser(app, { initialBalance: 1000000 });
    const receiver = await createAuthenticatedUser(app, { initialBalance: 200000 });
    const idempotencyKey = crypto.randomUUID();

    const payload = {
      target_wallet_number: receiver.wallet.wallet_number,
      amount: 150000,
      note: 'Simultaneous blast test',
    };

    // Fire 20 concurrent requests simultaneously
    const CONCURRENCY_COUNT = 20;
    const promises = Array.from({ length: CONCURRENCY_COUNT }, () =>
      request(app)
        .post('/api/v1/transfers')
        .set('Authorization', `Bearer ${sender.accessToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send(payload)
    );

    const responses = await Promise.all(promises);

    // All 20 requests must succeed (status 201 or 200)
    for (const res of responses) {
      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
      expect(res.body.data.amount).toBe(150000);
    }

    // Exactly one created (201) and 19 replays (200), or all resolved with identical transfer ID
    const transferIds = new Set(responses.map((r) => r.body.data.id));
    expect(transferIds.size).toBe(1);

    const singleTransferId = Array.from(transferIds)[0];

    // Verify DB integrity
    const pool = getTestPool();

    // 1. Exactly 1 transfer record in transfers table
    const dbTransfers = await pool.query('SELECT * FROM transfers WHERE id = $1', [
      singleTransferId,
    ]);
    expect(dbTransfers.rows.length).toBe(1);

    // 2. Sender was debited EXACTLY ONCE (1,000,000 - 150,000 = 850,000)
    const dbSender = await pool.query('SELECT balance::text FROM wallets WHERE id = $1', [
      sender.wallet.id,
    ]);
    expect(dbSender.rows[0].balance).toBe('850000');

    // 3. Receiver was credited EXACTLY ONCE (200,000 + 150,000 = 350,000)
    const dbReceiver = await pool.query('SELECT balance::text FROM wallets WHERE id = $1', [
      receiver.wallet.id,
    ]);
    expect(dbReceiver.rows[0].balance).toBe('350000');

    // 4. Exactly 2 ledger entries in wallet_entries for this transfer
    const ledgerEntries = await pool.query('SELECT * FROM wallet_entries WHERE reference_id = $1', [
      singleTransferId,
    ]);
    expect(ledgerEntries.rows.length).toBe(2);

    // 5. Total system money conserved
    const totalConservation = BigInt(dbSender.rows[0].balance) + BigInt(dbReceiver.rows[0].balance);
    expect(totalConservation).toBe(1000000n + 200000n);
  });

  it('failed transfer requests are not cached in idempotency_records and allow successful retry with the exact same key once funded', async () => {
    // Sender starts with only 50,000 IDR
    const sender = await createAuthenticatedUser(app, { initialBalance: 50000 });
    const receiver = await createAuthenticatedUser(app, { initialBalance: 100000 });
    const idempotencyKey = crypto.randomUUID();

    const transferPayload = {
      target_wallet_number: receiver.wallet.wallet_number,
      amount: 200000, // Exceeds 50,000 balance!
      note: 'Payment attempt with insufficient funds',
    };

    // 1. Initial attempt fails with 400 INSUFFICIENT_BALANCE
    const failedRes = await request(app)
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${sender.accessToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(transferPayload)
      .expect(400);

    expect(failedRes.body.success).toBe(false);
    expect(failedRes.body.error.code).toBe('INSUFFICIENT_BALANCE');

    // 2. Verify that failed request was NOT cached: NO idempotency_records entry exists
    const pool = getTestPool();
    const recordsAfterFailure = await pool.query(
      'SELECT * FROM idempotency_records WHERE user_id = $1 AND idempotency_key = $2',
      [sender.user.id, idempotencyKey]
    );
    expect(recordsAfterFailure.rows.length).toBe(0);

    // 3. Sender gets funded with 500,000 IDR topup
    await request(app)
      .post('/api/v1/wallets/my/topup')
      .set('Authorization', `Bearer ${sender.accessToken}`)
      .send({ amount: 500000 })
      .expect(200);

    // 4. Retry transfer with the EXACT SAME idempotency key and payload -> must SUCCEED with 201 Created!
    const successRes = await request(app)
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${sender.accessToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(transferPayload)
      .expect(201);

    expect(successRes.body.success).toBe(true);
    expect(successRes.body.data.amount).toBe(200000);
    expect(successRes.body.data.idempotency_key).toBe(idempotencyKey);

    // 5. Now idempotency record exists with status COMPLETED and response_code 201
    const recordsAfterSuccess = await pool.query(
      'SELECT * FROM idempotency_records WHERE user_id = $1 AND idempotency_key = $2',
      [sender.user.id, idempotencyKey]
    );
    expect(recordsAfterSuccess.rows.length).toBe(1);
    expect(recordsAfterSuccess.rows[0].status).toBe('COMPLETED');
    expect(recordsAfterSuccess.rows[0].response_code).toBe(201);
  });

  it('idempotency_records and transfer financial effects are strictly written and committed atomically within the same database transaction', async () => {
    const sender = await createAuthenticatedUser(app, { initialBalance: 300000 });
    const receiver = await createAuthenticatedUser(app, { initialBalance: 100000 });
    const idempotencyKey = crypto.randomUUID();

    const pool = getTestPool();

    // Verify baseline table counts
    const countTransfersBefore = await pool.query('SELECT COUNT(*) as count FROM transfers');
    const countIdempotencyBefore = await pool.query('SELECT COUNT(*) as count FROM idempotency_records');
    const countEntriesBefore = await pool.query('SELECT COUNT(*) as count FROM wallet_entries');

    // Execute transfer
    const res = await request(app)
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${sender.accessToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        target_wallet_number: receiver.wallet.wallet_number,
        amount: 75000,
      })
      .expect(201);

    const transferId = res.body.data.id;

    // Both transfer, idempotency record, and ledger entries must be incremented together
    const countTransfersAfter = await pool.query('SELECT COUNT(*) as count FROM transfers');
    const countIdempotencyAfter = await pool.query('SELECT COUNT(*) as count FROM idempotency_records');
    const countEntriesAfter = await pool.query('SELECT COUNT(*) as count FROM wallet_entries');

    expect(parseInt(countTransfersAfter.rows[0].count, 10)).toBe(
      parseInt(countTransfersBefore.rows[0].count, 10) + 1
    );
    expect(parseInt(countIdempotencyAfter.rows[0].count, 10)).toBe(
      parseInt(countIdempotencyBefore.rows[0].count, 10) + 1
    );
    expect(parseInt(countEntriesAfter.rows[0].count, 10)).toBe(
      parseInt(countEntriesBefore.rows[0].count, 10) + 2
    );

    // Verify idempotency record references the exact transfer resource ID
    const rec = await pool.query(
      'SELECT resource_id, status FROM idempotency_records WHERE user_id = $1 AND idempotency_key = $2',
      [sender.user.id, idempotencyKey]
    );
    expect(rec.rows[0].resource_id).toBe(transferId);
    expect(rec.rows[0].status).toBe('COMPLETED');
  });
});
