import { z } from 'zod';
import { supabase } from '../supabase';
import { workoutDraftSchema, type WorkoutDraft } from './types';

const storedDraftsSchema = z.array(workoutDraftSchema);
const serverSetSchema = z.object({
  program_exercise_id: z.string().uuid(),
  set_number: z.number().int(),
  load_lifted: z.number().nullable(),
  rpe_lifted: z.number().nullable(),
  notes_athlete: z.string().nullable(),
});
const serverSessionSchema = z.object({
  id: z.string().uuid(),
  day_id: z.string().uuid(),
  session_date: z.string(),
  completed_at: z.string().nullable(),
  logged_sets: z.array(serverSetSchema),
});

export type AthleteWorkoutSession = z.infer<typeof serverSessionSchema>;

function client() {
  if (!supabase) throw new Error('Supabase environment is not configured.');
  return supabase;
}

function storageKey(athleteId: string) {
  return `topset:workout-drafts:v1:${athleteId}`;
}

function notifyDraftChange(athleteId: string) {
  window.dispatchEvent(new CustomEvent('topset:workout-drafts-changed', { detail: { athleteId } }));
}

export function readWorkoutDrafts(athleteId: string): WorkoutDraft[] {
  try {
    const raw = window.localStorage.getItem(storageKey(athleteId));
    if (!raw) return [];
    const parsed = storedDraftsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

function writeWorkoutDrafts(athleteId: string, drafts: WorkoutDraft[]) {
  try {
    window.localStorage.setItem(storageKey(athleteId), JSON.stringify(drafts));
  } catch (error) {
    console.error('Workout could not be saved on this device.', error);
    throw new Error('This device could not store the workout offline. Free up browser storage and try again.', { cause: error });
  }
}

export function storeWorkoutDraft(athleteId: string, value: WorkoutDraft): WorkoutDraft[] {
  const draft = workoutDraftSchema.parse(value);
  const drafts = readWorkoutDrafts(athleteId).filter((existing) => existing.id !== draft.id);
  const next = [...drafts, draft];
  writeWorkoutDrafts(athleteId, next);
  notifyDraftChange(athleteId);
  return next;
}

export function deleteWorkoutDraft(athleteId: string, sessionId: string): WorkoutDraft[] {
  const next = readWorkoutDrafts(athleteId).filter((draft) => draft.id !== sessionId);
  writeWorkoutDrafts(athleteId, next);
  notifyDraftChange(athleteId);
  return next;
}

export async function loadWorkoutSessions(assignmentId: string): Promise<AthleteWorkoutSession[]> {
  const { data, error } = await client().from('workout_sessions')
    .select('id, day_id, session_date, completed_at, logged_sets(program_exercise_id, set_number, load_lifted, rpe_lifted, notes_athlete)')
    .eq('assignment_id', assignmentId).order('session_date', { ascending: false });
  if (error) throw error;
  return z.array(serverSessionSchema).parse(data ?? []);
}

export async function syncWorkoutDraft(draft: WorkoutDraft): Promise<void> {
  const value = workoutDraftSchema.parse(draft);
  const { error } = await client().rpc('save_athlete_workout_session', {
    p_session_id: value.id,
    p_assignment_id: value.assignment_id,
    p_day_id: value.day_id,
    p_session_date: value.session_date,
    p_completed: value.completed,
    p_sets: value.sets,
  });
  if (error) throw error;
}

export function getLocalDraftForDay(athleteId: string, assignmentId: string, dayId: string): WorkoutDraft | null {
  return readWorkoutDrafts(athleteId).find((draft) => draft.assignment_id === assignmentId && draft.day_id === dayId && !draft.completed) ?? null;
}
