import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import {
  setupTestDatabase,
  closeTestDatabase,
  cleanTestTables,
  getTestPool,
} from '../database/test-db-helper.js';

describe('Auth Module - Registration (/api/v1/auth/register)', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanTestTables();
  });

  it('should successfully register a new user and return sanitized profile', async () => {
    const payload = {
      username: 'john_doe',
      email: 'john@example.com',
      password: 'StrongPassword123!',
      full_name: 'John Doe',
    };

    const res = await request(app).post('/api/v1/auth/register').send(payload).expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Registrasi berhasil');
    expect(res.body.data).toBeDefined();

    const userData = res.body.data;
    expect(userData.id).toBeDefined();
    expect(userData.username).toBe('john_doe');
    expect(userData.email).toBe('john@example.com');
    expect(userData.full_name).toBe('John Doe');
    expect(userData.role).toBe('user');
    expect(userData.is_active).toBe(true);
    expect(userData.is_verified).toBe(true);

    // Strict security assertion: NEVER expose password or password_hash in response
    expect(userData.password).toBeUndefined();
    expect(userData.password_hash).toBeUndefined();

    // Verify database record has argon2id hash, not plaintext password
    const pool = getTestPool();
    const dbRes = await pool.query('SELECT * FROM users WHERE id = $1', [userData.id]);
    expect(dbRes.rows.length).toBe(1);
    expect(dbRes.rows[0].password_hash).toMatch(/^\$argon2id\$/);
    expect(dbRes.rows[0].password_hash).not.toContain('StrongPassword123!');

    // D1: Verify default wallet was created atomically
    const walletRes = await pool.query('SELECT * FROM wallets WHERE user_id = $1', [userData.id]);
    expect(walletRes.rows.length).toBe(1);
    expect(walletRes.rows[0].currency).toBe('IDR');
    expect(walletRes.rows[0].balance).toBe('0');
    expect(walletRes.rows[0].name).toBe('Dompet Utama');
    expect(walletRes.rows[0].wallet_number).toMatch(/^WAL-[0-9A-F]{8}$/);
  });

  it('should reject duplicate email registration case-insensitively with 409 DUPLICATE_ENTRY', async () => {
    // 1. Initial registration
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: 'user_one',
        email: 'duplicate@wallet.local',
        password: 'Password123!',
        full_name: 'User One',
      })
      .expect(201);

    // 2. Duplicate with uppercase in email
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: 'user_two',
        email: 'DUPLICATE@WALLET.LOCAL',
        password: 'Password123!',
        full_name: 'User Two',
      })
      .expect(409);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('DUPLICATE_ENTRY');
    expect(res.body.error.message).toContain('Email sudah terdaftar');
  });

  it('should reject duplicate username registration case-insensitively with 409 DUPLICATE_ENTRY', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: 'unique_user',
        email: 'first@wallet.local',
        password: 'Password123!',
        full_name: 'Unique User',
      })
      .expect(201);

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: 'UNIQUE_USER',
        email: 'second@wallet.local',
        password: 'Password123!',
        full_name: 'Second User',
      })
      .expect(409);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('DUPLICATE_ENTRY');
    expect(res.body.error.message).toContain('Username sudah digunakan');
  });

  it('should prevent mass assignment: body role, is_active, and id must be ignored', async () => {
    const maliciousPayload = {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'hacker_user',
      email: 'hacker@wallet.local',
      password: 'HackerPassword123!',
      full_name: 'Malicious Attempt',
      role: 'admin',
      is_active: false,
      is_verified: false,
    };

    const res = await request(app).post('/api/v1/auth/register').send(maliciousPayload).expect(201);

    expect(res.body.data.role).toBe('user'); // MUST NOT be admin
    expect(res.body.data.id).not.toBe('00000000-0000-0000-0000-000000000001');

    const pool = getTestPool();
    const dbRes = await pool.query('SELECT role FROM users WHERE email = $1', [
      'hacker@wallet.local',
    ]);
    expect(dbRes.rows[0].role).toBe('user');
  });

  it('should validate password complexity and reject weak passwords with 422 VALIDATION_ERROR', async () => {
    // Missing uppercase
    const res1 = await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: 'weak_pass1',
        email: 'weak1@wallet.local',
        password: 'password123',
        full_name: 'Weak Pass 1',
      })
      .expect(422);

    expect(res1.body.error.code).toBe('VALIDATION_ERROR');

    // Missing number
    const res2 = await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: 'weak_pass2',
        email: 'weak2@wallet.local',
        password: 'PasswordOnly!',
        full_name: 'Weak Pass 2',
      })
      .expect(422);

    expect(res2.body.error.code).toBe('VALIDATION_ERROR');

    // Too short (< 8 chars)
    const res3 = await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: 'weak_pass3',
        email: 'weak3@wallet.local',
        password: 'P1a!',
        full_name: 'Weak Pass 3',
      })
      .expect(422);

    expect(res3.body.error.code).toBe('VALIDATION_ERROR');
  });
});
