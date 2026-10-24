import { describe, it, expect } from 'vitest';
import {
  safeAddMoney,
  safeSubtractMoney,
  formatIdr,
  canonicalStringify,
  moneyAmountSchema,
} from '@wallet-app/shared';

describe('Financial Domain Logic - Unit Tests (Money Arithmetic & Precision)', () => {
  it('should safely add large numbers using BigInt without floating point errors', () => {
    // 0.1 + 0.2 floating point in JS: 0.30000000000000004
    // In our integer minor unit representation: 10 + 20 = 30
    const sum = safeAddMoney(10, 20);
    expect(sum).toBe(30n);

    // Large financial amounts
    const large1 = 900_000_000_000n; // 900 Miliar IDR
    const large2 = 50_000_000_000n; // 50 Miliar IDR
    expect(safeAddMoney(large1, large2)).toBe(950_000_000_000n);
  });

  it('should safely subtract money and throw if deduction exceeds balance (zero negative balance)', () => {
    const balance = 1_000_000n;
    const deduction = 400_000n;
    expect(safeSubtractMoney(balance, deduction)).toBe(600_000n);

    // Exact reduction to zero is allowed
    expect(safeSubtractMoney(100n, 100n)).toBe(0n);

    // Negative result is strictly forbidden and throws Error
    expect(() => safeSubtractMoney(100n, 101n)).toThrow(
      'Saldo tidak mencukupi untuk pengurangan ini'
    );
  });

  it('should throw if subtraction receives negative deduction value', () => {
    expect(() => safeSubtractMoney(100n, -50n)).toThrow('Nilai pengurangan tidak boleh negatif');
  });

  it('formatIdr formats numbers to Rupiah string', () => {
    const formatted = formatIdr(1500000);
    expect(formatted).toContain('1.500.000');
  });

  it('canonicalStringify produces deterministic, key-sorted JSON representation', () => {
    const objA = { z: 1, a: 2, m: { b: 3, a: 4 } };
    const objB = { a: 2, m: { a: 4, b: 3 }, z: 1 };

    const strA = canonicalStringify(objA);
    const strB = canonicalStringify(objB);

    expect(strA).toBe(strB);
    expect(strA).toBe('{"a":2,"m":{"a":4,"b":3},"z":1}');
  });

  it('moneyAmountSchema rejects invalid, float, zero, negative, or weird numerical inputs', () => {
    // Valid positive integers
    expect(moneyAmountSchema.safeParse(50000).success).toBe(true);
    expect(moneyAmountSchema.safeParse(1).success).toBe(true);

    // Float / decimal values
    const floatRes = moneyAmountSchema.safeParse(50000.55);
    expect(floatRes.success).toBe(false);

    // Zero
    const zeroRes = moneyAmountSchema.safeParse(0);
    expect(zeroRes.success).toBe(false);

    // Negative numbers
    const negRes = moneyAmountSchema.safeParse(-1000);
    expect(negRes.success).toBe(false);

    // -0 (negative zero)
    const negZeroRes = moneyAmountSchema.safeParse(-0);
    expect(negZeroRes.success).toBe(false);

    // NaN / Infinity
    expect(moneyAmountSchema.safeParse(NaN).success).toBe(false);
    expect(moneyAmountSchema.safeParse(Infinity).success).toBe(false);

    // Exceeding 1 Trillion max
    expect(moneyAmountSchema.safeParse(1_000_000_000_001).success).toBe(false);
  });
});
