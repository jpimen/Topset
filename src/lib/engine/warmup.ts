import { DEFAULT_BAR_KG, DEFAULT_BAR_LB, DEFAULT_WARMUP_SCHEME } from './constants';
import { assertPositive, type Unit } from './shared';
import { roundLoad } from './units';
export interface WarmupStep { fraction: number; reps: number; }
export interface WarmupSet { load: number; reps: number; }
export function generateWarmups(topSet: number, unit: Unit = 'kg', increment?: number, scheme: readonly WarmupStep[] = DEFAULT_WARMUP_SCHEME, barWeight = unit === 'kg' ? DEFAULT_BAR_KG : DEFAULT_BAR_LB): WarmupSet[] {
  assertPositive(topSet, 'top set');
  assertPositive(barWeight, 'bar weight');
  if (topSet < barWeight) return [];
  const steps = scheme.map((step) => { if (!Number.isFinite(step.fraction) || step.fraction < 0 || step.fraction > 1 || !Number.isInteger(step.reps) || step.reps < 1) throw new RangeError('Warm-up fractions must be 0–1 and reps positive integers.'); const proposed = step.fraction === 0 ? barWeight : roundLoad(topSet * step.fraction, unit, 'down', increment); return { load: proposed, reps: step.reps }; });
  let lastLoad = 0;
  const usable = steps.filter((step) => {
    if (step.load <= lastLoad || step.load >= topSet) return false;
    lastLoad = step.load;
    return true;
  });
  return usable;
}
