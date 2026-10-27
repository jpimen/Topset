import { describe, expect, it } from 'vitest';
import { banisterModel, sessionTrainingLoad } from './fatigue';
describe('fatigue model', () => {
  it('is deterministic for supplied dates and loads', () => { const result = banisterModel([{ date: 'd1', load: 10 }, { date: 'd2', load: 0 }]); expect(result).toHaveLength(2); expect(result[0].fitness).toBe(10); expect(result[0].fatigue).toBe(20); expect(result[1].date).toBe('d2'); });
  it('calculates documented replaceable session load', () => { expect(sessionTrainingLoad([{ loadKg: 100, reps: 5, e1rmKg: 200 }])).toBe(1.25); expect(() => banisterModel([], { k1: 1, k2: 1, tau1Days: 0, tau2Days: 10, baseline: 0 })).toThrow(); });
});
