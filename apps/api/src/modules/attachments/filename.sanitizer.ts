/**
 * Sanitizes user-supplied filenames to prevent path traversal, control character injection,
 * and anomalous unicode formatting.
 */
export function sanitizeFilename(originalName: string): string {
  if (!originalName || typeof originalName !== 'string') {
    return 'unnamed_attachment';
  }

  // 1. Remove control characters, null bytes, and RTL override characters
  let sanitized = originalName
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1F\x7F\u200E\u200F\u202A-\u202E]/g, '')
    .trim();

  // 2. Extract basename (strip Unix and Windows path separators)
  sanitized = sanitized.split(/[/\\]/).pop() || 'attachment';

  // 3. Remove leading dots (hidden files/parent traversal)
  sanitized = sanitized.replace(/^\.+/, '');

  // 4. Strip dangerous characters, keep alphanumeric, dot, underscore, dash, and space
  sanitized = sanitized.replace(/[^a-zA-Z0-9._\-\s]/g, '_');

  // 5. Truncate length to maximum 100 characters while preserving extension if possible
  if (sanitized.length > 100) {
    const extMatch = sanitized.match(/\.([a-zA-Z0-9]{1,8})$/);
    if (extMatch) {
      const ext = extMatch[0];
      sanitized = `${sanitized.slice(0, 100 - ext.length)}${ext}`;
    } else {
      sanitized = sanitized.slice(0, 100);
    }
  }

  return sanitized || 'attachment';
}
