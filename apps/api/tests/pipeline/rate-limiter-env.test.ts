import { describe, it, expect, vi, afterEach } from 'vitest';
import express, { type Request, type Response, type RequestHandler } from 'express';
import request from 'supertest';
import { resolveRateLimitMax } from '../../src/middlewares/rate-limiter.middleware.js';

interface LoadedLimiters {
  registerLimiter: RequestHandler;
  loginLimiter: RequestHandler;
  refreshLimiter: RequestHandler;
  forgotPasswordLimiter: RequestHandler;
  resetPasswordLimiter: RequestHandler;
  topupLimiter: RequestHandler;
  transactionLimiter: RequestHandler;
  transferLimiter: RequestHandler;
  attachmentUploadLimiter: RequestHandler;
  attachmentDownloadLimiter: RequestHandler;
}

async function loadLimitersUnderEnv(
  targetNodeEnv: 'production' | 'development' | 'test'
): Promise<LoadedLimiters> {
  vi.resetModules();

  const envModule = await import('../../src/config/env.js');
  envModule.env.NODE_ENV = targetNodeEnv;
  if (targetNodeEnv === 'production') {
    envModule.env.MAIL_TRANSPORT = 'smtp';
    envModule.env.SMTP_HOST = 'smtp.wallet.local';
  } else {
    envModule.env.MAIL_TRANSPORT = 'outbox';
  }

  const [authMod, walletsMod, txMod, transfersMod, attachmentsMod] = await Promise.all([
    import('../../src/modules/auth/auth.router.js'),
    import('../../src/modules/wallets/wallets.router.js'),
    import('../../src/modules/transactions/transactions.router.js'),
    import('../../src/modules/transfers/transfers.router.js'),
    import('../../src/modules/attachments/attachments.router.js'),
  ]);

  return {
    registerLimiter: authMod.registerLimiter,
    loginLimiter: authMod.loginLimiter,
    refreshLimiter: authMod.refreshLimiter,
    forgotPasswordLimiter: authMod.forgotPasswordLimiter,
    resetPasswordLimiter: authMod.resetPasswordLimiter,
    topupLimiter: walletsMod.topupLimiter,
    transactionLimiter: txMod.transactionLimiter,
    transferLimiter: transfersMod.transferLimiter,
    attachmentUploadLimiter: attachmentsMod.attachmentUploadLimiter,
    attachmentDownloadLimiter: attachmentsMod.attachmentDownloadLimiter,
  };
}

function buildProbeApp(limiters: LoadedLimiters) {
  const app = express();
  app.use(express.json());

  for (const [name, limiter] of Object.entries(limiters) as [
    keyof LoadedLimiters,
    RequestHandler,
  ][]) {
    app.post(`/probe/${name}`, limiter, (_req: Request, res: Response) => {
      res.status(200).json({ success: true });
    });
  }

  return app;
}

describe('Rate Limiter Test-Relaxation Safety Guard (NODE_ENV Gating)', () => {
  afterEach(async () => {
    vi.resetModules();
    const envModule = await import('../../src/config/env.js');
    envModule.env.NODE_ENV = 'test';
    envModule.env.MAIL_TRANSPORT = 'outbox';
    envModule.env.SMTP_HOST = undefined;
  });

  it('resolveRateLimitMax must relax ONLY for NODE_ENV=test and strictly forbid relaxation in production/development', () => {
    expect(resolveRateLimitMax(10, 'test')).toBe(1000);
    expect(resolveRateLimitMax(10, 'production')).toBe(10);
    expect(resolveRateLimitMax(10, 'production', 99999)).toBe(10);
    expect(resolveRateLimitMax(10, 'development')).toBe(10);
    expect(resolveRateLimitMax(5, 'staging')).toBe(5);
    expect(resolveRateLimitMax(30, '')).toBe(30);
  });

  it('must enforce strict non-relaxed limits across ALL routers in NODE_ENV=production and trigger 429 on threshold', async () => {
    const prodLimiters = await loadLimitersUnderEnv('production');
    const app = buildProbeApp(prodLimiters);

    const expectedStrictLimits: Record<keyof LoadedLimiters, string> = {
      registerLimiter: '10',
      loginLimiter: '10',
      refreshLimiter: '30',
      forgotPasswordLimiter: '5',
      resetPasswordLimiter: '5',
      topupLimiter: '30',
      transactionLimiter: '60',
      transferLimiter: '30',
      attachmentUploadLimiter: '30',
      attachmentDownloadLimiter: '60',
    };

    for (const [name, expectedLimit] of Object.entries(expectedStrictLimits)) {
      const res = await request(app).post(`/probe/${name}`).send({ email: 'probe@wallet.local' });
      expect(res.status).toBe(200);
      expect(res.headers['ratelimit-limit']).toBe(expectedLimit);
      expect(res.headers['ratelimit-limit']).not.toBe('1000');
    }

    // forgotPasswordLimiter already received 1 request above (4 remaining of 5).
    // Requests 2..5 must succeed (200), and Request 6 must be rejected with 429 TOO_MANY_REQUESTS.
    for (let i = 2; i <= 5; i++) {
      await request(app).post('/probe/forgotPasswordLimiter').expect(200);
    }

    const blockedRes = await request(app).post('/probe/forgotPasswordLimiter').expect(429);
    expect(blockedRes.body.success).toBe(false);
    expect(blockedRes.body.error.code).toBe('TOO_MANY_REQUESTS');
    expect(blockedRes.headers['retry-after']).toBeDefined();
  });

  it('must enforce strict non-relaxed limits in NODE_ENV=development and relax to 1000 ONLY in NODE_ENV=test', async () => {
    const devLimiters = await loadLimitersUnderEnv('development');
    const devApp = buildProbeApp(devLimiters);

    const devRes = await request(devApp).post('/probe/forgotPasswordLimiter').expect(200);
    expect(devRes.headers['ratelimit-limit']).toBe('5');

    const testLimiters = await loadLimitersUnderEnv('test');
    const testApp = buildProbeApp(testLimiters);

    for (const name of Object.keys(testLimiters)) {
      const res = await request(testApp)
        .post(`/probe/${name}`)
        .send({ email: 'probe@wallet.local' })
        .expect(200);
      expect(res.headers['ratelimit-limit']).toBe('1000');
    }

    // 6th request in NODE_ENV=test must NOT trigger 429
    for (let i = 2; i <= 6; i++) {
      await request(testApp).post('/probe/forgotPasswordLimiter').expect(200);
    }
  });
});
