import type { Pool, PoolClient } from 'pg';
import type { TransferStatus } from '@wallet-app/shared';

export interface TransferRecord {
  id: string;
  source_wallet_id: string;
  target_wallet_id: string;
  amount: string; // BIGINT string from pg
  idempotency_key: string;
  status: TransferStatus;
  note: string | null;
  created_at: Date;
  source_wallet_number?: string;
  target_wallet_number?: string;
  source_user_id?: string;
  target_user_id?: string;
}

export class TransfersRepository {
  async createTransfer(
    client: PoolClient | Pool,
    params: {
      sourceWalletId: string;
      targetWalletId: string;
      amount: bigint;
      idempotencyKey: string;
      status?: TransferStatus;
      note?: string | null;
    }
  ): Promise<TransferRecord> {
    const res = await client.query<TransferRecord>(
      `INSERT INTO transfers (source_wallet_id, target_wallet_id, amount, idempotency_key, status, note)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, source_wallet_id, target_wallet_id, amount::text, idempotency_key, status, note, created_at`,
      [
        params.sourceWalletId,
        params.targetWalletId,
        params.amount.toString(),
        params.idempotencyKey,
        params.status ?? 'completed',
        params.note || null,
      ]
    );
    return res.rows[0]!;
  }

  async findTransferById(
    client: PoolClient | Pool,
    transferId: string
  ): Promise<TransferRecord | null> {
    const res = await client.query<TransferRecord>(
      `SELECT tr.id, tr.source_wallet_id, tr.target_wallet_id, tr.amount::text,
              tr.idempotency_key, tr.status, tr.note, tr.created_at,
              sw.wallet_number as source_wallet_number, sw.user_id as source_user_id,
              tw.wallet_number as target_wallet_number, tw.user_id as target_user_id
       FROM transfers tr
       JOIN wallets sw ON tr.source_wallet_id = sw.id
       JOIN wallets tw ON tr.target_wallet_id = tw.id
       WHERE tr.id = $1`,
      [transferId]
    );
    return res.rows[0] || null;
  }

  async listTransfers(
    client: PoolClient | Pool,
    walletId: string,
    options: { limit: number; offset: number }
  ): Promise<{ transfers: TransferRecord[]; total: number }> {
    const countRes = await client.query<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM transfers
       WHERE source_wallet_id = $1 OR target_wallet_id = $1`,
      [walletId]
    );
    const total = parseInt(countRes.rows[0]?.count ?? '0', 10);

    const rowsRes = await client.query<TransferRecord>(
      `SELECT tr.id, tr.source_wallet_id, tr.target_wallet_id, tr.amount::text,
              tr.idempotency_key, tr.status, tr.note, tr.created_at,
              sw.wallet_number as source_wallet_number, sw.user_id as source_user_id,
              tw.wallet_number as target_wallet_number, tw.user_id as target_user_id
       FROM transfers tr
       JOIN wallets sw ON tr.source_wallet_id = sw.id
       JOIN wallets tw ON tr.target_wallet_id = tw.id
       WHERE tr.source_wallet_id = $1 OR tr.target_wallet_id = $1
       ORDER BY tr.created_at DESC
       LIMIT $2 OFFSET $3`,
      [walletId, options.limit, options.offset]
    );

    return { transfers: rowsRes.rows, total };
  }
}

export const transfersRepository = new TransfersRepository();
