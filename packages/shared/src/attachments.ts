import { z } from 'zod';

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export type AllowedAttachmentMimeType = (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number];

export const uploadAttachmentQuerySchema = z.object({
  transaction_id: z
    .string({ required_error: 'ID transaksi wajib diisi' })
    .uuid('ID transaksi harus berformat UUID yang valid'),
});

export type UploadAttachmentQuery = z.infer<typeof uploadAttachmentQuerySchema>;

export interface AttachmentResponse {
  id: string;
  transaction_id: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  file_hash: string;
  created_at: string;
}
