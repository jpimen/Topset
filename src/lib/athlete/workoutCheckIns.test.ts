import { describe, expect, it } from 'vitest';
import { workoutCheckInDraftSchema, workoutCheckInSchema } from './workoutCheckIns';

const validCheckIn = {
  athlete_id: '20000000-0000-4000-8000-000000000001',
  assignment_id: '90000000-0000-4000-8000-000000000001',
  day_id: '60000000-0000-4000-8000-000000000001',
  bodyweight: 82.5,
  bodyweight_unit: 'kg' as const,
  sleep_quality: 4,
  sleep_hours: 7.5,
  protein_grams: 180,
  calories_kcal: 2600,
  carbs_grams: 320,
  fatigue_level: 3,
};

describe('athlete workout check-ins', () => {
  it('validates values scoped to a specific assignment day', () => {
    expect(workoutCheckInSchema.parse(validCheckIn)).toEqual(validCheckIn);
    expect(workoutCheckInDraftSchema.parse(validCheckIn)).toMatchObject({ bodyweight: 82.5, sleep_hours: 7.5 });
  });

  it('allows a partial check-in while requiring at least one value', () => {
    expect(workoutCheckInSchema.parse({ ...validCheckIn, sleep_quality: null, sleep_hours: null, protein_grams: null, calories_kcal: null, carbs_grams: null, fatigue_level: null })).toMatchObject({ bodyweight: 82.5 });
    expect(workoutCheckInSchema.safeParse({ ...validCheckIn, bodyweight: null, sleep_quality: null, sleep_hours: null, protein_grams: null, calories_kcal: null, carbs_grams: null, fatigue_level: null }).success).toBe(false);
  });

  it('rejects invalid ratings, increments, amounts, and identifiers', () => {
    expect(workoutCheckInSchema.safeParse({ ...validCheckIn, bodyweight: 0 }).success).toBe(false);
    expect(workoutCheckInSchema.safeParse({ ...validCheckIn, sleep_quality: 6 }).success).toBe(false);
    expect(workoutCheckInSchema.safeParse({ ...validCheckIn, sleep_hours: 7.3 }).success).toBe(false);
    expect(workoutCheckInSchema.safeParse({ ...validCheckIn, protein_grams: 1001 }).success).toBe(false);
    expect(workoutCheckInSchema.safeParse({ ...validCheckIn, fatigue_level: 0 }).success).toBe(false);
    expect(workoutCheckInSchema.safeParse({ ...validCheckIn, day_id: 'not-a-day' }).success).toBe(false);
  });
});
