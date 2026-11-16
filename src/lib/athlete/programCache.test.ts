// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ assignment: vi.fn(), program: vi.fn() }));
vi.mock('../supabase', () => ({ supabase: { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: mocks.assignment }) }) }) }) } }));
vi.mock('../programs/repository', () => ({ loadProgram: mocks.program }));
import { clearAthleteProgramCaches, loadActiveAthleteProgram } from './programs';

const athlete = '20000000-0000-4000-8000-000000000001';
const assignment = { id: '90000000-0000-4000-8000-000000000001', program_id: '30000000-0000-4000-8000-000000000001', start_date: '2026-10-29', sync_mode: 'live', program_snapshot: null };
const program = { program: { id: assignment.program_id, name: 'Saved plan', description: null, unit: 'kg', updated_at: '2026-11-03T00:00:00Z' }, weeks: [] };
const networkError = { message: 'TypeError: Failed to fetch', code: '', details: '', hint: '' };
const key = `topset:athlete-program:v2:${athlete}`;
function offline() {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  mocks.assignment.mockResolvedValue({ data: null, error: networkError });
}

describe('assigned program offline cache', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    clearAthleteProgramCaches();
    mocks.assignment.mockReset().mockResolvedValue({ data: assignment, error: null });
    mocks.program.mockReset().mockResolvedValue(program);
  });

  it('revalidates online and uses a validated copy only after an offline transport failure', async () => {
    expect((await loadActiveAthleteProgram(athlete)).source).toBe('server');
    mocks.program.mockResolvedValue({ ...program, program: { ...program.program, name: 'Confirmed coach edit' } });
    expect((await loadActiveAthleteProgram(athlete)).state?.program.program.name).toBe('Confirmed coach edit');
    offline();
    expect((await loadActiveAthleteProgram(athlete)).source).toBe('offline');
    expect(mocks.program).toHaveBeenCalledTimes(2);
  });

  it('clears an old copy after an authoritative empty response', async () => {
    await loadActiveAthleteProgram(athlete);
    mocks.assignment.mockResolvedValue({ data: null, error: null });
    expect((await loadActiveAthleteProgram(athlete)).state).toBeNull();
    expect(localStorage.getItem(key)).toBeNull();
    offline();
    await expect(loadActiveAthleteProgram(athlete)).rejects.toThrow('offline');
  });

  it('never replaces online errors or server denials with cached success', async () => {
    await loadActiveAthleteProgram(athlete);
    mocks.assignment.mockResolvedValue({ data: null, error: networkError });
    await expect(loadActiveAthleteProgram(athlete)).rejects.toEqual(networkError);
    expect(localStorage.getItem(key)).not.toBeNull();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const denied = { code: '42501', message: 'permission denied' };
    mocks.assignment.mockResolvedValue({ data: null, error: denied });
    await expect(loadActiveAthleteProgram(athlete)).rejects.toEqual(denied);
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('expires copies after 24 hours without extending their age on offline reads', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(100000000);
    await loadActiveAthleteProgram(athlete);
    offline();
    now.mockReturnValue(100000000 + 23 * 3600000);
    expect((await loadActiveAthleteProgram(athlete)).source).toBe('offline');
    now.mockReturnValue(100000000 + 24 * 3600000);
    await expect(loadActiveAthleteProgram(athlete)).rejects.toThrow('offline');
  });

  it.each(['{broken', '{}'])('rejects malformed storage without rendering it: %s', async (raw) => {
    localStorage.setItem(key, raw);
    offline();
    await expect(loadActiveAthleteProgram(athlete)).rejects.toThrow();
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('isolates accounts and preserves drafts and settings on cache cleanup', async () => {
    await loadActiveAthleteProgram(athlete);
    localStorage.setItem(`topset:workout-drafts:v1:${athlete}`, '[pending input]');
    localStorage.setItem('topset:theme:athlete', 'light');
    offline();
    await expect(loadActiveAthleteProgram('20000000-0000-4000-8000-000000000002')).rejects.toThrow();
    clearAthleteProgramCaches();
    expect(localStorage.getItem(key)).toBeNull();
    expect(localStorage.getItem(`topset:workout-drafts:v1:${athlete}`)).toBe('[pending input]');
    expect(localStorage.getItem('topset:theme:athlete')).toBe('light');
  });

  it('keeps snapshots immutable and does not read the live source', async () => {
    mocks.assignment.mockResolvedValue({ data: { ...assignment, sync_mode: 'snapshot', program_snapshot: program }, error: null });
    expect((await loadActiveAthleteProgram(athlete)).state?.program.program.name).toBe('Saved plan');
    expect(mocks.program).not.toHaveBeenCalled();
  });

  it('does not repopulate storage from an in-flight request after account cleanup', async () => {
    let resolveProgram!: (value: typeof program) => void;
    mocks.program.mockReturnValue(new Promise((resolve) => { resolveProgram = resolve; }));
    const pending = loadActiveAthleteProgram(athlete);
    await Promise.resolve();
    clearAthleteProgramCaches();
    resolveProgram(program);
    await pending;
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('reports storage failure while retaining a successful server result', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    const result = await loadActiveAthleteProgram(athlete);
    expect(result.state?.program.program.name).toBe('Saved plan');
    expect(result.warning).toContain('offline');
  });

  it('does not resurrect an older request after a newer empty response', async () => {
    let finish!: (value: typeof program) => void;
    mocks.program.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const old = loadActiveAthleteProgram(athlete);
    await Promise.resolve();
    mocks.assignment.mockResolvedValue({ data: null, error: null });
    await loadActiveAthleteProgram(athlete);
    finish(program);
    await old;
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('preserves only the restored athlete copy during initial session cleanup', async () => {
    await loadActiveAthleteProgram(athlete);
    localStorage.setItem('topset:athlete-program:v2:other-user', 'old data');
    localStorage.setItem(`topset:athlete-program:v1:${athlete}`, 'legacy data');
    clearAthleteProgramCaches(athlete);
    expect(localStorage.getItem(key)).not.toBeNull();
    expect(localStorage.getItem('topset:athlete-program:v2:other-user')).toBeNull();
    expect(localStorage.getItem(`topset:athlete-program:v1:${athlete}`)).toBeNull();
  });
});
