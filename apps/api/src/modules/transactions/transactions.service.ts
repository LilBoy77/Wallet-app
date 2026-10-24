import type {
  CreateTransactionInput,
  UpdateTransactionMetadataInput,
  TransactionResponse,
} from '@wallet-app/shared';
import { safeAddMoney, safeSubtractMoney } from '@wallet-app/shared';
import { pool, withTransaction } from '../../database/index.js';
import { env } from '../../config/env.js';
import { transactionsRepository, type TransactionRecord } from './transactions.repository.js';
import { walletsRepository } from '../wallets/wallets.repository.js';
import { NotFoundError, BadRequestError, ERROR_CODES } from '../../shared/errors/index.js';
import { createPaginationMeta } from '../../shared/utils/query-parser.js';

export function toTransactionResponse(
  record: TransactionRecord,
  tags: Array<{ id: string; name: string }> = []
): TransactionResponse {
  return {
    id: record.id,
    wallet_id: record.wallet_id,
    category_id: record.category_id,
    type: record.type,
    amount: Number(record.amount),
    status: record.status,
    transaction_date: record.transaction_date.toISOString(),
    description: record.description,
    created_at: record.created_at.toISOString(),
    updated_at: record.updated_at.toISOString(),
    deleted_at: record.deleted_at ? record.deleted_at.toISOString() : null,
    category: record.category_name
      ? {
          id: record.category_id,
          name: record.category_name,
          type: record.category_type || '',
          color: record.category_color,
          icon: record.category_icon,
        }
      : undefined,
    tags,
  };
}

export class TransactionsService {
  async createTransaction(
    userId: string,
    input: CreateTransactionInput,
    ip: string
  ): Promise<TransactionResponse> {
    const result = await withTransaction(async (client) => {
      // 1. Verify user's wallet exists and is active
      const wallet = await walletsRepository.findWalletByUserId(client, userId);
      if (!wallet) {
        throw new NotFoundError('Dompet tidak ditemukan untuk pengguna ini');
      }
      if (!wallet.is_active) {
        throw new BadRequestError('Dompet dinonaktifkan dan tidak dapat melakukan transaksi');
      }

      // 2. Lock wallet row FOR UPDATE
      const lockedWallet = await walletsRepository.findWalletForUpdate(client, wallet.id);
      if (!lockedWallet) {
        throw new NotFoundError('Gagal memperoleh kunci dompet');
      }

      // 3. Verify category exists and matches transaction (scoped to user or system)
      const category = await transactionsRepository.verifyCategoryExists(
        client,
        input.category_id,
        userId
      );
      if (!category) {
        throw new NotFoundError('Kategori tidak ditemukan atau telah dihapus');
      }

      // 4. Calculate balance under lock with safe BigInt arithmetic
      const currentBalance = BigInt(lockedWallet.balance);
      const txAmount = BigInt(input.amount);
      let newBalance: bigint;
      let entryType: 'debit' | 'credit';

      if (input.type === 'income') {
        if (input.amount > env.INCOME_MAX_AMOUNT_PER_TX) {
          throw new BadRequestError(
            `Nominal pemasukan melebihi batas maksimal per transaksi (Rp ${env.INCOME_MAX_AMOUNT_PER_TX.toLocaleString('id-ID')})`,
            ERROR_CODES.LIMIT_EXCEEDED
          );
        }
        newBalance = safeAddMoney(currentBalance, txAmount);
        entryType = 'credit';
      } else {
        if (currentBalance < txAmount) {
          throw new BadRequestError(
            'Saldo dompet tidak mencukupi untuk pengeluaran ini',
            'INSUFFICIENT_BALANCE'
          );
        }
        newBalance = safeSubtractMoney(currentBalance, txAmount);
        entryType = 'debit';
      }

      // 5. Update wallet balance through designated repository
      await walletsRepository.updateBalance(client, lockedWallet.id, newBalance);

      // 6. Create transaction record
      const txDate = input.transaction_date ? new Date(input.transaction_date) : new Date();
      const txRecord = await transactionsRepository.createTransaction(client, {
        walletId: lockedWallet.id,
        categoryId: input.category_id,
        type: input.type,
        amount: txAmount,
        transactionDate: txDate,
        description: input.description,
        status: 'COMPLETED',
      });

      // 7. Attach tags if provided
      if (input.tag_ids && input.tag_ids.length > 0) {
        await transactionsRepository.syncTransactionTags(client, txRecord.id, input.tag_ids);
      }

      // 8. Append immutable ledger entry
      await walletsRepository.createLedgerEntry(client, {
        walletId: lockedWallet.id,
        referenceId: txRecord.id,
        referenceType: 'transaction',
        entryType,
        amount: txAmount,
        balanceAfter: newBalance,
      });

      // 9. Activity log
      await client.query(
        `INSERT INTO activity_logs (user_id, action, entity, entity_id, metadata, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          userId,
          input.type === 'income' ? 'TRANSACTION_INCOME_CREATED' : 'TRANSACTION_EXPENSE_CREATED',
          'transactions',
          txRecord.id,
          JSON.stringify({
            amount: input.amount,
            type: input.type,
            newBalance: newBalance.toString(),
          }),
          ip,
        ]
      );

      const tags = input.tag_ids
        ? await transactionsRepository.getTagsForTransaction(client, txRecord.id)
        : [];

      return {
        ...txRecord,
        category_name: category.name,
        category_type: category.type,
        tags,
      };
    });

    return toTransactionResponse(result, result.tags);
  }

  async voidTransaction(
    userId: string,
    transactionId: string,
    ip: string
  ): Promise<TransactionResponse> {
    const result = await withTransaction(async (client) => {
      // 1. Fetch transaction with owner check (IDOR protection)
      const tx = await transactionsRepository.findTransactionById(client, transactionId);
      if (!tx || tx.user_id !== userId) {
        throw new NotFoundError('Transaksi tidak ditemukan');
      }

      // 2. State machine: cannot void an already voided transaction
      if (tx.status === 'VOIDED') {
        throw new BadRequestError(
          'Transaksi sudah dibatalkan (void) sebelumnya',
          'TRANSACTION_ALREADY_VOIDED'
        );
      }

      // 3. Lock user's wallet
      const lockedWallet = await walletsRepository.findWalletForUpdate(client, tx.wallet_id);
      if (!lockedWallet) {
        throw new NotFoundError('Gagal memperoleh kunci dompet');
      }

      // 4. Calculate compensating ledger entry
      const currentBalance = BigInt(lockedWallet.balance);
      const txAmount = BigInt(tx.amount);
      let newBalance: bigint;
      let compensatingEntry: 'debit' | 'credit';

      if (tx.type === 'income') {
        // Voiding income requires deducting money
        if (currentBalance < txAmount) {
          throw new BadRequestError(
            'Saldo dompet tidak mencukupi untuk membatalkan transaksi pemasukan ini',
            'INSUFFICIENT_BALANCE'
          );
        }
        newBalance = safeSubtractMoney(currentBalance, txAmount);
        compensatingEntry = 'debit';
      } else {
        // Voiding expense requires refunding money
        newBalance = safeAddMoney(currentBalance, txAmount);
        compensatingEntry = 'credit';
      }

      // 5. Update wallet balance through designated repository
      await walletsRepository.updateBalance(client, lockedWallet.id, newBalance);

      // 6. Transition transaction status to VOIDED (soft delete)
      const voidedTx = await transactionsRepository.voidTransaction(client, tx.id);
      if (!voidedTx) {
        throw new NotFoundError('Gagal membatalkan transaksi');
      }

      // 7. Append immutable compensating ledger entry
      await walletsRepository.createLedgerEntry(client, {
        walletId: lockedWallet.id,
        referenceId: tx.id,
        referenceType: 'transaction_void',
        entryType: compensatingEntry,
        amount: txAmount,
        balanceAfter: newBalance,
      });

      // 8. Activity log
      await client.query(
        `INSERT INTO activity_logs (user_id, action, entity, entity_id, metadata, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          userId,
          'TRANSACTION_VOIDED',
          'transactions',
          tx.id,
          JSON.stringify({
            amount: tx.amount,
            originalType: tx.type,
            newBalance: newBalance.toString(),
          }),
          ip,
        ]
      );

      const tags = await transactionsRepository.getTagsForTransaction(client, tx.id);

      return {
        ...voidedTx,
        category_name: tx.category_name,
        category_type: tx.category_type,
        tags,
      };
    });

    return toTransactionResponse(result, result.tags);
  }

  async updateTransactionMetadata(
    userId: string,
    transactionId: string,
    input: UpdateTransactionMetadataInput,
    ip: string
  ): Promise<TransactionResponse> {
    const tx = await transactionsRepository.findTransactionById(pool, transactionId);
    if (!tx || tx.user_id !== userId) {
      throw new NotFoundError('Transaksi tidak ditemukan');
    }

    if (tx.status === 'VOIDED') {
      throw new BadRequestError('Tidak dapat memperbarui transaksi yang sudah dibatalkan (void)');
    }

    if (input.category_id) {
      const category = await transactionsRepository.verifyCategoryExists(
        pool,
        input.category_id,
        userId
      );
      if (!category) {
        throw new NotFoundError('Kategori tidak ditemukan atau telah dihapus');
      }
    }

    const updated = await transactionsRepository.updateTransactionMetadata(pool, transactionId, {
      categoryId: input.category_id,
      description: input.description,
    });
    if (!updated) {
      throw new NotFoundError('Gagal memperbarui metadata transaksi');
    }

    if (input.tag_ids) {
      await transactionsRepository.syncTransactionTags(pool, transactionId, input.tag_ids);
    }

    await pool.query(
      `INSERT INTO activity_logs (user_id, action, entity, entity_id, metadata, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        userId,
        'TRANSACTION_METADATA_UPDATED',
        'transactions',
        transactionId,
        JSON.stringify(input),
        ip,
      ]
    );

    const tags = await transactionsRepository.getTagsForTransaction(pool, transactionId);
    return toTransactionResponse(
      {
        ...updated,
        category_name: tx.category_name,
        category_type: tx.category_type,
      },
      tags
    );
  }

  async getTransactionById(userId: string, transactionId: string): Promise<TransactionResponse> {
    const tx = await transactionsRepository.findTransactionById(pool, transactionId);
    if (!tx || tx.user_id !== userId) {
      throw new NotFoundError('Transaksi tidak ditemukan');
    }
    const tags = await transactionsRepository.getTagsForTransaction(pool, transactionId);
    return toTransactionResponse(tx, tags);
  }

  async listTransactions(
    userId: string,
    query: {
      page?: number;
      limit?: number;
      type?: 'income' | 'expense';
      categoryId?: string;
      status?: 'COMPLETED' | 'VOIDED' | 'ALL';
      startDate?: string;
      endDate?: string;
      search?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    }
  ): Promise<{ data: TransactionResponse[]; pagination: ReturnType<typeof createPaginationMeta> }> {
    const wallet = await walletsRepository.findWalletByUserId(pool, userId);
    if (!wallet) {
      throw new NotFoundError('Dompet tidak ditemukan untuk pengguna ini');
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 10));
    const offset = (page - 1) * limit;

    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    const { transactions, total } = await transactionsRepository.listTransactions(pool, wallet.id, {
      limit,
      offset,
      type: query.type,
      categoryId: query.categoryId,
      status: query.status,
      startDate,
      endDate,
      search: query.search,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });

    const data = transactions.map((t) => toTransactionResponse(t, []));
    return {
      data,
      pagination: createPaginationMeta({ page, limit, totalItems: total }),
    };
  }
}

export const transactionsService = new TransactionsService();
