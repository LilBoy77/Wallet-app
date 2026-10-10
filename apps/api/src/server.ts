import { app } from './app.js';
import { env } from './config/env.js';

const server = app.listen(env.API_PORT, () => {
  console.log(`[API_SERVER] Running on http://localhost:${env.API_PORT} [ENV: ${env.NODE_ENV}]`);
  console.log(`[API_SERVER] Health check available at: http://localhost:${env.API_PORT}/health`);
});

// Graceful Shutdown
function handleShutdown(signal: string) {
  console.log(`\n[API_SERVER] Received ${signal}. Starting graceful shutdown...`);
  server.close((err) => {
    if (err) {
      console.error('[API_SERVER] Error during shutdown:', err);
      process.exit(1);
    }
    console.log('[API_SERVER] HTTP server closed gracefully.');
    process.exit(0);
  });

  // Force close if graceful shutdown hangs
  setTimeout(() => {
    console.error('[API_SERVER] Forcing shutdown after timeout.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
