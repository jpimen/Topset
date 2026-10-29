// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { deleteWorkoutDraft, readWorkoutDrafts, storeWorkoutDraft } from './logs';

const athleteId = '20000000-0000-4000-8000-000000000001';
const draft = {
  id: '80000000-0000-4000-8000-000000000001',
  assignment_id: '90000000-0000-4000-8000-000000000001',
  day_id: '60000000-0000-4000-8000-000000000001',
  session_date: '2026-10-29',
  completed: false,
  sets: [{
    program_exercise_id: '70000000-0000-4000-8000-000000000001', set_number: 1,
    load_lifted: 100, rpe_lifted: 8, notes_athlete: null,
  }],
};

describe('offline workout draft storage', () => {
  beforeEach(() => window.localStorage.clear());

  it('persists a draft across reads and replaces it idempotently by session id', () => {
    storeWorkoutDraft(athleteId, draft);
    storeWorkoutDraft(athleteId, { ...draft, sets: [{ ...draft.sets[0], load_lifted: 102.5 }] });
    expect(readWorkoutDrafts(athleteId)).toHaveLength(1);
    expect(readWorkoutDrafts(athleteId)[0].sets[0].load_lifted).toBe(102.5);
  });

  it('removes a queued draft after the remote save is confirmed', () => {
    storeWorkoutDraft(athleteId, draft);
    expect(deleteWorkoutDraft(athleteId, draft.id)).toEqual([]);
    expect(readWorkoutDrafts(athleteId)).toEqual([]);
  });
});
