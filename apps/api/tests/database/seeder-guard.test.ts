import { describe, it, expect } from 'vitest';
import { assertEnvironmentSafety } from '../../src/database/seeder.js';
import { assertTestDatabaseIsolation } from './test-db-helper.js';

describe('Database Safety Guards (Seeder & Test Isolation)', () => {
  it('should reject seeder/reset if NODE_ENV is production', () => {
    expect(() => {
      assertEnvironmentSafety(
        'postgresql://postgres:pass@localhost:5432/wallet_test',
        'production'
      );
    }).toThrow(/\[GUARD_REJECTED\].*production/);
  });

  it('should reject seeder/reset if host is not a local host', () => {
    // AWS RDS host
    expect(() => {
      assertEnvironmentSafety(
        'postgresql://postgres:pass@prod-db.us-east-1.rds.amazonaws.com:5432/wallet_prod',
        'development'
      );
    }).toThrow(/\[GUARD_REJECTED\].*non-local host/);

    // GCP Cloud SQL host
    expect(() => {
      assertEnvironmentSafety(
        'postgresql://postgres:pass@192.168.1.100:5432/wallet_prod',
        'development'
      );
    }).toThrow(/\[GUARD_REJECTED\].*non-local host/);
  });

  it('should allow seeder/reset on valid local development hosts', () => {
    expect(() => {
      assertEnvironmentSafety(
        'postgresql://postgres:pass@localhost:5432/wallet_app_db',
        'development'
      );
    }).not.toThrow();

    expect(() => {
      assertEnvironmentSafety(
        'postgresql://postgres:pass@127.0.0.1:5432/wallet_app_db',
        'development'
      );
    }).not.toThrow();

    expect(() => {
      assertEnvironmentSafety(
        'postgresql://postgres:pass@postgres:5432/wallet_app_db',
        'development'
      );
    }).not.toThrow();
  });

  it('should reject test execution if TEST_DATABASE_URL points to the development database', () => {
    const devUrl = 'postgresql://postgres:pass@localhost:5432/wallet_app_db';
    const sameUrlAsDev = 'postgresql://postgres:pass@localhost:5432/wallet_app_db';

    expect(() => {
      assertTestDatabaseIsolation(sameUrlAsDev, devUrl);
    }).toThrow(/\[TEST_GUARD_REJECTED\].*development database/);
  });

  it('should allow test execution when TEST_DATABASE_URL is isolated from dev database', () => {
    const devUrl = 'postgresql://postgres:pass@localhost:5432/wallet_app_db';
    const testUrl = 'postgresql://postgres:pass@localhost:5432/wallet_test';

    expect(() => {
      assertTestDatabaseIsolation(testUrl, devUrl);
    }).not.toThrow();
  });
});
