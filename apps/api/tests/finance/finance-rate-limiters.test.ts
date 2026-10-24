import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import crypto from 'crypto';
import { createRateLimiter } from '../../src/middlewares/rate-limiter.middleware.js';
import { requestIdMiddleware } from '../../src/middlewares/request-id.middleware.js';
import { globalErrorHandler } from '../../src/middlewares/error-handler.middleware.js';
import { createTransfersRouter } from '../../src/modules/transfers/transfers.router.js';
import { createTransactionsRouter } from '../../src/modules/transactions/transactions.router.js';
import { createWalletsRouter } from '../../src/modules/wallets/wallets.router.js';
import { app } from '../../src/app.js';
import {
  setupTestDatabase,
  closeTestDatabase,
  cleanTestTables,
  getTestPool,
} from '../database/test-db-helper.js';
import { createAuthenticatedUser } from './finance-test-helper.js';

describe('Financial Rate Limiters Enforce HTTP 429 & Retry-After Header', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanTestTables();
  });

  function createTestFinanceApp(routers: {
    transfers?: express.Router;
    transactions?: express.Router;
    wallets?: express.Router;
  }): Express {
    const testApp = express();
    testApp.use(requestIdMiddleware);
    testApp.use(express.json());

    if (routers.transfers) testApp.use('/api/v1/transfers', routers.transfers);
    if (routers.transactions) testApp.use('/api/v1/transactions', routers.transactions);
    if (routers.wallets) testApp.use('/api/v1/wallets', routers.wallets);

    testApp.use(globalErrorHandler);
    return testApp;
  }

  it('POST /api/v1/transfers should enforce rate limit and return 429 TOO_MANY_REQUESTS with Retry-After header', async () => {
    const sender = await createAuthenticatedUser(app, { initialBalance: 1000000 });
    const receiver = await createAuthenticatedUser(app, { initialBalance: 100000 });

    const transferLimiter = createRateLimiter({
      windowMs: 60 * 1000,
      max: 2,
      message: 'Terlalu banyak permintaan transfer saldo. Silakan coba lagi nanti.',
    });

    const transfersRouter = createTransfersRouter({ transferLimiter });
    const testApp = createTestFinanceApp({ transfers: transfersRouter });

    const payload = {
      target_wallet_number: receiver.wallet.wallet_number,
      amount: 10000,
    };

    // Request 1: 201 Created
    const res1 = await request(testApp)
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${sender.accessToken}`)
      .set('Idempotency-Key', crypto.randomUUID())
      .send(payload);
    expect(res1.status).toBe(201);

    // Request 2: 201 Created
    const res2 = await request(testApp)
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${sender.accessToken}`)
      .set('Idempotency-Key', crypto.randomUUID())
      .send(payload);
    expect(res2.status).toBe(201);

    // Request 3: Rate limited -> 429
    const res3 = await request(testApp)
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${sender.accessToken}`)
      .set('Idempotency-Key', crypto.randomUUID())
      .send(payload);

    expect(res3.status).toBe(429);
    expect(res3.body.success).toBe(false);
    expect(res3.body.error.code).toBe('TOO_MANY_REQUESTS');
    expect(res3.body.error.message).toContain('Terlalu banyak permintaan transfer saldo');
    expect(res3.headers['retry-after']).toBeDefined();
    expect(Number(res3.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('POST & DELETE /api/v1/transactions should enforce rate limit and return 429 TOO_MANY_REQUESTS with Retry-After header', async () => {
    const user = await createAuthenticatedUser(app, { initialBalance: 1000000 });
    const pool = getTestPool();

    const catRes = await pool.query(
      `INSERT INTO categories (name, type, color, icon)
       VALUES ('Rate Limit Cat', 'expense', '#EF4444', 'tag')
       RETURNING id`
    );
    const categoryId = catRes.rows[0].id;

    const transactionLimiter = createRateLimiter({
      windowMs: 60 * 1000,
      max: 2,
      message: 'Terlalu banyak permintaan mutasi transaksi. Silakan coba lagi nanti.',
    });

    const transactionsRouter = createTransactionsRouter({ transactionLimiter });
    const testApp = createTestFinanceApp({ transactions: transactionsRouter });

    // Request 1: 201 Created
    const res1 = await request(testApp)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        type: 'expense',
        category_id: categoryId,
        amount: 10000,
      });
    expect(res1.status).toBe(201);

    // Request 2: 201 Created
    const res2 = await request(testApp)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        type: 'expense',
        category_id: categoryId,
        amount: 10000,
      });
    expect(res2.status).toBe(201);

    // Request 3: Rate limited on POST -> 429
    const res3 = await request(testApp)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        type: 'expense',
        category_id: categoryId,
        amount: 10000,
      });

    expect(res3.status).toBe(429);
    expect(res3.body.success).toBe(false);
    expect(res3.body.error.code).toBe('TOO_MANY_REQUESTS');
    expect(res3.headers['retry-after']).toBeDefined();
    expect(Number(res3.headers['retry-after'])).toBeGreaterThan(0);

    // Rate limiter also blocks DELETE (void) under the same shared limiter
    const voidRes = await request(testApp)
      .delete(`/api/v1/transactions/${res1.body.data.id}`)
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(voidRes.status).toBe(429);
    expect(voidRes.body.error.code).toBe('TOO_MANY_REQUESTS');
    expect(voidRes.headers['retry-after']).toBeDefined();
  });

  it('POST /api/v1/wallets/my/topup should enforce rate limit and return 429 TOO_MANY_REQUESTS with Retry-After header', async () => {
    const user = await createAuthenticatedUser(app, { initialBalance: 100000 });

    const topupLimiter = createRateLimiter({
      windowMs: 60 * 1000,
      max: 2,
      message: 'Terlalu banyak permintaan simulasi topup. Silakan coba lagi nanti.',
    });

    const walletsRouter = createWalletsRouter({ topupLimiter });
    const testApp = createTestFinanceApp({ wallets: walletsRouter });

    // Request 1: 200 OK
    const res1 = await request(testApp)
      .post('/api/v1/wallets/my/topup')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ amount: 50000 });
    expect(res1.status).toBe(200);

    // Request 2: 200 OK
    const res2 = await request(testApp)
      .post('/api/v1/wallets/my/topup')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ amount: 50000 });
    expect(res2.status).toBe(200);

    // Request 3: 429
    const res3 = await request(testApp)
      .post('/api/v1/wallets/my/topup')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ amount: 50000 });

    expect(res3.status).toBe(429);
    expect(res3.body.success).toBe(false);
    expect(res3.body.error.code).toBe('TOO_MANY_REQUESTS');
    expect(res3.headers['retry-after']).toBeDefined();
    expect(Number(res3.headers['retry-after'])).toBeGreaterThan(0);
  });
});
