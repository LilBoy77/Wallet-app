import type { PoolClient } from 'pg';

export interface IdempotencyRecord {
  id: string;
  user_id: string;
  idempotency_key: string;
  request_path: string;
  payload_hash: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  response_code: number | null;
  response_body: unknown;
  resource_id: string | null;
  created_at: Date;
  expires_at: Date;
}

export class IdempotencyRepository {
  /**
   * Attempts to insert an initial IN_PROGRESS record.
   * If record already exists, locks the row FOR UPDATE to coordinate concurrency.
   */
  async lockOrInitIdempotencyRecord(
    client: PoolClient,
    params: {
      userId: string;
      idempotencyKey: string;
      requestPath: string;
      payloadHash: string;
    }
  ): Promise<{ isNew: boolean; record: IdempotencyRecord }> {
    // 1. Try insert
    const insertRes = await client.query<IdempotencyRecord>(
      `INSERT INTO idempotency_records (user_id, idempotency_key, request_path, payload_hash, status)
       VALUES ($1, $2, $3, $4, 'IN_PROGRESS')
       ON CONFLICT (user_id, idempotency_key) DO NOTHING
       RETURNING *`,
      [params.userId, params.idempotencyKey, params.requestPath, params.payloadHash]
    );

    if (insertRes.rows.length > 0) {
      return { isNew: true, record: insertRes.rows[0]! };
    }

    // 2. Already exists: lock FOR UPDATE to await concurrent in-flight or read completed
    const existingRes = await client.query<IdempotencyRecord>(
      `SELECT * FROM idempotency_records
       WHERE user_id = $1 AND idempotency_key = $2
       FOR UPDATE`,
      [params.userId, params.idempotencyKey]
    );

    return { isNew: false, record: existingRes.rows[0]! };
  }

  async markCompleted(
    client: PoolClient,
    params: {
      userId: string;
      idempotencyKey: string;
      responseCode: number;
      responseBody: unknown;
      resourceId?: string | null;
    }
  ): Promise<void> {
    await client.query(
      `UPDATE idempotency_records
       SET status = 'COMPLETED',
           response_code = $1,
           response_body = $2::jsonb,
           resource_id = $3
       WHERE user_id = $4 AND idempotency_key = $5`,
      [
        params.responseCode,
        JSON.stringify(params.responseBody),
        params.resourceId || null,
        params.userId,
        params.idempotencyKey,
      ]
    );
  }

  async markFailed(client: PoolClient, userId: string, idempotencyKey: string): Promise<void> {
    await client.query(
      `UPDATE idempotency_records
       SET status = 'FAILED'
       WHERE user_id = $1 AND idempotency_key = $2`,
      [userId, idempotencyKey]
    );
  }
}

export const idempotencyRepository = new IdempotencyRepository();
