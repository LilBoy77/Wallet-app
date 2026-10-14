import pino, { type Logger, type LoggerOptions } from 'pino';
import { env } from '../../config/env.js';

export const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["set-cookie"]',
  'headers.authorization',
  'headers.cookie',
  'headers["set-cookie"]',
  'authorization',
  'cookie',
  'set-cookie',
  'password',
  'token',
  'refreshToken',
  'accessToken',
  'secret',
  '*.password',
  '*.token',
  '*.refreshToken',
  '*.accessToken',
  '*.secret',
  '*.*.password',
  '*.*.token',
  '*.*.refreshToken',
  '*.*.accessToken',
  '*.*.secret',
];

const pinoOptions: LoggerOptions = {
  level: env.LOG_LEVEL || 'info',
  redact: {
    paths: REDACTED_PATHS,
    censor: '[REDACTED]',
  },
  base: {
    service: '@wallet-app/api',
    env: env.NODE_ENV,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
};

/**
 * Creates a Pino logger instance configured for the environment.
 * Development uses pretty formatting when available; production uses high-performance JSON lines.
 */
export function createLogger(destination?: pino.DestinationStream): Logger {
  // If destination stream is explicitly passed (e.g. for testing log output)
  if (destination) {
    return pino(pinoOptions, destination);
  }

  if (env.NODE_ENV === 'development') {
    return pino({
      ...pinoOptions,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
          ignore: 'pid,hostname,service',
        },
      },
    });
  }

  return pino(pinoOptions);
}

export const logger: Logger = createLogger();
