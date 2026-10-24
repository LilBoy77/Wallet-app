import type { Pool, PoolClient } from 'pg';

export interface WalletRecord {
  id: string;
  user_id: string;
  wallet_number: string;
  currency: 'IDR';
  balance: string; // BIGINT is returned as string by pg driver
  name: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface WalletEntryRecord {
  id: string;
  wallet_id: string;
  reference_id: string | null;
  reference_type: string;
  entry_type: 'debit' | 'credit';
  amount: string; // BIGINT from pg
  balance_after: string; // BIGINT from pg
  created_at: Date;
}

/**
 * Designated Ledger & Wallets Repository:
 * [STRUCTURAL_GUARD_ANCHOR: DESIGNATED_LEDGER_REPOSITORY]
 * All SQL statements modifying wallet balance or appending ledger entries MUST reside exclusively here.
 */
export class WalletsRepository {
  async createWallet(
    client: PoolClient | Pool,
    params: {
      userId: string;
      walletNumber: string;
      currency?: 'IDR';
      initialBalance?: bigint;
      name?: string;
    }
  ): Promise<WalletRecord> {
    const res = await client.query<WalletRecord>(
      `INSERT INTO wallets (user_id, wallet_number, currency, balance, name, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id, user_id, wallet_number, currency, balance::text, name, is_active, created_at, updated_at`,
      [
        params.userId,
        params.walletNumber,
        params.currency ?? 'IDR',
        (params.initialBalance ?? 0n).toString(),
        params.name ?? 'Dompet Utama',
      ]
    );
    return res.rows[0]!;
  }

  async findWalletByUserId(
    client: PoolClient | Pool,
    userId: string
  ): Promise<WalletRecord | null> {
    const res = await client.query<WalletRecord>(
      `SELECT id, user_id, wallet_number, currency, balance::text, name, is_active, created_at, updated_at
       FROM wallets
       WHERE user_id = $1`,
      [userId]
    );
    return res.rows[0] || null;
  }

  async findWalletById(client: PoolClient | Pool, walletId: string): Promise<WalletRecord | null> {
    const res = await client.query<WalletRecord>(
      `SELECT id, user_id, wallet_number, currency, balance::text, name, is_active, created_at, updated_at
       FROM wallets
       WHERE id = $1`,
      [walletId]
    );
    return res.rows[0] || null;
  }

  async findWalletByNumber(
    client: PoolClient | Pool,
    walletNumber: string
  ): Promise<WalletRecord | null> {
    const res = await client.query<WalletRecord>(
      `SELECT id, user_id, wallet_number, currency, balance::text, name, is_active, created_at, updated_at
       FROM wallets
       WHERE wallet_number = $1`,
      [walletNumber]
    );
    return res.rows[0] || null;
  }

  /**
   * Acquires row-level lock on a single wallet.
   */
  async findWalletForUpdate(client: PoolClient, walletId: string): Promise<WalletRecord | null> {
    const res = await client.query<WalletRecord>(
      `SELECT id, user_id, wallet_number, currency, balance::text, name, is_active, created_at, updated_at
       FROM wallets
       WHERE id = $1
       FOR UPDATE`,
      [walletId]
    );
    return res.rows[0] || null;
  }

  /**
   * Acquires row-level lock on two wallets in strictly deterministic ascending order (id ASC)
   * to guarantee deadlock prevention across concurrent transfers.
   */
  async findWalletsForUpdateSorted(
    client: PoolClient,
    walletIds: [string, string]
  ): Promise<WalletRecord[]> {
    const res = await client.query<WalletRecord>(
      `SELECT id, user_id, wallet_number, currency, balance::text, name, is_active, created_at, updated_at
       FROM wallets
       WHERE id = ANY($1::uuid[])
       ORDER BY id ASC
       FOR UPDATE`,
      [walletIds]
    );
    return res.rows;
  }

  /**
   * Sole legal path for updating wallet balance in the system.
   */
  async updateBalance(client: PoolClient, walletId: string, newBalance: bigint): Promise<void> {
    await client.query(
      `UPDATE wallets
       SET balance = $1, updated_at = NOW()
       WHERE id = $2`,
      [newBalance.toString(), walletId]
    );
  }

  async updateWalletMetadata(
    client: PoolClient | Pool,
    walletId: string,
    fields: { name?: string; is_active?: boolean }
  ): Promise<WalletRecord | null> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (fields.name !== undefined) {
      updates.push(`name = $${idx++}`);
      values.push(fields.name);
    }
    if (fields.is_active !== undefined) {
      updates.push(`is_active = $${idx++}`);
      values.push(fields.is_active);
    }

    if (updates.length === 0) {
      return this.findWalletById(client, walletId);
    }

    values.push(walletId);
    const res = await client.query<WalletRecord>(
      `UPDATE wallets
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${idx}
       RETURNING id, user_id, wallet_number, currency, balance::text, name, is_active, created_at, updated_at`,
      values
    );

    return res.rows[0] || null;
  }

  /**
   * Appends an immutable audit entry to the double-entry ledger.
   */
  async createLedgerEntry(
    client: PoolClient,
    params: {
      walletId: string;
      referenceId?: string | null;
      referenceType: string;
      entryType: 'debit' | 'credit';
      amount: bigint;
      balanceAfter: bigint;
    }
  ): Promise<WalletEntryRecord> {
    const res = await client.query<WalletEntryRecord>(
      `INSERT INTO wallet_entries (wallet_id, reference_id, reference_type, entry_type, amount, balance_after)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, wallet_id, reference_id, reference_type, entry_type, amount::text, balance_after::text, created_at`,
      [
        params.walletId,
        params.referenceId || null,
        params.referenceType,
        params.entryType,
        params.amount.toString(),
        params.balanceAfter.toString(),
      ]
    );
    return res.rows[0]!;
  }

  async listWalletEntries(
    client: PoolClient | Pool,
    walletId: string,
    options: { limit: number; offset: number; entryType?: string }
  ): Promise<{ entries: WalletEntryRecord[]; total: number }> {
    const whereConditions = ['wallet_id = $1'];
    const params: unknown[] = [walletId];
    let paramIndex = 2;

    if (options.entryType) {
      whereConditions.push(`entry_type = $${paramIndex++}`);
      params.push(options.entryType);
    }

    const whereClause = whereConditions.join(' AND ');

    // Count
    const countRes = await client.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM wallet_entries WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countRes.rows[0]?.count ?? '0', 10);

    // Rows
    params.push(options.limit);
    params.push(options.offset);
    const rowsRes = await client.query<WalletEntryRecord>(
      `SELECT id, wallet_id, reference_id, reference_type, entry_type, amount::text, balance_after::text, created_at
       FROM wallet_entries
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      params
    );

    return { entries: rowsRes.rows, total };
  }
}

export const walletsRepository = new WalletsRepository();
