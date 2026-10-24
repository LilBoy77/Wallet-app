import { Router } from 'express';
import { env } from '../../config/env.js';
import { authenticate, validate, createRateLimiter } from '../../middlewares/index.js';
import { asyncHandler } from '../../shared/errors/index.js';
import {
  createTransactionInputSchema,
  updateTransactionMetadataInputSchema,
} from '@wallet-app/shared';
import { transactionsController } from './transactions.controller.js';

const isTest = env.NODE_ENV === 'test';

export const transactionLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: isTest ? 1000 : 60,
  message: 'Terlalu banyak permintaan transaksi. Silakan coba lagi nanti.',
});

export interface TransactionsRouterLimiters {
  transactionLimiter?: ReturnType<typeof createRateLimiter>;
}

export function createTransactionsRouter(limiters: TransactionsRouterLimiters = {}): Router {
  const router = Router();
  const effectiveLimiter = limiters.transactionLimiter ?? transactionLimiter;

  router.post(
    '/',
    asyncHandler(authenticate),
    effectiveLimiter,
    validate({ body: createTransactionInputSchema }),
    asyncHandler((req, res) => transactionsController.createTransaction(req, res))
  );

  router.get(
    '/',
    asyncHandler(authenticate),
    asyncHandler((req, res) => transactionsController.listTransactions(req, res))
  );

  router.get(
    '/:id',
    asyncHandler(authenticate),
    asyncHandler((req, res) => transactionsController.getTransactionById(req, res))
  );

  router.put(
    '/:id',
    asyncHandler(authenticate),
    validate({ body: updateTransactionMetadataInputSchema }),
    asyncHandler((req, res) => transactionsController.updateTransactionMetadata(req, res))
  );

  router.delete(
    '/:id',
    asyncHandler(authenticate),
    effectiveLimiter,
    asyncHandler((req, res) => transactionsController.voidTransaction(req, res))
  );

  return router;
}

export const transactionsRouter: Router = createTransactionsRouter();
