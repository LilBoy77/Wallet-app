import bcrypt from 'bcryptjs';
import pg, { type PoolClient } from 'pg';
import { env } from '../config/env.js';
import { sanitizeConnectionString } from './index.js';

const { Pool } = pg;

/**
 * Validates that current environment and host are strictly development/local.
 * Throws error if production or remote host is detected.
 */
export function assertEnvironmentSafety(
  connectionString?: string,
  nodeEnv: string = env.NODE_ENV
): void {
  if (nodeEnv === 'production') {
    throw new Error(
      '[GUARD_REJECTED] Seeder and DB Reset are strictly forbidden in production environment (NODE_ENV=production)'
    );
  }

  const targetUrl =
    connectionString || (env.NODE_ENV === 'test' ? env.TEST_DATABASE_URL : env.DATABASE_URL);
  try {
    const url = new URL(targetUrl);
    const hostname = url.hostname.toLowerCase();
    const allowedLocalHosts = ['localhost', '127.0.0.1', 'postgres', '::1', '0.0.0.0'];
    if (!allowedLocalHosts.includes(hostname)) {
      throw new Error(
        `[GUARD_REJECTED] Seeder and DB Reset are strictly forbidden on non-local host: '${hostname}'. Only local development databases are permitted.`
      );
    }
  } catch (err) {
    if ((err as Error).message.includes('[GUARD_REJECTED]')) {
      throw err;
    }
    throw new Error(`[GUARD_REJECTED] Invalid database URL: ${(err as Error).message}`);
  }
}

/**
 * Truncates all application tables safely inside transaction.
 */
export async function truncateAllTables(client: PoolClient): Promise<void> {
  const tables = [
    'password_resets',
    'notifications',
    'activity_logs',
    'refresh_tokens',
    'attachments',
    'transaction_tags',
    'tags',
    'wallet_entries',
    'transfers',
    'transactions',
    'budgets',
    'categories',
    'wallets',
    'users',
  ];

  // Disable triggers temporarily on wallet_entries to allow clean truncation if needed
  await client.query('ALTER TABLE wallet_entries DISABLE TRIGGER trg_wallet_entries_no_delete');
  await client.query(`TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE`);
  await client.query('ALTER TABLE wallet_entries ENABLE TRIGGER trg_wallet_entries_no_delete');
}

/**
 * Executes deterministic seed data population.
 */
export async function runSeeder(
  options: {
    connectionString?: string;
    truncateFirst?: boolean;
  } = {}
): Promise<{
  usersCount: number;
  walletsCount: number;
  categoriesCount: number;
  budgetsCount: number;
  transactionsCount: number;
  walletEntriesCount: number;
  transfersCount: number;
  tagsCount: number;
  transactionTagsCount: number;
  attachmentsCount: number;
  refreshTokensCount: number;
  activityLogsCount: number;
  notificationsCount: number;
}> {
  const targetUrl =
    options.connectionString ||
    (env.NODE_ENV === 'test' ? env.TEST_DATABASE_URL : env.DATABASE_URL);
  assertEnvironmentSafety(targetUrl);

  const pool = new Pool({
    connectionString: targetUrl,
    connectionTimeoutMillis: 5000,
  });

  const client = await pool.connect();

  try {
    console.log(`[SEEDER] Starting database seeding on ${sanitizeConnectionString(targetUrl)}...`);
    await client.query('BEGIN');

    if (options.truncateFirst !== false) {
      console.log('[SEEDER] Cleaning existing data...');
      await truncateAllTables(client);
    }

    // 1. Hash passwords (Argon2id or bcrypt with cost 12 as defined in AUTH_SECURITY.md)
    const salt = bcrypt.genSaltSync(12);
    const adminPasswordHash = bcrypt.hashSync('Admin123!', salt);
    const userPasswordHash = bcrypt.hashSync('User123!', salt);

    // 2. Insert Users (20 accounts: 1 admin + 19 users, 1 user soft-deleted)
    console.log('[SEEDER] Seeding 20 users...');
    const userRecords: Array<{
      id: string;
      username: string;
      email: string;
      password_hash: string;
      full_name: string;
      role: string;
      is_active: boolean;
      deleted_at: Date | null;
    }> = [
      {
        id: '10000000-0000-0000-0000-000000000000',
        username: 'admin',
        email: 'admin@walletapp.local',
        password_hash: adminPasswordHash,
        full_name: 'Super Administrator',
        role: 'admin',
        is_active: true,
        deleted_at: null,
      },
    ];

    for (let i = 1; i <= 19; i++) {
      const pad = String(i).padStart(2, '0');
      const isSoftDeleted = i === 19; // User 19 is soft-deleted for test coverage
      userRecords.push({
        id: `10000000-0000-0000-0000-0000000000${pad}`,
        username: `user_${pad}`,
        email: `user${pad}@walletapp.local`,
        password_hash: userPasswordHash,
        full_name: `Pengguna Pengujian ${pad}`,
        role: 'user',
        is_active: !isSoftDeleted,
        deleted_at: isSoftDeleted ? new Date('2026-09-01T10:00:00Z') : null,
      });
    }

    for (const u of userRecords) {
      await client.query(
        `INSERT INTO users (id, username, email, password_hash, full_name, role, is_active, is_verified, deleted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)`,
        [u.id, u.username, u.email, u.password_hash, u.full_name, u.role, u.is_active, u.deleted_at]
      );
    }

    // 3. Insert Wallets (20 wallets, 1:1 with users)
    console.log('[SEEDER] Seeding 20 wallets...');
    const walletMap = new Map<string, { id: string; userId: string; balance: number }>();
    for (let i = 0; i < userRecords.length; i++) {
      const u = userRecords[i]!;
      const pad = String(i).padStart(2, '0');
      const walletId = `20000000-0000-0000-0000-0000000000${pad}`;
      const walletNumber = `WLT-2026-${pad}`;

      await client.query(
        `INSERT INTO wallets (id, user_id, wallet_number, currency, balance)
         VALUES ($1, $2, $3, 'IDR', 0)`,
        [walletId, u.id, walletNumber]
      );

      walletMap.set(u.id, { id: walletId, userId: u.id, balance: 0 });
    }

    // 4. Insert Categories (20 categories: 10 expense system, 5 income system, 5 custom, 1 soft-deleted)
    console.log('[SEEDER] Seeding 20 categories...');
    const categoryDefs = [
      // 10 System Expense
      {
        id: '30000000-0000-0000-0000-000000000001',
        name: 'Makanan & Minuman',
        type: 'expense',
        icon: 'utensils',
        color: '#f97316',
        is_system: true,
        user_id: null,
        deleted_at: null,
      },
      {
        id: '30000000-0000-0000-0000-000000000002',
        name: 'Transportasi',
        type: 'expense',
        icon: 'car',
        color: '#0ea5e9',
        is_system: true,
        user_id: null,
        deleted_at: null,
      },
      {
        id: '30000000-0000-0000-0000-000000000003',
        name: 'Belanja Harian',
        type: 'expense',
        icon: 'shopping-cart',
        color: '#84cc16',
        is_system: true,
        user_id: null,
        deleted_at: null,
      },
      {
        id: '30000000-0000-0000-0000-000000000004',
        name: 'Tagihan & Utilitas',
        type: 'expense',
        icon: 'zap',
        color: '#eab308',
        is_system: true,
        user_id: null,
        deleted_at: null,
      },
      {
        id: '30000000-0000-0000-0000-000000000005',
        name: 'Hiburan & Liburan',
        type: 'expense',
        icon: 'film',
        color: '#ec4899',
        is_system: true,
        user_id: null,
        deleted_at: null,
      },
      {
        id: '30000000-0000-0000-0000-000000000006',
        name: 'Kesehatan & Obat',
        type: 'expense',
        icon: 'heart-pulse',
        color: '#ef4444',
        is_system: true,
        user_id: null,
        deleted_at: null,
      },
      {
        id: '30000000-0000-0000-0000-000000000007',
        name: 'Pendidikan & Kursus',
        type: 'expense',
        icon: 'graduation-cap',
        color: '#8b5cf6',
        is_system: true,
        user_id: null,
        deleted_at: null,
      },
      {
        id: '30000000-0000-0000-0000-000000000008',
        name: 'Asuransi',
        type: 'expense',
        icon: 'shield',
        color: '#6366f1',
        is_system: true,
        user_id: null,
        deleted_at: null,
      },
      {
        id: '30000000-0000-0000-0000-000000000009',
        name: 'Amal & Donasi',
        type: 'expense',
        icon: 'gift',
        color: '#10b981',
        is_system: true,
        user_id: null,
        deleted_at: null,
      },
      {
        id: '30000000-0000-0000-0000-000000000010',
        name: 'Pajak & Administrasi',
        type: 'expense',
        icon: 'file-text',
        color: '#64748b',
        is_system: true,
        user_id: null,
        deleted_at: null,
      },
      // 5 System Income
      {
        id: '30000000-0000-0000-0000-000000000011',
        name: 'Gaji Pokok',
        type: 'income',
        icon: 'briefcase',
        color: '#22c55e',
        is_system: true,
        user_id: null,
        deleted_at: null,
      },
      {
        id: '30000000-0000-0000-0000-000000000012',
        name: 'Bonus & Insentif',
        type: 'income',
        icon: 'award',
        color: '#14b8a6',
        is_system: true,
        user_id: null,
        deleted_at: null,
      },
      {
        id: '30000000-0000-0000-0000-000000000013',
        name: 'Pendapatan Freelance',
        type: 'income',
        icon: 'laptop',
        color: '#3b82f6',
        is_system: true,
        user_id: null,
        deleted_at: null,
      },
      {
        id: '30000000-0000-0000-0000-000000000014',
        name: 'Investasi & Dividen',
        type: 'income',
        icon: 'trending-up',
        color: '#a855f7',
        is_system: true,
        user_id: null,
        deleted_at: null,
      },
      {
        id: '30000000-0000-0000-0000-000000000015',
        name: 'Hadiah & Cashback',
        type: 'income',
        icon: 'sparkles',
        color: '#f59e0b',
        is_system: true,
        user_id: null,
        deleted_at: null,
      },
      // 5 Custom Categories
      {
        id: '30000000-0000-0000-0000-000000000016',
        name: 'Hobi Fotografi',
        type: 'expense',
        icon: 'camera',
        color: '#06b6d4',
        is_system: false,
        user_id: '10000000-0000-0000-0000-000000000002',
        deleted_at: null,
      },
      {
        id: '30000000-0000-0000-0000-000000000017',
        name: 'Perawatan Kucing',
        type: 'expense',
        icon: 'paw',
        color: '#fb923c',
        is_system: false,
        user_id: '10000000-0000-0000-0000-000000000003',
        deleted_at: null,
      },
      {
        id: '30000000-0000-0000-0000-000000000018',
        name: 'Kopi Kenangan',
        type: 'expense',
        icon: 'coffee',
        color: '#78350f',
        is_system: false,
        user_id: '10000000-0000-0000-0000-000000000004',
        deleted_at: null,
      },
      {
        id: '30000000-0000-0000-0000-000000000019',
        name: 'Sewa Studio Musik',
        type: 'expense',
        icon: 'music',
        color: '#4f46e5',
        is_system: false,
        user_id: '10000000-0000-0000-0000-000000000005',
        deleted_at: null,
      },
      {
        id: '30000000-0000-0000-0000-000000000020',
        name: 'Langganan Komik Lama',
        type: 'expense',
        icon: 'book',
        color: '#94a3b8',
        is_system: false,
        user_id: '10000000-0000-0000-0000-000000000002',
        deleted_at: new Date('2026-09-15T00:00:00Z'),
      }, // Soft deleted
    ];

    for (const c of categoryDefs) {
      await client.query(
        `INSERT INTO categories (id, user_id, name, type, icon, color, is_system, deleted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [c.id, c.user_id, c.name, c.type, c.icon, c.color, c.is_system, c.deleted_at]
      );
    }

    // 5. Insert Budgets (20 monthly budget allocations: 10 for Oct 2026, 10 for Nov 2026)
    console.log('[SEEDER] Seeding 20 budgets...');
    for (let i = 1; i <= 20; i++) {
      const pad = String(i).padStart(2, '0');
      const budgetId = `40000000-0000-0000-0000-0000000000${pad}`;
      const targetUserIndex = ((i - 1) % 10) + 1; // Users 1 to 10
      const userId = userRecords[targetUserIndex]!.id;
      const categoryId = categoryDefs[(i - 1) % 10]!.id; // Expense categories
      const limitAmount = 500000 * ((i % 5) + 1); // 500k to 2.5m
      const startDate = i <= 10 ? '2026-10-01' : '2026-11-01';
      const endDate = i <= 10 ? '2026-10-31' : '2026-11-30';

      await client.query(
        `INSERT INTO budgets (id, user_id, category_id, limit_amount, start_date, end_date)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [budgetId, userId, categoryId, limitAmount, startDate, endDate]
      );
    }

    // 6. Insert Tags (20 tags)
    console.log('[SEEDER] Seeding 20 tags...');
    const tagNames = [
      'makanan',
      'transport',
      'tagihan',
      'gajian',
      'belanja',
      'hiburan',
      'kesehatan',
      'keluarga',
      'hobi',
      'liburan',
      'investasi',
      'pendidikan',
      'sedekah',
      'bonus',
      'hadiah',
      'darurat',
      'utilitas',
      'freelance',
      'kopi',
      'bisnis',
    ];

    const tagIds: string[] = [];
    for (let i = 0; i < tagNames.length; i++) {
      const pad = String(i + 1).padStart(2, '0');
      const tagId = `50000000-0000-0000-0000-0000000000${pad}`;
      tagIds.push(tagId);
      await client.query(`INSERT INTO tags (id, name) VALUES ($1, $2)`, [tagId, tagNames[i]!]);
    }

    // 7. Track Ledger Mutasi & Wallets Balance Helper
    // Financial ledger state tracker
    const walletBalances = new Map<string, number>();
    for (const w of walletMap.values()) {
      walletBalances.set(w.id, 0);
    }

    async function applyLedgerEntry(
      walletId: string,
      entryType: 'debit' | 'credit',
      amount: number,
      referenceType: string,
      referenceId: string | null,
      createdAt: string
    ) {
      const current = walletBalances.get(walletId) || 0;
      const nextBalance = entryType === 'credit' ? current + amount : current - amount;
      if (nextBalance < 0) {
        throw new Error(
          `Integrity error: wallet ${walletId} balance would be negative: ${nextBalance}`
        );
      }
      walletBalances.set(walletId, nextBalance);

      await client.query(
        `INSERT INTO wallet_entries (wallet_id, reference_id, reference_type, entry_type, amount, balance_after, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [walletId, referenceId, referenceType, entryType, amount, nextBalance, createdAt]
      );
    }

    // 8. Seed Initial Funding (Top-up & Salary) for each wallet
    console.log('[SEEDER] Seeding initial funding and transactions...');
    const transactionIds: string[] = [];

    // Each of the 20 wallets gets initial salary / funding
    for (let i = 0; i < userRecords.length; i++) {
      const user = userRecords[i]!;
      const wallet = walletMap.get(user.id)!;
      const pad = String(i + 1).padStart(2, '0');
      const txId = `60000000-0000-0000-0000-0000000000${pad}`;
      transactionIds.push(txId);

      const incomeAmount = i === 0 ? 25000000 : 5000000 + i * 500000; // 5M to 14.5M
      const incomeCategory = categoryDefs[10]!.id; // Gaji Pokok

      await client.query(
        `INSERT INTO transactions (id, wallet_id, category_id, type, amount, transaction_date, description, created_at)
         VALUES ($1, $2, $3, 'income', $4, '2026-10-01 08:00:00+07', $5, '2026-10-01 08:00:00+07')`,
        [
          txId,
          wallet.id,
          incomeCategory,
          incomeAmount,
          `Pemasukan Gaji Awal Bulan [${user.username}]`,
        ]
      );

      await applyLedgerEntry(
        wallet.id,
        'credit',
        incomeAmount,
        'transaction',
        txId,
        '2026-10-01 08:00:00+07'
      );
    }

    // 25 Expense transactions across users
    for (let i = 1; i <= 25; i++) {
      const pad = String(i + 20).padStart(2, '0');
      const txId = `60000000-0000-0000-0000-0000000000${pad}`;
      transactionIds.push(txId);

      const userIndex = (i % 18) + 1; // Users 1 to 18
      const user = userRecords[userIndex]!;
      const wallet = walletMap.get(user.id)!;
      const categoryIndex = i % 10; // Expense categories
      const category = categoryDefs[categoryIndex]!;
      const expenseAmount = 50000 * ((i % 6) + 1); // 50k to 300k
      const isSoftDeleted = i === 25; // Transaction 25 soft-deleted

      await client.query(
        `INSERT INTO transactions (id, wallet_id, category_id, type, amount, transaction_date, description, created_at, deleted_at)
         VALUES ($1, $2, $3, 'expense', $4, '2026-10-05 12:30:00+07', $5, '2026-10-05 12:30:00+07', $6)`,
        [
          txId,
          wallet.id,
          category.id,
          expenseAmount,
          `Pengeluaran operasional ${category.name}`,
          isSoftDeleted ? new Date('2026-10-06T14:00:00Z') : null,
        ]
      );

      await applyLedgerEntry(
        wallet.id,
        'debit',
        expenseAmount,
        'transaction',
        txId,
        '2026-10-05 12:30:00+07'
      );
    }

    // 9. Seed 20 Internal Transfers with matching debit and credit entries
    console.log('[SEEDER] Seeding 20 internal transfers with double-entry balance consistency...');
    for (let i = 1; i <= 20; i++) {
      const pad = String(i).padStart(2, '0');
      const transferId = `70000000-0000-0000-0000-0000000000${pad}`;
      const sourceUserIndex = (i % 10) + 1; // Users 1 to 10
      const targetUserIndex = ((i + 3) % 10) + 1; // Users 1 to 10, distinct from source
      const sourceWallet = walletMap.get(userRecords[sourceUserIndex]!.id)!;
      const targetWallet = walletMap.get(userRecords[targetUserIndex]!.id)!;
      const transferAmount = 100000 * ((i % 4) + 1); // 100k to 400k
      const idempotencyKey = `idemp-seed-transfer-${pad}-20261011`;
      const createdAt = `2026-10-08 14:${String(i).padStart(2, '0')}:00+07`;

      await client.query(
        `INSERT INTO transfers (id, source_wallet_id, target_wallet_id, amount, idempotency_key, status, note, created_at)
         VALUES ($1, $2, $3, $4, $5, 'completed', $6, $7)`,
        [
          transferId,
          sourceWallet.id,
          targetWallet.id,
          transferAmount,
          idempotencyKey,
          `Transfer pengujian #${pad} antar dompet`,
          createdAt,
        ]
      );

      // Debit on source wallet
      await applyLedgerEntry(
        sourceWallet.id,
        'debit',
        transferAmount,
        'transfer_send',
        transferId,
        createdAt
      );

      // Credit on target wallet
      await applyLedgerEntry(
        targetWallet.id,
        'credit',
        transferAmount,
        'transfer_receive',
        transferId,
        createdAt
      );
    }

    // 10. Update all wallet balances to match exact ledger final balances
    console.log('[SEEDER] Updating wallets snapshot balances...');
    for (const [walletId, finalBalance] of walletBalances.entries()) {
      await client.query(`UPDATE wallets SET balance = $1 WHERE id = $2`, [finalBalance, walletId]);
    }

    // 11. Seed Transaction Tags (pivot table N:N, >=20 entries)
    console.log('[SEEDER] Seeding transaction_tags pivot relations...');
    for (let i = 0; i < 25; i++) {
      const txId = transactionIds[i];
      const tagId = tagIds[i % tagIds.length];
      await client.query(
        `INSERT INTO transaction_tags (transaction_id, tag_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [txId, tagId]
      );
    }

    // 12. Seed Attachments (20 attachments for transactions)
    console.log('[SEEDER] Seeding 20 attachments...');
    const mimes = ['image/jpeg', 'image/png', 'application/pdf'];
    for (let i = 1; i <= 20; i++) {
      const pad = String(i).padStart(2, '0');
      const attachmentId = `80000000-0000-0000-0000-0000000000${pad}`;
      const txId = transactionIds[i - 1];
      const mime = mimes[(i - 1) % 3];
      const ext = mime === 'image/jpeg' ? 'jpg' : mime === 'image/png' ? 'png' : 'pdf';
      const size = 1024 * (50 + i * 20); // 50KB to 450KB <= 2MB

      await client.query(
        `INSERT INTO attachments (id, transaction_id, file_name, file_path, mime_type, file_size)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          attachmentId,
          txId,
          `bukti_transaksi_${pad}.${ext}`,
          `/uploads/attachments/proof_${pad}.${ext}`,
          mime,
          size,
        ]
      );
    }

    // 13. Seed Refresh Tokens (20 token sessions)
    console.log('[SEEDER] Seeding 20 refresh tokens...');
    for (let i = 1; i <= 20; i++) {
      const pad = String(i).padStart(2, '0');
      const tokenId = `90000000-0000-0000-0000-0000000000${pad}`;
      const userIndex = (i - 1) % userRecords.length;
      const user = userRecords[userIndex]!;
      const tokenHash = `sha256_mock_seed_token_hash_${pad}_secure_salt`;
      const isRevoked = i % 5 === 0;

      await client.query(
        `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, is_revoked)
         VALUES ($1, $2, $3, NOW() + INTERVAL '7 days', $4)`,
        [tokenId, user.id, tokenHash, isRevoked]
      );
    }

    // 14. Seed Activity Logs (20 logs)
    console.log('[SEEDER] Seeding 20 activity logs...');
    const actions = [
      'USER_LOGIN',
      'USER_LOGOUT',
      'TRANSFER_INITIATED',
      'TRANSFER_COMPLETED',
      'BUDGET_CREATED',
      'PROFILE_UPDATED',
      'CATEGORY_CREATED',
      'PASSWORD_CHANGED',
    ];
    for (let i = 1; i <= 20; i++) {
      const pad = String(i).padStart(2, '0');
      const logId = `a0000000-0000-0000-0000-0000000000${pad}`;
      const userIndex = (i - 1) % userRecords.length;
      const user = userRecords[userIndex]!;
      const action = actions[(i - 1) % actions.length]!;

      await client.query(
        `INSERT INTO activity_logs (id, user_id, action, entity, metadata, ip_address)
         VALUES ($1, $2, $3, 'system', $4, '127.0.0.1')`,
        [logId, user.id, action, JSON.stringify({ auditIndex: i, testUser: user.username })]
      );
    }

    // 15. Seed Notifications (20 alerts)
    console.log('[SEEDER] Seeding 20 notifications...');
    const notifTypes = ['transfer_received', 'transfer_sent', 'budget_warning', 'system_alert'];
    for (let i = 1; i <= 20; i++) {
      const pad = String(i).padStart(2, '0');
      const notifId = `b0000000-0000-0000-0000-0000000000${pad}`;
      const userIndex = (i - 1) % userRecords.length;
      const user = userRecords[userIndex]!;
      const type = notifTypes[(i - 1) % notifTypes.length]!;
      const isRead = i % 3 === 0;

      await client.query(
        `INSERT INTO notifications (id, user_id, title, message, type, is_read)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          notifId,
          user.id,
          `Notifikasi Sistem #${pad}`,
          `Pesan simulasi untuk ${user.username} mengenai event ${type}`,
          type,
          isRead,
        ]
      );
    }

    await client.query('COMMIT');
    console.log('[SEEDER] Database seeding completed successfully ✓');

    return {
      usersCount: userRecords.length,
      walletsCount: walletMap.size,
      categoriesCount: categoryDefs.length,
      budgetsCount: 20,
      transactionsCount: transactionIds.length,
      walletEntriesCount: userRecords.length + 25 + 40, // initial + expenses + transfers (20*2)
      transfersCount: 20,
      tagsCount: tagNames.length,
      transactionTagsCount: 25,
      attachmentsCount: 20,
      refreshTokensCount: 20,
      activityLogsCount: 20,
      notificationsCount: 20,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[SEEDER] Error during database seeding:', (error as Error).message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}
