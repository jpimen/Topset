import { describe, expect, it } from 'vitest';
import { generateWarmups } from './warmup';
describe('warmup', () => {
  it('creates increasing, rounded warmups below top set, starting with the empty bar', () => { const sets = generateWarmups(140); expect(sets.map(({ load }) => load)).toEqual([20, 55, 82.5, 105, 122.5]); expect(sets.every((set) => set.load < 140)).toBe(true); });
  it('works with light top sets and removes duplicate weights', () => { expect(generateWarmups(22.5)).toEqual([{ load: 20, reps: 8 }]); expect(generateWarmups(15)).toEqual([]); expect(generateWarmups(30, 'kg', 2.5, [{ fraction: .2, reps: 5 }, { fraction: .3, reps: 3 }])).toEqual([{ load: 5, reps: 5 }, { load: 7.5, reps: 3 }]); expect(generateWarmups(30, 'kg', 2.5, [{ fraction: .2, reps: 5 }, { fraction: .21, reps: 3 }])).toEqual([{ load: 5, reps: 5 }]); });
});
