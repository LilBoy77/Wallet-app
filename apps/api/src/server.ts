import type { Server } from 'http';
import { app } from './app.js';
import { env } from './config/env.js';
import { closePool } from './database/index.js';
import { logger } from './shared/logging/logger.js';

let serverInstance: Server | null = null;
let isShuttingDown = false;

/**
 * Starts the HTTP server on configured API_PORT.
 */
export function startServer(): Server {
  serverInstance = app.listen(env.API_PORT, () => {
    logger.info(
      {
        port: env.API_PORT,
        env: env.NODE_ENV,
        healthEndpoint: `http://localhost:${env.API_PORT}/health`,
        readinessEndpoint: `http://localhost:${env.API_PORT}/health/ready`,
        apiBaseUrl: `http://localhost:${env.API_PORT}/api/v1`,
      },
      `[API_SERVER] Running on http://localhost:${env.API_PORT}`
    );
  });

  return serverInstance;
}

/**
 * Executes a graceful shutdown of the application:
 * 1. Stops accepting incoming HTTP connections.
 * 2. Waits for active requests to finish (with configurable timeout).
 * 3. Drains and closes the PostgreSQL connection pool.
 * 4. Exits process cleanly with status 0.
 */
export async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    logger.warn({ signal }, '[API_SERVER] Shutdown already in progress. Ignoring signal.');
    return;
  }
  isShuttingDown = true;

  logger.info({ signal }, `[API_SERVER] Received ${signal}. Starting graceful shutdown...`);

  // Safety force exit timer
  const forceTimer = setTimeout(() => {
    logger.error(
      { timeoutMs: env.SHUTDOWN_TIMEOUT_MS },
      '[API_SERVER] Forcing shutdown after timeout expired.'
    );
    process.exit(1);
  }, env.SHUTDOWN_TIMEOUT_MS);
  forceTimer.unref();

  if (serverInstance) {
    serverInstance.close(async (err) => {
      if (err) {
        logger.error({ err }, '[API_SERVER] Error closing HTTP server');
        process.exit(1);
      }

      try {
        await closePool();
        logger.info('[API_SERVER] Database pool closed successfully.');
      } catch (poolErr) {
        logger.error({ poolErr }, '[API_SERVER] Error closing database pool');
      }

      clearTimeout(forceTimer);
      logger.info('[API_SERVER] HTTP server closed gracefully. Exiting process.');
      process.exit(0);
    });
  } else {
    try {
      await closePool();
    } catch {
      // Ignore error if server wasn't running
    }
    clearTimeout(forceTimer);
    process.exit(0);
  }
}

// Attach process signal handlers
process.on('SIGINT', () => {
  gracefulShutdown('SIGINT').catch((err) => {
    logger.error({ err }, '[API_SERVER] Fatal error during SIGINT shutdown');
    process.exit(1);
  });
});

process.on('SIGTERM', () => {
  gracefulShutdown('SIGTERM').catch((err) => {
    logger.error({ err }, '[API_SERVER] Fatal error during SIGTERM shutdown');
    process.exit(1);
  });
});

// Auto-start when executed directly
if (process.env['NODE_ENV'] !== 'test') {
  startServer();
}
