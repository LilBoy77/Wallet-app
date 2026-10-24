import crypto from 'crypto';
import type { CreateTransferInput, TransferResponse } from '@wallet-app/shared';
import { safeAddMoney, safeSubtractMoney, canonicalStringify } from '@wallet-app/shared';
import { env } from '../../config/env.js';
import { pool, withTransaction } from '../../database/index.js';
import { transfersRepository, type TransferRecord } from './transfers.repository.js';
import { idempotencyRepository } from './idempotency.repository.js';
import { walletsRepository } from '../wallets/wallets.repository.js';
import { NotFoundError, BadRequestError, ConflictError } from '../../shared/errors/index.js';
import { createPaginationMeta } from '../../shared/utils/query-parser.js';

export function toTransferResponse(record: TransferRecord): TransferResponse {
  return {
    id: record.id,
    source_wallet_id: record.source_wallet_id,
    target_wallet_id: record.target_wallet_id,
    source_wallet_number: record.source_wallet_number || '',
    target_wallet_number: record.target_wallet_number || '',
    amount: Number(record.amount),
    status: record.status,
    note: record.note,
    idempotency_key: record.idempotency_key,
    created_at: record.created_at.toISOString(),
  };
}

export function computePayloadHash(payload: unknown): string {
  const canonical = canonicalStringify(payload);
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

export class TransfersService {
  async executeTransfer(
    userId: string,
    input: CreateTransferInput,
    idempotencyKey: string,
    ip: string
  ): Promise<{ data: TransferResponse; isReplay: boolean }> {
    if (!idempotencyKey || !idempotencyKey.trim()) {
      throw new BadRequestError(
        'Header Idempotency-Key wajib disertakan',
        'MISSING_IDEMPOTENCY_KEY'
      );
    }

    // 1. Validate max transfer amount limit
    if (input.amount > env.TRANSFER_MAX_AMOUNT_PER_TX) {
      throw new BadRequestError(
        `Nominal transfer melebihi batas maksimal per transaksi (Rp ${env.TRANSFER_MAX_AMOUNT_PER_TX.toLocaleString('id-ID')})`,
        'LIMIT_EXCEEDED'
      );
    }

    const payloadHash = computePayloadHash({
      target_wallet_number: input.target_wallet_number,
      amount: input.amount,
      note: input.note || '',
    });

    const result = await withTransaction(async (client) => {
      // 2. Lock or initialize idempotency record
      const { isNew, record } = await idempotencyRepository.lockOrInitIdempotencyRecord(client, {
        userId,
        idempotencyKey,
        requestPath: '/api/v1/transfers',
        payloadHash,
      });

      if (!isNew) {
        if (record.payload_hash !== payloadHash) {
          throw new ConflictError(
            'Kunci idempotensi telah digunakan untuk payload transaksi yang berbeda',
            'IDEMPOTENCY_CONFLICT'
          );
        }

        if (record.status === 'COMPLETED' && record.response_body) {
          return {
            data: record.response_body as TransferResponse,
            isReplay: true,
          };
        }

        if (record.status === 'FAILED') {
          throw new BadRequestError(
            'Permintaan transfer sebelumnya dengan kunci ini gagal. Silakan gunakan kunci baru.',
            'IDEMPOTENCY_KEY_FAILED'
          );
        }
      }

      // 3. Find source wallet
      const sourceWallet = await walletsRepository.findWalletByUserId(client, userId);
      if (!sourceWallet) {
        throw new NotFoundError('Dompet pengirim tidak ditemukan');
      }
      if (!sourceWallet.is_active) {
        throw new BadRequestError(
          'Dompet pengirim dinonaktifkan dan tidak dapat melakukan transfer'
        );
      }

      // 4. Find target wallet by wallet number (Anti-enumeration per D5)
      const targetWallet = await walletsRepository.findWalletByNumber(
        client,
        input.target_wallet_number
      );
      if (!targetWallet || !targetWallet.is_active) {
        throw new NotFoundError(
          'Nomor dompet tujuan tidak ditemukan atau tidak dapat menerima transfer'
        );
      }

      // 5. Prevent self-transfer
      if (sourceWallet.id === targetWallet.id) {
        throw new BadRequestError(
          'Tidak dapat melakukan transfer ke dompet sendiri',
          'SELF_TRANSFER_PROHIBITED'
        );
      }

      // 6. Deterministic Row Locking in ascending UUID order (eliminates deadlocks)
      const lockedWallets = await walletsRepository.findWalletsForUpdateSorted(client, [
        sourceWallet.id,
        targetWallet.id,
      ]);

      const lockedSource = lockedWallets.find((w) => w.id === sourceWallet.id);
      const lockedTarget = lockedWallets.find((w) => w.id === targetWallet.id);

      if (!lockedSource || !lockedTarget) {
        throw new NotFoundError('Gagal memperoleh kunci dompet untuk transfer');
      }

      // 7. Balance check strictly UNDER LOCK
      const sourceBalance = BigInt(lockedSource.balance);
      const targetBalance = BigInt(lockedTarget.balance);
      const transferAmount = BigInt(input.amount);

      if (sourceBalance < transferAmount) {
        throw new BadRequestError(
          'Saldo dompet tidak mencukupi untuk melakukan transfer ini',
          'INSUFFICIENT_BALANCE'
        );
      }

      // 8. Safe BigInt arithmetic (Zero Negative Balance guarantee)
      const newSourceBalance = safeSubtractMoney(sourceBalance, transferAmount);
      const newTargetBalance = safeAddMoney(targetBalance, transferAmount);

      // 9. Update balances exclusively through designated repository
      await walletsRepository.updateBalance(client, lockedSource.id, newSourceBalance);
      await walletsRepository.updateBalance(client, lockedTarget.id, newTargetBalance);

      // 10. Create transfer record
      const transferRecord = await transfersRepository.createTransfer(client, {
        sourceWalletId: lockedSource.id,
        targetWalletId: lockedTarget.id,
        amount: transferAmount,
        idempotencyKey,
        status: 'completed',
        note: input.note,
      });

      // 11. Append balanced double-entry audit entries
      // Sender: debit
      await walletsRepository.createLedgerEntry(client, {
        walletId: lockedSource.id,
        referenceId: transferRecord.id,
        referenceType: 'transfer_send',
        entryType: 'debit',
        amount: transferAmount,
        balanceAfter: newSourceBalance,
      });

      // Receiver: credit
      await walletsRepository.createLedgerEntry(client, {
        walletId: lockedTarget.id,
        referenceId: transferRecord.id,
        referenceType: 'transfer_receive',
        entryType: 'credit',
        amount: transferAmount,
        balanceAfter: newTargetBalance,
      });

      // 12. Audit log
      await client.query(
        `INSERT INTO activity_logs (user_id, action, entity, entity_id, metadata, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          userId,
          'TRANSFER_SENT',
          'transfers',
          transferRecord.id,
          JSON.stringify({
            amount: input.amount,
            target_wallet_number: input.target_wallet_number,
            new_balance: newSourceBalance.toString(),
          }),
          ip,
        ]
      );

      const responseData: TransferResponse = {
        id: transferRecord.id,
        source_wallet_id: lockedSource.id,
        target_wallet_id: lockedTarget.id,
        source_wallet_number: lockedSource.wallet_number,
        target_wallet_number: lockedTarget.wallet_number,
        amount: Number(transferRecord.amount),
        status: transferRecord.status,
        note: transferRecord.note,
        idempotency_key: transferRecord.idempotency_key,
        created_at: transferRecord.created_at.toISOString(),
      };

      // 13. Mark idempotency record as COMPLETED
      await idempotencyRepository.markCompleted(client, {
        userId,
        idempotencyKey,
        responseCode: 201,
        responseBody: responseData,
        resourceId: transferRecord.id,
      });

      return {
        data: responseData,
        isReplay: false,
      };
    });

    return result;
  }

  async getTransferById(userId: string, transferId: string): Promise<TransferResponse> {
    const transfer = await transfersRepository.findTransferById(pool, transferId);
    if (!transfer) {
      throw new NotFoundError('Transaksi transfer tidak ditemukan');
    }

    // IDOR verification: user must be either source or target
    if (transfer.source_user_id !== userId && transfer.target_user_id !== userId) {
      throw new NotFoundError('Transaksi transfer tidak ditemukan');
    }

    return toTransferResponse(transfer);
  }

  async listTransfers(
    userId: string,
    query: { page?: number; limit?: number }
  ): Promise<{ data: TransferResponse[]; pagination: ReturnType<typeof createPaginationMeta> }> {
    const wallet = await walletsRepository.findWalletByUserId(pool, userId);
    if (!wallet) {
      throw new NotFoundError('Dompet tidak ditemukan untuk pengguna ini');
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 10));
    const offset = (page - 1) * limit;

    const { transfers, total } = await transfersRepository.listTransfers(pool, wallet.id, {
      limit,
      offset,
    });

    return {
      data: transfers.map(toTransferResponse),
      pagination: createPaginationMeta({ page, limit, totalItems: total }),
    };
  }
}

export const transfersService = new TransfersService();
