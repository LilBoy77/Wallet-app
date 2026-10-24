import { Router } from 'express';
import { env } from '../../config/env.js';
import { authenticate, validate, createRateLimiter } from '../../middlewares/index.js';
import { asyncHandler } from '../../shared/errors/index.js';
import { topupSimulationInputSchema, updateWalletInputSchema } from '@wallet-app/shared';
import { walletsController } from './wallets.controller.js';

const isTest = env.NODE_ENV === 'test';

export const topupLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: isTest ? 1000 : 30,
  message: 'Terlalu banyak permintaan simulasi topup. Silakan coba lagi nanti.',
});

export interface WalletsRouterLimiters {
  topupLimiter?: ReturnType<typeof createRateLimiter>;
}

export function createWalletsRouter(limiters: WalletsRouterLimiters = {}): Router {
  const router = Router();
  const effectiveTopupLimiter = limiters.topupLimiter ?? topupLimiter;

  router.get(
    '/my',
    asyncHandler(authenticate),
    asyncHandler((req, res) => walletsController.getMyWallet(req, res))
  );

  router.get(
    '/my/entries',
    asyncHandler(authenticate),
    asyncHandler((req, res) => walletsController.getMyWalletEntries(req, res))
  );

  router.post(
    '/my/topup',
    asyncHandler(authenticate),
    effectiveTopupLimiter,
    validate({ body: topupSimulationInputSchema }),
    asyncHandler((req, res) => walletsController.simulateTopup(req, res))
  );

  router.put(
    '/my',
    asyncHandler(authenticate),
    validate({ body: updateWalletInputSchema }),
    asyncHandler((req, res) => walletsController.updateWalletMetadata(req, res))
  );

  return router;
}

export const walletsRouter: Router = createWalletsRouter();
