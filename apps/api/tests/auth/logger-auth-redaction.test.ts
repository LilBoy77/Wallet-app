import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Writable } from 'stream';
import express, { type Request, type Response } from 'express';
import { createLogger } from '../../src/shared/logging/logger.js';
import { globalErrorHandler } from '../../src/middlewares/index.js';

describe('Auth Module - Logger Sanitization & Zero Leakage in Auth Flows', () => {
  let capturedLogs = '';
  let testApp: express.Express;

  beforeAll(() => {
    const testStream = new Writable({
      write(chunk, _encoding, callback) {
        capturedLogs += chunk.toString();
        callback();
      },
    });

    const testLogger = createLogger(testStream);

    testApp = express();
    testApp.use(express.json());

    // Middleware that logs request headers and body to verify redaction
    testApp.use((req, _res, next) => {
      testLogger.info(
        {
          headers: req.headers,
          body: req.body,
        },
        'Incoming HTTP Request'
      );
      next();
    });

    testApp.post('/mock/auth/register', (req: Request, res: Response) => {
      testLogger.info({ user: req.body }, 'User registered');
      res.status(201).json({ success: true });
    });

    testApp.post('/mock/auth/login', (req: Request, res: Response) => {
      testLogger.info({ credentials: req.body }, 'Login processed');
      res.setHeader('Set-Cookie', 'refreshToken=SuperSecretCookieValue789; HttpOnly');
      res.status(200).json({ success: true });
    });

    testApp.get('/mock/auth/me', (_req: Request, res: Response) => {
      testLogger.info('User profile accessed');
      res.status(200).json({ success: true });
    });

    testApp.use(globalErrorHandler);
  });

  afterAll(() => {
    capturedLogs = '';
  });

  it('should prove password is NEVER leaked in logs during registration', async () => {
    const secretPassword = 'MySuperSecretPasswordToRedact123!';

    await request(testApp)
      .post('/mock/auth/register')
      .send({
        username: 'safe_logger_user',
        email: 'safe@wallet.local',
        password: secretPassword,
      })
      .expect(201);

    expect(capturedLogs).not.toContain(secretPassword);
    expect(capturedLogs).toContain('[REDACTED]');
  });

  it('should prove login password and credentials are NEVER leaked in logs', async () => {
    const loginSecret = 'MySuperSecretLoginPassword123!';

    await request(testApp)
      .post('/mock/auth/login')
      .send({
        email: 'safe@wallet.local',
        password: loginSecret,
      })
      .expect(200);

    expect(capturedLogs).not.toContain(loginSecret);
  });

  it('should prove Bearer tokens and cookies in headers are NEVER leaked in logs', async () => {
    const secretBearerToken = 'secret_bearer_token_xyz_should_never_leak';
    const secretCookie = 'refreshToken=secret_refresh_cookie_value_never_leak';

    await request(testApp)
      .get('/mock/auth/me')
      .set('Authorization', `Bearer ${secretBearerToken}`)
      .set('Cookie', secretCookie)
      .expect(200);

    expect(capturedLogs).not.toContain(secretBearerToken);
    expect(capturedLogs).not.toContain('secret_refresh_cookie_value_never_leak');
  });
});
