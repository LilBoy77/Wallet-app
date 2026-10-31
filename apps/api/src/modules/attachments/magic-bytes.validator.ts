import type { AllowedAttachmentMimeType } from '@wallet-app/shared';

/**
 * Validates file buffer against known magic byte signatures.
 * Never trusts client-supplied Content-Type or file extension.
 */
export function detectMagicBytes(buffer: Buffer): {
  valid: boolean;
  detectedMime: AllowedAttachmentMimeType | null;
} {
  if (!buffer || buffer.length < 4) {
    return { valid: false, detectedMime: null };
  }

  // 1. JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, detectedMime: 'image/jpeg' };
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { valid: true, detectedMime: 'image/png' };
  }

  // 3. WebP: RIFF (bytes 0-3) and WEBP (bytes 8-11)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && // 'R'
    buffer[1] === 0x49 && // 'I'
    buffer[2] === 0x46 && // 'F'
    buffer[3] === 0x46 && // 'F'
    buffer[8] === 0x57 && // 'W'
    buffer[9] === 0x45 && // 'E'
    buffer[10] === 0x42 && // 'B'
    buffer[11] === 0x50 // 'P'
  ) {
    return { valid: true, detectedMime: 'image/webp' };
  }

  // 4. PDF: %PDF- (25 50 44 46 2D)
  if (
    buffer.length >= 5 &&
    buffer[0] === 0x25 && // '%'
    buffer[1] === 0x50 && // 'P'
    buffer[2] === 0x44 && // 'D'
    buffer[3] === 0x46 && // 'F'
    buffer[4] === 0x2d // '-'
  ) {
    return { valid: true, detectedMime: 'application/pdf' };
  }

  return { valid: false, detectedMime: null };
}
