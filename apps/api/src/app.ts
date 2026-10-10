import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { SHARED_API_VERSION, type HealthCheckPayload } from '@wallet-app/shared';
import { env } from './config/env.js';

export function createApp(): Express {
  const app: Express = express();

  // 1. Security Headers via Helmet
  app.use(helmet());

  // 2. CORS configuration with explicit origin
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
    })
  );

  // 3. JSON body parser with size limit
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // 4. Request Logging Middleware (Safe Sanitized Logging)
  // NEVER log authorization headers, cookies, or sensitive payload keys
  app.use((req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const sanitizedUrl = req.originalUrl.split('?')[0];

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      if (env.LOG_LEVEL !== 'error' && env.NODE_ENV !== 'test') {
        // Output structured safe log without credentials or tokens
        console.log(
          `[HTTP] ${req.method} ${sanitizedUrl} -> ${res.statusCode} (${duration}ms) [IP: ${req.ip || 'unknown'}]`
        );
      }
    });
    next();
  });

  // 5. Health Check Endpoint (Infrastructure only)
  app.get('/health', (_req: Request, res: Response) => {
    const healthData: HealthCheckPayload = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: '@wallet-app/api',
      version: SHARED_API_VERSION,
    };

    res.status(200).json({
      success: true,
      data: healthData,
      message: 'Service is healthy',
    });
  });

  // 6. 404 Not Found Handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Rute '${req.method} ${req.originalUrl}' tidak ditemukan`,
        details: null,
      },
    });
  });

  // 7. Global Error Handler Middleware
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const statusCode = typeof err.statusCode === 'number' ? err.statusCode : 500;
    const errorCode = err.code || (statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST');
    const message =
      env.NODE_ENV === 'production' && statusCode >= 500
        ? 'Terjadi kesalahan internal pada server'
        : err.message || 'Terjadi kesalahan sistem';

    if (env.NODE_ENV !== 'test') {
      console.error('[GLOBAL_ERROR]', err);
    }

    res.status(statusCode).json({
      success: false,
      error: {
        code: errorCode,
        message,
        details: err.details || null,
      },
    });
  });

  return app;
}

export const app: Express = createApp();
