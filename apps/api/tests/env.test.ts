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
    expect(parsed.JWT_ACCESS_SECRET).toBeDefined();
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

  it('should fail when JWT_ACCESS_SECRET is shorter than 32 characters', () => {
    const invalidConfig = {
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/wallet_db',
      JWT_ACCESS_SECRET: 'too-short-secret',
    };

    expect(() => validateEnv(invalidConfig)).toThrow('at least 32 characters');
  });

  it('should fail in production when JWT_ACCESS_SECRET uses placeholder values', () => {
    const invalidProdConfig = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/wallet_db',
      JWT_ACCESS_SECRET: 'change_me_super_secret_key_at_least_32_characters_long',
      JWT_REFRESH_SECRET: 'production_valid_refresh_key_at_least_32_chars_long_123',
      MAIL_TRANSPORT: 'smtp',
      SMTP_HOST: 'smtp.mail.example.com',
    };

    expect(() => validateEnv(invalidProdConfig)).toThrow('placeholder values');
  });

  it('should fail in production when MAIL_TRANSPORT is outbox', () => {
    const invalidProdConfig = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/wallet_db',
      JWT_ACCESS_SECRET: 'production_valid_access_key_at_least_32_chars_long_123',
      JWT_REFRESH_SECRET: 'production_valid_refresh_key_at_least_32_chars_long_123',
      MAIL_TRANSPORT: 'outbox',
    };

    expect(() => validateEnv(invalidProdConfig)).toThrow(
      "MAIL_TRANSPORT cannot be 'outbox' in production"
    );
  });
});
