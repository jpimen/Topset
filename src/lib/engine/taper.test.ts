import { describe, expect, it } from 'vitest';
import { selectAttempts, taperVolumeMultiplier } from './taper';
describe('taper and attempts', () => {
  it('reduces volume progressively with configurable window and leaves intensity to caller', () => { expect(taperVolumeMultiplier(10)).toBe(1); expect(taperVolumeMultiplier(0)).toBe(.5); expect(taperVolumeMultiplier(5)).toBe(.75); });
  it('selects rounded increasing attempts', () => { expect(selectAttempts(200)).toEqual({ opener: 182.5, second: 192.5, third: 200, total: 575 }); expect(() => selectAttempts(200, 'kg', undefined, { opener: .97, second: .95, third: 1 })).toThrow(); });
});
