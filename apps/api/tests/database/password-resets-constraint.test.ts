import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  setupTestDatabase,
  closeTestDatabase,
  cleanTestTables,
  getTestPool,
} from './test-db-helper.js';

describe('Migration 009: password_resets & refresh_tokens family_id constraints', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanTestTables();
  });

  it('should enforce unique constraint on password_resets.token_hash', async () => {
    const pool = getTestPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const userRes = await client.query(
        `INSERT INTO users (username, email, password_hash, full_name, role)
         VALUES ('test_reset_user', 'test_reset@wallet.local', 'hash', 'Test Reset', 'user')
         RETURNING id`
      );
      const userId = userRes.rows[0].id;

      await client.query(
        `INSERT INTO password_resets (user_id, token_hash, expires_at)
         VALUES ($1, 'duplicate_hash_123', NOW() + INTERVAL '15 minutes')`,
        [userId]
      );

      await expect(
        client.query(
          `INSERT INTO password_resets (user_id, token_hash, expires_at)
           VALUES ($1, 'duplicate_hash_123', NOW() + INTERVAL '15 minutes')`,
          [userId]
        )
      ).rejects.toThrow(/duplicate key|violates unique constraint/i);

      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  it('should cascade delete password_resets when user is deleted', async () => {
    const pool = getTestPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const userRes = await client.query(
        `INSERT INTO users (username, email, password_hash, full_name, role)
         VALUES ('cascade_reset_user', 'cascade_reset@wallet.local', 'hash', 'Cascade Reset', 'user')
         RETURNING id`
      );
      const userId = userRes.rows[0].id;

      await client.query(
        `INSERT INTO password_resets (user_id, token_hash, expires_at)
         VALUES ($1, 'cascade_token_hash_456', NOW() + INTERVAL '15 minutes')`,
        [userId]
      );

      const beforeRes = await client.query(
        'SELECT COUNT(*) FROM password_resets WHERE user_id = $1',
        [userId]
      );
      expect(Number(beforeRes.rows[0].count)).toBe(1);

      await client.query('DELETE FROM users WHERE id = $1', [userId]);

      const afterRes = await client.query(
        'SELECT COUNT(*) FROM password_resets WHERE user_id = $1',
        [userId]
      );
      expect(Number(afterRes.rows[0].count)).toBe(0);

      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  it('should allow family_id on refresh_tokens table', async () => {
    const pool = getTestPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const userRes = await client.query(
        `INSERT INTO users (username, email, password_hash, full_name, role)
         VALUES ('family_test_user', 'family_test@wallet.local', 'hash', 'Family User', 'user')
         RETURNING id`
      );
      const userId = userRes.rows[0].id;

      const familyRes = await client.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at)
         VALUES ($1, 'family_token_hash_789', gen_random_uuid(), NOW() + INTERVAL '7 days')
         RETURNING family_id`,
        [userId]
      );

      expect(familyRes.rows[0].family_id).toBeDefined();
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });
});
