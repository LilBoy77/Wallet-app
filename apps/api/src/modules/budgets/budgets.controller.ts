import type { Request, Response, RequestHandler } from 'express';
import { budgetsService } from './budgets.service.js';
import { asyncHandler } from '../../shared/errors/index.js';
import type { CreateBudgetInput, UpdateBudgetInput, BudgetListQuery } from '@wallet-app/shared';

export const listBudgets: RequestHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const query = req.query as unknown as BudgetListQuery;
  const result = await budgetsService.listBudgets(userId, query);

  res.status(200).json({
    success: true,
    data: result.data,
    meta: result.meta,
  });
});

export const getBudgetById: RequestHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const id = req.params['id'] as string;
  const budget = await budgetsService.getBudgetById(userId, id);

  res.status(200).json({
    success: true,
    data: budget,
  });
});

export const createBudget: RequestHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const input = req.body as CreateBudgetInput;
  const ip = req.ip || '127.0.0.1';
  const budget = await budgetsService.createBudget(userId, input, ip);

  res.status(201).json({
    success: true,
    data: budget,
    message: 'Anggaran berhasil dibuat',
  });
});

export const updateBudget: RequestHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const id = req.params['id'] as string;
  const input = req.body as UpdateBudgetInput;
  const ip = req.ip || '127.0.0.1';
  const budget = await budgetsService.updateBudget(userId, id, input, ip);

  res.status(200).json({
    success: true,
    data: budget,
    message: 'Pagu anggaran berhasil diperbarui',
  });
});

export const deleteBudget: RequestHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const id = req.params['id'] as string;
  const ip = req.ip || '127.0.0.1';
  const budget = await budgetsService.deleteBudget(userId, id, ip);

  res.status(200).json({
    success: true,
    data: budget,
    message: 'Anggaran berhasil dihapus',
  });
});
