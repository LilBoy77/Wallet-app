import { describe, it, expect } from 'vitest';
import { validateEnv } from '../src/config/env.js';

describe('Environment Configuration Validation (Fail-Fast with Zod)', () => {
  it('should pass validation when all required variables are valid', () => {
    const validConfig = {
      NODE_ENV: 'test',
      API_PORT: 5000,
      CORS_ORIGIN: 'http://localhost:5173',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/wallet_db',
      LOG_LEVEL: 'info',
    };

    const parsed = validateEnv(validConfig);
    expect(parsed.DATABASE_URL).toBe('postgresql://user:pass@localhost:5432/wallet_db');
    expect(parsed.API_PORT).toBe(5000);
  });

  it('should fail and throw an error when DATABASE_URL is missing', () => {
    const invalidConfig = {
      NODE_ENV: 'test',
      API_PORT: 5000,
      CORS_ORIGIN: 'http://localhost:5173',
      // DATABASE_URL missing
    };

    expect(() => validateEnv(invalidConfig)).toThrow('DATABASE_URL');
  });

  it('should fail when DATABASE_URL has invalid protocol', () => {
    const invalidConfig = {
      NODE_ENV: 'test',
      API_PORT: 5000,
      CORS_ORIGIN: 'http://localhost:5173',
      DATABASE_URL: 'mysql://user:pass@localhost:3306/db',
    };

    expect(() => validateEnv(invalidConfig)).toThrow('PostgreSQL connection URL');
  });
});
