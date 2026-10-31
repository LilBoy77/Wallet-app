import type { ActivityLogResponse, ActivityLogQuery } from '@wallet-app/shared';
import { pool } from '../../database/index.js';
import { activityLogsRepository, type ActivityLogDbRow } from './activity-logs.repository.js';
import { createPaginationMeta } from '../../shared/utils/query-parser.js';

export function toActivityLogResponse(row: ActivityLogDbRow): ActivityLogResponse {
  return {
    id: row.id,
    user_id: row.user_id,
    action: row.action,
    entity: row.entity,
    entity_id: row.entity_id,
    metadata: row.metadata || {},
    ip_address: row.ip_address,
    created_at: row.created_at.toISOString(),
    user_email: row.user_email,
    user_full_name: row.user_full_name,
  };
}

export class ActivityLogsService {
  async getMyLogs(
    userId: string,
    query: ActivityLogQuery
  ): Promise<{ data: ActivityLogResponse[]; meta: unknown }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const offset = (page - 1) * limit;

    const { rows, total } = await activityLogsRepository.listLogs(pool, {
      userId,
      action: query.action,
      entity: query.entity,
      startDate: query.start_date,
      endDate: query.end_date,
      sortBy: query.sort_by,
      order: query.order,
      limit,
      offset,
    });

    const meta = createPaginationMeta({ totalItems: total, page, limit });
    return {
      data: rows.map(toActivityLogResponse),
      meta,
    };
  }

  async getAdminLogs(
    query: ActivityLogQuery
  ): Promise<{ data: ActivityLogResponse[]; meta: unknown }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const offset = (page - 1) * limit;

    const { rows, total } = await activityLogsRepository.listLogs(pool, {
      userId: query.user_id,
      action: query.action,
      entity: query.entity,
      startDate: query.start_date,
      endDate: query.end_date,
      sortBy: query.sort_by,
      order: query.order,
      limit,
      offset,
    });

    const meta = createPaginationMeta({ totalItems: total, page, limit });
    return {
      data: rows.map(toActivityLogResponse),
      meta,
    };
  }
}

export const activityLogsService = new ActivityLogsService();
