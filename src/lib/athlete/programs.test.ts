import { describe, expect, it } from 'vitest';
import { findNextWorkout } from './programs';
import { athleteProgramSchema, loggedSetInputSchema } from './types';

const program = athleteProgramSchema.parse({
  program: { id: '30000000-0000-4000-8000-000000000001', name: 'Training', description: null, unit: 'kg', updated_at: '2026-10-29T00:00:00Z' },
  weeks: [
    { id: '50000000-0000-4000-8000-000000000002', week_number: 2, name: 'Week 2', notes: null, days: [
      { id: '60000000-0000-4000-8000-000000000002', day_number: 1, name: 'Day 1', notes: null, exercises: [] },
    ] },
    { id: '50000000-0000-4000-8000-000000000001', week_number: 1, name: 'Week 1', notes: null, days: [
      { id: '60000000-0000-4000-8000-000000000001', day_number: 2, name: 'Day 2', notes: null, exercises: [] },
      { id: '60000000-0000-4000-8000-000000000003', day_number: 1, name: 'Day 1', notes: null, exercises: [] },
    ] },
  ],
});

describe('athlete program helpers', () => {
  it('selects the earliest incomplete workout in week/day order', () => {
    expect(findNextWorkout(program, new Set())?.day.id).toBe('60000000-0000-4000-8000-000000000003');
    expect(findNextWorkout(program, new Set(['60000000-0000-4000-8000-000000000003']))?.day.id).toBe('60000000-0000-4000-8000-000000000001');
    expect(findNextWorkout(program, new Set([
      '60000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000002',
      '60000000-0000-4000-8000-000000000003',
    ]))).toBeNull();
  });

  it('validates logged set values and bounds notes and RPE', () => {
    expect(loggedSetInputSchema.safeParse({
      program_exercise_id: '70000000-0000-4000-8000-000000000001', set_number: 1,
      load_lifted: 100, rpe_lifted: 8.5, notes_athlete: 'Smooth set',
    }).success).toBe(true);
    expect(loggedSetInputSchema.safeParse({
      program_exercise_id: '70000000-0000-4000-8000-000000000001', set_number: 0,
      load_lifted: -1, rpe_lifted: 8.2, notes_athlete: 'x'.repeat(2001),
    }).success).toBe(false);
  });
});
