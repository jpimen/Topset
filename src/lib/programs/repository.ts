import { supabase } from '../supabase';
import type { Exercise, ProgramDocument, ProgramExercise, ProgramWeek } from './types';

function client() {
  if (!supabase) throw new Error('Supabase environment is not configured.');
  return supabase;
}

function raise(error: { message: string; code?: string } | null): void {
  if (error) throw new Error(error.code === '40001' ? 'PROGRAM_CONFLICT' : error.message);
}

export async function listPrograms(coachId: string) {
  const { data, error } = await client().from('programs').select('id, coach_id, name, description, unit, created_at, updated_at, archived_at')
    .eq('coach_id', coachId).is('archived_at', null).order('updated_at', { ascending: false });
  raise(error);
  return (data ?? []) as Array<ProgramDocument['program'] & { created_at: string; archived_at: string | null }>;
}

export async function loadProgram(programId: string): Promise<ProgramDocument> {
  const db = client();
  const [programResult, weeksResult, exercisesResult] = await Promise.all([
    db.from('programs').select('*').eq('id', programId).maybeSingle(),
    db.from('weeks').select('*, days(*, program_exercises(*, exercises(*)))').eq('program_id', programId).order('week_number'),
    db.from('exercises').select('*').order('name'),
  ]);
  raise(programResult.error); raise(weeksResult.error); raise(exercisesResult.error);
  if (!programResult.data) throw new Error('Program not found or you do not have access to it.');
  const weeks = (weeksResult.data ?? []).map((week) => ({
    ...week,
    days: ((week.days ?? []) as Array<Record<string, unknown>>).map((day) => ({
      ...day,
      exercises: ((day.program_exercises ?? []) as Array<Record<string, unknown>>).map((row) => ({
        ...row,
        exercise: row.exercises,
      })).sort((a, b) => Number((a as Record<string, unknown>).position) - Number((b as Record<string, unknown>).position)),
    })).sort((a, b) => Number((a as Record<string, unknown>).day_number) - Number((b as Record<string, unknown>).day_number)),
  })) as ProgramWeek[];
  return { program: programResult.data as ProgramDocument['program'], weeks };
}

export async function saveProgram(document: ProgramDocument, expectedUpdatedAt: string): Promise<string> {
  const payload = {
    program: { name: document.program.name, description: document.program.description, unit: document.program.unit },
    weeks: document.weeks.map((week) => ({
      id: week.id, week_number: week.week_number, name: week.name, notes: week.notes,
        days: week.days.map((day) => ({
        id: day.id, day_number: day.day_number, name: day.name, notes: day.notes,
        exercises: day.exercises.map((row) => {
          const serialized = { ...row };
          delete serialized.exercise;
          return serialized;
        }),
      })),
    })),
  };
  const { data, error } = await client().rpc('save_coach_program_document', {
    p_program_id: document.program.id,
    p_expected_updated_at: expectedUpdatedAt,
    p_document: payload,
  });
  raise(error);
  return data as string;
}

export async function createProgram(coachId: string): Promise<string> {
  const { data, error } = await client().from('programs').insert({ coach_id: coachId, name: 'Untitled program', unit: 'kg' }).select('id').single();
  raise(error);
  if (!data) throw new Error('Program could not be created.');
  return data.id as string;
}

export async function duplicateProgram(programId: string, coachId: string): Promise<string> {
  const original = await loadProgram(programId);
  const { data, error } = await client().from('programs').insert({
    coach_id: coachId, name: `${original.program.name} copy`, description: original.program.description, unit: original.program.unit,
  }).select('id, updated_at').single();
  raise(error);
  if (!data) throw new Error('Program could not be duplicated.');
  const copy: ProgramDocument = {
    program: { ...original.program, id: data.id as string, coach_id: coachId, updated_at: data.updated_at as string },
    weeks: original.weeks.map((week) => ({
      ...week, id: crypto.randomUUID(), program_id: data.id as string,
      days: week.days.map((day) => ({
        ...day, id: crypto.randomUUID(),
        exercises: day.exercises.map((row, position) => ({ ...row, id: crypto.randomUUID(), position })),
      })),
    })),
  };
  try {
    await saveProgram(copy, data.updated_at as string);
  } catch (error) {
    await client().from('programs').delete().eq('id', data.id as string);
    throw error;
  }
  return data.id as string;
}

export async function archiveProgram(programId: string) {
  const { error } = await client().from('programs').update({ archived_at: new Date().toISOString() }).eq('id', programId);
  raise(error);
}

export async function listExercises(): Promise<Exercise[]> {
  const { data, error } = await client().from('exercises').select('*').order('category').order('name');
  raise(error);
  return (data ?? []) as Exercise[];
}

export async function createExercise(ownerId: string, values: Omit<Exercise, 'id' | 'owner_id'>) {
  const { data, error } = await client().from('exercises').insert({ ...values, owner_id: ownerId }).select('*').single();
  raise(error);
  return data as Exercise;
}

export async function updateExercise(exercise: Exercise) {
  const { error } = await client().from('exercises').update({
    name: exercise.name, category: exercise.category, movement: exercise.movement,
    muscle_group: exercise.muscle_group, is_competition_lift: exercise.is_competition_lift,
  }).eq('id', exercise.id);
  raise(error);
}

export async function deleteExercise(exercise: Exercise) {
  const { data, error: usageError } = await client().from('program_exercises').select('id').eq('exercise_id', exercise.id).limit(1);
  raise(usageError);
  if (data?.length) throw new Error('This exercise is used in a program. Remove it from the program before deleting it.');
  const { error } = await client().from('exercises').delete().eq('id', exercise.id);
  raise(error);
}

export async function getCoachSummary(coachId: string) {
  const [programs, athletes] = await Promise.all([
    client().from('programs').select('id, name, unit, updated_at', { count: 'exact' }).eq('coach_id', coachId).is('archived_at', null).order('updated_at', { ascending: false }).limit(5),
    client().from('coach_athlete_links').select('id', { count: 'exact', head: true }).eq('coach_id', coachId).eq('status', 'active'),
  ]);
  raise(programs.error); raise(athletes.error);
  return { recent: (programs.data ?? []) as Array<{ id: string; name: string; unit: string; updated_at: string }>, programCount: programs.count ?? 0, athleteCount: athletes.count ?? 0 };
}

export type ExerciseForGrid = Pick<ProgramExercise, 'exercise_id'> & { exercise?: Exercise };
