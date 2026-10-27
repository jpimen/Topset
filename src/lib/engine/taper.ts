import { ATTEMPT_DEFAULTS, TAPER_DEFAULTS } from './constants';
import { assertPositive, type Unit } from './shared';
import { roundLoad } from './units';
export interface TaperOptions { days?: number; totalReduction?: number; }
export function taperVolumeMultiplier(daysToMeet: number, options: TaperOptions = {}): number {
  const days = options.days ?? TAPER_DEFAULTS.days; const reduction = options.totalReduction ?? TAPER_DEFAULTS.totalReduction;
  if (!Number.isInteger(daysToMeet) || daysToMeet < 0 || !Number.isInteger(days) || days < 1 || !Number.isFinite(reduction) || reduction < 0 || reduction > 1) throw new RangeError('Taper days must be non-negative and reduction must be between 0 and 1.');
  // Bosquet et al. (2007), Effects of tapering on performance: meta-analysis; linearly reduce volume by the configured amount while retaining intensity.
  if (daysToMeet >= days) return 1;
  return 1 - reduction * (1 - daysToMeet / days);
}
export interface Attempts { opener: number; second: number; third: number; total: number; }
export interface AttemptRatios { opener: number; second: number; third: number; }
export function selectAttempts(projectedMax: number, unit: Unit = 'kg', increment?: number, ratios: AttemptRatios = ATTEMPT_DEFAULTS): Attempts {
  assertPositive(projectedMax, 'projected max');
  if (![ratios.opener, ratios.second, ratios.third].every(Number.isFinite) || !(ratios.opener > 0 && ratios.opener <= ratios.second && ratios.second <= ratios.third)) throw new RangeError('Attempt ratios must be finite, positive and increasing.');
  const opener = roundLoad(projectedMax * ratios.opener, unit, 'down', increment); const second = roundLoad(projectedMax * ratios.second, unit, 'down', increment); const third = roundLoad(projectedMax * ratios.third, unit, 'down', increment);
  return { opener, second, third, total: opener + second + third };
}
