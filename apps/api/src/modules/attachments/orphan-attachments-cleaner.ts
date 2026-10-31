import fs from 'fs';
import path from 'path';
import type { Pool, PoolClient } from 'pg';
import { env } from '../../config/env.js';
import { attachmentsRepository } from './attachments.repository.js';

export interface OrphanCleanerReport {
  orphanFilesFound: number;
  orphanFilesDeleted: number;
  missingDbFilesFound: number;
  scannedFilesCount: number;
  dbRecordsCount: number;
}

/**
 * Scans the upload directory and the attachments database table,
 * resolving discrepancies by pruning physical files that have no matching database record.
 */
export async function cleanOrphanAttachments(
  client: Pool | PoolClient,
  customUploadDir?: string
): Promise<OrphanCleanerReport> {
  const uploadDir = customUploadDir
    ? path.resolve(customUploadDir)
    : path.isAbsolute(env.UPLOAD_DIR)
      ? env.UPLOAD_DIR
      : path.resolve(process.cwd(), env.UPLOAD_DIR);

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    return {
      orphanFilesFound: 0,
      orphanFilesDeleted: 0,
      missingDbFilesFound: 0,
      scannedFilesCount: 0,
      dbRecordsCount: 0,
    };
  }

  // 1. Fetch all records from database
  const dbRecords = await attachmentsRepository.findAllAttachments(client);
  const dbFileNames = new Set(dbRecords.map((r) => r.file_path));

  // 2. Read physical files from disk
  const physicalFiles = await fs.promises.readdir(uploadDir);
  const scannedFiles = physicalFiles.filter((f) => f !== '.gitkeep');

  let orphanFilesFound = 0;
  let orphanFilesDeleted = 0;

  for (const fileName of scannedFiles) {
    if (!dbFileNames.has(fileName)) {
      orphanFilesFound++;
      const fullPath = path.join(uploadDir, fileName);
      try {
        await fs.promises.unlink(fullPath);
        orphanFilesDeleted++;
      } catch {
        // Ignore unlink error if already deleted
      }
    }
  }

  // 3. Count missing files for existing DB records
  let missingDbFilesFound = 0;
  for (const record of dbRecords) {
    const fullPath = path.join(uploadDir, record.file_path);
    if (!fs.existsSync(fullPath)) {
      missingDbFilesFound++;
    }
  }

  return {
    orphanFilesFound,
    orphanFilesDeleted,
    missingDbFilesFound,
    scannedFilesCount: scannedFiles.length,
    dbRecordsCount: dbRecords.length,
  };
}
