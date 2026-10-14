import pg from 'pg';
import { env } from '../../config/env.js';
import { sanitizeConnectionString } from '../index.js';

const { Pool } = pg;

export async function cleanupExpiredTokens(connectionString: string = env.DATABASE_URL): Promise<{
  cleanedRefreshTokens: number;
  cleanedPasswordResets: number;
}> {
  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  try {
    console.log(`[CLEANUP] Connecting to ${sanitizeConnectionString(connectionString)}...`);
    await client.query('BEGIN');

    // 1. Delete refresh tokens that are either expired OR revoked older than 7 days
    const refreshResult = await client.query(
      `DELETE FROM refresh_tokens
       WHERE expires_at < NOW()
          OR (is_revoked = true AND created_at < NOW() - INTERVAL '7 days')`
    );

    // 2. Delete password resets that are either expired or marked as used
    const resetResult = await client.query(
      `DELETE FROM password_resets
       WHERE expires_at < NOW()
          OR (is_used = true AND created_at < NOW() - INTERVAL '1 day')`
    );

    await client.query('COMMIT');

    const cleanedRefreshTokens = refreshResult.rowCount || 0;
    const cleanedPasswordResets = resetResult.rowCount || 0;

    console.log(
      `[CLEANUP] Successfully cleaned ${cleanedRefreshTokens} refresh tokens and ${cleanedPasswordResets} password reset records ✓`
    );

    return { cleanedRefreshTokens, cleanedPasswordResets };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[CLEANUP] Error during token cleanup:', (error as Error).message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Direct execution from CLI
if (
  process.argv[1]?.endsWith('cleanup-tokens.ts') ||
  process.argv[1]?.endsWith('cleanup-tokens.js')
) {
  cleanupExpiredTokens()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
