import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from root .env or app .env
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config();

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(5000),
  CORS_ORIGIN: z.string().min(1, 'CORS_ORIGIN is required').default('http://localhost:5173'),
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .refine((val) => val.startsWith('postgresql://') || val.startsWith('postgres://'), {
      message: 'DATABASE_URL must be a valid PostgreSQL connection URL',
    }),
  TEST_DATABASE_URL: z
    .string()
    .refine((val) => val.startsWith('postgresql://') || val.startsWith('postgres://'), {
      message: 'TEST_DATABASE_URL must be a valid PostgreSQL connection URL',
    })
    .default('postgresql://postgres:change_me_local_only@localhost:5432/wallet_test'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(rawEnv: Record<string, unknown> = process.env): EnvConfig {
  const parsed = envSchema.safeParse(rawEnv);

  if (!parsed.success) {
    const errorMessages = parsed.error.issues
      .map((issue) => `  - [${issue.path.join('.') || 'ROOT'}]: ${issue.message}`)
      .join('\n');

    const formattedError = `\n=========================================\n[FATAL] ENVIRONMENT CONFIGURATION ERROR:\n${errorMessages}\n=========================================\n`;

    if (rawEnv['NODE_ENV'] !== 'test') {
      console.error(formattedError);
    }

    throw new Error(formattedError);
  }

  return parsed.data;
}

// In non-test mode or when explicitly imported, validate default process.env
let config: EnvConfig;
try {
  config = validateEnv(process.env);
} catch (err) {
  if (process.env['NODE_ENV'] === 'test') {
    // Provide a valid fallback for test runner if .env is missing in isolated tests
    config = {
      NODE_ENV: 'test',
      API_PORT: 5000,
      CORS_ORIGIN: 'http://localhost:5173',
      DATABASE_URL: 'postgresql://postgres:change_me_local_only@localhost:5432/wallet_app_db',
      TEST_DATABASE_URL: 'postgresql://postgres:change_me_local_only@localhost:5432/wallet_test',
      LOG_LEVEL: 'error',
    };
  } else {
    throw err;
  }
}

export const env = config;
