import { finite } from './shared';

export interface MinusPercentageResult {
  percentageAmount: number;
  adjustedResult: number;
}

export function calculateMinusPercentage(base: number, percentage: number): MinusPercentageResult {
  if (!Number.isFinite(base) || !Number.isFinite(percentage)) {
    throw new RangeError('Base number and percentage must be finite numbers.');
  }
  const percentageAmount = finite(base * (percentage / 100), 'percentage amount');
  const adjustedResult = finite(base + percentageAmount, 'adjusted result');
  return { percentageAmount, adjustedResult };
}
