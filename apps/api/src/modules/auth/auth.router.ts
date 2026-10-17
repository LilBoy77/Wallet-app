import { Router, type RequestHandler } from 'express';
import {
  registerInputSchema,
  loginInputSchema,
  changePasswordInputSchema,
  forgotPasswordInputSchema,
  resetPasswordInputSchema,
} from '@wallet-app/shared';
import { env } from '../../config/env.js';
import {
  validate,
  authenticate,
  csrfProtection,
  createRateLimiter,
} from '../../middlewares/index.js';
import { asyncHandler } from '../../shared/errors/index.js';
import { authController } from './auth.controller.js';

// Strict rate limiters for auth endpoints
const isTest = env.NODE_ENV === 'test';

export const registerLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isTest ? 1000 : 10,
  message: 'Terlalu banyak permintaan registrasi dari IP ini. Silakan coba lagi nanti.',
});

export const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: isTest ? 1000 : 10,
  keyGenerator: (req) => `${req.ip}_${req.body?.email || ''}`,
  message: 'Terlalu banyak percobaan login gagal untuk akun ini. Silakan coba lagi nanti.',
});

export const refreshLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 1000 : 30,
  message: 'Terlalu banyak permintaan refresh token. Silakan coba lagi nanti.',
});

export const forgotPasswordLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 1000 : 5,
  message: 'Terlalu banyak permintaan pemulihan kata sandi. Silakan coba lagi nanti.',
});

export const resetPasswordLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 1000 : 5,
  message: 'Terlalu banyak percobaan reset kata sandi. Silakan coba lagi nanti.',
});

export interface AuthRateLimiters {
  registerLimiter?: RequestHandler;
  loginLimiter?: RequestHandler;
  refreshLimiter?: RequestHandler;
  forgotPasswordLimiter?: RequestHandler;
  resetPasswordLimiter?: RequestHandler;
}

export function createAuthRouter(limiters: AuthRateLimiters = {}): Router {
  const router: Router = Router();

  const regLimiter = limiters.registerLimiter ?? registerLimiter;
  const logLimiter = limiters.loginLimiter ?? loginLimiter;
  const refLimiter = limiters.refreshLimiter ?? refreshLimiter;
  const forgotLimiter = limiters.forgotPasswordLimiter ?? forgotPasswordLimiter;
  const resetLimiter = limiters.resetPasswordLimiter ?? resetPasswordLimiter;

  // 1. POST /api/v1/auth/register (Public)
  router.post(
    '/register',
    regLimiter,
    validate({ body: registerInputSchema }),
    asyncHandler(authController.register)
  );

  // 2. POST /api/v1/auth/login (Public)
  router.post(
    '/login',
    logLimiter,
    validate({ body: loginInputSchema }),
    asyncHandler(authController.login)
  );

  // 3. POST /api/v1/auth/refresh (Cookie Authenticated + CSRF Protection)
  router.post('/refresh', csrfProtection, refLimiter, asyncHandler(authController.refresh));

  // 4. POST /api/v1/auth/logout (Cookie Authenticated + CSRF Protection)
  router.post('/logout', csrfProtection, asyncHandler(authController.logout));

  // 5. POST /api/v1/auth/logout-all (Bearer Authenticated)
  router.post('/logout-all', asyncHandler(authenticate), asyncHandler(authController.logoutAll));

  // 6. GET /api/v1/auth/me (Bearer Authenticated)
  router.get('/me', asyncHandler(authenticate), asyncHandler(authController.me));

  // 7. PUT /api/v1/auth/change-password (Bearer Authenticated)
  router.put(
    '/change-password',
    asyncHandler(authenticate),
    validate({ body: changePasswordInputSchema }),
    asyncHandler(authController.changePassword)
  );

  // 8. POST /api/v1/auth/forgot-password (Public)
  router.post(
    '/forgot-password',
    forgotLimiter,
    validate({ body: forgotPasswordInputSchema }),
    asyncHandler(authController.forgotPassword)
  );

  // 9. POST /api/v1/auth/reset-password (Public)
  router.post(
    '/reset-password',
    resetLimiter,
    validate({ body: resetPasswordInputSchema }),
    asyncHandler(authController.resetPassword)
  );

  return router;
}

export const authRouter: Router = createAuthRouter();
