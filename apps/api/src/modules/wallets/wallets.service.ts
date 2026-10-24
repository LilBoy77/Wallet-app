import crypto from 'crypto';
import type { WalletResponse, WalletEntryResponse, UpdateWalletInput } from '@wallet-app/shared';
import { safeAddMoney } from '@wallet-app/shared';
import { pool, withTransaction } from '../../database/index.js';
import { env } from '../../config/env.js';
import {
  walletsRepository,
  type WalletRecord,
  type WalletEntryRecord,
} from './wallets.repository.js';
import { NotFoundError, BadRequestError, ForbiddenError, ERROR_CODES } from '../../shared/errors/index.js';
import { createPaginationMeta } from '../../shared/utils/query-parser.js';

export function toWalletResponse(record: WalletRecord): WalletResponse {
  return {
    id: record.id,
    user_id: record.user_id,
    wallet_number: record.wallet_number,
    currency: record.currency,
    balance: Number(record.balance),
    name: record.name,
    is_active: record.is_active,
    created_at: record.created_at.toISOString(),
    updated_at: record.updated_at.toISOString(),
  };
}

export function toWalletEntryResponse(record: WalletEntryRecord): WalletEntryResponse {
  return {
    id: record.id,
    wallet_id: record.wallet_id,
    reference_id: record.reference_id,
    reference_type: record.reference_type,
    entry_type: record.entry_type,
    amount: Number(record.amount),
    balance_after: Number(record.balance_after),
    created_at: record.created_at.toISOString(),
  };
}

export function generateWalletNumber(): string {
  const hex = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `WAL-${hex}`;
}

export class WalletsService {
  async getMyWallet(userId: string): Promise<WalletResponse> {
    const wallet = await walletsRepository.findWalletByUserId(pool, userId);
    if (!wallet) {
      throw new NotFoundError('Dompet tidak ditemukan untuk pengguna ini');
    }
    return toWalletResponse(wallet);
  }

  async getMyWalletEntries(
    userId: string,
    query: { page?: number; limit?: number; type?: string }
  ): Promise<{ data: WalletEntryResponse[]; pagination: ReturnType<typeof createPaginationMeta> }> {
    const wallet = await walletsRepository.findWalletByUserId(pool, userId);
    if (!wallet) {
      throw new NotFoundError('Dompet tidak ditemukan untuk pengguna ini');
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 10));
    const offset = (page - 1) * limit;

    const { entries, total } = await walletsRepository.listWalletEntries(pool, wallet.id, {
      limit,
      offset,
      entryType: query.type,
    });

    return {
      data: entries.map(toWalletEntryResponse),
      pagination: createPaginationMeta({ page, limit, totalItems: total }),
    };
  }

  async simulateTopup(userId: string, amount: number, ip: string): Promise<WalletResponse> {
    if (!env.ENABLE_TOPUP_SIMULATION || env.NODE_ENV === 'production') {
      throw new ForbiddenError(
        'Simulasi topup dinonaktifkan pada lingkungan ini',
        ERROR_CODES.TOPUP_SIMULATION_DISABLED
      );
    }

    if (amount > env.TOPUP_MAX_AMOUNT_PER_TX) {
      throw new BadRequestError(
        `Nominal topup melebihi batas maksimal per transaksi (Rp ${env.TOPUP_MAX_AMOUNT_PER_TX.toLocaleString('id-ID')})`,
        ERROR_CODES.LIMIT_EXCEEDED
      );
    }

    const result = await withTransaction(async (client) => {
      // 1. Lock wallet row FOR UPDATE
      const wallet = await walletsRepository.findWalletByUserId(client, userId);
      if (!wallet) {
        throw new NotFoundError('Dompet tidak ditemukan untuk pengguna ini');
      }

      if (!wallet.is_active) {
        throw new BadRequestError('Dompet dinonaktifkan dan tidak dapat menerima topup');
      }

      const lockedWallet = await walletsRepository.findWalletForUpdate(client, wallet.id);
      if (!lockedWallet) {
        throw new NotFoundError('Gagal memperoleh kunci dompet');
      }

      // 2. Safe BigInt arithmetic
      const currentBalance = BigInt(lockedWallet.balance);
      const topupAmount = BigInt(amount);
      const newBalance = safeAddMoney(currentBalance, topupAmount);

      // 3. Update balance through designated repository
      await walletsRepository.updateBalance(client, lockedWallet.id, newBalance);

      // 4. Append immutable ledger credit entry
      await walletsRepository.createLedgerEntry(client, {
        walletId: lockedWallet.id,
        referenceId: null,
        referenceType: 'topup_simulation',
        entryType: 'credit',
        amount: topupAmount,
        balanceAfter: newBalance,
      });

      // 5. Audit log
      await client.query(
        `INSERT INTO activity_logs (user_id, action, entity, entity_id, metadata, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          userId,
          'WALLET_TOPUP_SIMULATED',
          'wallets',
          lockedWallet.id,
          JSON.stringify({ amount, newBalance: newBalance.toString() }),
          ip,
        ]
      );

      return {
        ...lockedWallet,
        balance: newBalance.toString(),
      };
    });

    return toWalletResponse(result);
  }

  async updateWalletMetadata(
    userId: string,
    input: UpdateWalletInput,
    ip: string
  ): Promise<WalletResponse> {
    const wallet = await walletsRepository.findWalletByUserId(pool, userId);
    if (!wallet) {
      throw new NotFoundError('Dompet tidak ditemukan untuk pengguna ini');
    }

    const updated = await walletsRepository.updateWalletMetadata(pool, wallet.id, input);
    if (!updated) {
      throw new NotFoundError('Gagal memperbarui metadata dompet');
    }

    await pool.query(
      `INSERT INTO activity_logs (user_id, action, entity, entity_id, metadata, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, 'WALLET_METADATA_UPDATED', 'wallets', wallet.id, JSON.stringify(input), ip]
    );

    return toWalletResponse(updated);
  }
}

export const walletsService = new WalletsService();
