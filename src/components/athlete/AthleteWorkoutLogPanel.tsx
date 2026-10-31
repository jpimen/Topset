import { useCallback, useEffect, useState } from 'react';
import { loadWorkoutSessions, getLocalDraftForDay, storeWorkoutDraft } from '../../lib/athlete/logs';
import type { AthleteDay } from '../../lib/athlete/types';
import type { AthleteWorkoutSession } from '../../lib/athlete/logs';
import type { WorkoutDraft } from '../../lib/athlete/types';

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function makeDraft(assignmentId: string, day: AthleteDay, session?: AthleteWorkoutSession): WorkoutDraft {
  return {
    id: session?.id ?? crypto.randomUUID(),
    assignment_id: assignmentId,
    day_id: day.id,
    session_date: session?.session_date ?? today(),
    completed: false,
    sets: day.exercises.flatMap((exercise) => Array.from({ length: Math.min(100, Math.max(1, exercise.sets ?? 1)) }, (_, index) => {
      const previous = session?.logged_sets.find((item) => item.program_exercise_id === exercise.id && item.set_number === index + 1);
      return { program_exercise_id: exercise.id, set_number: index + 1, load_lifted: previous?.load_lifted ?? null, rpe_lifted: previous?.rpe_lifted ?? null, notes_athlete: previous?.notes_athlete ?? null };
    })),
  };
}

export function AthleteWorkoutLogPanel({ athleteId, assignmentId, day, unit }: { athleteId: string; assignmentId: string; day: AthleteDay; unit: 'kg' | 'lb' }) {
  const [draft, setDraft] = useState<WorkoutDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [status, setStatus] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const sessions = await loadWorkoutSessions(assignmentId);
      const session = sessions.find((item) => item.day_id === day.id);
      const local = getLocalDraftForDay(athleteId, assignmentId, day.id);
      setDraft(local ?? makeDraft(assignmentId, day, session));
      setStatus(local ? 'Saved on this device · waiting to sync' : session ? 'Synced to your coach' : 'Not saved yet');
    } catch (error) {
      console.error('Workout log could not be loaded.', error);
      setLoadError('We could not load this day’s workout log. Try again before editing.');
    } finally {
      setLoading(false);
    }
  }, [athleteId, assignmentId, day, retryKey]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const changed = (event: Event) => {
      if ((event as CustomEvent<{ athleteId: string }>).detail?.athleteId !== athleteId) return;
      const local = getLocalDraftForDay(athleteId, assignmentId, day.id);
      if (local) {
        setDraft(local);
        setStatus('Saved on this device · syncing to your coach');
      } else {
        void loadWorkoutSessions(assignmentId).then((sessions) => {
          const session = sessions.find((item) => item.day_id === day.id);
          if (session) { setDraft(makeDraft(assignmentId, day, session)); setStatus('Synced to your coach'); }
        }).catch(() => undefined);
      }
    };
    window.addEventListener('topset:workout-drafts-changed', changed);
    return () => window.removeEventListener('topset:workout-drafts-changed', changed);
  }, [athleteId, assignmentId, day, load]);

  const updateSet = (exerciseId: string, setNumber: number, field: 'load_lifted' | 'rpe_lifted', value: number | null) => {
    if (!draft) return;
    const next = { ...draft, sets: draft.sets.map((item) => item.program_exercise_id === exerciseId && item.set_number === setNumber ? { ...item, [field]: value } : item) };
    try { storeWorkoutDraft(athleteId, next); setDraft(next); setStatus('Saved on this device · waiting to sync'); }
    catch (error) { setLoadError(error instanceof Error ? error.message : 'Could not save on this device.'); }
  };

  const updateNotes = (exerciseId: string, note: string) => {
    if (!draft) return;
    const next = { ...draft, sets: draft.sets.map((item) => item.program_exercise_id === exerciseId ? { ...item, notes_athlete: item.set_number === 1 ? (note || null) : null } : item) };
    try { storeWorkoutDraft(athleteId, next); setDraft(next); setStatus('Saved on this device · waiting to sync'); }
    catch (error) { setLoadError(error instanceof Error ? error.message : 'Could not save on this device.'); }
  };

  const save = () => {
    if (!draft) return;
    try {
      storeWorkoutDraft(athleteId, { ...draft, session_date: today() });
      setStatus(navigator.onLine ? 'Saved on this device · syncing to your coach' : 'Saved on this device · will sync when online');
    } catch (error) { setLoadError(error instanceof Error ? error.message : 'Could not save this workout log.'); }
  };
  const hasEntries = draft?.sets.some((set) => set.load_lifted !== null || set.rpe_lifted !== null || set.notes_athlete !== null) ?? false;

  return <section className="athlete-workout-log" aria-labelledby={`workout-log-${day.id}`}>
    <header className="athlete-workout-log-heading"><div><p className="eyebrow">TRAINING LOG</p><h3 id={`workout-log-${day.id}`}>Record your sets</h3><p>Enter the load and RPE you lifted. Your coach can see entries after they sync.</p></div><span className="checkin-status" role="status">{status}</span></header>
    {loading ? <div className="dashboard-skeleton athlete-workout-log-skeleton" aria-label="Loading workout log" /> : loadError ? <div className="athlete-checkin-error" role="alert"><p>{loadError}</p><button className="button button-secondary" type="button" onClick={() => setRetryKey((current) => current + 1)}>Try again</button></div> : draft && day.exercises.length === 0 ? <p className="athlete-program-empty-day">Add exercises to this day before logging sets.</p> : draft && <>
      <div className="athlete-workout-log-list">{day.exercises.map((exercise) => {
        const sets = draft.sets.filter((item) => item.program_exercise_id === exercise.id).sort((a, b) => a.set_number - b.set_number);
        const note = sets.find((item) => item.notes_athlete)?.notes_athlete ?? '';
        return <section className="athlete-workout-log-exercise" key={exercise.id}>
          <div className="athlete-workout-log-exercise-heading"><strong>{exercise.exercise.name}</strong><span>{exercise.rpe === null ? 'RPE not prescribed' : `Prescribed RPE ${exercise.rpe}`}</span></div>
          <div className="athlete-workout-log-table-wrap"><table className="athlete-workout-log-table"><caption className="visually-hidden">{exercise.exercise.name} set log</caption><thead><tr><th scope="col">Set</th><th scope="col">Load lifted ({unit})</th><th scope="col">RPE lifted</th></tr></thead><tbody>{sets.map((item) => <tr key={item.set_number}>
            <th scope="row">{item.set_number}</th>
            <td><input aria-label={`${exercise.exercise.name}, set ${item.set_number}, load lifted`} type="number" min="0" max="10000" step="0.5" value={item.load_lifted ?? ''} placeholder="—" onChange={(event) => updateSet(exercise.id, item.set_number, 'load_lifted', event.currentTarget.value === '' ? null : Number(event.currentTarget.value))} /></td>
            <td><select aria-label={`${exercise.exercise.name}, set ${item.set_number}, RPE lifted`} value={item.rpe_lifted ?? ''} onChange={(event) => updateSet(exercise.id, item.set_number, 'rpe_lifted', event.currentTarget.value ? Number(event.currentTarget.value) : null)}><option value="">—</option>{Array.from({ length: 19 }, (_, index) => (index + 2) / 2).map((value) => <option key={value} value={value}>{value.toFixed(1)}</option>)}</select></td>
          </tr>)}</tbody></table></div>
          <label className="athlete-workout-log-note">Athlete notes<textarea maxLength={2000} value={note} placeholder="Notes for your coach" onChange={(event) => updateNotes(exercise.id, event.currentTarget.value)} /></label>
        </section>;
      })}</div>
      <div className="athlete-workout-log-actions"><span className="checkin-status">Changes save on this device and sync automatically.</span><button className="button button-primary" type="button" onClick={save} disabled={!hasEntries}>Save workout log</button></div>
    </>}
  </section>;
}
