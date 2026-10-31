import { z } from 'zod';

export const activityLogQuerySchema = z.object({
  action: z.string().optional(),
  entity: z.string().optional(),
  user_id: z.string().uuid().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  sort_by: z.enum(['created_at', 'action', 'entity']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type ActivityLogQuery = z.infer<typeof activityLogQuerySchema>;

export interface ActivityLogResponse {
  id: string;
  user_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
  user_email?: string | null;
  user_full_name?: string | null;
}
