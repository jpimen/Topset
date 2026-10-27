import { describe, expect, it } from 'vitest';
import { estimateE1rm, loadForRepMax } from './e1rm';
describe('e1rm', () => {
  it('matches formula known values and returns lifted weight at one rep', () => { expect(estimateE1rm(140, 1).e1rmKg).toBe(140); expect(estimateE1rm(140, 5).e1rmKg).toBeCloseTo(163.333); expect(estimateE1rm(140, 5, 'brzycki').e1rmKg).toBe(157.5); });
  it('reverses a formula and flags low confidence above ten reps', () => { expect(loadForRepMax(estimateE1rm(140, 5).e1rmKg, 5).e1rmKg).toBeCloseTo(140); expect(estimateE1rm(100, 11).lowConfidence).toBe(true); expect(() => estimateE1rm(100, 13)).toThrow(); expect(() => estimateE1rm(100, 0)).toThrow(); });
});
