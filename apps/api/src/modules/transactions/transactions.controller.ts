import type { Request, Response } from 'express';
import { transactionsService } from './transactions.service.js';

export class TransactionsController {
  async createTransaction(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const ip = req.ip || '127.0.0.1';

    const transaction = await transactionsService.createTransaction(userId, req.body, ip);
    res.status(201).json({
      success: true,
      message: 'Transaksi berhasil dibuat',
      data: transaction,
    });
  }

  async listTransactions(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const page = req.query['page'] ? parseInt(req.query['page'] as string, 10) : undefined;
    const limit = req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : undefined;
    const type = req.query['type'] as 'income' | 'expense' | undefined;
    const categoryId = req.query['category_id'] as string | undefined;
    const status = req.query['status'] as 'COMPLETED' | 'VOIDED' | 'ALL' | undefined;
    const startDate = req.query['start_date'] as string | undefined;
    const endDate = req.query['end_date'] as string | undefined;
    const search = req.query['search'] as string | undefined;
    const sortBy = req.query['sort_by'] as string | undefined;
    const sortOrder = req.query['sort_order'] as 'asc' | 'desc' | undefined;

    const result = await transactionsService.listTransactions(userId, {
      page,
      limit,
      type,
      categoryId,
      status,
      startDate,
      endDate,
      search,
      sortBy,
      sortOrder,
    });

    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  }

  async getTransactionById(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const transactionId = req.params['id'] as string;

    const transaction = await transactionsService.getTransactionById(userId, transactionId);
    res.status(200).json({
      success: true,
      data: transaction,
    });
  }

  async updateTransactionMetadata(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const transactionId = req.params['id'] as string;
    const ip = req.ip || '127.0.0.1';

    const transaction = await transactionsService.updateTransactionMetadata(
      userId,
      transactionId,
      req.body,
      ip
    );
    res.status(200).json({
      success: true,
      message: 'Metadata transaksi berhasil diperbarui',
      data: transaction,
    });
  }

  async voidTransaction(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const transactionId = req.params['id'] as string;
    const ip = req.ip || '127.0.0.1';

    const transaction = await transactionsService.voidTransaction(userId, transactionId, ip);
    res.status(200).json({
      success: true,
      message: 'Transaksi berhasil dibatalkan (void)',
      data: transaction,
    });
  }
}

export const transactionsController = new TransactionsController();
