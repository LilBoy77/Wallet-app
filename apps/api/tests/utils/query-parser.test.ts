import { describe, it, expect } from 'vitest';
import { parseListingQuery, createPaginationMeta } from '../../src/shared/utils/query-parser.js';

describe('Listing Query Helper & SQL Injection Prevention', () => {
  const allowedSortColumns = ['created_at', 'amount', 'transaction_date', 'name'] as const;

  it('should parse valid page and limit with correct offset calculation', () => {
    const result = parseListingQuery(
      { page: '3', limit: '20', sort_by: 'amount', order: 'asc' },
      { allowedSortColumns }
    );

    expect(result).toEqual({
      page: 3,
      limit: 20,
      offset: 40,
      sortBy: 'amount',
      order: 'asc',
      search: undefined,
      filters: {},
    });
  });

  it('should use default values when parameters are omitted', () => {
    const result = parseListingQuery({}, { allowedSortColumns });

    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
    expect(result.offset).toBe(0);
    expect(result.sortBy).toBe('created_at');
    expect(result.order).toBe('desc');
  });

  it('should reject invalid page numbers (negative, zero, or non-integer)', () => {
    expect(() => parseListingQuery({ page: '-1' }, { allowedSortColumns })).toThrow(
      "Parameter 'page' harus berupa bilangan bulat positif"
    );
    expect(() => parseListingQuery({ page: '0' }, { allowedSortColumns })).toThrow(
      "Parameter 'page' harus berupa bilangan bulat positif"
    );
    expect(() => parseListingQuery({ page: 'abc' }, { allowedSortColumns })).toThrow(
      "Parameter 'page' harus berupa bilangan bulat positif"
    );
  });

  it('should reject invalid limit or limit exceeding maximum configured boundary', () => {
    expect(() => parseListingQuery({ limit: '-10' }, { allowedSortColumns })).toThrow(
      "Parameter 'limit' harus berupa bilangan bulat positif"
    );
    expect(() => parseListingQuery({ limit: 'abc' }, { allowedSortColumns })).toThrow(
      "Parameter 'limit' harus berupa bilangan bulat positif"
    );
    expect(() =>
      parseListingQuery({ limit: '150' }, { allowedSortColumns, maxLimit: 100 })
    ).toThrow('melebihi batas maksimum');
  });

  it('should reject non-whitelisted sort columns', () => {
    expect(() => parseListingQuery({ sort_by: 'password_hash' }, { allowedSortColumns })).toThrow(
      "Kolom sort 'password_hash' tidak diizinkan"
    );
  });

  it('should strictly reject SQL Injection attempts in sort parameter', () => {
    const maliciousSortInputs = [
      'amount; DROP TABLE users; --',
      "amount' OR '1'='1",
      '(SELECT CASE WHEN 1=1 THEN id ELSE name END)',
      'created_at UNION SELECT * FROM users',
      'amount /* comment */',
    ];

    for (const maliciousInput of maliciousSortInputs) {
      expect(() => parseListingQuery({ sort_by: maliciousInput }, { allowedSortColumns })).toThrow(
        'tidak diizinkan'
      );
    }
  });

  it('should filter whitelisted filter keys correctly', () => {
    const result = parseListingQuery(
      {
        page: '1',
        type: 'expense',
        category_id: 'cat-uuid-123',
        unauthorized_key: 'malicious',
      },
      {
        allowedSortColumns,
        allowedFilterKeys: ['type', 'category_id'],
      }
    );

    expect(result.filters).toEqual({
      type: 'expense',
      category_id: 'cat-uuid-123',
    });
    expect(result.filters).not.toHaveProperty('unauthorized_key');
  });

  it('createPaginationMeta: should compute correct total pages and items', () => {
    const meta1 = createPaginationMeta({ page: 2, limit: 10, totalItems: 45 });
    expect(meta1).toEqual({
      page: 2,
      limit: 10,
      total_items: 45,
      total_pages: 5,
    });

    const meta2 = createPaginationMeta({ page: 1, limit: 20, totalItems: 0 });
    expect(meta2).toEqual({
      page: 1,
      limit: 20,
      total_items: 0,
      total_pages: 0,
    });
  });
});
