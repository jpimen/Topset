import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { loadWorkoutSessions, readWorkoutDrafts, storeWorkoutDraft, type AthleteWorkoutSession } from '../../lib/athlete/logs';
import { findNextWorkout } from '../../lib/athlete/programs';
import type { UserProfile } from '../../auth/AuthProvider';
import type { AthleteProgramState } from '../../lib/athlete/programs';
import { loggedSetInputSchema, type LoggedSetInput, type WorkoutDraft } from '../../lib/athlete/types';
import { useAthleteWorkoutSync } from './AthleteWorkoutSyncProvider';

function todayLocal() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatLoad(row: { load_mode: string; load_value: number | null; load_min: number | null; load_max: number | null; percent_of?: 'e1rm' | 'tm' | null; rpe: number | null }, unit: string) {
  if (row.load_mode === 'absolute') {
    if (row.load_min !== null && row.load_max !== null && row.load_min !== row.load_max) return `${row.load_min}–${row.load_max} ${unit}`;
    const value = row.load_value ?? row.load_min;
    return value === null ? 'Load not specified' : `${value} ${unit}`;
  }
  if (row.load_mode === 'percent') return `${row.load_value ?? '—'}% of ${row.percent_of === 'tm' ? 'training max' : 'e1RM'}`;
  if (row.load_mode === 'rpe') return `RPE-derived${row.rpe === null ? '' : ` · RPE ${row.rpe}`} · load estimate unavailable`;
  return 'No load prescribed';
}

function overlayDrafts(sessions: AthleteWorkoutSession[], drafts: WorkoutDraft[]): AthleteWorkoutSession[] {
  const map = new Map(sessions.map((session) => [session.id, session]));
  for (const draft of drafts) {
    map.set(draft.id, {
      id: draft.id,
      day_id: draft.day_id,
      session_date: draft.session_date,
      completed_at: draft.completed ? `${draft.session_date}T00:00:00.000Z` : null,
      logged_sets: draft.sets,
    });
  }
  return [...map.values()];
}

export function AthleteWorkoutSection({ profile, result, refreshProgram }: {
  profile: UserProfile | null;
  result: AthleteProgramState;
  refreshProgram: () => void;
}) {
  const { state: syncState, offline, error: syncError, syncVersion, retry: retrySync } = useAthleteWorkoutSync();
  const [sessions, setSessions] = useState<AthleteWorkoutSession[]>([]);
  const [drafts, setDrafts] = useState<WorkoutDraft[]>([]);
  const [sessionError, setSessionError] = useState('');
  const [storageError, setStorageError] = useState('');

  const reloadSessions = useCallback(async () => {
    if (!profile?.id || !result?.assignment.id) return;
    try {
      setSessions(await loadWorkoutSessions(result.assignment.id));
      setSessionError('');
    } catch (cause) {
      console.error('Workout sessions could not be loaded.', cause);
      if (window.navigator.onLine) setSessionError('Saved workout history could not be loaded. Your local entries are still available.');
    }
    setDrafts(readWorkoutDrafts(profile.id));
  }, [profile?.id, result?.assignment.id]);

  useEffect(() => { void reloadSessions(); }, [reloadSessions]);
  useEffect(() => {
    if (syncVersion > 0) void reloadSessions();
  }, [syncVersion, reloadSessions]);

  const visibleSessions = useMemo(() => overlayDrafts(sessions, drafts), [sessions, drafts]);
  const completedDayIds = useMemo(() => new Set(visibleSessions.filter((session) => session.completed_at).map((session) => session.day_id)), [visibleSessions]);
  const nextWorkout = result ? findNextWorkout(result.program, completedDayIds) : null;
  const pendingForDay = result && nextWorkout
    ? drafts.find((draft) => draft.assignment_id === result.assignment.id && draft.day_id === nextWorkout.day.id)
    : undefined;
  const partialForDay = result && nextWorkout
    ? sessions.find((session) => session.day_id === nextWorkout.day.id && !session.completed_at)
    : undefined;

  const draft = useMemo<WorkoutDraft | null>(() => {
    if (!result || !nextWorkout) return null;
    if (pendingForDay) return pendingForDay;
    if (partialForDay) {
      return {
        id: partialForDay.id,
        assignment_id: result.assignment.id,
        day_id: partialForDay.day_id,
        session_date: partialForDay.session_date,
        completed: false,
        sets: partialForDay.logged_sets.map((set) => ({ ...set })),
      };
    }
    return { id: crypto.randomUUID(), assignment_id: result.assignment.id, day_id: nextWorkout.day.id, session_date: todayLocal(), completed: false, sets: [] };
  }, [result, nextWorkout, pendingForDay, partialForDay]);

  const updateDraft = useCallback((change: (current: WorkoutDraft) => WorkoutDraft) => {
    if (!draft || !profile?.id) return;
    const next = change(draft);
    setStorageError('');
    try {
      const nextDrafts = storeWorkoutDraft(profile.id, next);
      setDrafts(nextDrafts);
    } catch (cause) {
      setStorageError(cause instanceof Error ? cause.message : 'Workout could not be saved on this device.');
    }
  }, [draft, profile?.id]);

  const updateSet = (exerciseId: string, setNumber: number, patch: Partial<LoggedSetInput>) => {
    updateDraft((current) => {
      const index = current.sets.findIndex((set) => set.program_exercise_id === exerciseId && set.set_number === setNumber);
      const existing = index >= 0 ? current.sets[index] : {
        program_exercise_id: exerciseId, set_number: setNumber, load_lifted: null, rpe_lifted: null, notes_athlete: null,
      };
      const parsed = loggedSetInputSchema.safeParse({ ...existing, ...patch });
      if (!parsed.success) return current;
      const sets = [...current.sets];
      if (index >= 0) sets[index] = parsed.data;
      else sets.push(parsed.data);
      return { ...current, sets };
    });
  };

  if (!nextWorkout) return <section className="athlete-next-workout"><header className="athlete-page-heading"><div><p className="eyebrow">NEXT WORKOUT</p><h2>Plan complete</h2><p>You have completed every workout in {result.program.program.name}. {syncState === 'saved' ? 'Your workout logs are synced.' : 'Workout logs are still saved on this device and need to sync.'}</p></div></header><div className={`workout-sync sync-${syncState}`} role="status"><span aria-hidden="true" />{offline ? 'Offline · saved on this device' : syncState === 'saved' ? 'Synced' : syncState === 'saving' ? 'Syncing…' : syncState === 'error' ? 'Sync issue' : 'Saved on this device · pending sync'}</div>{syncError && <div className="alert-banner alert-info" role="status"><span className="alert-mark">i</span><div>{syncError}{drafts.length > 0 && <button className="button button-quiet" onClick={() => void retrySync()}>Retry sync</button>}</div></div>}</section>;
  if (!draft) return null;

  const { week, day } = nextWorkout;
  const syncLabel = syncState === 'saved' ? 'Synced' : syncState === 'saving' ? 'Syncing…' : syncState === 'error' ? 'Sync issue' : 'Saved on this device · pending sync';
  const existingSet = (exerciseId: string, setNumber: number) => draft.sets.find((set) => set.program_exercise_id === exerciseId && set.set_number === setNumber);

  return (
    <section className="athlete-next-workout" aria-label="Next workout">
      <header className="athlete-page-heading">
        <div><p className="eyebrow">NEXT WORKOUT · {week.name.toUpperCase()} / {day.name.toUpperCase()}</p><h2>{day.name}</h2><p>{day.notes || `From ${result.program.program.name}. Prescriptions are set by your coach.`}</p></div>
        <div className="athlete-program-heading-actions"><div className={`workout-sync sync-${syncState}`} role="status"><span aria-hidden="true" />{offline ? 'Offline · saved on this device' : syncLabel}</div><button className="button button-secondary" onClick={refreshProgram}>Refresh program</button></div>
      </header>
      {(syncError || storageError || sessionError) && <div className="alert-banner alert-info" role="status"><span className="alert-mark">i</span><div>{storageError || syncError || sessionError}{drafts.length > 0 && <button className="button button-quiet" onClick={() => void retrySync()}>Retry sync</button>}</div></div>}
      {offline && <div className="alert-banner alert-info" role="status"><span className="alert-mark">i</span><div>You are offline. Workout changes are stored on this device and will sync when the connection returns.</div></div>}
      <section className="athlete-session" aria-label={`${week.name} ${day.name} workout`}>
        {day.exercises.length === 0 ? <div className="coach-panel empty-state"><h2>No exercises in this workout</h2><p>Your coach has not added exercises to this day yet.</p></div> : day.exercises.map((row, rowIndex) => {
          const setCount = row.sets ?? 1;
          return <article className="athlete-exercise-entry" key={row.id}>
            <div className="athlete-exercise-heading"><div><p className="eyebrow">EXERCISE {String(rowIndex + 1).padStart(2, '0')}</p><h2>{row.exercise.name}</h2></div><span className="athlete-prescription">{setCount} × {row.reps}{row.rpe === null ? '' : ` @ RPE ${row.rpe}`}</span></div>
            <p className="athlete-prescribed-load">{formatLoad(row, result.program.program.unit)}</p>
            {row.notes_coach && <p className="athlete-coach-note"><strong>Coach note</strong>{row.notes_coach}</p>}
            <div className="athlete-log-grid"><span className="log-column-label">SET</span><span className="log-column-label">LOAD LIFTED ({result.program.program.unit})</span><span className="log-column-label">RPE LIFTED</span>
              {Array.from({ length: Math.min(Math.max(setCount, 1), 100) }, (_, index) => {
                const number = index + 1;
                const logged = existingSet(row.id, number);
                return <div className="athlete-set-row" key={number}>
                  <span className="athlete-set-number">{number}</span>
                  <label className="visually-hidden" htmlFor={`load-${row.id}-${number}`}>Set {number} load lifted in {result.program.program.unit}</label>
                  <input id={`load-${row.id}-${number}`} inputMode="decimal" type="number" min="0" step="0.5" placeholder="—" value={logged?.load_lifted ?? ''} onChange={(event: ChangeEvent<HTMLInputElement>) => updateSet(row.id, number, { load_lifted: event.target.value === '' ? null : Number(event.target.value) })} />
                  <label className="visually-hidden" htmlFor={`rpe-${row.id}-${number}`}>Set {number} RPE lifted</label>
                  <select id={`rpe-${row.id}-${number}`} value={logged?.rpe_lifted ?? ''} onChange={(event) => updateSet(row.id, number, { rpe_lifted: event.target.value === '' ? null : Number(event.target.value) })}>
                    <option value="">—</option>{Array.from({ length: 19 }, (_, index) => 1 + index * 0.5).map((value) => <option key={value} value={value}>{value.toFixed(1)}</option>)}
                  </select>
                </div>;
              })}
            </div>
            <label className="form-field athlete-notes-field">Notes for your coach<textarea maxLength={2000} rows={2} value={existingSet(row.id, 1)?.notes_athlete ?? ''} onChange={(event) => updateSet(row.id, 1, { notes_athlete: event.target.value || null })} aria-label={`${row.exercise.name} notes for your coach`} /></label>
          </article>;
        })}
      </section>
      <footer className="athlete-session-footer"><p>Prescription is read-only. Your coach can see your synced training log.</p><button className="button button-primary athlete-finish-button" onClick={() => updateDraft((current) => ({ ...current, completed: true }))} disabled={draft.completed}>{draft.completed ? 'Workout completed' : 'Finish workout'}</button></footer>
    </section>
  );
}
