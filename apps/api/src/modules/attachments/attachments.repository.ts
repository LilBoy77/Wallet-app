import type { Pool, PoolClient } from 'pg';

export interface AttachmentRecord {
  id: string;
  transaction_id: string;
  file_name: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  file_hash: string;
  created_at: Date;
  user_id?: string;
  transaction_status?: string;
}

export class AttachmentsRepository {
  async findAttachmentById(
    client: Pool | PoolClient,
    id: string
  ): Promise<AttachmentRecord | null> {
    const res = await client.query<AttachmentRecord>(
      `SELECT 
        a.id, a.transaction_id, a.file_name, a.file_path, a.mime_type, a.file_size, a.file_hash, a.created_at,
        w.user_id, t.status as transaction_status
       FROM attachments a
       JOIN transactions t ON a.transaction_id = t.id
       JOIN wallets w ON t.wallet_id = w.id
       WHERE a.id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }

  async listAttachmentsByTransactionId(
    client: Pool | PoolClient,
    transactionId: string
  ): Promise<AttachmentRecord[]> {
    const res = await client.query<AttachmentRecord>(
      `SELECT a.id, a.transaction_id, a.file_name, a.file_path, a.mime_type, a.file_size, a.file_hash, a.created_at
       FROM attachments a
       WHERE a.transaction_id = $1
       ORDER BY a.created_at ASC`,
      [transactionId]
    );
    return res.rows;
  }

  async countAttachmentsForTransaction(
    client: Pool | PoolClient,
    transactionId: string
  ): Promise<number> {
    const res = await client.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM attachments WHERE transaction_id = $1`,
      [transactionId]
    );
    return parseInt(res.rows[0]?.count ?? '0', 10);
  }

  async createAttachment(
    client: Pool | PoolClient,
    data: {
      id?: string;
      transactionId: string;
      fileName: string;
      filePath: string;
      mimeType: string;
      fileSize: number;
      fileHash: string;
    }
  ): Promise<AttachmentRecord> {
    const res = await client.query<AttachmentRecord>(
      `INSERT INTO attachments (id, transaction_id, file_name, file_path, mime_type, file_size, file_hash)
       VALUES (COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7)
       RETURNING id, transaction_id, file_name, file_path, mime_type, file_size, file_hash, created_at`,
      [
        data.id || null,
        data.transactionId,
        data.fileName,
        data.filePath,
        data.mimeType,
        data.fileSize,
        data.fileHash,
      ]
    );
    return res.rows[0]!;
  }

  async deleteAttachment(client: Pool | PoolClient, id: string): Promise<AttachmentRecord | null> {
    const res = await client.query<AttachmentRecord>(
      `DELETE FROM attachments WHERE id = $1 RETURNING *`,
      [id]
    );
    return res.rows[0] || null;
  }

  async findAllAttachments(client: Pool | PoolClient): Promise<AttachmentRecord[]> {
    const res = await client.query<AttachmentRecord>(
      `SELECT id, transaction_id, file_name, file_path, mime_type, file_size, file_hash, created_at FROM attachments`
    );
    return res.rows;
  }
}

export const attachmentsRepository = new AttachmentsRepository();
