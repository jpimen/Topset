import type { AthletePrescription } from './types';

export function athleteExerciseName(row: AthletePrescription): string {
  return row.exercise.name.trim() || row.exercise_name?.trim() || '';
}

export function hasUsableExerciseName(row: AthletePrescription): boolean {
  return athleteExerciseName(row).length > 0;
}

export function isLoggablePrescription(row: AthletePrescription): boolean {
  if (!Number.isInteger(row.sets) || row.sets === null || row.sets < 1) return false;
  if (!row.reps.trim()) return false;
  const hasLoad = (row.load_mode === 'absolute' || row.load_mode === 'percent')
    && (row.load_min ?? row.load_value) !== null;
  return hasLoad || row.rpe !== null;
}

export function athleteLoadLabel(row: AthletePrescription, unit: string): string {
  const low = row.load_min ?? row.load_value;
  const high = row.load_max;
  if (row.load_mode === 'absolute') return low === null ? '—' : high !== null && high !== low ? `${low}–${high} ${unit}` : `${low} ${unit}`;
  if (row.load_mode === 'percent') return low === null ? '—' : high !== null && high !== low ? `${low}–${high}% of ${row.percent_of === 'tm' ? 'training max' : 'e1RM'}` : `${low}% of ${row.percent_of === 'tm' ? 'training max' : 'e1RM'}`;
  return '—';
}
