// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('../../lib/athlete/logs', async (original) => ({ ...await original<typeof import('../../lib/athlete/logs')>(), loadWorkoutSessions: mocks.load }));
import { readWorkoutDrafts, storeWorkoutDraft } from '../../lib/athlete/logs';
import { athleteProgramSchema } from '../../lib/athlete/types';
import { AthleteWorkoutLogRows } from './AthleteWorkoutLogRows';
import { AthleteWorkoutSessionsProvider } from './AthleteWorkoutSessionsProvider';

const athleteId = '20000000-0000-4000-8000-000000000001';
const assignmentId = '90000000-0000-4000-8000-000000000001';
const dayId = '60000000-0000-4000-8000-000000000001';
const rowId = '70000000-0000-4000-8000-000000000001';
const sessionId = '80000000-0000-4000-8000-000000000001';
const day = athleteProgramSchema.shape.weeks.element.shape.days.element.parse({
  id: dayId, name: 'Day 1', day_number: 1, notes: null,
  exercises: [{ id: rowId, day_id: dayId, exercise_id: rowId, position: 0, set_type: 'working', sets: 1, reps: '5', rpe: 8, load_mode: 'absolute', load_value: 100, load_min: null, load_max: null, notes_coach: 'Smooth', exercise: { id: rowId, name: 'Squat', category: 'main', movement: 'squat' } }],
});
const secondDay = { ...day, id: '60000000-0000-4000-8000-000000000002', name: 'Day 2' };
let host: HTMLDivElement;
let root: Root;
const dirty = vi.fn();
async function render(verifiedAt = 1) {
  await act(async () => root.render(<MemoryRouter><AthleteWorkoutSessionsProvider athleteId={athleteId} assignmentId={assignmentId} verifiedAt={verifiedAt}>
    {[day, secondDay].map((item) => <table key={item.id}><tbody><AthleteWorkoutLogRows athleteId={athleteId} assignmentId={assignmentId} day={item} unit="kg" onEditStateChange={dirty} /></tbody></table>)}
  </AthleteWorkoutSessionsProvider></MemoryRouter>));
}
function change(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  mocks.load.mockReset().mockResolvedValue([]);
  dirty.mockClear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); });

it('shares one assignment-wide history request across day rows', async () => {
  await render();
  expect(mocks.load).toHaveBeenCalledTimes(1);
  expect(host.querySelectorAll('input[type="number"]')).toHaveLength(2);
});

it('keeps prescriptions visible offline and recovers a local draft before history is available', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  mocks.load.mockRejectedValue(new TypeError('Failed to fetch'));
  storeWorkoutDraft(athleteId, { id: sessionId, assignment_id: assignmentId, day_id: dayId, session_date: '2026-11-03', completed: false, sets: [{ program_exercise_id: rowId, set_number: 1, load_lifted: 105, rpe_lifted: 8, notes_athlete: 'Local note' }] });
  await render();
  expect(host.textContent).toContain('Offline: prescriptions');
  expect(host.querySelectorAll('th.athlete-program-exercise')).toHaveLength(2);
  const inputs = host.querySelectorAll<HTMLInputElement>('input[type="number"]');
  expect(inputs[0].value).toBe('105');
  expect(inputs[0].disabled).toBe(false);
  expect(inputs[1].disabled).toBe(true);
  expect(readWorkoutDrafts(athleteId)).toHaveLength(1);
});

it('preserves unsaved input during shared history revalidation and persists before sync', async () => {
  await render();
  const input = host.querySelector<HTMLInputElement>('input[type="number"]')!;
  act(() => change(input, '112.5'));
  expect(dirty).toHaveBeenCalledWith(`log:${assignmentId}:${dayId}`, true);
  await render(2);
  expect(host.querySelector<HTMLInputElement>('input[type="number"]')!.value).toBe('112.5');
  const save = [...host.querySelectorAll('button')].find((button) => button.textContent === 'Save changes')!;
  await act(async () => save.click());
  expect(readWorkoutDrafts(athleteId)[0].sets[0].load_lifted).toBe(112.5);
  expect(host.textContent).toContain('waiting to sync');
});

it('shows storage failure without marking unsaved entries as saved', async () => {
  await render();
  act(() => change(host.querySelector<HTMLInputElement>('input[type="number"]')!, '120'));
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  act(() => [...host.querySelectorAll('button')].find((button) => button.textContent === 'Save changes')!.click());
  expect(host.textContent).toContain('Changes were not saved');
  expect(host.querySelector<HTMLInputElement>('input[type="number"]')!.value).toBe('120');
});
