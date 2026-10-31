import { z } from 'zod';

export const categoryTypeSchema = z.enum(['income', 'expense'], {
  errorMap: () => ({ message: "Tipe kategori harus 'income' atau 'expense'" }),
});

export type CategoryType = z.infer<typeof categoryTypeSchema>;

export const createCategoryInputSchema = z.object({
  name: z
    .string({ required_error: 'Nama kategori wajib diisi' })
    .trim()
    .min(1, 'Nama kategori minimal 1 karakter')
    .max(50, 'Nama kategori maksimal 50 karakter'),
  type: categoryTypeSchema,
  icon: z
    .string()
    .trim()
    .min(1, 'Icon minimal 1 karakter')
    .max(50, 'Icon maksimal 50 karakter')
    .default('tag'),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Format warna harus heksadesimal 6 digit (contoh: #64748b)')
    .default('#64748b'),
});

export type CreateCategoryInput = z.infer<typeof createCategoryInputSchema>;

export const updateCategoryInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Nama kategori minimal 1 karakter')
    .max(50, 'Nama kategori maksimal 50 karakter')
    .optional(),
  icon: z
    .string()
    .trim()
    .min(1, 'Icon minimal 1 karakter')
    .max(50, 'Icon maksimal 50 karakter')
    .optional(),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Format warna harus heksadesimal 6 digit (contoh: #64748b)')
    .optional(),
});

export type UpdateCategoryInput = z.infer<typeof updateCategoryInputSchema>;

export const categoryListQuerySchema = z.object({
  type: z.enum(['income', 'expense']).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type CategoryListQuery = z.infer<typeof categoryListQuerySchema>;

export interface CategoryResponse {
  id: string;
  user_id: string | null;
  name: string;
  type: 'income' | 'expense';
  icon: string;
  color: string;
  is_system: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
