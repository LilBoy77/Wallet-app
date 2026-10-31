import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { env } from '../../config/env.js';
import {
  authenticate,
  validate,
  createRateLimiter,
  resolveRateLimitMax,
} from '../../middlewares/index.js';
import { asyncHandler } from '../../shared/errors/index.js';
import {
  uploadAttachment,
  downloadAttachment,
  getAttachmentMetadata,
  listAttachmentsByTransaction,
  deleteAttachment,
} from './attachments.controller.js';

export const attachmentUploadLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: resolveRateLimitMax(30),
  message: 'Terlalu banyak permintaan unggah berkas. Silakan coba lagi nanti.',
});

export const attachmentDownloadLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: resolveRateLimitMax(60),
  message: 'Terlalu banyak permintaan unduh berkas. Silakan coba lagi nanti.',
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.ATTACHMENT_MAX_FILE_SIZE_BYTES,
    files: 1,
    fields: 10,
  },
});

const idParamSchema = z.object({
  id: z.string().uuid('ID lampiran harus berformat UUID yang valid'),
});

const transactionIdParamSchema = z.object({
  transactionId: z.string().uuid('ID transaksi harus berformat UUID yang valid'),
});

export const attachmentsRouter: Router = Router();

// 1. Upload Attachment
attachmentsRouter.post(
  '/',
  asyncHandler(authenticate),
  attachmentUploadLimiter,
  upload.single('file'),
  uploadAttachment
);

// 2. Download Attachment
attachmentsRouter.get(
  '/:id/download',
  asyncHandler(authenticate),
  attachmentDownloadLimiter,
  validate({ params: idParamSchema }),
  downloadAttachment
);

// 3. Get Attachment Metadata
attachmentsRouter.get(
  '/:id',
  asyncHandler(authenticate),
  validate({ params: idParamSchema }),
  getAttachmentMetadata
);

// 4. List Attachments by Transaction
attachmentsRouter.get(
  '/transaction/:transactionId',
  asyncHandler(authenticate),
  validate({ params: transactionIdParamSchema }),
  listAttachmentsByTransaction
);

// 5. Delete Attachment
attachmentsRouter.delete(
  '/:id',
  asyncHandler(authenticate),
  validate({ params: idParamSchema }),
  deleteAttachment
);
