export const CALCULATOR_IDS = [
  'estimated-one-rep-max',
  'rpe-load',
  'plate-calculator',
  'warm-up-sets',
  'strength-scores',
  'minus-percentage',
] as const;

export type CalculatorId = typeof CALCULATOR_IDS[number];
export type CalculatorVisibility = Record<CalculatorId, boolean>;

export const CALCULATOR_LABELS: Record<CalculatorId, string> = {
  'estimated-one-rep-max': 'Estimated one-rep max',
  'rpe-load': 'RPE load',
  'plate-calculator': 'Plate calculator',
  'warm-up-sets': 'Warm-up sets',
  'strength-scores': 'Strength scores',
  'minus-percentage': 'Minus percentage',
};

export const DEFAULT_CALCULATOR_VISIBILITY: CalculatorVisibility = {
  'estimated-one-rep-max': true,
  'rpe-load': true,
  'plate-calculator': true,
  'warm-up-sets': true,
  'strength-scores': true,
  'minus-percentage': true,
};

const STORAGE_PREFIX = 'topset:calculator-visibility:v1';
type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function calculatorPreferenceKey(userId: string): string {
  return `${STORAGE_PREFIX}:${userId}`;
}

export function readCalculatorVisibility(userId: string, storage?: PreferenceStorage | null): CalculatorVisibility {
  try {
    const source = storage ?? (typeof window === 'undefined' ? null : window.localStorage);
    const value: unknown = JSON.parse(source?.getItem(calculatorPreferenceKey(userId)) ?? 'null');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_CALCULATOR_VISIBILITY };
    const saved = value as Record<string, unknown>;
    return Object.fromEntries(CALCULATOR_IDS.map((id) => [id, typeof saved[id] === 'boolean' ? saved[id] : true])) as CalculatorVisibility;
  } catch {
    return { ...DEFAULT_CALCULATOR_VISIBILITY };
  }
}

export function storeCalculatorVisibility(userId: string, visibility: CalculatorVisibility, storage?: PreferenceStorage | null): void {
  try {
    const target = storage ?? (typeof window === 'undefined' ? null : window.localStorage);
    target?.setItem(calculatorPreferenceKey(userId), JSON.stringify(visibility));
  } catch {
    // The current selection remains usable for this page when storage is unavailable.
  }
}
