import type { Request, Response, RequestHandler } from 'express';
import { categoriesService } from './categories.service.js';
import { asyncHandler } from '../../shared/errors/index.js';
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
  CategoryListQuery,
} from '@wallet-app/shared';

export const listCategories: RequestHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const query = req.query as unknown as CategoryListQuery;
  const result = await categoriesService.listCategories(userId, query);

  res.status(200).json({
    success: true,
    data: result.data,
    meta: result.meta,
  });
});

export const getCategoryById: RequestHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const id = req.params['id'] as string;
  const category = await categoriesService.getCategoryById(userId, id);

  res.status(200).json({
    success: true,
    data: category,
  });
});

export const createCategory: RequestHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const input = req.body as CreateCategoryInput;
  const ip = req.ip || '127.0.0.1';
  const category = await categoriesService.createCategory(userId, input, ip);

  res.status(201).json({
    success: true,
    data: category,
    message: 'Kategori berhasil dibuat',
  });
});

export const updateCategory: RequestHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const id = req.params['id'] as string;
  const input = req.body as UpdateCategoryInput;
  const ip = req.ip || '127.0.0.1';
  const category = await categoriesService.updateCategory(userId, id, input, ip);

  res.status(200).json({
    success: true,
    data: category,
    message: 'Kategori berhasil diperbarui',
  });
});

export const deleteCategory: RequestHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const id = req.params['id'] as string;
  const ip = req.ip || '127.0.0.1';
  const category = await categoriesService.deleteCategory(userId, id, ip);

  res.status(200).json({
    success: true,
    data: category,
    message: 'Kategori berhasil dihapus',
  });
});
