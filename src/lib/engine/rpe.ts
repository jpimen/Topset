import { ALL_OUT_PERCENT_BY_REPS, MAX_RPE, MIN_RPE } from './constants';
import { assertInteger, assertPositive, CalculationError, type Unit } from './shared';
import { roundLoad } from './units';
function validateRpe(rpe: number): void {
  if (!Number.isFinite(rpe) || rpe < MIN_RPE || rpe > MAX_RPE || Math.round(rpe * 2) !== rpe * 2) throw new CalculationError('invalid_input', `RPE must be between ${MIN_RPE} and ${MAX_RPE} in half-point steps.`);
}
// Widely used approximation of the Tuchscherer/RTS RPE chart: estimate RIR, add it to reps,
// then interpolate the all-out reps table. This is not an exact copy of a full RTS chart.
// Chart values are the common RTS values published by Barbell Medicine, Powerbuilding I appendix (2024).
export function percentFromRepsAndRpe(reps: number, rpe: number): number {
  assertInteger(reps, 'reps'); validateRpe(rpe);
  const effectiveReps = reps + (10 - rpe);
  const low = Math.floor(effectiveReps); const high = Math.ceil(effectiveReps);
  const lower = ALL_OUT_PERCENT_BY_REPS[low]; const upper = ALL_OUT_PERCENT_BY_REPS[high];
  if (lower === undefined || upper === undefined) throw new CalculationError('out_of_range', 'This reps and RPE combination is outside the verified 1–10 rep table.');
  return (lower + (upper - lower) * (effectiveReps - low)) / 100;
}
export function loadFromE1rm(e1rmKg: number, reps: number, rpe: number, unit: Unit = 'kg', increment?: number): { percent: number; load: number } {
  assertPositive(e1rmKg, 'e1RM'); const percent = percentFromRepsAndRpe(reps, rpe);
  return { percent, load: roundLoad(e1rmKg * percent, unit, 'down', increment) };
}
export function e1rmFromSet(loadKg: number, reps: number, rpe: number): number { assertPositive(loadKg, 'load'); return loadKg / percentFromRepsAndRpe(reps, rpe); }
export function rpeFromLoad(loadKg: number, reps: number, e1rmKg: number): number {
  assertPositive(loadKg, 'load'); assertPositive(e1rmKg, 'e1RM'); assertInteger(reps, 'reps');
  const target = loadKg / e1rmKg;
  let bestRpe = MIN_RPE; let bestDiff = Infinity;
  for (let step = MIN_RPE * 2; step <= MAX_RPE * 2; step += 1) {
    const candidate = step / 2;
    try { const diff = Math.abs(percentFromRepsAndRpe(reps, candidate) - target); if (diff < bestDiff) { bestDiff = diff; bestRpe = candidate; } }
    catch { /* some low RPE combinations exceed verified table range */ }
  }
  if (!Number.isFinite(bestDiff)) throw new CalculationError('out_of_range', 'This rep count is outside the verified 1–10 rep table.');
  return bestRpe;
}
