import type { Pool, PoolClient } from 'pg';

export interface BudgetRecord {
  id: string;
  user_id: string;
  category_id: string;
  limit_amount: string; // BIGINT as string
  start_date: string;
  end_date: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  category_name?: string;
  category_icon?: string;
  category_color?: string;
  spent_amount?: string;
}

export class BudgetsRepository {
  async findBudgetById(
    client: Pool | PoolClient,
    id: string,
    userId?: string
  ): Promise<BudgetRecord | null> {
    const whereConditions = ['b.id = $1', 'b.deleted_at IS NULL'];
    const params: unknown[] = [id];

    if (userId) {
      whereConditions.push('b.user_id = $2');
      params.push(userId);
    }

    const res = await client.query<BudgetRecord>(
      `SELECT 
        b.id, b.user_id, b.category_id, b.limit_amount::text, b.start_date::text, b.end_date::text,
        b.created_at, b.updated_at, b.deleted_at,
        c.name as category_name, c.icon as category_icon, c.color as category_color
       FROM budgets b
       JOIN categories c ON b.category_id = c.id
       WHERE ${whereConditions.join(' AND ')}`,
      params
    );
    return res.rows[0] || null;
  }

  async findActiveByUserCategoryPeriod(
    client: Pool | PoolClient,
    userId: string,
    categoryId: string,
    startDate: string,
    endDate: string
  ): Promise<BudgetRecord | null> {
    const res = await client.query<BudgetRecord>(
      `SELECT b.id, b.user_id, b.category_id, b.limit_amount::text, b.start_date::text, b.end_date::text,
              b.created_at, b.updated_at, b.deleted_at
       FROM budgets b
       WHERE b.user_id = $1 
         AND b.category_id = $2 
         AND b.deleted_at IS NULL
         AND daterange(b.start_date, b.end_date, '[]') && daterange($3::date, $4::date, '[]')
       LIMIT 1`,
      [userId, categoryId, startDate, endDate]
    );
    return res.rows[0] || null;
  }

  async createBudget(
    client: Pool | PoolClient,
    data: {
      userId: string;
      categoryId: string;
      limitAmount: bigint | number;
      startDate: string;
      endDate: string;
    }
  ): Promise<BudgetRecord> {
    const res = await client.query<BudgetRecord>(
      `INSERT INTO budgets (user_id, category_id, limit_amount, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id, category_id, limit_amount::text, start_date::text, end_date::text, created_at, updated_at, deleted_at`,
      [data.userId, data.categoryId, data.limitAmount.toString(), data.startDate, data.endDate]
    );
    return res.rows[0]!;
  }

  async updateBudgetLimit(
    client: Pool | PoolClient,
    id: string,
    limitAmount: bigint | number
  ): Promise<BudgetRecord | null> {
    const res = await client.query<BudgetRecord>(
      `UPDATE budgets
       SET limit_amount = $2, updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, user_id, category_id, limit_amount::text, start_date::text, end_date::text, created_at, updated_at, deleted_at`,
      [id, limitAmount.toString()]
    );
    return res.rows[0] || null;
  }

  async softDeleteBudget(client: Pool | PoolClient, id: string): Promise<BudgetRecord | null> {
    const res = await client.query<BudgetRecord>(
      `UPDATE budgets
       SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, user_id, category_id, limit_amount::text, start_date::text, end_date::text, created_at, updated_at, deleted_at`,
      [id]
    );
    return res.rows[0] || null;
  }

  /**
   * Single aggregated query to list budgets with spent amounts.
   * Realization is calculated strictly on each budget's own half-open interval
   * `[start_date 00:00:00, (end_date + 1 day) 00:00:00)` in the configured IANA timezone.
   * Guarantees 0 N+1 database queries.
   */
  async listBudgetsWithRealization(
    client: Pool | PoolClient,
    options: {
      userId: string;
      startDateStr: string;
      endDateStr: string;
      timezone: string;
      limit: number;
      offset: number;
    }
  ): Promise<{ rows: BudgetRecord[]; total: number }> {
    // 1. Count total budgets overlapping with requested period
    const countRes = await client.query<{ count: string }>(
      `SELECT COUNT(*) as count 
       FROM budgets b
       WHERE b.user_id = $1 
         AND b.deleted_at IS NULL
         AND b.start_date <= $3 
         AND b.end_date >= $2`,
      [options.userId, options.startDateStr, options.endDateStr]
    );
    const total = parseInt(countRes.rows[0]?.count ?? '0', 10);

    // 2. Fetch budgets with single aggregate LEFT JOIN on transactions using each budget's own half-open boundaries
    const rowsRes = await client.query<BudgetRecord>(
      `SELECT 
        b.id,
        b.user_id,
        b.category_id,
        b.limit_amount::text,
        b.start_date::text,
        b.end_date::text,
        b.created_at,
        b.updated_at,
        b.deleted_at,
        c.name as category_name,
        c.icon as category_icon,
        c.color as category_color,
        COALESCE(SUM(t.amount), 0)::text as spent_amount
       FROM budgets b
       JOIN categories c ON b.category_id = c.id
       LEFT JOIN transactions t ON (
         t.category_id = b.category_id
         AND t.wallet_id IN (SELECT w.id FROM wallets w WHERE w.user_id = b.user_id)
         AND t.type = 'expense'
         AND t.status = 'COMPLETED'
         AND t.deleted_at IS NULL
         AND t.transaction_date >= (b.start_date::timestamp AT TIME ZONE $6)
         AND t.transaction_date < ((b.end_date + 1)::timestamp AT TIME ZONE $6)
       )
       WHERE b.user_id = $1
         AND b.deleted_at IS NULL
         AND b.start_date <= $3
         AND b.end_date >= $2
       GROUP BY b.id, c.id
       ORDER BY c.name ASC
       LIMIT $4 OFFSET $5`,
      [
        options.userId,
        options.startDateStr,
        options.endDateStr,
        options.limit,
        options.offset,
        options.timezone,
      ]
    );

    return { rows: rowsRes.rows, total };
  }

  async getBudgetWithRealization(
    client: Pool | PoolClient,
    id: string,
    userId: string,
    timezone: string
  ): Promise<BudgetRecord | null> {
    const res = await client.query<BudgetRecord>(
      `SELECT 
        b.id,
        b.user_id,
        b.category_id,
        b.limit_amount::text,
        b.start_date::text,
        b.end_date::text,
        b.created_at,
        b.updated_at,
        b.deleted_at,
        c.name as category_name,
        c.icon as category_icon,
        c.color as category_color,
        COALESCE(SUM(t.amount), 0)::text as spent_amount
       FROM budgets b
       JOIN categories c ON b.category_id = c.id
       LEFT JOIN transactions t ON (
         t.category_id = b.category_id
         AND t.wallet_id IN (SELECT w.id FROM wallets w WHERE w.user_id = b.user_id)
         AND t.type = 'expense'
         AND t.status = 'COMPLETED'
         AND t.deleted_at IS NULL
         AND t.transaction_date >= (b.start_date::timestamp AT TIME ZONE $3)
         AND t.transaction_date < ((b.end_date + 1)::timestamp AT TIME ZONE $3)
       )
       WHERE b.id = $1
         AND b.user_id = $2
         AND b.deleted_at IS NULL
       GROUP BY b.id, c.id`,
      [id, userId, timezone]
    );
    return res.rows[0] || null;
  }
}

export const budgetsRepository = new BudgetsRepository();
