// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ sync: vi.fn() }));
const athleteId = '20000000-0000-4000-8000-000000000001';
vi.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ profile: { id: '20000000-0000-4000-8000-000000000001', role: 'athlete' } }) }));
vi.mock('../../lib/athlete/logs', async (original) => ({ ...await original<typeof import('../../lib/athlete/logs')>(), syncWorkoutDraft: mocks.sync }));
import { readWorkoutDrafts, storeWorkoutDraft } from '../../lib/athlete/logs';
import { AthleteWorkoutSyncProvider } from './AthleteWorkoutSyncProvider';
const draft = { id: '80000000-0000-4000-8000-000000000001', assignment_id: '90000000-0000-4000-8000-000000000001', day_id: '60000000-0000-4000-8000-000000000001', session_date: '2026-11-03', completed: false, sets: [{ program_exercise_id: '70000000-0000-4000-8000-000000000001', set_number: 1, load_lifted: 100, rpe_lifted: 8, notes_athlete: null }] };
let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  mocks.sync.mockReset().mockResolvedValue(undefined);
  host = document.createElement('div');
  root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); vi.restoreAllMocks(); });

it('retains a failed sync and removes the draft only after a confirmed retry', async () => {
  storeWorkoutDraft(athleteId, draft);
  mocks.sync.mockRejectedValueOnce(new Error('permission denied'));
  await act(async () => root.render(<AthleteWorkoutSyncProvider><p>Program</p></AthleteWorkoutSyncProvider>));
  expect(readWorkoutDrafts(athleteId)).toEqual([draft]);
  expect(host.textContent).toContain('retry sync');
  await act(async () => host.querySelector('button')!.click());
  expect(readWorkoutDrafts(athleteId)).toEqual([]);
});

it('never deletes a newer local revision when an older request succeeds', async () => {
  let finish!: () => void;
  mocks.sync.mockReturnValueOnce(new Promise<void>((resolve) => { finish = resolve; }));
  mocks.sync.mockRejectedValueOnce(new Error('offline'));
  storeWorkoutDraft(athleteId, draft);
  await act(async () => root.render(<AthleteWorkoutSyncProvider><p>Program</p></AthleteWorkoutSyncProvider>));
  const newer = { ...draft, sets: [{ ...draft.sets[0], load_lifted: 110 }] };
  act(() => storeWorkoutDraft(athleteId, newer));
  await act(async () => { finish(); await new Promise((resolve) => setTimeout(resolve, 10)); });
  expect(readWorkoutDrafts(athleteId)).toEqual([newer]);
});

it('reports malformed storage without crashing or replacing it', async () => {
  const key = `topset:workout-drafts:v1:${athleteId}`;
  localStorage.setItem(key, '{broken');
  await act(async () => root.render(<AthleteWorkoutSyncProvider><p>Program</p></AthleteWorkoutSyncProvider>));
  expect(host.textContent).toContain('Pending workouts could not be read');
  expect(host.textContent).toContain('Program');
  expect(localStorage.getItem(key)).toBe('{broken');
  expect(mocks.sync).not.toHaveBeenCalled();
});

it('preserves drafts when the workspace unmounts during a request', async () => {
  let finish!: () => void;
  mocks.sync.mockReturnValueOnce(new Promise<void>((resolve) => { finish = resolve; }));
  storeWorkoutDraft(athleteId, draft);
  await act(async () => root.render(<AthleteWorkoutSyncProvider><p>Program</p></AthleteWorkoutSyncProvider>));
  act(() => root.render(<p>Signed out</p>));
  await act(async () => finish());
  expect(readWorkoutDrafts(athleteId)).toEqual([draft]);
});
