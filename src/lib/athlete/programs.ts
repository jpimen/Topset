import { z } from 'zod';
import { supabase } from '../supabase';
import { loadProgram } from '../programs/repository';
import { athleteProgramSchema, type ActiveAssignment, type AthleteProgram } from './types';

const cachedProgramSchema = z.object({
  assignment: z.object({
    id: z.string().uuid(),
    program_id: z.string().uuid(),
    start_date: z.string(),
    sync_mode: z.enum(['live', 'snapshot']),
  }),
  program: athleteProgramSchema,
});

export type AthleteProgramState = z.infer<typeof cachedProgramSchema>;

function client() {
  if (!supabase) throw new Error('Supabase environment is not configured.');
  return supabase;
}

function cacheKey(athleteId: string) {
  return `topset:athlete-program:v1:${athleteId}`;
}

function readCache(athleteId: string): AthleteProgramState | null {
  try {
    const raw = window.localStorage.getItem(cacheKey(athleteId));
    if (!raw) return null;
    const parsed = cachedProgramSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function writeCache(athleteId: string, value: AthleteProgramState) {
  try {
    window.localStorage.setItem(cacheKey(athleteId), JSON.stringify(value));
  } catch (error) {
    console.warn('Athlete program could not be cached for offline use.', error);
  }
}

function readSnapshot(snapshot: unknown): AthleteProgram {
  return athleteProgramSchema.parse(snapshot);
}

export async function loadActiveAthleteProgram(athleteId: string): Promise<AthleteProgramState | null> {
  const db = client();
  const { data, error } = await db.from('program_assignments')
    .select('id, program_id, start_date, sync_mode, program_snapshot')
    .eq('athlete_id', athleteId).eq('status', 'active').maybeSingle();

  if (error) {
    if (!window.navigator.onLine) return readCache(athleteId);
    throw error;
  }
  if (!data) return null;

  const assignment: ActiveAssignment = {
    id: data.id,
    program_id: data.program_id,
    start_date: data.start_date,
    sync_mode: data.sync_mode as ActiveAssignment['sync_mode'],
    program_snapshot: data.program_snapshot,
  };
  try {
    const program = assignment.sync_mode === 'snapshot'
      ? readSnapshot(assignment.program_snapshot)
      : athleteProgramSchema.parse(await loadProgram(assignment.program_id));
    const result = { assignment: { id: assignment.id, program_id: assignment.program_id, start_date: assignment.start_date, sync_mode: assignment.sync_mode }, program };
    writeCache(athleteId, result);
    return result;
  } catch (cause) {
    if (!window.navigator.onLine) return readCache(athleteId);
    throw cause;
  }
}

export function findNextWorkout(program: AthleteProgram, completedDayIds: ReadonlySet<string>) {
  const orderedDays = program.weeks.flatMap((week) => week.days.map((day) => ({ week, day })))
    .sort((left, right) => left.week.week_number - right.week.week_number || left.day.day_number - right.day.day_number);
  return orderedDays.find(({ day }) => !completedDayIds.has(day.id)) ?? null;
}
