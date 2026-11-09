import { describe, expect, it } from 'vitest';
import { calculateMinusPercentage } from './percentage';

describe('calculateMinusPercentage', () => {
  it('returns the signed percentage amount and adjusted base', () => {
    expect(calculateMinusPercentage(160, -12)).toEqual({ percentageAmount: -19.2, adjustedResult: 140.8 });
  });

  it('supports decimal and negative base values', () => {
    expect(calculateMinusPercentage(-80.5, 10)).toEqual({ percentageAmount: -8.05, adjustedResult: -88.55 });
    expect(calculateMinusPercentage(12.5, -0.4)).toEqual({ percentageAmount: -0.05, adjustedResult: 12.45 });
  });

  it('rejects non-finite inputs and results', () => {
    expect(() => calculateMinusPercentage(Number.NaN, 10)).toThrow('finite numbers');
    expect(() => calculateMinusPercentage(10, Number.POSITIVE_INFINITY)).toThrow('finite numbers');
    expect(() => calculateMinusPercentage(Number.MAX_VALUE, 200)).toThrow('percentage amount');
  });
});
