import { percentFromRepsAndRpe, DEFAULT_ROUNDING_KG, DEFAULT_ROUNDING_LB, roundLoad } from '../engine';
import type { LoadMode, ProgramAction, ProgramDocument, ProgramExercise, ProgramHistory } from './types';

const id = () => crypto.randomUUID();

export function createEmptyDocument(coachId: string): ProgramDocument {
  return {
    program: { id: '', coach_id: coachId, name: 'Untitled program', description: null, unit: 'kg', updated_at: '' },
    weeks: [{ id: id(), program_id: '', block_id: null, week_number: 1, name: 'Week 1', notes: null, days: [] }],
  };
}

export function parseReps(value: string): { valid: boolean; min: number | null; max: number | null; timed: boolean } {
  const normalized = value.trim();
  if (/^\d+\s*min$/i.test(normalized)) return { valid: true, min: null, max: null, timed: true };
  const exact = normalized.match(/^(\d+)$/);
  if (exact) {
    const reps = Number(exact[1]);
    return { valid: reps > 0, min: reps || null, max: reps || null, timed: false };
  }
  const range = normalized.match(/^(\d+)\s*-\s*(\d+)$/);
  if (!range) return { valid: false, min: null, max: null, timed: false };
  const min = Number(range[1]);
  const max = Number(range[2]);
  return { valid: min > 0 && max >= min, min, max, timed: false };
}

export function validateLoad(value: string, mode: LoadMode, unit: 'kg' | 'lb', reps: string, rpe: number | null) {
  if (mode === 'none') return { valid: true, min: null, max: null, hint: null };
  if (mode === 'rpe') {
    const parsed = parseReps(reps);
    if (!parsed.valid || parsed.min === null || parsed.min !== parsed.max || rpe === null) {
      return { valid: false, min: null, max: null, hint: 'Enter one numeric rep count and an RPE to use RPE-derived loads.' };
    }
    try {
      percentFromRepsAndRpe(parsed.min, rpe);
      return { valid: true, min: null, max: null, hint: 'Enter an e1RM preview in Phase B to calculate this load.' };
    } catch {
      return { valid: false, min: null, max: null, hint: 'RPE load unavailable above 10 effective reps. Enter an absolute load.' };
    }
  }
  const numbers = value.trim().match(/^(\d+(?:\.\d+)?)\s*(?:-\s*(\d+(?:\.\d+)?))?$/);
  if (!numbers) return { valid: false, min: null, max: null, hint: 'Enter a load such as 130 or a range such as 130-132.5.' };
  const first = mode === 'percent' ? Number(numbers[1]) : roundLoad(Number(numbers[1]), unit);
  const second = numbers[2] ? mode === 'percent' ? Number(numbers[2]) : roundLoad(Number(numbers[2]), unit) : first;
  if (first <= 0 || second <= 0 || second < first) return { valid: false, min: first, max: second, hint: 'Load values must be positive and the range must be in ascending order.' };
  return {
    valid: true,
    min: first,
    max: second,
    hint: mode === 'percent' ? 'Percent loads are stored for athlete preview in Phase B.' : null,
    increment: unit === 'kg' ? DEFAULT_ROUNDING_KG : DEFAULT_ROUNDING_LB,
  };
}

export function createProgramHistory(document: ProgramDocument): ProgramHistory {
  return { past: [], present: document, future: [] };
}

function applyAction(document: ProgramDocument, action: ProgramAction): ProgramDocument {
  if (action.type === 'rename-program') return { ...document, program: { ...document.program, name: action.name } };
  if (action.type === 'set-unit') return { ...document, program: { ...document.program, unit: action.unit } };
  if (action.type === 'add-week') {
    const weekNumber = document.weeks.reduce((max, week) => Math.max(max, week.week_number), 0) + 1;
    return { ...document, weeks: [...document.weeks, { id: id(), program_id: document.program.id, block_id: null, week_number: weekNumber, name: `Week ${weekNumber}`, notes: null, days: [] }] };
  }
  if (action.type === 'delete-week') return { ...document, weeks: document.weeks.filter((week) => week.id !== action.weekId).map((week, index) => ({ ...week, week_number: index + 1 })) };
  const weeks = document.weeks.map((week) => {
    if (week.id !== ('weekId' in action ? action.weekId : undefined)) return week;
    if (action.type === 'rename-week') return { ...week, name: action.name };
    if (action.type === 'add-day') {
      const dayNumber = week.days.reduce((max, day) => Math.max(max, day.day_number), 0) + 1;
      return { ...week, days: [...week.days, { id: id(), week_id: week.id, day_number: dayNumber, name: `Day ${dayNumber}`, notes: null, exercises: [] }] };
    }
    if (action.type === 'delete-day') return { ...week, days: week.days.filter((day) => day.id !== action.dayId).map((day, index) => ({ ...day, day_number: index + 1 })) };
    if (action.type === 'rename-day') return { ...week, days: week.days.map((day) => day.id === action.dayId ? { ...day, name: action.name } : day) };
    if (action.type === 'add-row') return { ...week, days: week.days.map((day) => day.id === action.dayId ? { ...day, exercises: [...day.exercises, action.row] } : day) };
    if (action.type === 'update-row') return { ...week, days: week.days.map((day) => day.id === action.dayId ? { ...day, exercises: day.exercises.map((row) => row.id === action.rowId ? { ...row, ...action.patch } : row) } : day) };
    if (action.type === 'delete-row') return { ...week, days: week.days.map((day) => day.id === action.dayId ? { ...day, exercises: day.exercises.filter((row) => row.id !== action.rowId).map((row, index) => ({ ...row, position: index })) } : day) };
    return week;
  });
  return { ...document, weeks };
}

export function programReducer(state: ProgramHistory, action: ProgramAction): ProgramHistory {
  if (action.type === 'undo') {
    if (state.past.length === 0) return state;
    const previous = state.past.at(-1)!;
    return { past: state.past.slice(0, -1), present: previous, future: [state.present, ...state.future] };
  }
  if (action.type === 'redo') {
    if (state.future.length === 0) return state;
    return { past: [...state.past, state.present].slice(-50), present: state.future[0], future: state.future.slice(1) };
  }
  if (action.type === 'replace') return { past: [], present: action.document, future: [] };
  const next = applyAction(state.present, action);
  if (next === state.present) return state;
  return { past: [...state.past, state.present].slice(-50), present: next, future: [] };
}

export function createRow(dayId: string, exerciseId: string, position: number, values: Partial<ProgramExercise> = {}): ProgramExercise {
  return {
    id: id(), day_id: dayId, exercise_id: exerciseId, position, set_type: 'working', sets: 3,
    reps: '5', reps_min: 5, reps_max: 5, rpe: null, load_mode: 'none', load_value: null,
    load_min: null, load_max: null, percent_of: null, notes_coach: null, superset_group: null,
    ...values,
  };
}
