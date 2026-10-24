import { describe, it, expect } from 'vitest';
import { canonicalStringify } from '@wallet-app/shared';
import { computePayloadHash } from '../../src/modules/transfers/transfers.service.js';

describe('Financial Domain Logic - Unit Tests (Canonical Idempotency Fingerprint)', () => {
  it('should produce identical JSON string and SHA256 hash regardless of object key insertion order', () => {
    const payloadA = {
      target_wallet_number: 'WAL-12345678',
      amount: 150000,
      note: 'Payment for services',
    };

    const payloadB = {
      note: 'Payment for services',
      amount: 150000,
      target_wallet_number: 'WAL-12345678',
    };

    const jsonA = canonicalStringify(payloadA);
    const jsonB = canonicalStringify(payloadB);
    expect(jsonA).toBe(jsonB);

    const hashA = computePayloadHash(payloadA);
    const hashB = computePayloadHash(payloadB);
    expect(hashA).toBe(hashB);
  });

  it('should produce different hashes for different payloads', () => {
    const hashA = computePayloadHash({ amount: 100000, target: 'WAL-1' });
    const hashB = computePayloadHash({ amount: 100001, target: 'WAL-1' });
    expect(hashA).not.toBe(hashB);
  });
});
