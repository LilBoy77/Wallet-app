import { describe, it, expect } from 'vitest';
import { Writable } from 'stream';
import { createLogger } from '../../src/shared/logging/logger.js';

describe('Structured Logger Redaction Security', () => {
  it('should strictly redact authorization, cookies, passwords, and tokens from log output', () => {
    let capturedLogs = '';

    const testStream = new Writable({
      write(chunk, _encoding, callback) {
        capturedLogs += chunk.toString();
        callback();
      },
    });

    const testLogger = createLogger(testStream);

    const sensitivePayload = {
      user: {
        id: 'usr-123',
        password: 'SuperSecretPassword123!',
      },
      auth: {
        token: 'jwt_token_secret_xyz',
        accessToken: 'access_secret_abc',
        refreshToken: 'refresh_secret_def',
        secret: 'system_secret_key',
      },
      headers: {
        authorization: 'Bearer BearerSecret123',
        cookie: 'sessionId=CookieSecret456',
        'set-cookie': 'refreshToken=SetCookieSecret789',
      },
    };

    testLogger.info(sensitivePayload, 'Sensitive transaction executed');

    // 1. Verify that redacted placeholder is present
    expect(capturedLogs).toContain('[REDACTED]');

    // 2. Prove that NONE of the secret values leak anywhere in the captured output
    expect(capturedLogs).not.toContain('SuperSecretPassword123!');
    expect(capturedLogs).not.toContain('jwt_token_secret_xyz');
    expect(capturedLogs).not.toContain('access_secret_abc');
    expect(capturedLogs).not.toContain('refresh_secret_def');
    expect(capturedLogs).not.toContain('system_secret_key');
    expect(capturedLogs).not.toContain('BearerSecret123');
    expect(capturedLogs).not.toContain('CookieSecret456');
    expect(capturedLogs).not.toContain('SetCookieSecret789');

    // 3. Verify non-sensitive fields are preserved
    expect(capturedLogs).toContain('usr-123');
    expect(capturedLogs).toContain('Sensitive transaction executed');
  });
});
