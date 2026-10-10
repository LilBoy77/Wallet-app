/**
 * Placeholder constants to verify monorepo wiring and typecheck between @wallet-app/shared,
 * @wallet-app/api, and @wallet-app/web.
 *
 * NOTE: These placeholders are temporary for Phase 1 verification and will be replaced
 * with domain entities, types, and Zod schemas in subsequent phases.
 */

export const SHARED_APP_NAME = 'Wallet App';
export const SHARED_API_VERSION = 'v1';

export interface HealthCheckPayload {
  status: 'ok' | 'degraded';
  timestamp: string;
  service: string;
  version: string;
}
