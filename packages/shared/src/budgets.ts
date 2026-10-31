import { z } from 'zod';
import { moneyAmountSchema } from './finance.js';

export const createBudgetInputSchema = z
  .object({
    category_id: z
      .string({ required_error: 'ID kategori wajib diisi' })
      .uuid('ID kategori harus berformat UUID yang valid'),
    limit_amount: moneyAmountSchema,
    month: z.coerce
      .number()
      .int()
      .min(1, 'Bulan minimal 1')
      .max(12, 'Bulan maksimal 12')
      .optional(),
    year: z.coerce
      .number()
      .int()
      .min(2020, 'Tahun minimal 2020')
      .max(2100, 'Tahun maksimal 2100')
      .optional(),
    start_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')
      .optional(),
    end_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')
      .optional(),
  })
  .refine(
    (data) =>
      (data.month !== undefined && data.year !== undefined) ||
      (data.start_date !== undefined && data.end_date !== undefined),
    {
      message: 'Harus menyertakan pasangan month dan year ATAU start_date dan end_date',
    }
  );

export type CreateBudgetInput = z.infer<typeof createBudgetInputSchema>;

export const updateBudgetInputSchema = z.object({
  limit_amount: moneyAmountSchema,
});

export type UpdateBudgetInput = z.infer<typeof updateBudgetInputSchema>;

export const budgetListQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2020).max(2100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export type BudgetListQuery = z.infer<typeof budgetListQuerySchema>;

export interface BudgetResponse {
  id: string;
  user_id: string;
  category_id: string;
  category_name?: string;
  category_icon?: string;
  category_color?: string;
  limit_amount: number;
  spent_amount: number;
  remaining_amount: number;
  percentage_bps: number; // Basis points: 10000 bps = 100%
  percentage: number; // Integer percentage
  is_exceeded: boolean;
  start_date: string;
  end_date: string;
  month: number;
  year: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
