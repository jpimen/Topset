import { LOW_CONFIDENCE_REPS, MAX_E1RM_REPS } from './constants';
import { assertInteger, assertPositive, finite } from './shared';
export type E1rmFormula = 'epley' | 'brzycki';
export interface E1rmEstimate { e1rmKg: number; lowConfidence: boolean; }
export function estimateE1rm(loadKg: number, reps: number, formula: E1rmFormula = 'epley'): E1rmEstimate {
  assertPositive(loadKg, 'load'); assertInteger(reps, 'reps');
  if (formula !== 'epley' && formula !== 'brzycki') throw new RangeError('Formula must be epley or brzycki.');
  if (reps > MAX_E1RM_REPS) throw new RangeError(`reps must not exceed ${MAX_E1RM_REPS}.`);
  // Epley (1985), The Way to Strength; Brzycki (1993), Strength Testing—Predicting a One-Rep Max from Reps-to-Fatigue. A single returns the lifted load by definition.
  const e1rmKg = reps === 1 ? loadKg : formula === 'epley' ? loadKg * (1 + reps / 30) : loadKg * 36 / (37 - reps);
  return { e1rmKg: finite(e1rmKg), lowConfidence: reps > LOW_CONFIDENCE_REPS };
}
export function loadForRepMax(e1rmKg: number, reps: number, formula: E1rmFormula = 'epley'): E1rmEstimate {
  assertPositive(e1rmKg, 'e1RM'); assertInteger(reps, 'reps');
  if (formula !== 'epley' && formula !== 'brzycki') throw new RangeError('Formula must be epley or brzycki.');
  if (reps > MAX_E1RM_REPS) throw new RangeError(`reps must not exceed ${MAX_E1RM_REPS}.`);
  const loadKg = reps === 1 ? e1rmKg : formula === 'epley' ? e1rmKg / (1 + reps / 30) : e1rmKg * (37 - reps) / 36;
  return { e1rmKg: finite(loadKg, 'load'), lowConfidence: reps > LOW_CONFIDENCE_REPS };
}
