export type Unit = 'kg' | 'lb';
export type Sex = 'male' | 'female';
export class CalculationError extends RangeError {
  constructor(public readonly code: 'invalid_input' | 'out_of_range', message: string) { super(message); this.name = 'CalculationError'; }
}
export function assertPositive(value: number, name: string, allowZero = false): void {
  if (!Number.isFinite(value) || (allowZero ? value < 0 : value <= 0)) throw new CalculationError('invalid_input', `${name} must be a finite ${allowZero ? 'non-negative' : 'positive'} number.`);
}
export function assertInteger(value: number, name: string, min = 1): void {
  if (!Number.isInteger(value) || value < min) throw new CalculationError('invalid_input', `${name} must be an integer of at least ${min}.`);
}
export function finite(value: number, name = 'result'): number {
  if (!Number.isFinite(value)) throw new CalculationError('out_of_range', `${name} is outside the supported numeric range.`);
  return value;
}
