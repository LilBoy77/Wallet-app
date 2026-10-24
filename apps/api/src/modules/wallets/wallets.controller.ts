import type { Request, Response } from 'express';
import { walletsService } from './wallets.service.js';

export class WalletsController {
  async getMyWallet(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const wallet = await walletsService.getMyWallet(userId);
    res.status(200).json({ success: true, data: wallet });
  }

  async getMyWalletEntries(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const page = req.query['page'] ? parseInt(req.query['page'] as string, 10) : 1;
    const limit = req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : 10;
    const type = req.query['type'] as string | undefined;

    const result = await walletsService.getMyWalletEntries(userId, { page, limit, type });
    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  }

  async simulateTopup(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const amount = req.body.amount as number;
    const ip = req.ip || '127.0.0.1';

    const wallet = await walletsService.simulateTopup(userId, amount, ip);
    res.status(200).json({
      success: true,
      message: 'Top-up simulasi saldo berhasil diproses',
      data: wallet,
    });
  }

  async updateWalletMetadata(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const ip = req.ip || '127.0.0.1';

    const wallet = await walletsService.updateWalletMetadata(userId, req.body, ip);
    res.status(200).json({
      success: true,
      message: 'Metadata dompet berhasil diperbarui',
      data: wallet,
    });
  }
}

export const walletsController = new WalletsController();
