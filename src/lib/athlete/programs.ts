import { z } from 'zod';
import { supabase } from '../supabase';
import { loadProgram } from '../programs/repository';
import type { ProgramDocument } from '../programs/types';
import { athleteProgramSchema, type AthleteProgram } from './types';

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
export type AthleteProgramLoad = {
  state: AthleteProgramState | null;
  source: 'server' | 'offline';
  verifiedAt: number;
  warning: string;
};
const storedProgramSchema = z.object({
  athleteId: z.string().uuid(),
  role: z.literal('athlete'),
  verifiedAt: z.number().int().nonnegative(),
  state: cachedProgramSchema,
});
export const PROGRAM_CACHE_MAX_AGE = 24 * 60 * 60 * 1000;
let cacheGeneration = 0;
const requestVersions = new Map<string, number>();
let cleanupFailed = false;
const blockedCopies = new Set<string>();

export function omitUnassignedRows(program: ProgramDocument): ProgramDocument {
  return {
    ...program,
    weeks: program.weeks.map((week) => ({
      ...week,
      days: week.days.map((day) => ({
        ...day,
        exercises: day.exercises.filter((row) => Boolean((row.exercise_id || row.exercise_name) && row.exercise)),
      })),
    })),
  };
}

function client() {
  if (!supabase) throw new Error('Supabase environment is not configured.');
  return supabase;
}

function cacheKey(athleteId: string) {
  return `topset:athlete-program:v2:${athleteId}`;
}

function removeCache(athleteId: string): string {
  blockedCopies.add(athleteId);
  try {
    window.localStorage.removeItem(cacheKey(athleteId));
    window.localStorage.removeItem(`topset:athlete-program:v1:${athleteId}`);
    return '';
  } catch (cause) {
    console.warn('Offline program cleanup failed.', cause);
    return 'This browser could not clear its old offline program copy. Offline access is disabled until a new program is saved from the server.';
  }
}

// Only disposable prescription copies are cleared. Pending workout input is retained.
export function clearAthleteProgramCaches(keepAthleteId?: string): string {
  cacheGeneration += 1;
  requestVersions.clear();
  cleanupFailed = true;
  try {
    const storage = window.localStorage;
    const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
    for (const key of keys) {
      if (key?.startsWith('topset:athlete-program:') && key !== (keepAthleteId ? cacheKey(keepAthleteId) : null)) {
        blockedCopies.add(key.slice(key.lastIndexOf(':') + 1));
        storage.removeItem(key);
      }
    }
    cleanupFailed = false;
    return '';
  } catch (cause) {
    console.warn('Offline program cleanup failed.', cause);
    return 'This browser could not clear offline program storage. Check browser storage permissions.';
  }
}

function offlineCopy(athleteId: string): AthleteProgramLoad {
  try {
    const raw = cleanupFailed || blockedCopies.has(athleteId) ? null : window.localStorage.getItem(cacheKey(athleteId));
    const stored = raw ? storedProgramSchema.parse(JSON.parse(raw)) : null;
    if (stored && stored.athleteId === athleteId && stored.state.assignment.program_id === stored.state.program.program.id
      && Date.now() >= stored.verifiedAt && Date.now() - stored.verifiedAt < PROGRAM_CACHE_MAX_AGE) {
      return { state: stored.state, verifiedAt: stored.verifiedAt, source: 'offline', warning: '' };
    }
  } catch (cause) {
    console.warn('Offline program copy could not be read.', cause);
  }
  removeCache(athleteId);
  throw new Error('You are offline and no valid program copy is available on this device. Reconnect to load your assignment.');
}

function isTransportFailure(cause: unknown): boolean {
  if (!cause || typeof cause !== 'object' || cause instanceof z.ZodError) return false;
  const error = cause as { code?: string; message?: string; status?: number };
  // Offline status alone must never turn a permission or validation error into cached success.
  return !error.code && (!error.status || error.status === 0)
    && /fetch|network|failed to load|load failed/i.test(error.message ?? '');
}

export async function loadActiveAthleteProgram(athleteId: string): Promise<AthleteProgramLoad> {
  z.string().uuid().parse(athleteId);
  const generation = cacheGeneration;
  const version = (requestVersions.get(athleteId) ?? 0) + 1;
  requestVersions.set(athleteId, version);
  const current = () => generation === cacheGeneration && requestVersions.get(athleteId) === version;
  const db = client();
  try {
  const { data, error } = await db.from('program_assignments')
    .select('id, program_id, start_date, sync_mode, program_snapshot')
    .eq('athlete_id', athleteId).eq('status', 'active').maybeSingle();

  if (error) throw error;
  if (!data) return { state: null, source: 'server', verifiedAt: Date.now(), warning: current() ? removeCache(athleteId) : '' };
  // Never recover a different or previously revoked assignment if its live query fails midway.
  let previousAssignment: string | undefined;
  try {
    const raw = window.localStorage.getItem(cacheKey(athleteId));
    previousAssignment = raw ? storedProgramSchema.parse(JSON.parse(raw)).state.assignment.id : undefined;
  } catch { /* A successful online load replaces an unreadable disposable copy below. */ }
  if (current() && previousAssignment !== data.id) removeCache(athleteId);
    const assignment = cachedProgramSchema.shape.assignment.parse(data);
    const program = assignment.sync_mode === 'snapshot'
      ? athleteProgramSchema.parse(data.program_snapshot)
      : athleteProgramSchema.parse(omitUnassignedRows(await loadProgram(assignment.program_id)));
    if (program.program.id !== assignment.program_id) throw new Error('The assigned program does not match its prescription.');
    const result: AthleteProgramLoad = { state: { assignment, program }, source: 'server', verifiedAt: Date.now(), warning: '' };
    if (current()) {
      try {
        window.localStorage.setItem(cacheKey(athleteId), JSON.stringify({ athleteId, role: 'athlete', verifiedAt: result.verifiedAt, state: result.state }));
        blockedCopies.delete(athleteId);
        cleanupFailed = false;
      } catch (cause) {
        console.warn('Athlete program could not be cached for offline use.', cause);
        removeCache(athleteId);
        result.warning = 'Your program loaded, but this browser could not save it for offline use. Check browser storage permissions or available space.';
      }
    }
    return result;
  } catch (cause) {
    if (current() && !navigator.onLine && isTransportFailure(cause)) return offlineCopy(athleteId);
    if (current() && !isTransportFailure(cause)) removeCache(athleteId);
    throw cause;
  }
}

export function findNextWorkout(program: AthleteProgram, completedDayIds: ReadonlySet<string>) {
  const orderedDays = program.weeks.flatMap((week) => week.days.map((day) => ({ week, day })))
    .sort((left, right) => left.week.week_number - right.week.week_number || left.day.day_number - right.day.day_number);
  return orderedDays.find(({ day }) => !completedDayIds.has(day.id)) ?? null;
}
