import { DEFAULT_BAR_KG, DEFAULT_BAR_LB, DEFAULT_WARMUP_SCHEME } from './constants';
import { assertPositive, type Unit } from './shared';
import { roundLoad } from './units';
export interface WarmupStep { fraction: number; reps: number; }
export interface WarmupSet { load: number; reps: number; }
export type WarmupMethod = 'standard' | 'even-jumps';

export interface WarmupPlanOptions {
  method: WarmupMethod;
  barWeight: number;
  increment: number;
}

/** Create warm-up loads rounded to the lifter's available total-load increment. */
export function generateWarmupPlan(topSet: number, unit: Unit, options: WarmupPlanOptions): WarmupSet[] {
  assertPositive(topSet, 'top set');
  assertPositive(options.barWeight, 'bar weight');
  assertPositive(options.increment, 'smallest change');
  if (options.method !== 'standard' && options.method !== 'even-jumps') throw new RangeError('Choose a warm-up method.');
  if (topSet <= options.barWeight) throw new RangeError('Top set must be heavier than the barbell.');

  const proposed = options.method === 'standard'
    ? [{ load: options.barWeight, reps: 8 }, { load: topSet * 0.5, reps: 5 }, { load: topSet * 0.7, reps: 3 }, { load: topSet * 0.9, reps: 1 }]
    : (() => {
      const jumpSize = (topSet - options.barWeight) / 4;
      return [8, 5, 3, 1].map((reps, index) => ({ load: options.barWeight + jumpSize * (index + 1), reps }));
    })();

  const steps = proposed.map((step) => ({ load: roundLoad(step.load, unit, 'nearest', options.increment), reps: step.reps }));
  let lastLoad = 0;
  return steps.filter((step) => {
    if (step.load <= lastLoad || step.load > topSet) return false;
    lastLoad = step.load;
    return true;
  });
}

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
