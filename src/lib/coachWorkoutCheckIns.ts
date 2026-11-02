import { z } from 'zod';
import { supabase } from './supabase';
import type { ProgramAssignment } from './programAssignments';

const rowSchema = z.object({
  athlete_id: z.string().uuid(),
  assignment_id: z.string().uuid(),
  day_id: z.string().uuid(),
  bodyweight: z.number().nullable(),
  bodyweight_unit: z.enum(['kg', 'lb']),
  sleep_quality: z.number().nullable(),
  sleep_hours: z.number().nullable(),
  protein_grams: z.number().nullable(),
  calories_kcal: z.number().nullable(),
  carbs_grams: z.number().nullable(),
  fatigue_level: z.number().nullable(),
  updated_at: z.string(),
});

export type CoachWorkoutCheckIn = z.infer<typeof rowSchema>;

function client() {
  if (!supabase) throw new Error('Supabase environment is not configured.');
  return supabase;
}

export async function loadCoachWorkoutCheckIns(assignment: ProgramAssignment): Promise<CoachWorkoutCheckIn[]> {
  const db = client();
  const checkInsResult = await db.from('athlete_workout_checkins')
    .select('athlete_id, assignment_id, day_id, bodyweight, bodyweight_unit, sleep_quality, sleep_hours, protein_grams, calories_kcal, carbs_grams, fatigue_level, updated_at')
    .eq('assignment_id', assignment.id).order('updated_at', { ascending: false });
  if (checkInsResult.error) throw checkInsResult.error;
  // RLS checks the active link, start date, assignment and live/snapshot day membership.
  // The caller already has display labels; fetching the program again added no UI data.
  return z.array(rowSchema).parse(checkInsResult.data ?? []);
}
