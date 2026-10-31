import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { AttachmentResponse } from '@wallet-app/shared';
import { env } from '../../config/env.js';
import { pool, withTransaction } from '../../database/index.js';
import { attachmentsRepository, type AttachmentRecord } from './attachments.repository.js';
import { transactionsRepository } from '../transactions/transactions.repository.js';
import {
  NotFoundError,
  BadRequestError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError,
  ERROR_CODES,
} from '../../shared/errors/index.js';
import { detectMagicBytes } from './magic-bytes.validator.js';
import { sanitizeFilename } from './filename.sanitizer.js';
import { recordActivity, ACTIVITY_ACTIONS } from '../../shared/logging/activity-log.helper.js';

export function toAttachmentResponse(record: AttachmentRecord): AttachmentResponse {
  return {
    id: record.id,
    transaction_id: record.transaction_id,
    file_name: record.file_name,
    mime_type: record.mime_type,
    file_size: record.file_size,
    file_hash: record.file_hash,
    created_at: record.created_at.toISOString(),
  };
}

export class AttachmentsService {
  getUploadDirectory(): string {
    const targetDir = path.isAbsolute(env.UPLOAD_DIR)
      ? env.UPLOAD_DIR
      : path.resolve(process.cwd(), env.UPLOAD_DIR);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    return targetDir;
  }

  async uploadAttachment(
    userId: string,
    transactionId: string,
    file: {
      buffer?: Buffer;
      originalname?: string;
      size?: number;
      mimetype?: string;
    },
    ip: string
  ): Promise<AttachmentResponse> {
    // 1. Validate file presence and non-empty
    if (!file || !file.buffer || !file.size || file.size === 0) {
      throw new BadRequestError('Berkas lampiran tidak boleh kosong');
    }

    if (file.size > env.ATTACHMENT_MAX_FILE_SIZE_BYTES) {
      throw new PayloadTooLargeError(
        `Ukuran berkas melebihi batas maksimal (${(env.ATTACHMENT_MAX_FILE_SIZE_BYTES / 1024 / 1024).toFixed(0)}MB)`
      );
    }

    // 2. Validate Magic Bytes (Whitelisted: JPEG, PNG, WebP, PDF)
    const { valid, detectedMime } = detectMagicBytes(file.buffer);
    if (!valid || !detectedMime) {
      throw new UnsupportedMediaTypeError(
        'Format berkas tidak didukung. Format yang diizinkan: JPEG, PNG, WebP, PDF'
      );
    }

    // 3. Compute SHA-256 Digest
    const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex');

    // 4. Sanitize original filename and generate random storage name (UUID)
    const sanitizedOriginalName = sanitizeFilename(file.originalname || 'attachment');
    const storedFileName = crypto.randomUUID(); // Random UUID, no extension from client
    const uploadDir = this.getUploadDirectory();
    const targetPath = path.join(uploadDir, storedFileName);

    // 5. Write file to disk first
    await fs.promises.writeFile(targetPath, file.buffer);

    try {
      // 6. DB Transaction with Row-Level Locking on Transaction
      const record = await withTransaction(async (client) => {
        // Lock transaction row FOR UPDATE to prevent race condition exceeding 5 attachments
        const txRes = await client.query<{
          id: string;
          status: string;
          wallet_id: string;
          user_id: string;
        }>(
          `SELECT t.id, t.status, t.wallet_id, w.user_id
           FROM transactions t
           JOIN wallets w ON t.wallet_id = w.id
           WHERE t.id = $1
           FOR UPDATE`,
          [transactionId]
        );

        const tx = txRes.rows[0];
        if (!tx || tx.user_id !== userId) {
          throw new NotFoundError('Transaksi tidak ditemukan');
        }

        if (tx.status !== 'COMPLETED') {
          throw new BadRequestError(
            'Lampiran hanya dapat ditambahkan pada transaksi yang berstatus COMPLETED'
          );
        }

        // Count existing attachments under lock
        const count = await attachmentsRepository.countAttachmentsForTransaction(
          client,
          transactionId
        );

        if (count >= env.ATTACHMENT_MAX_FILES_PER_TX) {
          throw new BadRequestError(
            `Jumlah lampiran untuk transaksi ini telah mencapai batas maksimal (${env.ATTACHMENT_MAX_FILES_PER_TX})`,
            ERROR_CODES.LIMIT_EXCEEDED
          );
        }

        // Insert attachment record
        const attRecord = await attachmentsRepository.createAttachment(client, {
          transactionId,
          fileName: sanitizedOriginalName,
          filePath: storedFileName,
          mimeType: detectedMime,
          fileSize: file.size!,
          fileHash,
        });

        // Activity log
        await recordActivity(client, {
          userId,
          action: ACTIVITY_ACTIONS.ATTACHMENT_UPLOADED,
          entity: 'attachments',
          entityId: attRecord.id,
          metadata: {
            transaction_id: transactionId,
            file_name: sanitizedOriginalName,
            file_size: file.size,
            mime_type: detectedMime,
          },
          ipAddress: ip,
        });

        return attRecord;
      });

      return toAttachmentResponse(record);
    } catch (err) {
      // Cleanup orphan physical file on failure
      await fs.promises.unlink(targetPath).catch(() => {});
      throw err;
    }
  }

  async getAttachmentDownload(
    userId: string,
    attachmentId: string
  ): Promise<{
    fullPath: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
  }> {
    const attachment = await attachmentsRepository.findAttachmentById(pool, attachmentId);
    if (!attachment || attachment.user_id !== userId) {
      throw new NotFoundError('Lampiran tidak ditemukan');
    }

    const uploadDir = this.getUploadDirectory();
    const fullPath = path.join(uploadDir, attachment.file_path);

    if (!fs.existsSync(fullPath)) {
      throw new NotFoundError('Berkas fisik lampiran tidak ditemukan di server');
    }

    return {
      fullPath,
      fileName: attachment.file_name,
      mimeType: attachment.mime_type,
      fileSize: attachment.file_size,
    };
  }

  async getAttachmentMetadata(userId: string, attachmentId: string): Promise<AttachmentResponse> {
    const attachment = await attachmentsRepository.findAttachmentById(pool, attachmentId);
    if (!attachment || attachment.user_id !== userId) {
      throw new NotFoundError('Lampiran tidak ditemukan');
    }
    return toAttachmentResponse(attachment);
  }

  async listAttachmentsByTransaction(
    userId: string,
    transactionId: string
  ): Promise<AttachmentResponse[]> {
    const tx = await transactionsRepository.findTransactionById(pool, transactionId);
    if (!tx || tx.user_id !== userId) {
      throw new NotFoundError('Transaksi tidak ditemukan');
    }

    const rows = await attachmentsRepository.listAttachmentsByTransactionId(pool, transactionId);
    return rows.map(toAttachmentResponse);
  }

  async deleteAttachment(
    userId: string,
    attachmentId: string,
    ip: string
  ): Promise<AttachmentResponse> {
    const uploadDir = this.getUploadDirectory();

    const deletedRecord = await withTransaction(async (client) => {
      const attachment = await attachmentsRepository.findAttachmentById(client, attachmentId);
      if (!attachment || attachment.user_id !== userId) {
        throw new NotFoundError('Lampiran tidak ditemukan');
      }

      const deleted = await attachmentsRepository.deleteAttachment(client, attachmentId);
      if (!deleted) {
        throw new NotFoundError('Gagal menghapus lampiran');
      }

      await recordActivity(client, {
        userId,
        action: ACTIVITY_ACTIONS.ATTACHMENT_DELETED,
        entity: 'attachments',
        entityId: attachmentId,
        metadata: {
          transaction_id: attachment.transaction_id,
          file_name: attachment.file_name,
        },
        ipAddress: ip,
      });

      return deleted;
    });

    // Remove physical file from disk after DB deletion commits
    const filePath = path.join(uploadDir, deletedRecord.file_path);
    await fs.promises.unlink(filePath).catch(() => {});

    return toAttachmentResponse(deletedRecord);
  }
}

export const attachmentsService = new AttachmentsService();
