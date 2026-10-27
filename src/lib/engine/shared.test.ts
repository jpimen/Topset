import { describe, expect, it } from 'vitest';
import { assertInteger, assertPositive, CalculationError, finite } from './shared';
describe('shared validation', () => {
  it('validates positive numbers, integer reps, and finite outputs', () => { expect(() => assertPositive(1, 'load')).not.toThrow(); expect(() => assertPositive(0, 'load', true)).not.toThrow(); expect(() => assertInteger(1, 'reps')).not.toThrow(); expect(finite(2)).toBe(2); });
  it('throws typed errors for invalid inputs', () => { expect(() => assertPositive(Number.NaN, 'load')).toThrow(CalculationError); expect(() => assertInteger(1.5, 'reps')).toThrow(); expect(() => finite(Infinity)).toThrow(); });
});
