import { describe, it, expect } from 'vitest';
import {
  canTransitionTransaction,
  canTransitionTransfer,
  type TransactionStatus,
} from '@wallet-app/shared';

describe('Financial Domain Logic - Unit Tests (State Machine Transitions)', () => {
  it('transaction state machine allows COMPLETED to VOIDED and rejects illegal transitions', () => {
    // Valid transition: COMPLETED -> VOIDED
    expect(canTransitionTransaction('COMPLETED', 'VOIDED')).toBe(true);

    // Invalid: VOIDED is terminal, cannot transition back to COMPLETED
    expect(canTransitionTransaction('VOIDED', 'COMPLETED')).toBe(false);

    // Invalid: Same state
    expect(canTransitionTransaction('COMPLETED', 'COMPLETED')).toBe(false);
    expect(canTransitionTransaction('VOIDED', 'VOIDED')).toBe(false);

    // Invalid: Unknown state
    expect(canTransitionTransaction('UNKNOWN' as TransactionStatus, 'COMPLETED')).toBe(false);
  });

  it('transfer state machine allows valid transitions and rejects invalid or backwards transitions', () => {
    // Valid transitions
    expect(canTransitionTransfer('pending', 'completed')).toBe(true);
    expect(canTransitionTransfer('pending', 'failed')).toBe(true);
    expect(canTransitionTransfer('completed', 'reversed')).toBe(true);

    // Invalid: failed is terminal
    expect(canTransitionTransfer('failed', 'completed')).toBe(false);
    expect(canTransitionTransfer('failed', 'reversed')).toBe(false);

    // Invalid: reversed is terminal
    expect(canTransitionTransfer('reversed', 'completed')).toBe(false);

    // Invalid: backwards completed -> pending
    expect(canTransitionTransfer('completed', 'pending')).toBe(false);

    // Invalid: same state
    expect(canTransitionTransfer('completed', 'completed')).toBe(false);
    expect(canTransitionTransfer('failed', 'failed')).toBe(false);
  });
});
