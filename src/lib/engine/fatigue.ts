import { BANISTER_DEFAULTS } from './constants';
import { assertPositive } from './shared';
export interface BanisterParameters { k1: number; k2: number; tau1Days: number; tau2Days: number; baseline: number; }
export interface DailyLoad { date: string; load: number; }
export interface BanisterDay { date: string; fitness: number; fatigue: number; form: number; }
export function banisterModel(days: readonly DailyLoad[], parameters: BanisterParameters = BANISTER_DEFAULTS): BanisterDay[] {
  if (![parameters.k1, parameters.k2, parameters.tau1Days, parameters.tau2Days, parameters.baseline].every(Number.isFinite) || parameters.tau1Days <= 0 || parameters.tau2Days <= 0) throw new RangeError('Banister parameters must be finite and time constants positive.');
  // Banister et al. (1975), A systems model of training for athletic performance; tau defaults are editable population estimates, not individually fitted.
  let fitness = 0; let fatigue = 0;
  return days.map(({ date, load }) => { assertPositive(load, 'training load', true); fitness = fitness * Math.exp(-1 / parameters.tau1Days) + parameters.k1 * load; fatigue = fatigue * Math.exp(-1 / parameters.tau2Days) + parameters.k2 * load; return { date, fitness, fatigue, form: parameters.baseline + fitness - fatigue }; });
}
export function sessionTrainingLoad(sets: readonly { loadKg: number; reps: number; e1rmKg: number }[]): number {
  // Replaceable engineering proxy: sum reps × relative intensity squared (inspired by Banister TRIMP weighting).
  return sets.reduce((sum, set) => { assertPositive(set.loadKg, 'load'); assertPositive(set.e1rmKg, 'e1RM'); if (!Number.isInteger(set.reps) || set.reps < 1) throw new RangeError('reps must be a positive integer.'); const intensity = set.loadKg / set.e1rmKg; return sum + set.reps * intensity ** 2; }, 0);
}
