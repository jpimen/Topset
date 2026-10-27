import { describe, expect, it } from 'vitest';
import { e1rmFromSet, loadFromE1rm, percentFromRepsAndRpe, rpeFromLoad } from './rpe';
describe('rpe approximation', () => {
  it('matches sanity values and RIR equivalence', () => { expect(percentFromRepsAndRpe(1, 10)).toBe(1); expect(percentFromRepsAndRpe(3, 10)).toBeCloseTo(.922); expect(percentFromRepsAndRpe(5, 10)).toBeCloseTo(.863); expect(percentFromRepsAndRpe(3, 8)).toBeCloseTo(.863); });
  it('supports half RPE, load conversion and set round trips', () => { expect(percentFromRepsAndRpe(1, 9.5)).toBeCloseTo(.978); const est = e1rmFromSet(150, 3, 8); expect(est).toBeCloseTo(150 / .863); expect(loadFromE1rm(est, 3, 8).load).toBe(150); expect(rpeFromLoad(150, 3, est)).toBe(8); });
  it('rejects invalid or unverified table-range inputs', () => { expect(percentFromRepsAndRpe(1, 5)).toBeCloseTo(.837); expect(() => percentFromRepsAndRpe(12, 10)).toThrow(); expect(() => rpeFromLoad(100, 12, 150)).toThrow(); expect(() => percentFromRepsAndRpe(3, 4)).toThrow(); });
});
