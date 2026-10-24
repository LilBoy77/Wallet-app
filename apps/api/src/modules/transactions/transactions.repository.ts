import type { Pool, PoolClient } from 'pg';
import type { TransactionStatus } from '@wallet-app/shared';

export interface TransactionRecord {
  id: string;
  wallet_id: string;
  category_id: string;
  type: 'income' | 'expense';
  amount: string; // BIGINT string from pg
  status: TransactionStatus;
  transaction_date: Date;
  description: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  user_id?: string;
  category_name?: string;
  category_type?: string;
  category_color?: string;
  category_icon?: string;
}

export interface TagRecord {
  id: string;
  name: string;
}

export const TRANSACTION_SORTABLE_COLUMNS = ['transaction_date', 'amount', 'created_at'] as const;
export type TransactionSortColumn = (typeof TRANSACTION_SORTABLE_COLUMNS)[number];

export class TransactionsRepository {
  async createTransaction(
    client: PoolClient | Pool,
    params: {
      walletId: string;
      categoryId: string;
      type: 'income' | 'expense';
      amount: bigint;
      transactionDate?: Date;
      description?: string;
      status?: TransactionStatus;
    }
  ): Promise<TransactionRecord> {
    const res = await client.query<TransactionRecord>(
      `INSERT INTO transactions (wallet_id, category_id, type, amount, transaction_date, description, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, wallet_id, category_id, type, amount::text, status, transaction_date, description, created_at, updated_at, deleted_at`,
      [
        params.walletId,
        params.categoryId,
        params.type,
        params.amount.toString(),
        params.transactionDate ?? new Date(),
        params.description ?? '',
        params.status ?? 'COMPLETED',
      ]
    );
    return res.rows[0]!;
  }

  async findTransactionById(
    client: PoolClient | Pool,
    transactionId: string
  ): Promise<TransactionRecord | null> {
    const res = await client.query<TransactionRecord>(
      `SELECT t.id, t.wallet_id, t.category_id, t.type, t.amount::text, t.status,
              t.transaction_date, t.description, t.created_at, t.updated_at, t.deleted_at,
              w.user_id,
              c.name as category_name, c.type as category_type, c.color as category_color, c.icon as category_icon
       FROM transactions t
       JOIN wallets w ON t.wallet_id = w.id
       JOIN categories c ON t.category_id = c.id
       WHERE t.id = $1`,
      [transactionId]
    );
    return res.rows[0] || null;
  }

  async listTransactions(
    client: PoolClient | Pool,
    walletId: string,
    options: {
      limit: number;
      offset: number;
      type?: 'income' | 'expense';
      categoryId?: string;
      status?: 'COMPLETED' | 'VOIDED' | 'ALL';
      startDate?: Date;
      endDate?: Date;
      search?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    }
  ): Promise<{ transactions: TransactionRecord[]; total: number }> {
    const whereConditions = ['t.wallet_id = $1'];
    const params: unknown[] = [walletId];
    let idx = 2;

    // Status filter: default to COMPLETED and not deleted
    if (options.status === 'VOIDED') {
      whereConditions.push(`t.status = 'VOIDED'`);
    } else if (options.status === 'ALL') {
      // show all including voided
    } else {
      whereConditions.push(`t.status = 'COMPLETED'`);
      whereConditions.push(`t.deleted_at IS NULL`);
    }

    if (options.type) {
      whereConditions.push(`t.type = $${idx++}`);
      params.push(options.type);
    }

    if (options.categoryId) {
      whereConditions.push(`t.category_id = $${idx++}`);
      params.push(options.categoryId);
    }

    if (options.startDate) {
      whereConditions.push(`t.transaction_date >= $${idx++}`);
      params.push(options.startDate);
    }

    if (options.endDate) {
      whereConditions.push(`t.transaction_date <= $${idx++}`);
      params.push(options.endDate);
    }

    if (options.search && options.search.trim()) {
      whereConditions.push(`t.description ILIKE $${idx++}`);
      params.push(`%${options.search.trim()}%`);
    }

    const whereClause = whereConditions.join(' AND ');

    // Count query
    const countRes = await client.query<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM transactions t
       WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countRes.rows[0]?.count ?? '0', 10);

    // Whitelist sort column
    const validSortCol = TRANSACTION_SORTABLE_COLUMNS.includes(
      options.sortBy as TransactionSortColumn
    )
      ? (options.sortBy as TransactionSortColumn)
      : 'transaction_date';
    const validOrder = options.sortOrder?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Rows query
    params.push(options.limit);
    const limitIdx = idx++;
    params.push(options.offset);
    const offsetIdx = idx++;

    const rowsRes = await client.query<TransactionRecord>(
      `SELECT t.id, t.wallet_id, t.category_id, t.type, t.amount::text, t.status,
              t.transaction_date, t.description, t.created_at, t.updated_at, t.deleted_at,
              c.name as category_name, c.type as category_type, c.color as category_color, c.icon as category_icon
       FROM transactions t
       JOIN categories c ON t.category_id = c.id
       WHERE ${whereClause}
       ORDER BY t.${validSortCol} ${validOrder}
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );

    return { transactions: rowsRes.rows, total };
  }

  async updateTransactionMetadata(
    client: PoolClient | Pool,
    transactionId: string,
    fields: {
      categoryId?: string;
      description?: string;
    }
  ): Promise<TransactionRecord | null> {
    const updates: string[] = ['updated_at = NOW()'];
    const values: unknown[] = [];
    let idx = 1;

    if (fields.categoryId !== undefined) {
      updates.push(`category_id = $${idx++}`);
      values.push(fields.categoryId);
    }
    if (fields.description !== undefined) {
      updates.push(`description = $${idx++}`);
      values.push(fields.description);
    }

    values.push(transactionId);
    const res = await client.query<TransactionRecord>(
      `UPDATE transactions
       SET ${updates.join(', ')}
       WHERE id = $${idx}
       RETURNING id, wallet_id, category_id, type, amount::text, status, transaction_date, description, created_at, updated_at, deleted_at`,
      values
    );
    return res.rows[0] || null;
  }

  async voidTransaction(
    client: PoolClient | Pool,
    transactionId: string
  ): Promise<TransactionRecord | null> {
    const res = await client.query<TransactionRecord>(
      `UPDATE transactions
       SET status = 'VOIDED', deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING id, wallet_id, category_id, type, amount::text, status, transaction_date, description, created_at, updated_at, deleted_at`,
      [transactionId]
    );
    return res.rows[0] || null;
  }

  async getTagsForTransaction(
    client: PoolClient | Pool,
    transactionId: string
  ): Promise<TagRecord[]> {
    const res = await client.query<TagRecord>(
      `SELECT t.id, t.name
       FROM tags t
       JOIN transaction_tags tt ON t.id = tt.tag_id
       WHERE tt.transaction_id = $1`,
      [transactionId]
    );
    return res.rows;
  }

  async syncTransactionTags(
    client: PoolClient | Pool,
    transactionId: string,
    tagIds: string[]
  ): Promise<void> {
    await client.query('DELETE FROM transaction_tags WHERE transaction_id = $1', [transactionId]);
    if (tagIds.length > 0) {
      for (const tagId of tagIds) {
        await client.query(
          `INSERT INTO transaction_tags (transaction_id, tag_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [transactionId, tagId]
        );
      }
    }
  }

  async verifyCategoryExists(
    client: PoolClient | Pool,
    categoryId: string,
    userId?: string
  ): Promise<{ id: string; name: string; type: string } | null> {
    const query = userId
      ? `SELECT id, name, type FROM categories WHERE id = $1 AND deleted_at IS NULL AND (user_id IS NULL OR user_id = $2)`
      : `SELECT id, name, type FROM categories WHERE id = $1 AND deleted_at IS NULL`;
    const params = userId ? [categoryId, userId] : [categoryId];
    const res = await client.query<{ id: string; name: string; type: string }>(query, params);
    return res.rows[0] || null;
  }
}

export const transactionsRepository = new TransactionsRepository();
