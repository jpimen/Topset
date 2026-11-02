// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ assignments: vi.fn(), links: vi.fn(), checkins: vi.fn(), sessions: vi.fn() }));
vi.mock('./useCoachId', () => ({ useCoachId: () => 'coach' }));
vi.mock('../../lib/programAssignments', () => ({ listActiveAssignments: mocks.assignments }));
vi.mock('../../lib/coachAthletes', () => ({ listCoachLinks: mocks.links }));
vi.mock('../../lib/coachWorkoutCheckIns', () => ({ loadCoachWorkoutCheckIns: mocks.checkins }));
vi.mock('../../lib/athlete/logs', () => ({ loadWorkoutSessions: mocks.sessions }));
import { CoachWorkoutCheckInsPanel, CoachWorkoutCheckInsProvider, useCoachWorkoutLogSets } from './CoachWorkoutCheckInsPanel';
const assignment = { id: 'assignment', athlete_id: 'athlete', program_id: 'program', start_date: '2026-01-01', athlete: { name: 'Athlete A' } };
let root: Root;
let host: HTMLDivElement;
function GridProbe() {
  const sets = useCoachWorkoutLogSets('day', 'row');
  return <p>Grid sets: {sets.length}</p>;
}
const render = async () => { await act(async () => root.render(<CoachWorkoutCheckInsProvider preferredProgramId="program"><GridProbe /><CoachWorkoutCheckInsPanel dayId="day" dayName="Day 1" /></CoachWorkoutCheckInsProvider>)); };
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  mocks.assignments.mockReset().mockResolvedValue([assignment]);
  mocks.links.mockReset().mockResolvedValue([{ athlete_id: 'athlete', status: 'active' }]);
  mocks.checkins.mockReset().mockResolvedValue([{ day_id: 'day', bodyweight: 82, bodyweight_unit: 'kg', sleep_quality: null, sleep_hours: null, protein_grams: null, calories_kcal: null, carbs_grams: null, fatigue_level: null, updated_at: '2026-11-03' }]);
  mocks.sessions.mockReset().mockResolvedValue([{ id: 'session', day_id: 'day', session_date: '2026-11-03', logged_sets: [{ program_exercise_id: 'row', set_number: 1, load_lifted: 100, rpe_lifted: 8, notes_athlete: null }] }]);
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  host = document.createElement('div');
  root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); vi.useRealTimers(); vi.restoreAllMocks(); });

it('shares one response load across panels and clears both panels and grid after link removal', async () => {
  await render();
  expect(host.textContent).toContain('82 kg');
  expect(host.textContent).toContain('Grid sets: 1');
  expect(mocks.checkins).toHaveBeenCalledTimes(1);
  mocks.links.mockResolvedValue([]);
  await act(async () => vi.advanceTimersByTime(8000));
  expect(host.textContent).not.toContain('82 kg');
  expect(host.textContent).toContain('Grid sets: 0');
  expect(host.textContent).toContain('No athletes assigned');
});

it('shows a failed background refresh instead of presenting previous responses as current', async () => {
  await render();
  mocks.checkins.mockRejectedValue(new Error('server unavailable'));
  await act(async () => vi.advanceTimersByTime(8000));
  expect(host.textContent).toContain('could not be refreshed');
  expect(host.textContent).not.toContain('82 kg');
  expect(host.textContent).toContain('Grid sets: 0');
});
