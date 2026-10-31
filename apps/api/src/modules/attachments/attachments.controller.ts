import type { Request, Response, RequestHandler } from 'express';
import { attachmentsService } from './attachments.service.js';
import { asyncHandler, BadRequestError } from '../../shared/errors/index.js';

export const uploadAttachment: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const transactionId = (req.body.transaction_id ||
      req.body.transactionId ||
      req.query.transaction_id) as string;

    if (!transactionId) {
      throw new BadRequestError('ID transaksi (transaction_id) wajib disertakan');
    }

    if (!req.file) {
      throw new BadRequestError('Berkas lampiran (file) wajib disertakan');
    }

    const ip = req.ip || '127.0.0.1';
    const result = await attachmentsService.uploadAttachment(userId, transactionId, req.file, ip);

    res.status(201).json({
      success: true,
      data: result,
      message: 'Lampiran berhasil diunggah',
    });
  }
);

export const downloadAttachment: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const id = req.params['id'] as string;

    const { fullPath, fileName, mimeType, fileSize } =
      await attachmentsService.getAttachmentDownload(userId, id);

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store, private');
    res.setHeader('Content-Length', fileSize);

    res.sendFile(fullPath);
  }
);

export const getAttachmentMetadata: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const id = req.params['id'] as string;
    const data = await attachmentsService.getAttachmentMetadata(userId, id);

    res.status(200).json({
      success: true,
      data,
    });
  }
);

export const listAttachmentsByTransaction: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const transactionId = (req.params['transactionId'] || req.query['transaction_id']) as string;

    if (!transactionId) {
      throw new BadRequestError('ID transaksi wajib disertakan');
    }

    const data = await attachmentsService.listAttachmentsByTransaction(userId, transactionId);

    res.status(200).json({
      success: true,
      data,
    });
  }
);

export const deleteAttachment: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const id = req.params['id'] as string;
    const ip = req.ip || '127.0.0.1';
    const data = await attachmentsService.deleteAttachment(userId, id, ip);

    res.status(200).json({
      success: true,
      data,
      message: 'Lampiran berhasil dihapus',
    });
  }
);
