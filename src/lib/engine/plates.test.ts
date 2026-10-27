import { describe, expect, it } from 'vitest';
import { calculatePlates } from './plates';
describe('plates', () => {
  it('calculates per-side plates and exact targets with greedy largest-first loading', () => { const result = calculatePlates({ target: 142.5, bar: 20, unit: 'kg' }); expect(result.platesPerSide).toEqual([25, 25, 5, 2.5, 1.25]); expect(result.achievedLoad).toBe(142.5); expect(result.reachable).toBe(true); });
  it('handles bar-only, below-bar and impossible loads', () => { expect(calculatePlates({ target: 25, bar: 20, unit: 'kg' }).platesPerSide).toEqual([]); expect(calculatePlates({ target: 20, bar: 20, unit: 'kg', collarPerSide: 0 }).platesPerSide).toEqual([]); expect(calculatePlates({ target: 10, bar: 20, unit: 'kg' }).difference).toBe(-15); expect(calculatePlates({ target: 101, bar: 20, unit: 'kg', availablePlates: [10] }).reachable).toBe(false); });
});
