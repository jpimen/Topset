import { DEFAULT_ROUNDING_KG, DEFAULT_ROUNDING_LB, KG_PER_LB, LB_PER_KG } from './constants';
import { assertPositive, type Unit } from './shared';

export type RoundingMode = 'nearest' | 'down' | 'up';
export function kgToLb(kg: number): number { assertPositive(kg, 'kg', true); return kg * LB_PER_KG; }
export function lbToKg(lb: number): number { assertPositive(lb, 'lb', true); return lb * KG_PER_LB; }
export function convertLoad(value: number, from: Unit, to: Unit): number {
  if ((from !== 'kg' && from !== 'lb') || (to !== 'kg' && to !== 'lb')) throw new RangeError('Unit must be kg or lb.');
  if (from === to) { assertPositive(value, 'load', true); return value; }
  return from === 'kg' ? kgToLb(value) : lbToKg(value);
}
export function roundToIncrement(value: number, increment: number, mode: RoundingMode = 'nearest'): number {
  assertPositive(value, 'value', true); assertPositive(increment, 'increment');
  const ratio = value / increment;
  const rounded = mode === 'down' ? Math.floor(ratio + Number.EPSILON) : mode === 'up' ? Math.ceil(ratio - Number.EPSILON) : Math.round(ratio);
  return rounded * increment;
}
export function roundLoad(value: number, unit: Unit, mode: RoundingMode = 'nearest', increment = unit === 'kg' ? DEFAULT_ROUNDING_KG : DEFAULT_ROUNDING_LB): number {
  return roundToIncrement(value, increment, mode);
}
