import pg from 'pg';
import { env } from '../../config/env.js';
import { sanitizeConnectionString } from '../index.js';

const { Pool } = pg;

export interface VerificationCheck {
  name: string;
  passed: boolean;
  details: string;
}

export async function runDatabaseVerification(customConnectionString?: string): Promise<{
  success: boolean;
  checks: VerificationCheck[];
}> {
  const targetUrl =
    customConnectionString || (env.NODE_ENV === 'test' ? env.TEST_DATABASE_URL : env.DATABASE_URL);
  const pool = new Pool({
    connectionString: targetUrl,
    connectionTimeoutMillis: 5000,
  });

  const client = await pool.connect();
  const checks: VerificationCheck[] = [];

  try {
    console.log(
      `[VERIFY] Running database consistency checks on ${sanitizeConnectionString(targetUrl)}...`
    );

    // 1. Check Row Counts on Main Tables (minimums per ASSIGNMENT_SOURCE.md)
    const tableMinimums: Record<string, number> = {
      users: 20,
      wallets: 20,
      categories: 20,
      budgets: 20,
      transactions: 20,
      wallet_entries: 20,
      transfers: 20,
      tags: 20,
      transaction_tags: 20,
      attachments: 20,
      refresh_tokens: 20,
      activity_logs: 20,
      notifications: 20,
    };

    for (const [table, min] of Object.entries(tableMinimums)) {
      const { rows } = await client.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM ${table}`
      );
      const count = parseInt(rows[0]?.count ?? '0', 10);
      const passed = count >= min;
      checks.push({
        name: `Row count on ${table}`,
        passed,
        details: passed
          ? `Found ${count} rows (minimum required: ${min})`
          : `FAILED: Found ${count} rows (expected >= ${min})`,
      });
    }

    // 2. Check for Orphan Foreign Keys
    const orphanChecks = [
      {
        name: 'Orphan wallets (invalid user_id)',
        query:
          'SELECT COUNT(*) as count FROM wallets w LEFT JOIN users u ON w.user_id = u.id WHERE u.id IS NULL',
      },
      {
        name: 'Orphan categories (invalid user_id)',
        query:
          'SELECT COUNT(*) as count FROM categories c LEFT JOIN users u ON c.user_id = u.id WHERE c.user_id IS NOT NULL AND u.id IS NULL',
      },
      {
        name: 'Orphan budgets (invalid category_id)',
        query:
          'SELECT COUNT(*) as count FROM budgets b LEFT JOIN categories c ON b.category_id = c.id WHERE c.id IS NULL',
      },
      {
        name: 'Orphan transactions (invalid wallet_id)',
        query:
          'SELECT COUNT(*) as count FROM transactions t LEFT JOIN wallets w ON t.wallet_id = w.id WHERE w.id IS NULL',
      },
      {
        name: 'Orphan wallet_entries (invalid wallet_id)',
        query:
          'SELECT COUNT(*) as count FROM wallet_entries e LEFT JOIN wallets w ON e.wallet_id = w.id WHERE w.id IS NULL',
      },
      {
        name: 'Orphan transfers (invalid source or target wallet)',
        query:
          'SELECT COUNT(*) as count FROM transfers tr LEFT JOIN wallets sw ON tr.source_wallet_id = sw.id LEFT JOIN wallets tw ON tr.target_wallet_id = tw.id WHERE sw.id IS NULL OR tw.id IS NULL',
      },
    ];

    for (const oc of orphanChecks) {
      const { rows } = await client.query<{ count: string }>(oc.query);
      const orphanCount = parseInt(rows[0]?.count ?? '0', 10);
      const passed = orphanCount === 0;
      checks.push({
        name: oc.name,
        passed,
        details: passed
          ? '0 orphan records found'
          : `FAILED: ${orphanCount} orphan records detected!`,
      });
    }

    // 3. Check for Negative Balances
    const { rows: negRows } = await client.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM wallets WHERE balance < 0'
    );
    const negCount = parseInt(negRows[0]?.count ?? '0', 10);
    checks.push({
      name: 'Zero negative wallet balances',
      passed: negCount === 0,
      details:
        negCount === 0
          ? 'All wallet balances are >= 0'
          : `FAILED: ${negCount} negative balances found!`,
    });

    // 4. Ledger Reconciliation: For every wallet, balance == sum(credits) - sum(debits)
    const { rows: reconRows } = await client.query<{
      wallet_id: string;
      wallet_balance: string;
      ledger_balance: string;
    }>(`
      SELECT 
        w.id as wallet_id,
        w.balance as wallet_balance,
        COALESCE(SUM(CASE WHEN e.entry_type = 'credit' THEN e.amount ELSE -e.amount END), 0) as ledger_balance
      FROM wallets w
      LEFT JOIN wallet_entries e ON w.id = e.wallet_id
      GROUP BY w.id, w.balance
      HAVING w.balance <> COALESCE(SUM(CASE WHEN e.entry_type = 'credit' THEN e.amount ELSE -e.amount END), 0)
    `);

    const hasMismatchedWallets = reconRows.length > 0;
    checks.push({
      name: 'Ledger reconciliation consistency',
      passed: !hasMismatchedWallets,
      details: !hasMismatchedWallets
        ? 'All wallet balances 100% match ledger entries sum'
        : `FAILED: ${reconRows.length} wallets have balance discrepancy with ledger!`,
    });

    // 5. Transfer Double-Entry Balance: Every completed transfer has 1 matching debit and 1 matching credit
    const { rows: transferMismatchRows } = await client.query<{
      transfer_id: string;
      expected_amount: string;
      debit_amount: string | null;
      credit_amount: string | null;
    }>(`
      SELECT 
        tr.id as transfer_id,
        tr.amount as expected_amount,
        (SELECT e.amount FROM wallet_entries e WHERE e.reference_id = tr.id AND e.entry_type = 'debit' LIMIT 1) as debit_amount,
        (SELECT e.amount FROM wallet_entries e WHERE e.reference_id = tr.id AND e.entry_type = 'credit' LIMIT 1) as credit_amount
      FROM transfers tr
      WHERE tr.status = 'completed'
      AND (
        (SELECT e.amount FROM wallet_entries e WHERE e.reference_id = tr.id AND e.entry_type = 'debit') <> tr.amount
        OR
        (SELECT e.amount FROM wallet_entries e WHERE e.reference_id = tr.id AND e.entry_type = 'credit') <> tr.amount
      )
    `);

    const hasTransferMismatches = transferMismatchRows.length > 0;
    checks.push({
      name: 'Transfer double-entry pairing',
      passed: !hasTransferMismatches,
      details: !hasTransferMismatches
        ? 'All completed transfers have exact matching debit and credit entries'
        : `FAILED: ${transferMismatchRows.length} transfers lack balanced ledger entries!`,
    });

    // 6. Soft Delete Proof Check: Verify soft-deleted rows exist
    const { rows: sdUsers } = await client.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM users WHERE deleted_at IS NOT NULL'
    );
    const { rows: sdCategories } = await client.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM categories WHERE deleted_at IS NOT NULL'
    );
    const { rows: sdTransactions } = await client.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM transactions WHERE deleted_at IS NOT NULL'
    );

    const softDeletedUsersCount = parseInt(sdUsers[0]?.count ?? '0', 10);
    const softDeletedCategoriesCount = parseInt(sdCategories[0]?.count ?? '0', 10);
    const softDeletedTransactionsCount = parseInt(sdTransactions[0]?.count ?? '0', 10);

    const softDeletePassed =
      softDeletedUsersCount > 0 &&
      softDeletedCategoriesCount > 0 &&
      softDeletedTransactionsCount > 0;
    checks.push({
      name: 'Soft delete records presence',
      passed: softDeletePassed,
      details: softDeletePassed
        ? `Soft deleted rows verified (Users: ${softDeletedUsersCount}, Categories: ${softDeletedCategoriesCount}, Transactions: ${softDeletedTransactionsCount})`
        : `FAILED: Missing soft deleted test rows (Users: ${softDeletedUsersCount}, Categories: ${softDeletedCategoriesCount}, Transactions: ${softDeletedTransactionsCount})`,
    });

    const allPassed = checks.every((c) => c.passed);
    return { success: allPassed, checks };
  } finally {
    client.release();
    await pool.end();
  }
}

// Direct CLI execution
import { fileURLToPath } from 'url';
import path from 'path';

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : '';
const isDirectRun =
  invokedFile.toLowerCase() === currentFile.toLowerCase() ||
  invokedFile.endsWith('verify.ts') ||
  invokedFile.endsWith('verify.js');

if (isDirectRun) {
  runDatabaseVerification()
    .then(({ success, checks }) => {
      console.log('\n=========================================');
      console.log(' DATABASE CONSISTENCY VERIFICATION REPORT');
      console.log('=========================================');
      for (const c of checks) {
        console.log(`[${c.passed ? 'PASS' : 'FAIL'}] ${c.name}: ${c.details}`);
      }
      console.log('=========================================');
      if (success) {
        console.log('RESULT: ALL DATABASE INTEGRITY CHECKS PASSED ✓\n');
        process.exit(0);
      } else {
        console.error('RESULT: DATABASE INTEGRITY VERIFICATION FAILED ✗\n');
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error('[VERIFY_FATAL_ERROR]', err);
      process.exit(1);
    });
}
