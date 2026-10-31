import { Router } from 'express';
import { z } from 'zod';
import { authenticate, validate } from '../../middlewares/index.js';
import { asyncHandler } from '../../shared/errors/index.js';
import {
  createCategoryInputSchema,
  updateCategoryInputSchema,
  categoryListQuerySchema,
} from '@wallet-app/shared';
import {
  listCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} from './categories.controller.js';

const idParamSchema = z.object({
  id: z.string().uuid('ID kategori harus berformat UUID yang valid'),
});

export const categoriesRouter: Router = Router();

// 1. List categories (own + system, filtered by type / search)
categoriesRouter.get(
  '/',
  asyncHandler(authenticate),
  validate({ query: categoryListQuerySchema }),
  listCategories
);

// 2. Create custom category
categoriesRouter.post(
  '/',
  asyncHandler(authenticate),
  validate({ body: createCategoryInputSchema }),
  createCategory
);

// 3. Get category detail
categoriesRouter.get(
  '/:id',
  asyncHandler(authenticate),
  validate({ params: idParamSchema }),
  getCategoryById
);

// 4. Update custom category
categoriesRouter.put(
  '/:id',
  asyncHandler(authenticate),
  validate({ params: idParamSchema, body: updateCategoryInputSchema }),
  updateCategory
);

// 5. Soft delete custom category
categoriesRouter.delete(
  '/:id',
  asyncHandler(authenticate),
  validate({ params: idParamSchema }),
  deleteCategory
);
