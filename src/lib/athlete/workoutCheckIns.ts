import { z } from 'zod';
import { supabase } from '../supabase';

const workoutCheckInBaseSchema = z.object({
  athlete_id: z.string().uuid(),
  assignment_id: z.string().uuid(),
  day_id: z.string().uuid(),
  bodyweight: z.number().positive().max(500).multipleOf(0.1).nullable(),
  bodyweight_unit: z.enum(['kg', 'lb']),
  sleep_quality: z.number().int().min(1).max(5).nullable(),
  sleep_hours: z.number().min(0).max(16).multipleOf(0.5).nullable(),
  protein_grams: z.number().min(0).max(1000).nullable(),
  calories_kcal: z.number().int().min(0).max(20000).nullable(),
  carbs_grams: z.number().min(0).max(2000).nullable(),
  fatigue_level: z.number().int().min(1).max(10).nullable(),
});

export const workoutCheckInDraftSchema = workoutCheckInBaseSchema.omit({ athlete_id: true, assignment_id: true, day_id: true });
export const workoutCheckInSchema = workoutCheckInBaseSchema.refine((value) => [
  value.bodyweight,
  value.sleep_quality,
  value.sleep_hours,
  value.protein_grams,
  value.calories_kcal,
  value.carbs_grams,
  value.fatigue_level,
].some((entry) => entry !== null), { message: 'Enter at least one check-in value.' });

export type WorkoutCheckIn = z.infer<typeof workoutCheckInSchema>;
export type WorkoutCheckInDraft = z.infer<typeof workoutCheckInDraftSchema>;

const workoutCheckInRecordSchema = workoutCheckInBaseSchema.extend({
  created_at: z.string(),
  updated_at: z.string(),
});

function client() {
  if (!supabase) throw new Error('Supabase environment is not configured.');
  return supabase;
}

const selectFields = 'athlete_id, assignment_id, day_id, bodyweight, bodyweight_unit, sleep_quality, sleep_hours, protein_grams, calories_kcal, carbs_grams, fatigue_level, created_at, updated_at';

export async function loadWorkoutCheckIn(athleteId: string, assignmentId: string, dayId: string): Promise<WorkoutCheckInDraft | null> {
  const validAthleteId = z.string().uuid().parse(athleteId);
  const validAssignmentId = z.string().uuid().parse(assignmentId);
  const validDayId = z.string().uuid().parse(dayId);
  const { data, error } = await client().from('athlete_workout_checkins').select(selectFields)
    .eq('athlete_id', validAthleteId).eq('assignment_id', validAssignmentId).eq('day_id', validDayId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return workoutCheckInDraftSchema.parse(workoutCheckInRecordSchema.parse(data));
}

export async function saveWorkoutCheckIn(value: WorkoutCheckIn): Promise<WorkoutCheckInDraft> {
  const checkIn = workoutCheckInSchema.parse(value);
  const { data, error } = await client().from('athlete_workout_checkins')
    .upsert(checkIn, { onConflict: 'assignment_id,day_id' })
    .select(selectFields).single();
  if (error) throw error;
  return workoutCheckInDraftSchema.parse(workoutCheckInRecordSchema.parse(data));
}
