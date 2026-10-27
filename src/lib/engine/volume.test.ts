import { describe, expect, it } from 'vitest';
import { aggregateByDay, aggregateByWeek, summarizeVolume } from './volume';
describe('volume', () => {
  it('summarizes tonnage, hard sets, average intensity and INOL', () => { const result = summarizeVolume([{ loadKg: 90, reps: 5, rpe: 8 }, { loadKg: 80, reps: 5, rpe: 6 }], 100); expect(result.tonnageKg).toBe(850); expect(result.hardSets).toBe(1); expect(result.averagePercent1rm).toBe(85); expect(result.inol).toBeCloseTo(0.75); });
  it('aggregates date and week keys and guards 100% intensity', () => { expect(aggregateByDay({ monday: [{ loadKg: 50, reps: 5 }] }, 100).monday.tonnageKg).toBe(250); expect(aggregateByWeek({ week1: [] }, 100).week1.inol).toBe(0); expect(() => summarizeVolume([{ loadKg: 100, reps: 1 }], 100)).toThrow(); });
});
