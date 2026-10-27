import { describe, expect, it } from 'vitest';
import { kgToLb, lbToKg, roundLoad, roundToIncrement } from './units';
describe('units', () => {
  it('converts kg and lb with the documented factor', () => { expect(kgToLb(1)).toBeCloseTo(2.20462262); expect(lbToKg(2.20462262)).toBeCloseTo(1); });
  it('rounds nearest/down/up and preserves downward bounds', () => { expect(roundToIncrement(142.5, 2.5)).toBe(142.5); expect(roundLoad(143.9, 'kg', 'down')).toBe(142.5); expect(roundToIncrement(6, 5, 'up')).toBe(10); });
  it('rejects invalid values', () => { expect(() => kgToLb(-1)).toThrow(); expect(() => roundToIncrement(4, 0)).toThrow(); });
});
