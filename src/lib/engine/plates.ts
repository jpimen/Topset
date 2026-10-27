import { BAR_WEIGHTS_KG, DEFAULT_BAR_KG, DEFAULT_BAR_LB, DEFAULT_COLLAR_KG_PER_SIDE, DEFAULT_PLATES_KG, DEFAULT_PLATES_LB } from './constants';
import { assertPositive, type Unit } from './shared';
import { convertLoad } from './units';
export interface PlateInput { target: number; bar: number; unit: Unit; collarPerSide?: number; availablePlates?: readonly number[]; }
export interface PlateResult { platesPerSide: number[]; achievedLoad: number; difference: number; reachable: boolean; }
export function calculatePlates(input: PlateInput): PlateResult {
  assertPositive(input.target, 'target', true); assertPositive(input.bar, 'bar'); const collar = input.collarPerSide ?? (input.unit === 'kg' ? DEFAULT_COLLAR_KG_PER_SIDE : DEFAULT_COLLAR_KG_PER_SIDE * 2.20462262);
  assertPositive(collar, 'collar', true);
  const plates = [...(input.availablePlates ?? (input.unit === 'kg' ? DEFAULT_PLATES_KG : DEFAULT_PLATES_LB))].sort((a, b) => b - a);
  if (plates.some((plate) => !Number.isFinite(plate) || plate <= 0)) throw new RangeError('Available plates must be positive finite weights.');
  const targetKg = convertLoad(input.target, input.unit, 'kg'); const barKg = convertLoad(input.bar, input.unit, 'kg'); const collarKg = convertLoad(collar, input.unit, 'kg');
  const kgPlates = plates.map((plate) => convertLoad(plate, input.unit, 'kg'));
  const desiredPerSide = Math.max(0, (targetKg - barKg - 2 * collarKg) / 2); let remainder = desiredPerSide; const selected: number[] = [];
  for (const plate of kgPlates) { while (remainder + 1e-9 >= plate) { selected.push(plate); remainder -= plate; } }
  const achievedKg = barKg + 2 * collarKg + 2 * selected.reduce((sum, plate) => sum + plate, 0);
  const achievedLoad = convertLoad(achievedKg, 'kg', input.unit);
  return { platesPerSide: selected.map((plate) => convertLoad(plate, 'kg', input.unit)), achievedLoad, difference: input.target - achievedLoad, reachable: Math.abs(targetKg - achievedKg) < 1e-7 };
}
export const DEFAULT_BAR = { kg: DEFAULT_BAR_KG, womenKg: BAR_WEIGHTS_KG.women, lb: DEFAULT_BAR_LB } as const;
