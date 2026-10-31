import type { PoolClient, Pool } from 'pg';

export const ACTIVITY_ACTIONS = {
  // Authentication
  USER_REGISTERED: 'USER_REGISTERED',
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGIN_FAILED: 'USER_LOGIN_FAILED',
  TOKEN_REFRESHED: 'TOKEN_REFRESHED',
  TOKEN_REUSE_DETECTED: 'TOKEN_REUSE_DETECTED',
  USER_LOGOUT: 'USER_LOGOUT',
  USER_LOGOUT_ALL: 'USER_LOGOUT_ALL',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  PASSWORD_RESET_REQUESTED: 'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_COMPLETED: 'PASSWORD_RESET_COMPLETED',

  // Wallets
  TOPUP_SIMULATION: 'TOPUP_SIMULATION',
  WALLET_UPDATE: 'WALLET_UPDATE',

  // Transfers
  TRANSFER_SENT: 'TRANSFER_SENT',
  TRANSFER_RECEIVED: 'TRANSFER_RECEIVED',

  // Transactions
  TRANSACTION_CREATED: 'TRANSACTION_CREATED',
  TRANSACTION_METADATA_UPDATED: 'TRANSACTION_METADATA_UPDATED',
  TRANSACTION_VOIDED: 'TRANSACTION_VOIDED',

  // Categories
  CATEGORY_CREATED: 'CATEGORY_CREATED',
  CATEGORY_UPDATED: 'CATEGORY_UPDATED',
  CATEGORY_DELETED: 'CATEGORY_DELETED',

  // Budgets
  BUDGET_CREATED: 'BUDGET_CREATED',
  BUDGET_UPDATED: 'BUDGET_UPDATED',
  BUDGET_DELETED: 'BUDGET_DELETED',

  // Attachments
  ATTACHMENT_UPLOADED: 'ATTACHMENT_UPLOADED',
  ATTACHMENT_DELETED: 'ATTACHMENT_DELETED',
} as const;

export type ActivityAction = (typeof ACTIVITY_ACTIONS)[keyof typeof ACTIVITY_ACTIONS];

export interface RecordActivityParams {
  userId?: string | null;
  action: ActivityAction;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}

const FORBIDDEN_KEY_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /hash/i,
  /buffer/i,
  /credential/i,
  /cookie/i,
  /authorization/i,
  /file_path/i,
  /^email$/i,
];

/**
 * Sanitizes metadata to ensure no sensitive credentials, secrets, hashes, or internal file paths leak into audit logs.
 */
export function sanitizeLogMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    const isForbidden = FORBIDDEN_KEY_PATTERNS.some((pat) => pat.test(key));
    if (isForbidden) {
      continue;
    }

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeLogMetadata(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Writes an immutable activity log entry using the caller's transaction client.
 * Guarantees atomicity with the business operation (rollback on error).
 */
export async function recordActivity(
  client: PoolClient | Pool,
  params: RecordActivityParams
): Promise<void> {
  const sanitizedMetadata = params.metadata ? sanitizeLogMetadata(params.metadata) : {};

  await client.query(
    `INSERT INTO activity_logs (user_id, action, entity, entity_id, metadata, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      params.userId ?? null,
      params.action,
      params.entity,
      params.entityId ?? null,
      JSON.stringify(sanitizedMetadata),
      params.ipAddress ?? null,
    ]
  );
}
