import { z } from 'zod';
import type { Unit } from '../engine';

const exerciseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  category: z.enum(['main', 'variation', 'accessory']),
  movement: z.enum(['squat', 'bench', 'deadlift', 'other']),
  muscle_group: z.string().nullable().optional(),
  is_competition_lift: z.boolean().optional(),
});

const prescriptionRowSchema = z.object({
  id: z.string().uuid(),
  day_id: z.string().uuid(),
  exercise_id: z.string().uuid(),
  position: z.number().int(),
  set_type: z.enum(['top', 'backoff', 'working', 'warmup', 'amrap']).nullable(),
  sets: z.number().int().nullable(),
  reps: z.string(),
  rpe: z.number().nullable(),
  load_mode: z.enum(['absolute', 'percent', 'rpe', 'none']),
  load_value: z.number().nullable(),
  load_min: z.number().nullable(),
  load_max: z.number().nullable(),
  percent_of: z.enum(['e1rm', 'tm']).nullable().optional(),
  notes_coach: z.string().nullable(),
  superset_group: z.string().nullable().optional(),
  exercise: exerciseSchema,
});

const daySchema = z.object({
  id: z.string().uuid(),
  day_number: z.number().int(),
  name: z.string(),
  notes: z.string().nullable(),
  exercises: z.array(prescriptionRowSchema),
});

const weekSchema = z.object({
  id: z.string().uuid(),
  week_number: z.number().int(),
  name: z.string(),
  notes: z.string().nullable(),
  days: z.array(daySchema),
});

export const athleteProgramSchema = z.object({
  program: z.object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().nullable(),
    unit: z.enum(['kg', 'lb']),
    updated_at: z.string(),
  }),
  weeks: z.array(weekSchema),
});

export type AthleteProgram = z.infer<typeof athleteProgramSchema>;
export type AthleteWeek = AthleteProgram['weeks'][number];
export type AthleteDay = AthleteWeek['days'][number];
export type AthletePrescription = AthleteDay['exercises'][number];

export type ActiveAssignment = {
  id: string;
  program_id: string;
  start_date: string;
  sync_mode: 'live' | 'snapshot';
  program_snapshot: unknown;
};

export const loggedSetInputSchema = z.object({
  program_exercise_id: z.string().uuid(),
  set_number: z.number().int().min(1).max(100),
  load_lifted: z.number().min(0).max(10000).nullable(),
  rpe_lifted: z.number().min(1).max(10).multipleOf(0.5).nullable(),
  notes_athlete: z.string().max(2000).nullable(),
});

export const workoutDraftSchema = z.object({
  id: z.string().uuid(),
  assignment_id: z.string().uuid(),
  day_id: z.string().uuid(),
  session_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  completed: z.boolean(),
  sets: z.array(loggedSetInputSchema).max(1000),
});

export type LoggedSetInput = z.infer<typeof loggedSetInputSchema>;
export type WorkoutDraft = z.infer<typeof workoutDraftSchema>;
export type WorkoutSyncState = 'saved' | 'pending' | 'saving' | 'error';

export function isUnit(value: string): value is Unit {
  return value === 'kg' || value === 'lb';
}
