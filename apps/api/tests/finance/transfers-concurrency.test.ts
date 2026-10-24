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

describe('Financial Module - Concurrency, Zero Negative Balance & Deadlock Elimination', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanTestTables();
  });

  it('multiple concurrent transfers from single wallet exceeding balance strictly ensure zero negative balance', async () => {
    // Initial balance: 500,000 IDR
    const sender = await createAuthenticatedUser(app, { initialBalance: 500000 });
    const receiver = await createAuthenticatedUser(app, { initialBalance: 0 });

    // 10 concurrent requests of 100,000 IDR each. Total requested: 1,000,000 IDR.
    // Only exactly 5 can succeed. The other 5 must be rejected with INSUFFICIENT_BALANCE.
    const CONCURRENT_REQUESTS = 10;
    const TRANSFER_AMOUNT = 100000;

    const promises = Array.from({ length: CONCURRENT_REQUESTS }, () =>
      request(app)
        .post('/api/v1/transfers')
        .set('Authorization', `Bearer ${sender.accessToken}`)
        .set('Idempotency-Key', crypto.randomUUID()) // Unique key for each distinct transfer attempt
        .send({
          target_wallet_number: receiver.wallet.wallet_number,
          amount: TRANSFER_AMOUNT,
        })
    );

    const responses = await Promise.all(promises);

    const successful = responses.filter((r) => r.status === 201);
    const rejected = responses.filter((r) => r.status === 400);

    expect(successful.length).toBe(5);
    expect(rejected.length).toBe(5);

    for (const r of rejected) {
      expect(r.body.error.code).toBe('INSUFFICIENT_BALANCE');
    }

    // Verify DB integrity
    const pool = getTestPool();
    const dbSender = await pool.query('SELECT balance::text FROM wallets WHERE id = $1', [
      sender.wallet.id,
    ]);
    const dbReceiver = await pool.query('SELECT balance::text FROM wallets WHERE id = $1', [
      receiver.wallet.id,
    ]);

    expect(dbSender.rows[0].balance).toBe('0'); // Exactly drained, never negative!
    expect(dbReceiver.rows[0].balance).toBe('500000'); // Exactly 5 * 100,000

    // Money conservation
    expect(BigInt(dbSender.rows[0].balance) + BigInt(dbReceiver.rows[0].balance)).toBe(500000n);

    // Exactly 5 transfer records
    const transfers = await pool.query(
      'SELECT COUNT(*) as count FROM transfers WHERE status = $1',
      ['completed']
    );
    expect(parseInt(transfers.rows[0].count, 10)).toBe(5);
  });

  it('concurrent bidirectional cross-transfers (A -> B and B -> A) execute simultaneously with zero deadlocks and zero lost updates', async () => {
    // Both wallets funded with 1,000,000 IDR
    const userA = await createAuthenticatedUser(app, { initialBalance: 1000000 });
    const userB = await createAuthenticatedUser(app, { initialBalance: 1000000 });

    const ROUNDS = 8;
    const AMOUNT = 10000;

    // Concurrently fire A -> B and B -> A simultaneously
    const tasksAtoB = Array.from({ length: ROUNDS }, () =>
      request(app)
        .post('/api/v1/transfers')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .set('Idempotency-Key', crypto.randomUUID())
        .send({
          target_wallet_number: userB.wallet.wallet_number,
          amount: AMOUNT,
          note: 'A to B transfer',
        })
    );

    const tasksBtoA = Array.from({ length: ROUNDS }, () =>
      request(app)
        .post('/api/v1/transfers')
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .set('Idempotency-Key', crypto.randomUUID())
        .send({
          target_wallet_number: userA.wallet.wallet_number,
          amount: AMOUNT,
          note: 'B to A transfer',
        })
    );

    // Interleave tasks
    const allTasks: Promise<request.Response>[] = [];
    for (let i = 0; i < ROUNDS; i++) {
      allTasks.push(tasksAtoB[i]!);
      allTasks.push(tasksBtoA[i]!);
    }

    const results = await Promise.all(allTasks);

    // Every single cross transfer must succeed without deadlock (no 40P01, no timeouts)
    for (const res of results) {
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    }

    // Verify DB conservation and final balances
    const pool = getTestPool();
    const balA = await pool.query('SELECT balance::text FROM wallets WHERE id = $1', [
      userA.wallet.id,
    ]);
    const balB = await pool.query('SELECT balance::text FROM wallets WHERE id = $1', [
      userB.wallet.id,
    ]);

    // Net transfer between A and B was equal (ROUNDS * AMOUNT in each direction)
    // So both balances must end up at exactly their starting balance: 1,000,000 IDR!
    expect(balA.rows[0].balance).toBe('1000000');
    expect(balB.rows[0].balance).toBe('1000000');

    // Conservation check
    const totalConservation = BigInt(balA.rows[0].balance) + BigInt(balB.rows[0].balance);
    expect(totalConservation).toBe(2000000n);

    // Total transfers count
    const totalTransfers = await pool.query('SELECT COUNT(*) as count FROM transfers');
    expect(parseInt(totalTransfers.rows[0].count, 10)).toBe(ROUNDS * 2);
  });
});
