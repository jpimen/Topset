import { HARD_SET_RPE } from './constants';
import { assertInteger, assertPositive, CalculationError } from './shared';
export interface TrainingSet { loadKg: number; reps: number; rpe?: number; }
export interface VolumeSummary { tonnageKg: number; hardSets: number; averagePercent1rm: number; inol: number; }
export function summarizeVolume(sets: readonly TrainingSet[], e1rmKg: number, hardSetRpe = HARD_SET_RPE): VolumeSummary {
  assertPositive(e1rmKg, 'e1RM'); if (!Number.isFinite(hardSetRpe) || hardSetRpe < 0 || hardSetRpe > 10) throw new RangeError('hardSetRpe must be 0–10.');
  let tonnageKg = 0; let hardSets = 0; let percentTotal = 0; let inol = 0;
  for (const set of sets) {
    assertPositive(set.loadKg, 'set load'); assertInteger(set.reps, 'set reps');
    if (set.rpe !== undefined && (!Number.isFinite(set.rpe) || set.rpe < 0 || set.rpe > 10)) throw new RangeError('RPE must be 0–10.');
    const percent = set.loadKg / e1rmKg * 100; if (percent >= 100) throw new CalculationError('out_of_range', 'INOL requires every set to be below 100% of e1RM.');
    tonnageKg += set.loadKg * set.reps; percentTotal += percent; inol += set.reps / (100 - percent);
    if ((set.rpe ?? 0) >= hardSetRpe) hardSets += 1;
  }
  return { tonnageKg, hardSets, averagePercent1rm: sets.length === 0 ? 0 : percentTotal / sets.length, inol };
}
export function aggregateByDay(days: Readonly<Record<string, readonly TrainingSet[]>>, e1rmKg: number) { return Object.fromEntries(Object.entries(days).map(([day, sets]) => [day, summarizeVolume(sets, e1rmKg)])); }
export function aggregateByWeek(weeks: Readonly<Record<string, readonly TrainingSet[]>>, e1rmKg: number) { return Object.fromEntries(Object.entries(weeks).map(([week, sets]) => [week, summarizeVolume(sets, e1rmKg)])); }
