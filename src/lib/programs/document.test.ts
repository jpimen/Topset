import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDebouncedSave } from './autosave';
import { createEmptyDocument, createProgramHistory, createRow, parseReps, programReducer, validateLoad } from './document';

beforeEach(() => {
  vi.useRealTimers();
});

describe('program builder input validation', () => {
  it('parses exact reps, ranges, and timed reps without changing input text', () => {
    expect(parseReps('5')).toEqual({ valid: true, min: 5, max: 5, timed: false });
    expect(parseReps('3-5')).toEqual({ valid: true, min: 3, max: 5, timed: false });
    expect(parseReps('1min')).toEqual({ valid: true, min: null, max: null, timed: true });
    expect(parseReps('5-3').valid).toBe(false);
    expect(parseReps('0').valid).toBe(false);
  });

  it('uses engine validation for RPE ranges and engine rounding for absolute loads', () => {
    expect(validateLoad('', 'rpe', 'kg', '8', 7).hint).toContain('unavailable above 10 effective reps');
    expect(validateLoad('', 'rpe', 'kg', '1', 7).valid).toBe(true);
    expect(validateLoad('130-132.5', 'absolute', 'kg', '5', null)).toMatchObject({ valid: true, min: 130, max: 132.5 });
    expect(validateLoad('85', 'percent', 'kg', '5', null)).toMatchObject({ valid: true, min: 85, max: 85 });
    expect(validateLoad('132.5-130', 'absolute', 'kg', '5', null).valid).toBe(false);
    expect(validateLoad('180', 'absolute', 'lb', '5', null)).toMatchObject({ min: 180, max: 180 });
  });
});

describe('program reducer history', () => {
  it('supports undo and redo for edits and clears the redo branch after new work', () => {
    const initial = createProgramHistory(createEmptyDocument('coach'));
    const addedWeek = programReducer(initial, { type: 'add-week' });
    expect(addedWeek.present.weeks).toHaveLength(2);
    const undone = programReducer(addedWeek, { type: 'undo' });
    expect(undone.present.weeks).toHaveLength(1);
    const redone = programReducer(undone, { type: 'redo' });
    expect(redone.present.weeks).toHaveLength(2);
    expect(programReducer(redone, { type: 'rename-program', name: 'New' }).future).toHaveLength(0);
  });

  it('keeps up to 50 undo steps and reverses cell, row, day, and week operations', () => {
    let state = createProgramHistory(createEmptyDocument('coach'));
    for (let i = 0; i < 55; i += 1) state = programReducer(state, { type: 'rename-program', name: `Program ${i}` });
    expect(state.past).toHaveLength(50);
    state = createProgramHistory(createEmptyDocument('coach'));
    state = programReducer(state, { type: 'add-day', weekId: state.present.weeks[0].id });
    const week = state.present.weeks[0];
    const day = week.days[0];
    state = programReducer(state, { type: 'add-row', weekId: week.id, dayId: day.id, row: createRow(day.id, 'exercise', 0) });
    state = programReducer(state, { type: 'update-row', weekId: week.id, dayId: day.id, rowId: day.exercises[0]?.id ?? state.present.weeks[0].days[0].exercises[0].id, patch: { reps: '1x1' } });
    expect(state.present.weeks[0].days[0].exercises[0].reps).toBe('1x1');
    state = programReducer(state, { type: 'undo' });
    expect(state.present.weeks[0].days[0].exercises[0].reps).toBe('5');
    state = programReducer(state, { type: 'undo' });
    expect(state.present.weeks[0].days[0].exercises).toHaveLength(0);
    state = programReducer(state, { type: 'undo' });
    expect(state.present.weeks[0].days).toHaveLength(0);
  });
});

describe('debounced program save', () => {
  it('coalesces rapid edits and flushes the newest document', async () => {
    vi.useFakeTimers();
    const save = vi.fn((value: string) => value);
    const autosave = createDebouncedSave<string>(async (value) => { save(value); }, 600);
    autosave.schedule('one');
    autosave.schedule('two');
    await vi.advanceTimersByTimeAsync(599);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await autosave.flush();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenLastCalledWith('two');
  });

  it('flushes pending edits immediately when requested', async () => {
    const save = vi.fn((value: number) => value);
    const autosave = createDebouncedSave<number>(async (value) => { save(value); }, 600);
    autosave.schedule(42);
    await autosave.flush();
    expect(save).toHaveBeenCalledWith(42);
  });

  it('rejects a flush when the server save fails so navigation can be stopped', async () => {
    const autosave = createDebouncedSave<string>(async () => { throw new Error('save failed'); }, 600);
    autosave.schedule('latest');
    await expect(autosave.flush()).rejects.toThrow('save failed');
  });
});
