import { z } from 'zod';

export const programLayoutColumns = [
  { id: 'exercise', label: 'Exercise', width: 180, minWidth: 140, maxWidth: 360 },
  { id: 'set_type', label: 'Set type', width: 95, minWidth: 70, maxWidth: 220 },
  { id: 'sets', label: 'Sets', width: 60, minWidth: 50, maxWidth: 140 },
  { id: 'reps', label: 'Reps', width: 75, minWidth: 55, maxWidth: 160 },
  { id: 'rpe', label: 'RPE', width: 75, minWidth: 55, maxWidth: 160 },
  { id: 'load', label: 'Load', width: 175, minWidth: 100, maxWidth: 340 },
  { id: 'coach_notes', label: 'Coach notes', width: 150, minWidth: 100, maxWidth: 380 },
  { id: 'athlete_load', label: 'Load lifted', width: 100, minWidth: 85, maxWidth: 300 },
  { id: 'athlete_rpe', label: 'RPE lifted', width: 100, minWidth: 75, maxWidth: 260 },
  { id: 'athlete_notes', label: 'Athlete notes', width: 120, minWidth: 90, maxWidth: 380 },
  { id: 'athlete_total', label: 'Total lifted', width: 100, minWidth: 85, maxWidth: 300 },
] as const;

export type ProgramLayoutColumn = typeof programLayoutColumns[number]['id'];

export const defaultProgramLayout = {
  columns: Object.fromEntries(programLayoutColumns.map(({ id, width }) => [id, width])) as Record<ProgramLayoutColumn, number>,
  rowHeight: 48,
};

export const programLayoutSchema = z.object({
  columns: z.object(Object.fromEntries(programLayoutColumns.map(({ id, minWidth, maxWidth }) => [id, z.number().int().min(minWidth).max(maxWidth)])) as Record<ProgramLayoutColumn, z.ZodNumber>),
  rowHeight: z.number().int().min(40).max(88),
}).default(defaultProgramLayout);

export type ProgramLayout = z.infer<typeof programLayoutSchema>;

export function normalizeProgramLayout(value: unknown): ProgramLayout {
  const parsed = programLayoutSchema.safeParse(value);
  return parsed.success ? parsed.data : defaultProgramLayout;
}
