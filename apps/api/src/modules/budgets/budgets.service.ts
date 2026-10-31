import type {
  CreateBudgetInput,
  UpdateBudgetInput,
  BudgetListQuery,
  BudgetResponse,
} from '@wallet-app/shared';
import { toSafeMoneyNumber } from '@wallet-app/shared';
import { pool, withTransaction } from '../../database/index.js';
import { env } from '../../config/env.js';
import { budgetsRepository, type BudgetRecord } from './budgets.repository.js';
import { categoriesRepository } from '../categories/categories.repository.js';
import { NotFoundError, BadRequestError, ConflictError } from '../../shared/errors/index.js';
import { createPaginationMeta } from '../../shared/utils/query-parser.js';
import { recordActivity, ACTIVITY_ACTIONS } from '../../shared/logging/activity-log.helper.js';
import { parseDateRange } from '../../shared/utils/date-range.js';

export function toBudgetResponse(
  record: BudgetRecord,
  month: number,
  year: number
): BudgetResponse {
  const limitBig = BigInt(record.limit_amount);
  const spentBig = BigInt(record.spent_amount || '0');
  const remainingBig = limitBig > spentBig ? limitBig - spentBig : 0n;

  // Pure BigInt math: Basis points (10000 = 100.00%) and integer percentage
  const percentageBps = limitBig > 0n ? Number((spentBig * 10000n) / limitBig) : 0;
  const percentage = limitBig > 0n ? Number((spentBig * 100n) / limitBig) : 0;

  return {
    id: record.id,
    user_id: record.user_id,
    category_id: record.category_id,
    category_name: record.category_name,
    category_icon: record.category_icon,
    category_color: record.category_color,
    limit_amount: toSafeMoneyNumber(limitBig),
    spent_amount: toSafeMoneyNumber(spentBig),
    remaining_amount: toSafeMoneyNumber(remainingBig),
    percentage_bps: percentageBps,
    percentage,
    is_exceeded: spentBig > limitBig,
    start_date: record.start_date,
    end_date: record.end_date,
    month,
    year,
    created_at: record.created_at.toISOString(),
    updated_at: record.updated_at.toISOString(),
    deleted_at: record.deleted_at ? record.deleted_at.toISOString() : null,
  };
}

export class BudgetsService {
  async listBudgets(
    userId: string,
    query: BudgetListQuery
  ): Promise<{ data: BudgetResponse[]; meta: unknown }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 50));
    const offset = (page - 1) * limit;

    const dateRange = parseDateRange(
      query.month,
      query.year,
      undefined,
      undefined,
      env.BUDGET_TIMEZONE
    );

    const { rows, total } = await budgetsRepository.listBudgetsWithRealization(pool, {
      userId,
      startDateStr: dateRange.startDateStr,
      endDateStr: dateRange.endDateStr,
      timezone: env.BUDGET_TIMEZONE,
      limit,
      offset,
    });

    const meta = createPaginationMeta({ totalItems: total, page, limit });
    return {
      data: rows.map((r) => toBudgetResponse(r, dateRange.month, dateRange.year)),
      meta,
    };
  }

  async getBudgetById(userId: string, budgetId: string): Promise<BudgetResponse> {
    const budget = await budgetsRepository.findBudgetById(pool, budgetId, userId);
    if (!budget) {
      throw new NotFoundError('Anggaran tidak ditemukan');
    }

    const dateRange = parseDateRange(
      undefined,
      undefined,
      budget.start_date,
      budget.end_date,
      env.BUDGET_TIMEZONE
    );

    const detailed = await budgetsRepository.getBudgetWithRealization(
      pool,
      budgetId,
      userId,
      env.BUDGET_TIMEZONE
    );

    if (!detailed) {
      throw new NotFoundError('Anggaran tidak ditemukan');
    }

    return toBudgetResponse(detailed, dateRange.month, dateRange.year);
  }

  async createBudget(
    userId: string,
    input: CreateBudgetInput,
    ip: string
  ): Promise<BudgetResponse> {
    return withTransaction(async (client) => {
      // 1. Verify Category exists, is active, and is of type EXPENSE
      const category = await categoriesRepository.findCategoryById(
        client,
        input.category_id,
        userId
      );
      if (!category) {
        throw new NotFoundError('Kategori tidak ditemukan atau telah dihapus');
      }

      if (category.type !== 'expense') {
        throw new BadRequestError(
          'Anggaran hanya dapat dibuat untuk kategori pengeluaran (expense)'
        );
      }

      // 2. Parse Date Range in configured timezone
      const dateRange = parseDateRange(
        input.month,
        input.year,
        input.start_date,
        input.end_date,
        env.BUDGET_TIMEZONE
      );

      // 3. Check duplicate active budget for this user+category+month
      const existing = await budgetsRepository.findActiveByUserCategoryPeriod(
        client,
        userId,
        input.category_id,
        dateRange.startDateStr,
        dateRange.endDateStr
      );
      if (existing) {
        throw new ConflictError('Anggaran aktif untuk kategori dan periode bulan ini sudah ada');
      }

      // 4. Create Budget
      const record = await budgetsRepository.createBudget(client, {
        userId,
        categoryId: input.category_id,
        limitAmount: input.limit_amount,
        startDate: dateRange.startDateStr,
        endDate: dateRange.endDateStr,
      });

      // 5. Activity log
      await recordActivity(client, {
        userId,
        action: ACTIVITY_ACTIONS.BUDGET_CREATED,
        entity: 'budgets',
        entityId: record.id,
        metadata: {
          category_id: input.category_id,
          limit_amount: toSafeMoneyNumber(input.limit_amount),
          start_date: dateRange.startDateStr,
          end_date: dateRange.endDateStr,
        },
        ipAddress: ip,
      });

      const detailed = await budgetsRepository.getBudgetWithRealization(
        client,
        record.id,
        userId,
        env.BUDGET_TIMEZONE
      );

      return toBudgetResponse(
        detailed || {
          ...record,
          category_name: category.name,
          category_icon: category.icon,
          category_color: category.color,
          spent_amount: '0',
        },
        dateRange.month,
        dateRange.year
      );
    });
  }

  async updateBudget(
    userId: string,
    budgetId: string,
    input: UpdateBudgetInput,
    ip: string
  ): Promise<BudgetResponse> {
    return withTransaction(async (client) => {
      const budget = await budgetsRepository.findBudgetById(client, budgetId, userId);
      if (!budget) {
        throw new NotFoundError('Anggaran tidak ditemukan');
      }

      const updated = await budgetsRepository.updateBudgetLimit(
        client,
        budgetId,
        input.limit_amount
      );
      if (!updated) {
        throw new NotFoundError('Gagal memperbarui pagu anggaran');
      }

      const dateRange = parseDateRange(
        undefined,
        undefined,
        updated.start_date,
        updated.end_date,
        env.BUDGET_TIMEZONE
      );

      const detailed = await budgetsRepository.getBudgetWithRealization(
        client,
        budgetId,
        userId,
        env.BUDGET_TIMEZONE
      );

      // Activity log
      await recordActivity(client, {
        userId,
        action: ACTIVITY_ACTIONS.BUDGET_UPDATED,
        entity: 'budgets',
        entityId: budgetId,
        metadata: {
          limit_amount: toSafeMoneyNumber(input.limit_amount),
        },
        ipAddress: ip,
      });

      return toBudgetResponse(detailed || updated, dateRange.month, dateRange.year);
    });
  }

  async deleteBudget(userId: string, budgetId: string, ip: string): Promise<BudgetResponse> {
    return withTransaction(async (client) => {
      const budget = await budgetsRepository.findBudgetById(client, budgetId, userId);
      if (!budget) {
        throw new NotFoundError('Anggaran tidak ditemukan');
      }

      const deleted = await budgetsRepository.softDeleteBudget(client, budgetId);
      if (!deleted) {
        throw new NotFoundError('Gagal menghapus anggaran');
      }

      const dateRange = parseDateRange(
        undefined,
        undefined,
        deleted.start_date,
        deleted.end_date,
        env.BUDGET_TIMEZONE
      );

      // Activity log
      await recordActivity(client, {
        userId,
        action: ACTIVITY_ACTIONS.BUDGET_DELETED,
        entity: 'budgets',
        entityId: budgetId,
        metadata: {
          category_id: deleted.category_id,
        },
        ipAddress: ip,
      });

      return toBudgetResponse(deleted, dateRange.month, dateRange.year);
    });
  }
}

export const budgetsService = new BudgetsService();
