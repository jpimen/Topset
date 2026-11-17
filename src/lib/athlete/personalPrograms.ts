import { z } from 'zod';
import { supabase } from '../supabase';

const personalExerciseSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  sets: z.number().int().min(1).max(100).nullable(),
  reps: z.string().trim().max(24),
  rpe: z.number().min(1).max(10).multipleOf(0.5).nullable(),
  load: z.string().trim().max(40),
});

const personalDaySchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  exercises: z.array(personalExerciseSchema).max(100),
});

const personalWeekSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  days: z.array(personalDaySchema).max(50),
});

export const athletePersonalProgramSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  unit: z.enum(['kg', 'lb']),
  weeks: z.array(personalWeekSchema).max(52),
});

export type AthletePersonalProgram = z.infer<typeof athletePersonalProgramSchema>;
export type PersonalExercise = z.infer<typeof personalExerciseSchema>;
export type PersonalDay = z.infer<typeof personalDaySchema>;
export type PersonalWeek = z.infer<typeof personalWeekSchema>;

function client() {
  if (!supabase) throw new Error('Supabase environment is not configured.');
  return supabase;
}

export async function loadAthletePersonalPrograms(athleteId: string): Promise<AthletePersonalProgram[]> {
  const { data, error } = await client().from('athlete_personal_programs')
    .select('document').eq('athlete_id', athleteId).order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(({ document }) => athletePersonalProgramSchema.parse(document));
}

export async function saveAthletePersonalProgram(athleteId: string, document: AthletePersonalProgram): Promise<AthletePersonalProgram> {
  const parsed = athletePersonalProgramSchema.parse(document);
  const { error } = await client().from('athlete_personal_programs').upsert(
    { athlete_id: athleteId, program_id: parsed.id, document: parsed }, { onConflict: 'athlete_id,program_id' },
  );
  if (error) throw error;
  return parsed;
}

export async function deleteAthletePersonalProgram(athleteId: string, programId: string): Promise<void> {
  const { error } = await client().from('athlete_personal_programs').delete().eq('athlete_id', athleteId).eq('program_id', programId);
  if (error) throw error;
}
