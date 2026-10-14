import express, { type Express, type Request, type Response } from 'express';
import helmet from 'helmet';
import { SHARED_API_VERSION, type HealthCheckPayload } from '@wallet-app/shared';
import { env } from './config/env.js';
import {
  requestIdMiddleware,
  createCorsMiddleware,
  globalRateLimiter,
  requestLoggingMiddleware,
  notFoundHandler,
  globalErrorHandler,
} from './middlewares/index.js';
import { apiV1Router } from './modules/api.router.js';
import { checkDatabaseHealth } from './database/index.js';

/**
 * Express Application Factory
 * Configures the intentional, hardened middleware pipeline in strict sequence.
 */
export function createApp(): Express {
  const app: Express = express();

  // 1. Request ID Tracking
  // Validates incoming X-Request-Id or generates UUID v4, attaches to req.id and response headers
  app.use(requestIdMiddleware);

  // 2. Security Headers & Proxy Trust
  // Configured with Helmet and trust proxy setting from validated env
  app.set('trust proxy', env.TRUST_PROXY);
  app.use(helmet());

  // 3. CORS Whitelist
  // Strict origin whitelist from env; no wildcard when credentials allowed; explicit preflight
  app.use(createCorsMiddleware());

  // 4. Global Rate Limiter
  // Standard 429 response envelope with Retry-After header
  app.use(globalRateLimiter);

  // 5. Body Parsers with Configurable Size Limits
  app.use(express.json({ limit: env.BODY_SIZE_LIMIT }));
  app.use(express.urlencoded({ extended: true, limit: env.BODY_SIZE_LIMIT }));

  // 6. Structured Request Logging
  // Logs request lifecycle safely with mandatory redaction of authorization, cookie, and secrets
  app.use(requestLoggingMiddleware);

  // 7. Infrastructure Health Endpoints (Outside /api/v1 version prefix)
  // 7a. Liveness Probe (Does not touch database, verifies HTTP process is responsive)
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      data: {
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: '@wallet-app/api',
        version: SHARED_API_VERSION,
      },
      message: 'Service is alive',
    });
  });

  // 7b. Readiness Probe (Checks database connectivity; never leaks database credentials)
  app.get('/health/ready', async (_req: Request, res: Response) => {
    const dbHealth = await checkDatabaseHealth();
    const isDegraded = !dbHealth.connected;

    const healthData: HealthCheckPayload = {
      status: isDegraded ? 'degraded' : 'ok',
      timestamp: new Date().toISOString(),
      service: '@wallet-app/api',
      version: SHARED_API_VERSION,
      database: {
        status: dbHealth.connected ? 'connected' : 'disconnected',
        latencyMs: dbHealth.latencyMs,
      },
    };

    res.status(isDegraded ? 503 : 200).json({
      success: !isDegraded,
      data: healthData,
      message: isDegraded ? 'Service degraded: Database is unreachable' : 'Service is ready',
    });
  });

  // 8. API Router v1 (/api/v1) with Module Registry Blueprint
  app.use('/api/v1', apiV1Router);

  // 9. 404 Route Not Found Handler
  app.use(notFoundHandler);

  // 10. Centralized Global Error Handler
  app.use(globalErrorHandler);

  return app;
}

export const app: Express = createApp();
