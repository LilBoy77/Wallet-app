import { Router } from 'express';
import { z } from 'zod';
import { authenticate, validate } from '../../middlewares/index.js';
import { asyncHandler } from '../../shared/errors/index.js';
import {
  createBudgetInputSchema,
  updateBudgetInputSchema,
  budgetListQuerySchema,
} from '@wallet-app/shared';
import {
  listBudgets,
  getBudgetById,
  createBudget,
  updateBudget,
  deleteBudget,
} from './budgets.controller.js';

const idParamSchema = z.object({
  id: z.string().uuid('ID anggaran harus berformat UUID yang valid'),
});

export const budgetsRouter: Router = Router();

// 1. List budgets with aggregated spending
budgetsRouter.get(
  '/',
  asyncHandler(authenticate),
  validate({ query: budgetListQuerySchema }),
  listBudgets
);

// 2. Create budget for month
budgetsRouter.post(
  '/',
  asyncHandler(authenticate),
  validate({ body: createBudgetInputSchema }),
  createBudget
);

// 3. Get single budget details with spending
budgetsRouter.get(
  '/:id',
  asyncHandler(authenticate),
  validate({ params: idParamSchema }),
  getBudgetById
);

// 4. Update budget limit
budgetsRouter.put(
  '/:id',
  asyncHandler(authenticate),
  validate({ params: idParamSchema, body: updateBudgetInputSchema }),
  updateBudget
);

// 5. Soft delete budget
budgetsRouter.delete(
  '/:id',
  asyncHandler(authenticate),
  validate({ params: idParamSchema }),
  deleteBudget
);
