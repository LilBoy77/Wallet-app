import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from root .env or app .env
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config();

export const envSchema = z
  .object({
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
    BODY_SIZE_LIMIT: z.string().default('1mb'),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000), // 15 mins
    RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),
    TRUST_PROXY: z
      .preprocess(
        (val) => {
          if (typeof val === 'string') {
            const lower = val.trim().toLowerCase();
            if (lower === 'true') return true;
            if (lower === 'false') return false;
            const num = Number(val);
            if (!isNaN(num)) return num;
          }
          return val;
        },
        z.union([z.boolean(), z.number().int().nonnegative()])
      )
      .default(false),
    SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10000), // 10s
    PAGINATION_MAX_LIMIT: z.coerce.number().int().positive().default(100),

    // Phase 4: Authentication & Security Configuration
    JWT_ACCESS_SECRET: z
      .string()
      .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters')
      .default('dev_insecure_jwt_access_secret_key_32_chars_minimum_wallet_app'),
    JWT_REFRESH_SECRET: z
      .string()
      .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters')
      .default('dev_insecure_jwt_refresh_secret_key_32_chars_minimum_wallet_app'),
    JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
    JWT_ISSUER: z.string().default('wallet-app-api'),
    JWT_AUDIENCE: z.string().default('wallet-app-client'),
    APP_BASE_URL: z
      .string()
      .url('APP_BASE_URL must be a valid URL')
      .default('http://localhost:5173'),
    PASSWORD_RESET_EXPIRES_MINUTES: z.coerce.number().int().positive().default(15),
    ARGON2_MEMORY_COST: z.coerce.number().int().positive().default(65536),
    ARGON2_TIME_COST: z.coerce.number().int().positive().default(3),
    ARGON2_PARALLELISM: z.coerce.number().int().positive().default(4),
    MAIL_TRANSPORT: z.enum(['outbox', 'smtp']).default('outbox'),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),

    // Phase 5: Core Financial & Transfer Configuration
    TRANSFER_MAX_AMOUNT_PER_TX: z.coerce.number().int().positive().default(50_000_000), // Max Rp 50.000.000 per transfer
    ENABLE_TOPUP_SIMULATION: z
      .preprocess((val) => {
        if (typeof val === 'string') {
          const lower = val.trim().toLowerCase();
          if (lower === 'true' || lower === '1') return true;
          if (lower === 'false' || lower === '0') return false;
        }
        return val;
      }, z.boolean())
      .default(false),
    TOPUP_MAX_AMOUNT_PER_TX: z.coerce.number().int().positive().default(50_000_000), // Max Rp 50.000.000 per topup
    INCOME_MAX_AMOUNT_PER_TX: z.coerce.number().int().positive().default(50_000_000), // Max Rp 50.000.000 per income
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production') {
      const placeholders = [
        'change_me',
        'secret',
        'placeholder',
        'default',
        'your-super-secret',
        'insecure',
        'dev_insecure',
      ];

      for (const p of placeholders) {
        if (data.JWT_ACCESS_SECRET.toLowerCase().includes(p)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['JWT_ACCESS_SECRET'],
            message: 'In production, JWT_ACCESS_SECRET must not use default or placeholder values',
          });
          break;
        }
      }

      for (const p of placeholders) {
        if (data.JWT_REFRESH_SECRET.toLowerCase().includes(p)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['JWT_REFRESH_SECRET'],
            message: 'In production, JWT_REFRESH_SECRET must not use default or placeholder values',
          });
          break;
        }
      }

      if (data.MAIL_TRANSPORT === 'outbox') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['MAIL_TRANSPORT'],
          message:
            "MAIL_TRANSPORT cannot be 'outbox' in production. Valid SMTP configuration is required.",
        });
      }

      if (data.MAIL_TRANSPORT === 'smtp' && !data.SMTP_HOST) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SMTP_HOST'],
          message: "SMTP_HOST is required when MAIL_TRANSPORT is 'smtp'",
        });
      }

      if (data.ENABLE_TOPUP_SIMULATION) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ENABLE_TOPUP_SIMULATION'],
          message: 'ENABLE_TOPUP_SIMULATION must be disabled (false) in production',
        });
      }
    }
  });

export type EnvConfig = z.infer<typeof envSchema>;

export function getCorsAllowedOrigins(originString: string): string[] {
  return originString
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

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
      BODY_SIZE_LIMIT: '1mb',
      RATE_LIMIT_WINDOW_MS: 900000,
      RATE_LIMIT_MAX_REQUESTS: 100,
      TRUST_PROXY: false,
      SHUTDOWN_TIMEOUT_MS: 10000,
      PAGINATION_MAX_LIMIT: 100,
      JWT_ACCESS_SECRET: 'test_jwt_access_secret_key_32_chars_minimum_wallet_app',
      JWT_REFRESH_SECRET: 'test_jwt_refresh_secret_key_32_chars_minimum_wallet_app',
      JWT_ACCESS_EXPIRES_IN: '15m',
      JWT_REFRESH_EXPIRES_IN: '7d',
      JWT_ISSUER: 'wallet-app-api',
      JWT_AUDIENCE: 'wallet-app-client',
      APP_BASE_URL: 'http://localhost:5173',
      PASSWORD_RESET_EXPIRES_MINUTES: 15,
      ARGON2_MEMORY_COST: 65536,
      ARGON2_TIME_COST: 3,
      ARGON2_PARALLELISM: 4,
      MAIL_TRANSPORT: 'outbox',
      TRANSFER_MAX_AMOUNT_PER_TX: 50_000_000,
      ENABLE_TOPUP_SIMULATION: true,
      TOPUP_MAX_AMOUNT_PER_TX: 50_000_000,
      INCOME_MAX_AMOUNT_PER_TX: 50_000_000,
    };
  } else {
    throw err;
  }
}

export const env = config;
