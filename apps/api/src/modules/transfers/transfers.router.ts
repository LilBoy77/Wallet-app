import { Router } from 'express';
import {
  authenticate,
  validate,
  createRateLimiter,
  resolveRateLimitMax,
} from '../../middlewares/index.js';
import { asyncHandler } from '../../shared/errors/index.js';
import { createTransferInputSchema } from '@wallet-app/shared';
import { transfersController } from './transfers.controller.js';

export const transferLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: resolveRateLimitMax(30),
  message: 'Terlalu banyak permintaan transfer saldo. Silakan coba lagi nanti.',
});

export interface TransfersRouterLimiters {
  transferLimiter?: ReturnType<typeof createRateLimiter>;
}

export function createTransfersRouter(limiters: TransfersRouterLimiters = {}): Router {
  const router = Router();
  const effectiveTransferLimiter = limiters.transferLimiter ?? transferLimiter;

  router.post(
    '/',
    asyncHandler(authenticate),
    effectiveTransferLimiter,
    validate({ body: createTransferInputSchema }),
    asyncHandler((req, res) => transfersController.executeTransfer(req, res))
  );

  router.get(
    '/',
    asyncHandler(authenticate),
    asyncHandler((req, res) => transfersController.listTransfers(req, res))
  );

  router.get(
    '/:id',
    asyncHandler(authenticate),
    asyncHandler((req, res) => transfersController.getTransferById(req, res))
  );

  return router;
}

export const transfersRouter: Router = createTransfersRouter();
