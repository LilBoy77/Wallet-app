import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { query, closePool } from '../../src/database/index.js';
import { globalErrorHandler, requestIdMiddleware } from '../../src/middlewares/index.js';

function createPostgresErrorTestApp(): Express {
  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json());

  // 1. Route triggering real unique constraint violation (23505)
  app.post('/test/db-unique', async (_req, _res, next) => {
    try {
      // Insert duplicate email
      await query(
        "INSERT INTO users (username, email, password_hash, full_name) VALUES ('unique_test_user', 'unique_dup@test.local', 'hash', 'Test')"
      );
      // Attempt duplicate insert
      await query(
        "INSERT INTO users (username, email, password_hash, full_name) VALUES ('unique_test_user_2', 'unique_dup@test.local', 'hash', 'Test 2')"
      );
    } catch (err) {
      next(err);
    }
  });

  // 2. Route triggering real foreign key violation (23503)
  app.post('/test/db-fk', async (_req, _res, next) => {
    try {
      // Non-existent user_id
      await query(
        "INSERT INTO wallets (user_id, wallet_number, balance) VALUES ('00000000-0000-0000-0000-000000000099', 'W-INVALID', 0)"
      );
    } catch (err) {
      next(err);
    }
  });

  // 3. Route triggering real check constraint violation (23514)
  app.post('/test/db-check', async (_req, _res, next) => {
    try {
      // Negative balance violating chk_wallet_balance_non_negative
      await query(
        "INSERT INTO wallets (user_id, wallet_number, balance) VALUES ((SELECT id FROM users LIMIT 1), 'W-NEG', -500)"
      );
    } catch (err) {
      next(err);
    }
  });

  // 4. Route triggering real not-null violation (23502)
  app.post('/test/db-not-null', async (_req, _res, next) => {
    try {
      // Email is NOT NULL
      await query(
        "INSERT INTO users (username, email, password_hash, full_name) VALUES ('not_null_user', NULL, 'hash', 'Test')"
      );
    } catch (err) {
      next(err);
    }
  });

  // 5. Route triggering invalid UUID syntax (22P02)
  app.post('/test/db-invalid-uuid', async (_req, _res, next) => {
    try {
      await query('SELECT * FROM users WHERE id = $1', ['not-a-valid-uuid-format']);
    } catch (err) {
      next(err);
    }
  });

  app.use(globalErrorHandler);
  return app;
}

describe('Real PostgreSQL Error Mapping & SQL Leakage Prevention', () => {
  const testApp = createPostgresErrorTestApp();

  beforeAll(async () => {
    // Clean up test data if present
    await query("DELETE FROM users WHERE email = 'unique_dup@test.local'");
  });

  afterAll(async () => {
    await query("DELETE FROM users WHERE email = 'unique_dup@test.local'");
    await closePool();
  });

  it('23505 Unique Violation: maps to 409 DUPLICATE_ENTRY without leaking constraint or table names', async () => {
    const res = await request(testApp).post('/test/db-unique');

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('DUPLICATE_ENTRY');
    expect(res.body.error.message).toContain('sudah ada');

    // Prove NO table names, constraint names, or SQL query leaked in response
    const rawBody = JSON.stringify(res.body);
    expect(rawBody).not.toContain('users');
    expect(rawBody).not.toContain('idx_users_email_active');
    expect(rawBody).not.toContain('INSERT INTO');
  });

  it('23503 Foreign Key Violation: maps to 422 FOREIGN_KEY_VIOLATION without leaking schema details', async () => {
    const res = await request(testApp).post('/test/db-fk');

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('FOREIGN_KEY_VIOLATION');
    expect(res.body.error.message).toContain('relasional tidak valid');

    const rawBody = JSON.stringify(res.body);
    expect(rawBody).not.toContain('fk_wallets_user_id');
    expect(rawBody).not.toContain('wallets');
    expect(rawBody).not.toContain('INSERT INTO');
  });

  it('23514 Check Constraint Violation: maps to 422 CHECK_CONSTRAINT_VIOLATION without leaking constraint name', async () => {
    const res = await request(testApp).post('/test/db-check');

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('CHECK_CONSTRAINT_VIOLATION');

    const rawBody = JSON.stringify(res.body);
    expect(rawBody).not.toContain('chk_wallet_balance_non_negative');
    expect(rawBody).not.toContain('balance >= 0');
  });

  it('23502 Not Null Violation: maps to 400 BAD_REQUEST without leaking column name', async () => {
    const res = await request(testApp).post('/test/db-not-null');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');

    const rawBody = JSON.stringify(res.body);
    expect(rawBody).not.toContain('INSERT INTO users');
  });

  it('22P02 Invalid Representation: maps to 400 INVALID_PARAMETER without leaking internal SQL', async () => {
    const res = await request(testApp).post('/test/db-invalid-uuid');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_PARAMETER');

    const rawBody = JSON.stringify(res.body);
    expect(rawBody).not.toContain('SELECT * FROM users');
  });
});
