import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { app } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import {
  setupTestDatabase,
  closeTestDatabase,
  cleanTestTables,
  getTestPool,
} from '../database/test-db-helper.js';
import { createAuthenticatedUser } from '../finance/finance-test-helper.js';

const VALID_PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 0x77),
]);

describe('Attachments Module - Concurrency & Race Condition Protection', () => {
  let categoryId: string;

  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanTestTables();

    const pool = getTestPool();
    const res = await pool.query(
      `INSERT INTO categories (name, type, color, icon, is_system, user_id)
       VALUES ('Race Test Cat', 'expense', '#EF4444', 'receipt', true, NULL)
       RETURNING id`
    );
    categoryId = res.rows[0].id;
  });

  it('should strictly limit attachments to 5 when 10 simultaneous uploads race for the same transaction across 5 consecutive rounds', async () => {
    const user = await createAuthenticatedUser(app, { initialBalance: 1_000_000 });
    const pool = getTestPool();
    const ROUNDS = 5;
    const CONCURRENT_UPLOADS = 10;

    const uploadDir = path.isAbsolute(env.UPLOAD_DIR)
      ? env.UPLOAD_DIR
      : path.resolve(process.cwd(), env.UPLOAD_DIR);

    const roundResults: Array<{
      round: number;
      succeeded201: number;
      rejected400: number;
      dbRows: number;
    }> = [];

    for (let round = 1; round <= ROUNDS; round++) {
      // 1. Create an isolated transaction for this round
      const txRes = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          type: 'expense',
          category_id: categoryId,
          amount: 25_000,
          description: `Race condition test transaction round ${round}`,
        })
        .expect(201);

      const txId = txRes.body.data.id;

      // 2. Fire 10 simultaneous upload requests against quota of 5
      const uploadPromises = Array.from({ length: CONCURRENT_UPLOADS }).map((_, index) => {
        return request(app)
          .post('/api/v1/attachments')
          .set('Authorization', `Bearer ${user.accessToken}`)
          .field('transaction_id', txId)
          .attach('file', VALID_PNG, `race_r${round}_receipt_${index + 1}.png`);
      });

      const results = await Promise.all(uploadPromises);

      const successful = results.filter((r) => r.status === 201);
      const failed = results.filter((r) => r.status === 400);

      for (const failRes of failed) {
        expect(failRes.body.success).toBe(false);
        expect(failRes.body.error.code).toBe('LIMIT_EXCEEDED');
        expect(failRes.body.error.message).toMatch(/maksimal/i);
      }

      // 3. Verify database count for this transaction is strictly 5
      const countRes = await pool.query<{ count: string }>(
        'SELECT COUNT(*) as count FROM attachments WHERE transaction_id = $1',
        [txId]
      );
      const dbRows = parseInt(countRes.rows[0]?.count ?? '0', 10);

      // 4. Verify all 5 recorded files exist on disk
      const filesRes = await pool.query<{ file_path: string }>(
        'SELECT file_path FROM attachments WHERE transaction_id = $1',
        [txId]
      );
      for (const row of filesRes.rows) {
        const diskPath = path.resolve(uploadDir, row.file_path);
        expect(fs.existsSync(diskPath)).toBe(true);
      }

      roundResults.push({
        round,
        succeeded201: successful.length,
        rejected400: failed.length,
        dbRows,
      });
    }

    expect(roundResults).toEqual([
      { round: 1, succeeded201: 5, rejected400: 5, dbRows: 5 },
      { round: 2, succeeded201: 5, rejected400: 5, dbRows: 5 },
      { round: 3, succeeded201: 5, rejected400: 5, dbRows: 5 },
      { round: 4, succeeded201: 5, rejected400: 5, dbRows: 5 },
      { round: 5, succeeded201: 5, rejected400: 5, dbRows: 5 },
    ]);

    // 5. Verify failed uploads across all 5 rounds were unlinked (strictly 25 files on disk)
    const diskFiles = fs.existsSync(uploadDir)
      ? fs.readdirSync(uploadDir).filter((f) => f !== '.gitkeep')
      : [];
    expect(diskFiles.length).toBe(ROUNDS * 5);
  });
});
