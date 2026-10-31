import type { Pool, PoolClient } from 'pg';
import type { CategoryType } from '@wallet-app/shared';

export interface CategoryRecord {
  id: string;
  user_id: string | null;
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
  is_system: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface ListCategoriesOptions {
  userId: string;
  type?: CategoryType;
  search?: string;
  limit: number;
  offset: number;
}

export class CategoriesRepository {
  async findCategoryById(
    client: Pool | PoolClient,
    id: string,
    userId?: string
  ): Promise<CategoryRecord | null> {
    const whereConditions = ['id = $1', 'deleted_at IS NULL'];
    const params: unknown[] = [id];

    if (userId) {
      whereConditions.push('(user_id IS NULL OR user_id = $2)');
      params.push(userId);
    }

    const res = await client.query<CategoryRecord>(
      `SELECT * FROM categories WHERE ${whereConditions.join(' AND ')}`,
      params
    );
    return res.rows[0] || null;
  }

  async findRawCategoryById(client: Pool | PoolClient, id: string): Promise<CategoryRecord | null> {
    const res = await client.query<CategoryRecord>('SELECT * FROM categories WHERE id = $1', [id]);
    return res.rows[0] || null;
  }

  async findActiveByNameAndType(
    client: Pool | PoolClient,
    name: string,
    type: CategoryType,
    userId: string
  ): Promise<CategoryRecord | null> {
    const res = await client.query<CategoryRecord>(
      `SELECT * FROM categories 
       WHERE LOWER(name) = LOWER($1) 
         AND type = $2 
         AND deleted_at IS NULL 
         AND user_id = $3`,
      [name.trim(), type, userId]
    );
    return res.rows[0] || null;
  }

  async listCategories(
    client: Pool | PoolClient,
    options: ListCategoriesOptions
  ): Promise<{ rows: CategoryRecord[]; total: number }> {
    const whereConditions = [
      'deleted_at IS NULL',
      '(user_id = $1 OR user_id IS NULL OR is_system = true)',
    ];
    const params: unknown[] = [options.userId];
    let idx = 2;

    if (options.type) {
      whereConditions.push(`type = $${idx++}`);
      params.push(options.type);
    }

    if (options.search && options.search.trim()) {
      whereConditions.push(`name ILIKE $${idx++}`);
      params.push(`%${options.search.trim()}%`);
    }

    const whereClause = whereConditions.join(' AND ');

    // Count
    const countRes = await client.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM categories WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countRes.rows[0]?.count ?? '0', 10);

    // Rows
    params.push(options.limit);
    const limitIdx = idx++;
    params.push(options.offset);
    const offsetIdx = idx++;

    const rowsRes = await client.query<CategoryRecord>(
      `SELECT * FROM categories 
       WHERE ${whereClause}
       ORDER BY is_system DESC, LOWER(name) ASC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );

    return { rows: rowsRes.rows, total };
  }

  async createCategory(
    client: Pool | PoolClient,
    data: {
      userId: string;
      name: string;
      type: CategoryType;
      icon: string;
      color: string;
    }
  ): Promise<CategoryRecord> {
    const res = await client.query<CategoryRecord>(
      `INSERT INTO categories (user_id, name, type, icon, color, is_system)
       VALUES ($1, $2, $3, $4, $5, false)
       RETURNING *`,
      [data.userId, data.name.trim(), data.type, data.icon, data.color]
    );
    return res.rows[0]!;
  }

  async updateCategory(
    client: Pool | PoolClient,
    id: string,
    data: {
      name?: string;
      icon?: string;
      color?: string;
    }
  ): Promise<CategoryRecord | null> {
    const updates: string[] = [];
    const params: unknown[] = [id];
    let idx = 2;

    if (data.name !== undefined) {
      updates.push(`name = $${idx++}`);
      params.push(data.name.trim());
    }
    if (data.icon !== undefined) {
      updates.push(`icon = $${idx++}`);
      params.push(data.icon.trim());
    }
    if (data.color !== undefined) {
      updates.push(`color = $${idx++}`);
      params.push(data.color.trim());
    }

    if (updates.length === 0) {
      return this.findCategoryById(client, id);
    }

    const res = await client.query<CategoryRecord>(
      `UPDATE categories 
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      params
    );
    return res.rows[0] || null;
  }

  async softDeleteCategory(client: Pool | PoolClient, id: string): Promise<CategoryRecord | null> {
    const res = await client.query<CategoryRecord>(
      `UPDATE categories 
       SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [id]
    );
    return res.rows[0] || null;
  }
}

export const categoriesRepository = new CategoriesRepository();
