import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  setupTestDatabase,
  closeTestDatabase,
  cleanTestTables,
  getTestPool,
} from './test-db-helper.js';

describe('Soft Delete & Partial Unique Index Behavior', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanTestTables();
  });

  it('should allow reusing email and username after the previous owner is soft-deleted', async () => {
    const pool = getTestPool();

    // 1. Create User 1
    const { rows: initial } = await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name)
       VALUES ('alice', 'alice@company.local', 'hash', 'Alice Initial')
       RETURNING id`
    );
    const aliceId = initial[0].id;

    // 2. Active collision should fail
    await expect(
      pool.query(
        `INSERT INTO users (username, email, password_hash, full_name)
         VALUES ('alice_second', 'alice@company.local', 'hash', 'Alice Duplicate')`
      )
    ).rejects.toThrow(/idx_users_email_active/);

    // 3. Soft-delete Alice
    await pool.query(`UPDATE users SET deleted_at = NOW() WHERE id = $1`, [aliceId]);

    // 4. Now another active user CAN register with the same email and username!
    const { rows: newUser } = await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name)
       VALUES ('alice', 'alice@company.local', 'new_hash', 'Alice New Account')
       RETURNING id`
    );

    expect(newUser[0].id).toBeDefined();
    expect(newUser[0].id).not.toBe(aliceId);

    // 5. But a THIRD active user with that email still cannot register (because newUser is active)
    await expect(
      pool.query(
        `INSERT INTO users (username, email, password_hash, full_name)
         VALUES ('alice_third', 'ALICE@COMPANY.LOCAL', 'hash', 'Alice Third')`
      )
    ).rejects.toThrow(/idx_users_email_active/);
  });

  it('should allow soft-deleted custom categories to be recreated by the same user', async () => {
    const pool = getTestPool();

    // Create user
    const { rows: u } = await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name)
       VALUES ('bob', 'bob@company.local', 'hash', 'Bob') RETURNING id`
    );
    const userId = u[0].id;

    // Create category
    const { rows: cat } = await pool.query(
      `INSERT INTO categories (user_id, name, type)
       VALUES ($1, 'Koleksi Buku', 'expense') RETURNING id`,
      [userId]
    );
    const catId = cat[0].id;

    // Active duplicate fails
    await expect(
      pool.query(
        `INSERT INTO categories (user_id, name, type)
         VALUES ($1, 'koleksi buku', 'expense')`,
        [userId]
      )
    ).rejects.toThrow(/idx_categories_user_name_type_active/);

    // Soft delete the category
    await pool.query(`UPDATE categories SET deleted_at = NOW() WHERE id = $1`, [catId]);

    // Recreate custom category with same name
    const { rows: recreated } = await pool.query(
      `INSERT INTO categories (user_id, name, type)
       VALUES ($1, 'Koleksi Buku', 'expense') RETURNING id`,
      [userId]
    );

    expect(recreated[0].id).toBeDefined();
    expect(recreated[0].id).not.toBe(catId);
  });
});
