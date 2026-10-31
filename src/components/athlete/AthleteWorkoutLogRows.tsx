import { useCallback, useEffect, useState } from 'react';
import { loadWorkoutSessions, getLocalDraftForDay, storeWorkoutDraft } from '../../lib/athlete/logs';
import type { AthleteDay } from '../../lib/athlete/types';
import type { AthleteWorkoutSession } from '../../lib/athlete/logs';
import type { WorkoutDraft } from '../../lib/athlete/types';

function loadLabel(row: AthleteDay['exercises'][number], unit: string) {
  const low = row.load_min ?? row.load_value;
  const high = row.load_max;
  if (row.load_mode === 'absolute') return low === null ? 'Load not specified' : high !== null && high !== low ? `${low}–${high} ${unit}` : `${low} ${unit}`;
  if (row.load_mode === 'percent') return `${low === null ? '—' : high !== null && high !== low ? `${low}–${high}` : low}% of ${row.percent_of === 'tm' ? 'training max' : 'e1RM'}`;
  if (row.load_mode === 'rpe') return 'RPE-derived · load estimate unavailable';
  return 'No load prescribed';
}

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

export function AthleteWorkoutLogRows({ athleteId, assignmentId, day, unit }: { athleteId: string; assignmentId: string; day: AthleteDay; unit: 'kg' | 'lb' }) {
  const [draft, setDraft] = useState<WorkoutDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const sessions = await loadWorkoutSessions(assignmentId);
      const session = sessions.find((item) => item.day_id === day.id);
      const local = getLocalDraftForDay(athleteId, assignmentId, day.id);
      setDraft(local ?? makeDraft(assignmentId, day, session));
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
      } else {
        void loadWorkoutSessions(assignmentId).then((sessions) => {
          const session = sessions.find((item) => item.day_id === day.id);
          if (session) setDraft(makeDraft(assignmentId, day, session));
        }).catch(() => undefined);
      }
    };
    window.addEventListener('topset:workout-drafts-changed', changed);
    return () => window.removeEventListener('topset:workout-drafts-changed', changed);
  }, [athleteId, assignmentId, day, load]);

  const updateSet = (exerciseId: string, field: 'load_lifted' | 'rpe_lifted', value: number | null) => {
    if (!draft) return;
    const next = { ...draft, sets: draft.sets.map((item) => item.program_exercise_id === exerciseId ? { ...item, [field]: value } : item) };
    try { storeWorkoutDraft(athleteId, next); setDraft(next); }
    catch (error) { setLoadError(error instanceof Error ? error.message : 'Could not save on this device.'); }
  };

  const updateNotes = (exerciseId: string, note: string) => {
    if (!draft) return;
    const next = { ...draft, sets: draft.sets.map((item) => item.program_exercise_id === exerciseId ? { ...item, notes_athlete: item.set_number === 1 ? (note || null) : null } : item) };
    try { storeWorkoutDraft(athleteId, next); setDraft(next); }
    catch (error) { setLoadError(error instanceof Error ? error.message : 'Could not save on this device.'); }
  };

  return <>
    {loading ? <tr><td colSpan={10}><div className="dashboard-skeleton athlete-program-log-loading" aria-label="Loading workout log" /></td></tr> : loadError ? <tr><td colSpan={10}><div className="athlete-checkin-error" role="alert"><p>{loadError}</p><button className="button button-secondary" type="button" onClick={() => setRetryKey((current) => current + 1)}>Try again</button></div></td></tr> : draft && day.exercises.map((exercise) => {
      const sets = draft.sets.filter((item) => item.program_exercise_id === exercise.id).sort((a, b) => a.set_number - b.set_number);
      const first = sets[0];
      const note = sets.find((item) => item.notes_athlete)?.notes_athlete ?? '';
      return <tr key={exercise.id}>
        <th scope="row" className="athlete-program-exercise">{exercise.exercise.name}</th>
        <td><span className={`athlete-program-set-type${exercise.set_type ? ` set-type-${exercise.set_type}` : ''}`}>{exercise.set_type ?? '—'}</span></td>
        <td>{exercise.sets ?? '—'}</td>
        <td>{exercise.reps || '—'}</td>
        <td>{exercise.rpe ?? '—'}</td>
        <td>{loadLabel(exercise, unit)}</td>
        <td className="athlete-program-coach-notes">{exercise.notes_coach || '—'}</td>
        <td><input className="athlete-program-log-input" aria-label={`${exercise.exercise.name}, load lifted for all sets`} type="number" min="0" max="10000" step="0.5" value={first?.load_lifted ?? ''} placeholder="—" disabled={!first} onChange={(event) => updateSet(exercise.id, 'load_lifted', event.currentTarget.value === '' ? null : Number(event.currentTarget.value))} /></td>
        <td><select className="athlete-program-log-input" aria-label={`${exercise.exercise.name}, RPE lifted for all sets`} value={first?.rpe_lifted ?? ''} disabled={!first} onChange={(event) => updateSet(exercise.id, 'rpe_lifted', event.currentTarget.value ? Number(event.currentTarget.value) : null)}><option value="">—</option>{Array.from({ length: 19 }, (_, index) => (index + 2) / 2).map((value) => <option key={value} value={value}>{value.toFixed(1)}</option>)}</select></td>
        <td><input className="athlete-program-log-input athlete-program-log-note" aria-label={`${exercise.exercise.name}, athlete notes`} maxLength={2000} value={note} placeholder="Add note" disabled={!first} onChange={(event) => updateNotes(exercise.id, event.currentTarget.value)} /></td>
      </tr>;
    })}
  </>;
}
