import type {
  CreateCategoryInput,
  UpdateCategoryInput,
  CategoryListQuery,
  CategoryResponse,
} from '@wallet-app/shared';
import { pool, withTransaction } from '../../database/index.js';
import { categoriesRepository, type CategoryRecord } from './categories.repository.js';
import { NotFoundError, ForbiddenError, ConflictError } from '../../shared/errors/index.js';
import { createPaginationMeta } from '../../shared/utils/query-parser.js';
import { recordActivity, ACTIVITY_ACTIONS } from '../../shared/logging/activity-log.helper.js';

export function toCategoryResponse(record: CategoryRecord): CategoryResponse {
  return {
    id: record.id,
    user_id: record.user_id,
    name: record.name,
    type: record.type,
    icon: record.icon,
    color: record.color,
    is_system: record.is_system,
    created_at: record.created_at.toISOString(),
    updated_at: record.updated_at.toISOString(),
    deleted_at: record.deleted_at ? record.deleted_at.toISOString() : null,
  };
}

export class CategoriesService {
  async listCategories(
    userId: string,
    query: CategoryListQuery
  ): Promise<{ data: CategoryResponse[]; meta: unknown }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const offset = (page - 1) * limit;

    const { rows, total } = await categoriesRepository.listCategories(pool, {
      userId,
      type: query.type,
      search: query.search,
      limit,
      offset,
    });

    const meta = createPaginationMeta({ totalItems: total, page, limit });
    return {
      data: rows.map(toCategoryResponse),
      meta,
    };
  }

  async getCategoryById(userId: string, categoryId: string): Promise<CategoryResponse> {
    const category = await categoriesRepository.findCategoryById(pool, categoryId, userId);
    if (!category) {
      throw new NotFoundError('Kategori tidak ditemukan');
    }
    return toCategoryResponse(category);
  }

  async createCategory(
    userId: string,
    input: CreateCategoryInput,
    ip: string
  ): Promise<CategoryResponse> {
    return withTransaction(async (client) => {
      // 1. Check duplicate active category for this user
      const existing = await categoriesRepository.findActiveByNameAndType(
        client,
        input.name,
        input.type,
        userId
      );
      if (existing) {
        throw new ConflictError(
          `Kategori dengan nama '${input.name}' dan tipe '${input.type}' sudah ada`
        );
      }

      // 2. Create category
      const record = await categoriesRepository.createCategory(client, {
        userId,
        name: input.name,
        type: input.type,
        icon: input.icon,
        color: input.color,
      });

      // 3. Activity log
      await recordActivity(client, {
        userId,
        action: ACTIVITY_ACTIONS.CATEGORY_CREATED,
        entity: 'categories',
        entityId: record.id,
        metadata: {
          name: record.name,
          type: record.type,
        },
        ipAddress: ip,
      });

      return toCategoryResponse(record);
    });
  }

  async updateCategory(
    userId: string,
    categoryId: string,
    input: UpdateCategoryInput,
    ip: string
  ): Promise<CategoryResponse> {
    return withTransaction(async (client) => {
      const category = await categoriesRepository.findCategoryById(client, categoryId);
      if (!category) {
        throw new NotFoundError('Kategori tidak ditemukan');
      }

      if (category.is_system) {
        throw new ForbiddenError('Kategori bawaan sistem tidak dapat diubah');
      }

      if (category.user_id !== userId) {
        throw new NotFoundError('Kategori tidak ditemukan');
      }

      if (input.name && input.name.trim().toLowerCase() !== category.name.toLowerCase()) {
        const duplicate = await categoriesRepository.findActiveByNameAndType(
          client,
          input.name,
          category.type,
          userId
        );
        if (duplicate && duplicate.id !== category.id) {
          throw new ConflictError(
            `Kategori dengan nama '${input.name}' dan tipe '${category.type}' sudah ada`
          );
        }
      }

      const updated = await categoriesRepository.updateCategory(client, categoryId, input);
      if (!updated) {
        throw new NotFoundError('Gagal memperbarui kategori');
      }

      // Activity log
      await recordActivity(client, {
        userId,
        action: ACTIVITY_ACTIONS.CATEGORY_UPDATED,
        entity: 'categories',
        entityId: updated.id,
        metadata: {
          name: updated.name,
          type: updated.type,
        },
        ipAddress: ip,
      });

      return toCategoryResponse(updated);
    });
  }

  async deleteCategory(userId: string, categoryId: string, ip: string): Promise<CategoryResponse> {
    return withTransaction(async (client) => {
      const category = await categoriesRepository.findCategoryById(client, categoryId);
      if (!category) {
        throw new NotFoundError('Kategori tidak ditemukan');
      }

      if (category.is_system) {
        throw new ForbiddenError('Kategori bawaan sistem tidak dapat dihapus');
      }

      if (category.user_id !== userId) {
        throw new NotFoundError('Kategori tidak ditemukan');
      }

      const deleted = await categoriesRepository.softDeleteCategory(client, categoryId);
      if (!deleted) {
        throw new NotFoundError('Gagal menghapus kategori');
      }

      // Activity log
      await recordActivity(client, {
        userId,
        action: ACTIVITY_ACTIONS.CATEGORY_DELETED,
        entity: 'categories',
        entityId: deleted.id,
        metadata: {
          name: deleted.name,
          type: deleted.type,
        },
        ipAddress: ip,
      });

      return toCategoryResponse(deleted);
    });
  }
}

export const categoriesService = new CategoriesService();
