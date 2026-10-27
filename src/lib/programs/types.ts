import type { Unit } from '../engine';

export type SetType = 'top' | 'backoff' | 'working' | 'warmup' | 'amrap';
export type LoadMode = 'absolute' | 'percent' | 'rpe' | 'none';
export type ExerciseCategory = 'main' | 'variation' | 'accessory';
export type Movement = 'squat' | 'bench' | 'deadlift' | 'other';

export interface Exercise {
  id: string;
  owner_id: string | null;
  name: string;
  category: ExerciseCategory;
  movement: Movement;
  muscle_group: string | null;
  is_competition_lift: boolean;
}

export interface ProgramExercise {
  id: string;
  day_id: string;
  exercise_id: string;
  position: number;
  set_type: SetType | null;
  sets: number | null;
  reps: string;
  reps_min: number | null;
  reps_max: number | null;
  rpe: number | null;
  load_mode: LoadMode;
  load_value: number | null;
  load_min: number | null;
  load_max: number | null;
  percent_of: 'e1rm' | 'tm' | null;
  notes_coach: string | null;
  superset_group: string | null;
  exercise?: Exercise;
}

export interface ProgramDay {
  id: string;
  week_id: string;
  day_number: number;
  name: string;
  notes: string | null;
  exercises: ProgramExercise[];
}

export interface ProgramWeek {
  id: string;
  program_id: string;
  block_id: string | null;
  week_number: number;
  name: string;
  notes: string | null;
  days: ProgramDay[];
}

export interface ProgramDocument {
  program: {
    id: string;
    coach_id: string;
    name: string;
    description: string | null;
    unit: Unit;
    updated_at: string;
  };
  weeks: ProgramWeek[];
}

export interface ProgramHistory {
  past: ProgramDocument[];
  present: ProgramDocument;
  future: ProgramDocument[];
}

export type ProgramAction =
  | { type: 'replace'; document: ProgramDocument }
  | { type: 'rename-program'; name: string }
  | { type: 'set-unit'; unit: Unit }
  | { type: 'add-week' }
  | { type: 'delete-week'; weekId: string }
  | { type: 'rename-week'; weekId: string; name: string }
  | { type: 'add-day'; weekId: string }
  | { type: 'delete-day'; weekId: string; dayId: string }
  | { type: 'rename-day'; weekId: string; dayId: string; name: string }
  | { type: 'add-row'; weekId: string; dayId: string; row: ProgramExercise }
  | { type: 'update-row'; weekId: string; dayId: string; rowId: string; patch: Partial<ProgramExercise> }
  | { type: 'delete-row'; weekId: string; dayId: string; rowId: string }
  | { type: 'undo' }
  | { type: 'redo' };
