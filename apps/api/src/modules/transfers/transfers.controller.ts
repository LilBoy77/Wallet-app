import type { Request, Response } from 'express';
import { transfersService } from './transfers.service.js';

export class TransfersController {
  async executeTransfer(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const ip = req.ip || '127.0.0.1';
    const idempotencyKey = (req.headers['idempotency-key'] as string) || '';

    const { data, isReplay } = await transfersService.executeTransfer(
      userId,
      req.body,
      idempotencyKey,
      ip
    );

    const statusCode = isReplay ? 200 : 201;
    res.status(statusCode).json({
      success: true,
      message: isReplay
        ? 'Transfer berhasil (idempotent replay)'
        : 'Transfer saldo berhasil diproses',
      data,
    });
  }

  async listTransfers(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const page = req.query['page'] ? parseInt(req.query['page'] as string, 10) : undefined;
    const limit = req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : undefined;

    const result = await transfersService.listTransfers(userId, { page, limit });
    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  }

  async getTransferById(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const transferId = req.params['id'] as string;

    const transfer = await transfersService.getTransferById(userId, transferId);
    res.status(200).json({
      success: true,
      data: transfer,
    });
  }
}

export const transfersController = new TransfersController();
