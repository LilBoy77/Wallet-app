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

// Minimal valid file buffers with authentic magic bytes
const VALID_JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]),
  Buffer.alloc(100, 0xaa),
  Buffer.from([0xff, 0xd9]),
]);

const VALID_PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(100, 0xbb),
]);

const VALID_WEBP = Buffer.concat([
  Buffer.from([
    0x52,
    0x49,
    0x46,
    0x46, // 'RIFF'
    0x24,
    0x00,
    0x00,
    0x00, // file size chunk
    0x57,
    0x45,
    0x42,
    0x50, // 'WEBP'
    0x56,
    0x50,
    0x38,
    0x20, // 'VP8 '
  ]),
  Buffer.alloc(50, 0xcc),
]);

const VALID_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF'
);

describe('Attachments Module (/api/v1/attachments)', () => {
  let expenseCatId: string;

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
       VALUES ('Operasional', 'expense', '#EF4444', 'receipt', true, NULL)
       RETURNING id`
    );
    expenseCatId = res.rows[0].id;
  });

  describe('POST /api/v1/attachments (Upload & Security Validation)', () => {
    it('should successfully upload valid JPEG, PNG, WebP, and PDF receipt files', async () => {
      const user = await createAuthenticatedUser(app, { initialBalance: 1_000_000 });

      // Create transaction
      const txRes = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          type: 'expense',
          category_id: expenseCatId,
          amount: 50_000,
          description: 'Beli ATK',
        })
        .expect(201);

      const txId = txRes.body.data.id;

      // 1. Upload JPEG
      const resJpg = await request(app)
        .post('/api/v1/attachments')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .field('transaction_id', txId)
        .attach('file', VALID_JPEG, 'receipt.jpg')
        .expect(201);

      expect(resJpg.body.success).toBe(true);
      expect(resJpg.body.data.file_name).toBe('receipt.jpg');
      expect(resJpg.body.data.mime_type).toBe('image/jpeg');
      expect(resJpg.body.data.file_hash).toBeDefined();
      expect(resJpg.body.data.file_hash.length).toBe(64); // SHA-256

      // 2. Upload PNG
      const resPng = await request(app)
        .post('/api/v1/attachments')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .field('transaction_id', txId)
        .attach('file', VALID_PNG, 'struk.png')
        .expect(201);

      expect(resPng.body.data.mime_type).toBe('image/png');

      // 3. Upload WebP
      const resWebp = await request(app)
        .post('/api/v1/attachments')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .field('transaction_id', txId)
        .attach('file', VALID_WEBP, 'invoice.webp')
        .expect(201);

      expect(resWebp.body.data.mime_type).toBe('image/webp');

      // 4. Upload PDF
      const resPdf = await request(app)
        .post('/api/v1/attachments')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .field('transaction_id', txId)
        .attach('file', VALID_PDF, 'bukti_bayar.pdf')
        .expect(201);

      expect(resPdf.body.data.mime_type).toBe('application/pdf');
    });

    it('should reject fake extension with mismatched/corrupted magic bytes with 415 Unsupported Media Type', async () => {
      const user = await createAuthenticatedUser(app, { initialBalance: 1_000_000 });

      const txRes = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          type: 'expense',
          category_id: expenseCatId,
          amount: 50_000,
          description: 'Belanja',
        })
        .expect(201);

      const txId = txRes.body.data.id;

      // Disguised plain text file named receipt.jpg
      const fakeFile = Buffer.from('NOT A REAL JPEG! Just plain ASCII text malicious payload');

      const res = await request(app)
        .post('/api/v1/attachments')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .field('transaction_id', txId)
        .attach('file', fakeFile, 'receipt.jpg')
        .expect(415);

      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Format berkas tidak didukung');
    });

    it('should sanitize path traversal attempts in file names and store safely with UUID', async () => {
      const user = await createAuthenticatedUser(app, { initialBalance: 1_000_000 });

      const txRes = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          type: 'expense',
          category_id: expenseCatId,
          amount: 50_000,
          description: 'Test Path Traversal',
        })
        .expect(201);

      const txId = txRes.body.data.id;

      const res = await request(app)
        .post('/api/v1/attachments')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .field('transaction_id', txId)
        .attach('file', VALID_JPEG, '../../../../etc/passwd.jpg')
        .expect(201);

      expect(res.body.success).toBe(true);
      // Sanitized name should not contain path traversal indicators
      expect(res.body.data.file_name).not.toContain('..');
      expect(res.body.data.file_name).not.toContain('/');
      expect(res.body.data.file_name).not.toContain('\\');
    });

    it('should reject file upload when size exceeds limit with 413 Payload Too Large', async () => {
      const user = await createAuthenticatedUser(app, { initialBalance: 1_000_000 });
      const pool = getTestPool();

      const txRes = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          type: 'expense',
          category_id: expenseCatId,
          amount: 50_000,
          description: 'Test Max Size',
        })
        .expect(201);

      const txId = txRes.body.data.id;

      const uploadDir = path.isAbsolute(env.UPLOAD_DIR)
        ? env.UPLOAD_DIR
        : path.resolve(process.cwd(), env.UPLOAD_DIR);

      const countBeforeRes = await pool.query<{ count: string }>(
        'SELECT COUNT(*) as count FROM attachments'
      );
      const countBefore = parseInt(countBeforeRes.rows[0]?.count ?? '0', 10);
      const filesBefore = fs.existsSync(uploadDir)
        ? fs
            .readdirSync(uploadDir)
            .filter((f) => f !== '.gitkeep')
            .sort()
        : [];

      // Create a 3MB dummy file (exceeds strict 2MB limit: 2,097,152 bytes)
      const oversizedBuffer = Buffer.alloc(3 * 1024 * 1024);
      // Place JPEG header so magic bytes check is not the primary reason for failure
      VALID_JPEG.copy(oversizedBuffer, 0, 0, 12);

      let wasRejected = false;
      try {
        const res = await request(app)
          .post('/api/v1/attachments')
          .set('Authorization', `Bearer ${user.accessToken}`)
          .field('transaction_id', txId)
          .attach('file', oversizedBuffer, 'huge_file.jpg');

        expect(res.status).toBe(413);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
        wasRejected = true;
      } catch (err: unknown) {
        // When server terminates connection early on streaming upload exceeding 2MB,
        // client socket may receive ECONNRESET or EPIPE.
        const code = (err as { code?: string }).code;
        expect(['ECONNRESET', 'EPIPE']).toContain(code);
        wasRejected = true;
      }

      expect(wasRejected).toBe(true);

      // Unconditionally assert on BOTH 413 and ECONNRESET/EPIPE branches:
      // 1. No new rows persisted in attachments table
      const countAfterRes = await pool.query<{ count: string }>(
        'SELECT COUNT(*) as count FROM attachments'
      );
      const countAfter = parseInt(countAfterRes.rows[0]?.count ?? '0', 10);
      expect(countAfter).toBe(countBefore);

      // 2. No new files written to the test upload directory
      const filesAfter = fs.existsSync(uploadDir)
        ? fs
            .readdirSync(uploadDir)
            .filter((f) => f !== '.gitkeep')
            .sort()
        : [];
      expect(filesAfter).toEqual(filesBefore);
    });

    it('should reject attachment upload to VOIDED transaction or transaction owned by another user', async () => {
      const userA = await createAuthenticatedUser(app, { initialBalance: 1_000_000 });
      const userB = await createAuthenticatedUser(app);

      // Create transaction for User A
      const txRes = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({
          type: 'expense',
          category_id: expenseCatId,
          amount: 100_000,
          description: 'Transaksi User A',
        })
        .expect(201);

      const txId = txRes.body.data.id;

      // 1. User B tries to upload attachment to User A's transaction -> 404 NOT_FOUND
      const uploadByBRes = await request(app)
        .post('/api/v1/attachments')
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .field('transaction_id', txId)
        .attach('file', VALID_PNG, 'b_attack.png')
        .expect(404);

      expect(uploadByBRes.body.success).toBe(false);
      expect(uploadByBRes.body.error.code).toBe('NOT_FOUND');

      // 2. Void User A's transaction
      await request(app)
        .delete(`/api/v1/transactions/${txId}`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ void_reason: 'Voided transaction for testing attachment restriction' })
        .expect(200);

      // 3. User A tries to upload attachment to their own VOIDED transaction -> 400 BAD_REQUEST
      const uploadVoidedRes = await request(app)
        .post('/api/v1/attachments')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .field('transaction_id', txId)
        .attach('file', VALID_PNG, 'voided_receipt.png')
        .expect(400);

      expect(uploadVoidedRes.body.success).toBe(false);
      expect(uploadVoidedRes.body.error.message).toContain('COMPLETED');
    });
  });

  describe('GET /api/v1/attachments/:id/download (Secure Streaming)', () => {
    it('should serve file with strict security headers (nosniff, attachment, no-store)', async () => {
      const user = await createAuthenticatedUser(app, { initialBalance: 1_000_000 });

      const txRes = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          type: 'expense',
          category_id: expenseCatId,
          amount: 50_000,
          description: 'Makan',
        })
        .expect(201);

      const uploadRes = await request(app)
        .post('/api/v1/attachments')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .field('transaction_id', txRes.body.data.id)
        .attach('file', VALID_PNG, 'nota_makan.png')
        .expect(201);

      const attachmentId = uploadRes.body.data.id;

      const downloadRes = await request(app)
        .get(`/api/v1/attachments/${attachmentId}/download`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(downloadRes.headers['x-content-type-options']).toBe('nosniff');
      expect(downloadRes.headers['content-disposition']).toContain('attachment');
      expect(downloadRes.headers['content-disposition']).toContain('nota_makan.png');
      expect(downloadRes.headers['cache-control']).toContain('no-store');
      expect(downloadRes.headers['content-type']).toContain('image/png');
    });

    it('should deny static serving of upload directory (returns 404)', async () => {
      const res = await request(app).get('/uploads/attachments/any-file.jpg').expect(404);

      expect(res.body.success).toBe(false);
    });
  });

  describe('IDOR & Isolation Tests', () => {
    it('should return 404 when user B attempts to download, view metadata, or delete user A attachment', async () => {
      const userA = await createAuthenticatedUser(app, { initialBalance: 1_000_000 });
      const userB = await createAuthenticatedUser(app);

      const txRes = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({
          type: 'expense',
          category_id: expenseCatId,
          amount: 50_000,
          description: 'User A Secret Transaction',
        })
        .expect(201);

      const uploadRes = await request(app)
        .post('/api/v1/attachments')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .field('transaction_id', txRes.body.data.id)
        .attach('file', VALID_PDF, 'secret_contract.pdf')
        .expect(201);

      const attachmentId = uploadRes.body.data.id;

      // User B GET download -> 404
      await request(app)
        .get(`/api/v1/attachments/${attachmentId}/download`)
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .expect(404);

      // User B GET metadata -> 404
      await request(app)
        .get(`/api/v1/attachments/${attachmentId}`)
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .expect(404);

      // User B DELETE -> 404
      await request(app)
        .delete(`/api/v1/attachments/${attachmentId}`)
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .expect(404);
    });

    it('should retain attachments when transaction is voided', async () => {
      const user = await createAuthenticatedUser(app, { initialBalance: 1_000_000 });

      const txRes = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          type: 'expense',
          category_id: expenseCatId,
          amount: 50_000,
          description: 'To be voided',
        })
        .expect(201);

      const txId = txRes.body.data.id;

      const uploadRes = await request(app)
        .post('/api/v1/attachments')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .field('transaction_id', txId)
        .attach('file', VALID_PNG, 'receipt_retained.png')
        .expect(201);

      const attachmentId = uploadRes.body.data.id;

      // Void transaction (Phase 5 standard: DELETE /transactions/:id)
      await request(app)
        .delete(`/api/v1/transactions/${txId}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ void_reason: 'Double charge' })
        .expect(200);

      // Verify attachment is still retrievable
      const metaRes = await request(app)
        .get(`/api/v1/attachments/${attachmentId}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(metaRes.body.success).toBe(true);
      expect(metaRes.body.data.id).toBe(attachmentId);
    });

    it('should delete disk file when attachment is deleted via API', async () => {
      const user = await createAuthenticatedUser(app, { initialBalance: 1_000_000 });
      const pool = getTestPool();

      const txRes = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          type: 'expense',
          category_id: expenseCatId,
          amount: 50_000,
          description: 'To delete attachment',
        })
        .expect(201);

      const uploadRes = await request(app)
        .post('/api/v1/attachments')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .field('transaction_id', txRes.body.data.id)
        .attach('file', VALID_JPEG, 'delete_me.jpg')
        .expect(201);

      const attachmentId = uploadRes.body.data.id;
      // Get internal file_path from DB to test physical deletion
      const dbRes = await pool.query('SELECT file_path FROM attachments WHERE id = $1', [
        attachmentId,
      ]);
      const relativePath = dbRes.rows[0].file_path;
      const uploadDir = path.isAbsolute(env.UPLOAD_DIR)
        ? env.UPLOAD_DIR
        : path.resolve(process.cwd(), env.UPLOAD_DIR);
      const absolutePath = path.resolve(uploadDir, relativePath);

      // Verify file exists on disk
      expect(fs.existsSync(absolutePath)).toBe(true);

      // Delete attachment
      await request(app)
        .delete(`/api/v1/attachments/${attachmentId}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      // Verify file removed from disk
      expect(fs.existsSync(absolutePath)).toBe(false);

      // Verify 404 when querying metadata
      await request(app)
        .get(`/api/v1/attachments/${attachmentId}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(404);
    });
  });
});
