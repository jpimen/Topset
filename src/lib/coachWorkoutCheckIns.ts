import { z } from 'zod';
import { athleteProgramSchema } from './athlete/types';
import { loadProgram } from './programs/repository';
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

export type CoachWorkoutCheckIn = z.infer<typeof rowSchema> & { weekName: string; dayName: string };

function client() {
  if (!supabase) throw new Error('Supabase environment is not configured.');
  return supabase;
}

export async function loadCoachWorkoutCheckIns(assignment: ProgramAssignment): Promise<CoachWorkoutCheckIn[]> {
  const db = client();
  const [assignmentResult, checkInsResult] = await Promise.all([
    db.from('program_assignments').select('sync_mode, program_snapshot').eq('id', assignment.id).single(),
    db.from('athlete_workout_checkins').select('athlete_id, assignment_id, day_id, bodyweight, bodyweight_unit, sleep_quality, sleep_hours, protein_grams, calories_kcal, carbs_grams, fatigue_level, updated_at')
      .eq('assignment_id', assignment.id).order('updated_at', { ascending: false }),
  ]);
  if (assignmentResult.error) throw assignmentResult.error;
  if (checkInsResult.error) throw checkInsResult.error;

  const assignedProgram = assignmentResult.data.sync_mode === 'snapshot'
    ? athleteProgramSchema.parse(assignmentResult.data.program_snapshot)
    : athleteProgramSchema.parse(await loadProgram(assignment.program_id));
  const dayLabels = new Map(assignedProgram.weeks.flatMap((week) => week.days.map((day) => [day.id, { weekName: week.name, dayName: day.name }] as const)));

  return (checkInsResult.data ?? []).flatMap((record) => {
    const parsed = rowSchema.parse(record);
    const label = dayLabels.get(parsed.day_id);
    return label ? [{ ...parsed, ...label }] : [];
  });
}
