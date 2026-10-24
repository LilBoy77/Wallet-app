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

describe('Financial Module - Internal Transfers & Atomic Consistency (/api/v1/transfers)', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanTestTables();
  });

  it('should successfully execute transfer, balance debit and credit entries, and maintain balance conservation', async () => {
    const sender = await createAuthenticatedUser(app, { initialBalance: 1000000 });
    const receiver = await createAuthenticatedUser(app, { initialBalance: 250000 });
    const idempotencyKey = crypto.randomUUID();

    const transferAmount = 300000;

    const res = await request(app)
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${sender.accessToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        target_wallet_number: receiver.wallet.wallet_number,
        amount: transferAmount,
        note: 'Biaya sewa server bulanan',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.amount).toBe(transferAmount);
    expect(res.body.data.source_wallet_id).toBe(sender.wallet.id);
    expect(res.body.data.target_wallet_id).toBe(receiver.wallet.id);
    expect(res.body.data.source_wallet_number).toBe(sender.wallet.wallet_number);
    expect(res.body.data.target_wallet_number).toBe(receiver.wallet.wallet_number);
    expect(res.body.data.status).toBe('completed');
    expect(res.body.data.idempotency_key).toBe(idempotencyKey);

    const transferId = res.body.data.id;

    // 1. Verify balances in DB
    const pool = getTestPool();
    const dbSender = await pool.query('SELECT balance::text FROM wallets WHERE id = $1', [
      sender.wallet.id,
    ]);
    const dbReceiver = await pool.query('SELECT balance::text FROM wallets WHERE id = $1', [
      receiver.wallet.id,
    ]);

    expect(dbSender.rows[0].balance).toBe('700000'); // 1,000,000 - 300,000
    expect(dbReceiver.rows[0].balance).toBe('550000'); // 250,000 + 300,000

    // 2. Strict conservation check
    const totalBefore = 1000000n + 250000n;
    const totalAfter = BigInt(dbSender.rows[0].balance) + BigInt(dbReceiver.rows[0].balance);
    expect(totalAfter).toBe(totalBefore);

    // 3. Verify exactly 2 balanced ledger entries linked to this transfer
    const entries = await pool.query(
      'SELECT * FROM wallet_entries WHERE reference_id = $1 ORDER BY entry_type ASC',
      [transferId]
    );
    expect(entries.rows.length).toBe(2);

    const creditEntry = entries.rows.find((e) => e.entry_type === 'credit');
    const debitEntry = entries.rows.find((e) => e.entry_type === 'debit');

    expect(creditEntry).toBeDefined();
    expect(creditEntry.wallet_id).toBe(receiver.wallet.id);
    expect(creditEntry.reference_type).toBe('transfer_receive');
    expect(creditEntry.amount).toBe('300000');
    expect(creditEntry.balance_after).toBe('550000');

    expect(debitEntry).toBeDefined();
    expect(debitEntry.wallet_id).toBe(sender.wallet.id);
    expect(debitEntry.reference_type).toBe('transfer_send');
    expect(debitEntry.amount).toBe('300000');
    expect(debitEntry.balance_after).toBe('700000');

    // 4. Verify activity log recorded
    const logs = await pool.query(
      `SELECT * FROM activity_logs WHERE user_id = $1 AND action = 'TRANSFER_SENT' AND entity_id = $2`,
      [sender.user.id, transferId]
    );
    expect(logs.rows.length).toBe(1);
  });

  it('should reject transfer when sender has insufficient balance with 400 and leave all tables untouched', async () => {
    const sender = await createAuthenticatedUser(app, { initialBalance: 100000 });
    const receiver = await createAuthenticatedUser(app, { initialBalance: 50000 });
    const idempotencyKey = crypto.randomUUID();

    const res = await request(app)
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${sender.accessToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        target_wallet_number: receiver.wallet.wallet_number,
        amount: 500000,
      })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INSUFFICIENT_BALANCE');

    // Verify balances untouched
    const pool = getTestPool();
    const dbSender = await pool.query('SELECT balance::text FROM wallets WHERE id = $1', [
      sender.wallet.id,
    ]);
    const dbReceiver = await pool.query('SELECT balance::text FROM wallets WHERE id = $1', [
      receiver.wallet.id,
    ]);
    expect(dbSender.rows[0].balance).toBe('100000');
    expect(dbReceiver.rows[0].balance).toBe('50000');

    // Verify no transfer was inserted
    const transfersCount = await pool.query('SELECT COUNT(*) as count FROM transfers');
    expect(parseInt(transfersCount.rows[0].count, 10)).toBe(0);
  });

  it('should reject transfer to self with 400 SELF_TRANSFER_PROHIBITED', async () => {
    const sender = await createAuthenticatedUser(app, { initialBalance: 500000 });
    const idempotencyKey = crypto.randomUUID();

    const res = await request(app)
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${sender.accessToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        target_wallet_number: sender.wallet.wallet_number,
        amount: 50000,
      })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('SELF_TRANSFER_PROHIBITED');
  });

  it('should return uniform 404 message for non-existent and inactive target wallets to prevent enumeration', async () => {
    const sender = await createAuthenticatedUser(app, { initialBalance: 500000 });

    // 1. Non-existent target wallet number
    const nonExistentRes = await request(app)
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${sender.accessToken}`)
      .set('Idempotency-Key', crypto.randomUUID())
      .send({
        target_wallet_number: 'WAL-NONEXIST',
        amount: 50000,
      })
      .expect(404);

    expect(nonExistentRes.body.error.message).toBe(
      'Nomor dompet tujuan tidak ditemukan atau tidak dapat menerima transfer'
    );

    // 2. Inactive target wallet
    const receiver = await createAuthenticatedUser(app, { initialBalance: 100000 });
    const pool = getTestPool();
    await pool.query('UPDATE wallets SET is_active = false WHERE id = $1', [receiver.wallet.id]);

    const inactiveRes = await request(app)
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${sender.accessToken}`)
      .set('Idempotency-Key', crypto.randomUUID())
      .send({
        target_wallet_number: receiver.wallet.wallet_number,
        amount: 50000,
      })
      .expect(404);

    expect(inactiveRes.body.error.message).toBe(
      'Nomor dompet tujuan tidak ditemukan atau tidak dapat menerima transfer'
    );
  });

  it('should reject missing Idempotency-Key header with 400 MISSING_IDEMPOTENCY_KEY', async () => {
    const sender = await createAuthenticatedUser(app, { initialBalance: 500000 });
    const receiver = await createAuthenticatedUser(app);

    const res = await request(app)
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${sender.accessToken}`)
      // No Idempotency-Key header
      .send({
        target_wallet_number: receiver.wallet.wallet_number,
        amount: 50000,
      })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('MISSING_IDEMPOTENCY_KEY');
  });

  it('should reject transfer amount exceeding maximum per-transaction limit with 400 LIMIT_EXCEEDED', async () => {
    const sender = await createAuthenticatedUser(app, { initialBalance: 100000000 });
    const receiver = await createAuthenticatedUser(app);

    const res = await request(app)
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${sender.accessToken}`)
      .set('Idempotency-Key', crypto.randomUUID())
      .send({
        target_wallet_number: receiver.wallet.wallet_number,
        amount: 50_000_001, // exceeds 50,000,000 max limit
      })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('LIMIT_EXCEEDED');
  });

  it('should allow reading transfer details only for sender or receiver and reject outsider with 404 NOT_FOUND (IDOR protected)', async () => {
    const sender = await createAuthenticatedUser(app, { initialBalance: 500000 });
    const receiver = await createAuthenticatedUser(app, { initialBalance: 100000 });
    const outsider = await createAuthenticatedUser(app, { initialBalance: 100000 });

    const txRes = await request(app)
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${sender.accessToken}`)
      .set('Idempotency-Key', crypto.randomUUID())
      .send({
        target_wallet_number: receiver.wallet.wallet_number,
        amount: 80000,
        note: 'Transfer to receiver for detail check',
      })
      .expect(201);

    const transferId = txRes.body.data.id;

    // 1. Sender can view transfer detail
    const senderGet = await request(app)
      .get(`/api/v1/transfers/${transferId}`)
      .set('Authorization', `Bearer ${sender.accessToken}`)
      .expect(200);
    expect(senderGet.body.data.amount).toBe(80000);

    // 2. Receiver can view transfer detail
    const receiverGet = await request(app)
      .get(`/api/v1/transfers/${transferId}`)
      .set('Authorization', `Bearer ${receiver.accessToken}`)
      .expect(200);
    expect(receiverGet.body.data.amount).toBe(80000);

    // 3. Outsider CANNOT view transfer detail (404 IDOR protection)
    const outsiderGet = await request(app)
      .get(`/api/v1/transfers/${transferId}`)
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .expect(404);
    expect(outsiderGet.body.success).toBe(false);
    expect(outsiderGet.body.error.code).toBe('NOT_FOUND');
  });

  it('should list transfers paginated and scoped strictly to participant user (sender or receiver)', async () => {
    const sender = await createAuthenticatedUser(app, { initialBalance: 500000 });
    const receiver = await createAuthenticatedUser(app, { initialBalance: 100000 });
    const outsider = await createAuthenticatedUser(app, { initialBalance: 100000 });

    await request(app)
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${sender.accessToken}`)
      .set('Idempotency-Key', crypto.randomUUID())
      .send({
        target_wallet_number: receiver.wallet.wallet_number,
        amount: 80000,
        note: 'Transfer for listing check',
      })
      .expect(201);

    // Listing transfers: sender has 1 transfer, receiver has 1 transfer, outsider has 0
    const senderList = await request(app)
      .get('/api/v1/transfers')
      .set('Authorization', `Bearer ${sender.accessToken}`)
      .expect(200);
    expect(senderList.body.data.length).toBe(1);

    const receiverList = await request(app)
      .get('/api/v1/transfers')
      .set('Authorization', `Bearer ${receiver.accessToken}`)
      .expect(200);
    expect(receiverList.body.data.length).toBe(1);

    const outsiderList = await request(app)
      .get('/api/v1/transfers')
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .expect(200);
    expect(outsiderList.body.data.length).toBe(0);
  });

  it('should prevent transferring from another user wallet when an attacker attempts to specify victim wallet in payload or parameters (strict session binding)', async () => {
    const victim = await createAuthenticatedUser(app, { initialBalance: 1000000 });
    const attacker = await createAuthenticatedUser(app, { initialBalance: 100000 });
    const recipient = await createAuthenticatedUser(app, { initialBalance: 50000 });

    // Attacker sends transfer request with attacker's token, but attempts to set
    // source_wallet_id or source_wallet_number to the victim's wallet in payload
    const res = await request(app)
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${attacker.accessToken}`)
      .set('Idempotency-Key', crypto.randomUUID())
      .send({
        source_wallet_id: victim.wallet.id,
        source_wallet_number: victim.wallet.wallet_number,
        target_wallet_number: recipient.wallet.wallet_number,
        amount: 80000,
        note: 'Steal from victim attempt',
      })
      .expect(201);

    // Verify the transfer was executed FROM ATTACKER'S WALLET, NOT VICTIM'S!
    expect(res.body.data.source_wallet_id).toBe(attacker.wallet.id);
    expect(res.body.data.source_wallet_id).not.toBe(victim.wallet.id);

    // Verify DB integrity
    const pool = getTestPool();
    const victimBal = await pool.query('SELECT balance::text FROM wallets WHERE id = $1', [
      victim.wallet.id,
    ]);
    const attackerBal = await pool.query('SELECT balance::text FROM wallets WHERE id = $1', [
      attacker.wallet.id,
    ]);
    const recipientBal = await pool.query('SELECT balance::text FROM wallets WHERE id = $1', [
      recipient.wallet.id,
    ]);

    // Victim balance is 100% untouched
    expect(victimBal.rows[0].balance).toBe('1000000');
    // Attacker debited: 100,000 - 80,000 = 20,000
    expect(attackerBal.rows[0].balance).toBe('20000');
    // Recipient credited: 50,000 + 80,000 = 130,000
    expect(recipientBal.rows[0].balance).toBe('130000');
  });
});
