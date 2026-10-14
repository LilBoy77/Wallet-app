import { BadRequestError } from '../errors/app-error.js';
import { env } from '../../config/env.js';

export interface PaginationMeta {
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
}

export interface ListingQueryOptions {
  allowedSortColumns: readonly string[];
  defaultSortColumn?: string;
  defaultSortOrder?: 'asc' | 'desc';
  allowedFilterKeys?: readonly string[];
  maxLimit?: number;
  defaultLimit?: number;
}

export interface ParsedListingQuery {
  page: number;
  limit: number;
  offset: number;
  sortBy: string;
  order: 'asc' | 'desc';
  search?: string;
  filters: Record<string, unknown>;
}

/**
 * Creates standardized pagination metadata conforming to API_CONTRACT.md
 */
export function createPaginationMeta(params: {
  page: number;
  limit: number;
  totalItems: number;
}): PaginationMeta {
  const totalItems = Math.max(0, params.totalItems);
  const totalPages = params.limit > 0 ? Math.ceil(totalItems / params.limit) : 0;

  return {
    page: params.page,
    limit: params.limit,
    total_items: totalItems,
    total_pages: totalPages,
  };
}

/**
 * Generic listing query parser with strict column whitelisting to prevent SQL Injection in ORDER BY.
 */
export function parseListingQuery(
  rawQuery: Record<string, unknown>,
  options: ListingQueryOptions
): ParsedListingQuery {
  const maxLimit = options.maxLimit ?? env.PAGINATION_MAX_LIMIT;
  const defaultLimit = options.defaultLimit ?? 10;

  // 1. Parse and Validate 'page'
  let page = 1;
  if (rawQuery['page'] !== undefined && rawQuery['page'] !== null && rawQuery['page'] !== '') {
    const rawPage = String(rawQuery['page']).trim();
    const parsedPage = Number(rawPage);
    if (!Number.isInteger(parsedPage) || parsedPage < 1) {
      throw new BadRequestError(
        "Parameter 'page' harus berupa bilangan bulat positif lebih besar dari 0"
      );
    }
    page = parsedPage;
  }

  // 2. Parse and Validate 'limit'
  let limit = defaultLimit;
  if (rawQuery['limit'] !== undefined && rawQuery['limit'] !== null && rawQuery['limit'] !== '') {
    const rawLimit = String(rawQuery['limit']).trim();
    const parsedLimit = Number(rawLimit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
      throw new BadRequestError(
        "Parameter 'limit' harus berupa bilangan bulat positif lebih besar dari 0"
      );
    }
    if (parsedLimit > maxLimit) {
      throw new BadRequestError(
        `Parameter 'limit' (${parsedLimit}) melebihi batas maksimum yang diizinkan (${maxLimit})`
      );
    }
    limit = parsedLimit;
  }

  const offset = (page - 1) * limit;

  // 3. Parse and Validate 'sort' / 'sort_by' with strict whitelist
  const rawSort = (rawQuery['sort_by'] || rawQuery['sort']) as string | undefined;
  let sortBy: string;

  if (rawSort !== undefined && rawSort !== null && String(rawSort).trim() !== '') {
    const sanitizedSort = String(rawSort).trim().toLowerCase();
    const matchedColumn = options.allowedSortColumns.find(
      (col) => col.toLowerCase() === sanitizedSort
    );

    if (!matchedColumn) {
      throw new BadRequestError(
        `Kolom sort '${rawSort}' tidak diizinkan. Kolom yang diizinkan: [${options.allowedSortColumns.join(', ')}]`
      );
    }
    sortBy = matchedColumn;
  } else {
    sortBy = options.defaultSortColumn || options.allowedSortColumns[0] || 'created_at';
  }

  // 4. Parse and Validate 'order'
  let order: 'asc' | 'desc' = options.defaultSortOrder || 'desc';
  const rawOrder = rawQuery['order'] as string | undefined;
  if (rawOrder !== undefined && rawOrder !== null && String(rawOrder).trim() !== '') {
    const normalizedOrder = String(rawOrder).trim().toLowerCase();
    if (normalizedOrder !== 'asc' && normalizedOrder !== 'desc') {
      throw new BadRequestError("Parameter 'order' harus bernilai 'asc' atau 'desc'");
    }
    order = normalizedOrder as 'asc' | 'desc';
  }

  // 5. Parse Search Text
  let search: string | undefined = undefined;
  if (rawQuery['search'] !== undefined && rawQuery['search'] !== null) {
    const trimmed = String(rawQuery['search']).trim();
    if (trimmed.length > 0) {
      search = trimmed;
    }
  }

  // 6. Parse Whitelisted Filters
  const filters: Record<string, unknown> = {};
  if (options.allowedFilterKeys && options.allowedFilterKeys.length > 0) {
    for (const key of options.allowedFilterKeys) {
      if (rawQuery[key] !== undefined && rawQuery[key] !== null && rawQuery[key] !== '') {
        filters[key] = rawQuery[key];
      }
    }
  }

  return {
    page,
    limit,
    offset,
    sortBy,
    order,
    search,
    filters,
  };
}
