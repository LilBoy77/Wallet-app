import type { Pool, PoolClient } from 'pg';

export interface ActivityLogDbRow {
  id: string;
  user_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  created_at: Date;
  user_email: string | null;
  user_full_name: string | null;
}

export interface ListActivityLogsOptions {
  userId?: string;
  action?: string;
  entity?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: 'created_at' | 'action' | 'entity';
  order?: 'asc' | 'desc';
  limit: number;
  offset: number;
}

const SORTABLE_COLUMNS = ['created_at', 'action', 'entity'] as const;

export class ActivityLogsRepository {
  async listLogs(
    client: Pool | PoolClient,
    options: ListActivityLogsOptions
  ): Promise<{ rows: ActivityLogDbRow[]; total: number }> {
    const whereConditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (options.userId) {
      whereConditions.push(`l.user_id = $${idx++}`);
      params.push(options.userId);
    }

    if (options.action) {
      whereConditions.push(`l.action = $${idx++}`);
      params.push(options.action);
    }

    if (options.entity) {
      whereConditions.push(`l.entity = $${idx++}`);
      params.push(options.entity);
    }

    if (options.startDate) {
      whereConditions.push(`l.created_at >= $${idx++}`);
      params.push(options.startDate);
    }

    if (options.endDate) {
      whereConditions.push(`l.created_at <= $${idx++}`);
      params.push(options.endDate);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Count
    const countRes = await client.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM activity_logs l ${whereClause}`,
      params
    );
    const total = parseInt(countRes.rows[0]?.count ?? '0', 10);

    // Whitelist sort
    const validSortCol =
      options.sortBy && (SORTABLE_COLUMNS as readonly string[]).includes(options.sortBy)
        ? options.sortBy
        : 'created_at';
    const validOrder = options.order?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Rows
    params.push(options.limit);
    const limitIdx = idx++;
    params.push(options.offset);
    const offsetIdx = idx++;

    const rowsRes = await client.query<ActivityLogDbRow>(
      `SELECT 
        l.id, l.user_id, l.action, l.entity, l.entity_id, l.metadata, l.ip_address, l.created_at,
        u.email as user_email, u.full_name as user_full_name
       FROM activity_logs l
       LEFT JOIN users u ON l.user_id = u.id
       ${whereClause}
       ORDER BY l.${validSortCol} ${validOrder}
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );

    return { rows: rowsRes.rows, total };
  }
}

export const activityLogsRepository = new ActivityLogsRepository();
