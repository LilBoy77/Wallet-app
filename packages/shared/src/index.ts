/**
 * Single Source of Truth for shared types, DTOs, and schemas.
 */

export const SHARED_APP_NAME = 'Wallet App';
export const SHARED_API_VERSION = 'v1';

export interface HealthCheckPayload {
  status: 'ok' | 'degraded';
  timestamp: string;
  service: string;
  version: string;
  database?: {
    status: 'connected' | 'disconnected';
    latencyMs?: number;
  };
}

export * from './auth.js';
export * from './finance.js';
