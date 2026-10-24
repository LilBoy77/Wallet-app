import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  setupTestDatabase,
  closeTestDatabase,
  cleanTestTables,
  getTestPool,
} from '../database/test-db-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.resolve(__dirname, '../../src');

function getAllTypeScriptFiles(dir: string): string[] {
  const results: string[] = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of list) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllTypeScriptFiles(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('Financial Module - Structural Guard & Database Invariant Enforcement', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanTestTables();
  });

  it('structural guard: no SQL updating wallet balance or inserting ledger entries exists outside WalletsRepository', () => {
    const allFiles = getAllTypeScriptFiles(SRC_DIR);
    const designatedRepo = path.resolve(SRC_DIR, 'modules/wallets/wallets.repository.ts');

    const violatingFiles: { file: string; reason: string }[] = [];

    const balanceUpdateRegex = /UPDATE\s+wallets\s+SET\s+balance/i;
    const ledgerInsertRegex = /INSERT\s+INTO\s+wallet_entries/i;

    for (const file of allFiles) {
      const normalized = file.replace(/\\/g, '/');
      if (
        path.resolve(file) === designatedRepo ||
        normalized.includes('/database/seeder.ts') ||
        normalized.includes('/database/scripts/')
      ) {
        // Designated ledger repository and initial DB seeder/scripts are excluded
        continue;
      }

      const content = fs.readFileSync(file, 'utf-8');

      if (balanceUpdateRegex.test(content)) {
        violatingFiles.push({
          file: path.relative(SRC_DIR, file),
          reason: 'Direct UPDATE on wallets.balance found outside designated WalletsRepository',
        });
      }

      if (ledgerInsertRegex.test(content)) {
        violatingFiles.push({
          file: path.relative(SRC_DIR, file),
          reason: 'Direct INSERT INTO wallet_entries found outside designated WalletsRepository',
        });
      }
    }

    if (violatingFiles.length > 0) {
      const summary = violatingFiles.map((v) => `${v.file}: ${v.reason}`).join('\n');
      throw new Error(`[STRUCTURAL_LEDGER_GUARD_VIOLATION]\n${summary}`);
    }

    expect(violatingFiles).toHaveLength(0);
  });

  it('database level: direct SQL attempting to set negative wallet balance is rejected by CHECK constraint', async () => {
    const pool = getTestPool();

    // Insert user & wallet
    const userRes = await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name)
       VALUES ('neg_bal_tester', 'neg_bal@wallet.local', '$argon2id$mock', 'Negative Balance Tester')
       RETURNING id`
    );
    const userId = userRes.rows[0].id;

    await expect(
      pool.query(
        `INSERT INTO wallets (user_id, wallet_number, currency, balance)
         VALUES ($1, 'WAL-NEG-TEST', 'IDR', -100)`,
        [userId]
      )
    ).rejects.toThrow(/chk_wallets_balance_non_negative/i);
  });

  it('database level: direct SQL attempting to UPDATE or DELETE wallet_entries is rejected by append-only triggers', async () => {
    const pool = getTestPool();

    const userRes = await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name)
       VALUES ('trigger_tester', 'trigger@wallet.local', '$argon2id$mock', 'Trigger Tester')
       RETURNING id`
    );
    const walletRes = await pool.query(
      `INSERT INTO wallets (user_id, wallet_number, currency, balance)
       VALUES ($1, 'WAL-TRIG-TEST', 'IDR', 100000)
       RETURNING id`,
      [userRes.rows[0].id]
    );

    const entryRes = await pool.query(
      `INSERT INTO wallet_entries (wallet_id, reference_type, entry_type, amount, balance_after)
       VALUES ($1, 'topup_simulation', 'credit', 100000, 100000)
       RETURNING id`,
      [walletRes.rows[0].id]
    );
    const entryId = entryRes.rows[0].id;

    // UPDATE must be rejected by trigger
    await expect(
      pool.query(`UPDATE wallet_entries SET amount = 999999 WHERE id = $1`, [entryId])
    ).rejects.toThrow(/wallet_entries is an append-only/i);

    // DELETE must be rejected by trigger
    await expect(pool.query(`DELETE FROM wallet_entries WHERE id = $1`, [entryId])).rejects.toThrow(
      /wallet_entries is an append-only/i
    );
  });

  it('global post-condition: entire database satisfies global money conservation and balance equals net ledger', async () => {
    const pool = getTestPool();

    // 1. Balance = total credit entries - total debit entries per wallet
    const auditRes = await pool.query<{
      wallet_id: string;
      current_balance: string;
      net_ledger: string;
    }>(`
      SELECT
        w.id as wallet_id,
        w.balance::text as current_balance,
        COALESCE(SUM(CASE WHEN we.entry_type = 'credit' THEN we.amount ELSE -we.amount END), 0)::text as net_ledger
      FROM wallets w
      LEFT JOIN wallet_entries we ON w.id = we.wallet_id
      GROUP BY w.id, w.balance
    `);

    for (const row of auditRes.rows) {
      expect(BigInt(row.current_balance)).toBe(BigInt(row.net_ledger));
    }

    // 2. Transfer conservation: SUM(transfer_send amount) == SUM(transfer_receive amount)
    const transferAudit = await pool.query<{
      total_send: string;
      total_receive: string;
    }>(`
      SELECT
        COALESCE(SUM(CASE WHEN reference_type = 'transfer_send' THEN amount ELSE 0 END), 0)::text as total_send,
        COALESCE(SUM(CASE WHEN reference_type = 'transfer_receive' THEN amount ELSE 0 END), 0)::text as total_receive
      FROM wallet_entries
    `);

    expect(BigInt(transferAudit.rows[0].total_send)).toBe(
      BigInt(transferAudit.rows[0].total_receive)
    );
  });
});
