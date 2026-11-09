import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getLocalDraftForDay, storeWorkoutDraft } from '../../lib/athlete/logs';
import { workoutDraftSchema, type AthleteDay, type WorkoutDraft } from '../../lib/athlete/types';
import { athleteExerciseName, athleteLoadLabel, hasUsableExerciseName, isLoggablePrescription } from '../../lib/athlete/prescriptions';
import { useAthleteWorkoutSessions } from './AthleteWorkoutSessionsProvider';
import type { AthleteWorkoutSession } from '../../lib/athlete/logs';

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function makeDraft(assignmentId: string, day: AthleteDay, session?: AthleteWorkoutSession, previousDraft?: WorkoutDraft): WorkoutDraft {
  return {
    id: session?.id ?? previousDraft?.id ?? crypto.randomUUID(),
    assignment_id: assignmentId,
    day_id: day.id,
    session_date: session?.session_date ?? previousDraft?.session_date ?? today(),
    completed: previousDraft?.completed ?? false,
    sets: day.exercises.filter((exercise) => hasUsableExerciseName(exercise) && isLoggablePrescription(exercise)).flatMap((exercise) => {
      const previousSets = session?.logged_sets.filter((item) => item.program_exercise_id === exercise.id)
        ?? previousDraft?.sets.filter((item) => item.program_exercise_id === exercise.id)
        ?? [];
      const previousCount = previousSets.reduce((maximum, item) => Math.max(maximum, item.set_number), 0);
      const prescribedCount = session || previousDraft ? previousCount : exercise.sets ?? 0;
      const count = Math.min(100, prescribedCount);
      return Array.from({ length: count }, (_, index) => {
        const previous = previousSets.find((item) => item.set_number === index + 1);
        return { program_exercise_id: exercise.id, set_number: index + 1, load_lifted: previous?.load_lifted ?? null, rpe_lifted: previous?.rpe_lifted ?? null, notes_athlete: previous?.notes_athlete ?? null };
      });
    }),
  };
}

export function AthleteWorkoutLogRows({ athleteId, assignmentId, day, unit, onEditStateChange }: {
  athleteId: string; assignmentId: string; day: AthleteDay; unit: 'kg' | 'lb';
  onEditStateChange?: (key: string, dirty: boolean) => void;
}) {
  const { sessions, loading, error: historyError, refresh } = useAthleteWorkoutSessions();
  const [draft, setDraft] = useState<WorkoutDraft | null>(null);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingSync, setPendingSync] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [localVersion, setLocalVersion] = useState(0);
  const dirtyRef = useRef(false);
  const dirty = Boolean(draft && savedSnapshot && JSON.stringify(draft) !== savedSnapshot);
  dirtyRef.current = dirty;
  const editable = Boolean(draft && !loadError && (pendingSync || sessions !== null));
  const editKey = `log:${assignmentId}:${day.id}`;

  useEffect(() => {
    onEditStateChange?.(editKey, dirty);
    return () => onEditStateChange?.(editKey, false);
  }, [dirty, editKey, onEditStateChange]);

  useEffect(() => {
    if (dirtyRef.current) return;
    try {
      const local = getLocalDraftForDay(athleteId, assignmentId, day.id);
      setPendingSync(Boolean(local));
      setLoadError('');
      if (!local && (loading || sessions === null)) return;
      const session = sessions?.find((item) => item.day_id === day.id);
      const value = local ? makeDraft(assignmentId, day, undefined, local) : makeDraft(assignmentId, day, session);
      setDraft(value);
      setSavedSnapshot(JSON.stringify(value));
      setSaveStatus(local ? 'Saved on this device - waiting to sync' : session ? 'Synced to coach' : '');
    } catch (cause) {
      console.error('Local workout draft could not be loaded.', cause);
      setLoadError(cause instanceof Error ? cause.message : 'Pending workout input could not be read.');
    }
  }, [athleteId, assignmentId, day, sessions, loading, localVersion]);

  useEffect(() => {
    const changed = (event: Event) => {
      if ((event as CustomEvent<{ athleteId: string }>).detail?.athleteId === athleteId) setLocalVersion((value) => value + 1);
    };
    const storage = (event: StorageEvent) => {
      if (event.key === null || event.key === `topset:workout-drafts:v1:${athleteId}`) setLocalVersion((value) => value + 1);
    };
    window.addEventListener('topset:workout-drafts-changed', changed);
    window.addEventListener('storage', storage);
    return () => {
      window.removeEventListener('topset:workout-drafts-changed', changed);
      window.removeEventListener('storage', storage);
    };
  }, [athleteId]);

  const updateSet = (exerciseId: string, setNumber: number, field: 'load_lifted' | 'rpe_lifted', value: number | null) => {
    if (!draft) return;
    setDraft({ ...draft, sets: draft.sets.map((item) => item.program_exercise_id === exerciseId && item.set_number === setNumber ? { ...item, [field]: value } : item) });
    setSaveError('');
    setSaveStatus('Unsaved changes');
  };
  const updateNotes = (exerciseId: string, setNumber: number, note: string) => {
    if (!draft) return;
    setDraft({ ...draft, sets: draft.sets.map((item) => item.program_exercise_id === exerciseId && item.set_number === setNumber ? { ...item, notes_athlete: note || null } : item) });
    setSaveError('');
    setSaveStatus('Unsaved changes');
  };
  const addSet = (exerciseId: string) => {
    if (!draft || !editable || saving) return;
    const exerciseSets = draft.sets.filter((item) => item.program_exercise_id === exerciseId);
    const nextSetNumber = exerciseSets.reduce((maximum, item) => Math.max(maximum, item.set_number), 0) + 1;
    if (nextSetNumber > 100) return;
    setDraft({ ...draft, sets: [...draft.sets, { program_exercise_id: exerciseId, set_number: nextSetNumber, load_lifted: null, rpe_lifted: null, notes_athlete: null }] });
    setSaveError('');
    setSaveStatus('Unsaved changes');
  };
  const removeSet = (exerciseId: string, setNumber: number) => {
    if (!draft || !editable || saving) return;
    const exerciseSets = draft.sets.filter((item) => item.program_exercise_id === exerciseId).sort((a, b) => a.set_number - b.set_number);
    const remaining = exerciseSets.filter((item) => item.set_number !== setNumber);
    const renumbered = remaining.map((item, index) => ({ ...item, set_number: index + 1 }));
    setDraft({ ...draft, sets: [...draft.sets.filter((item) => item.program_exercise_id !== exerciseId), ...renumbered] });
    setSaveError('');
    setSaveStatus('Unsaved changes');
  };
  const hasChanges = dirty || pendingSync;
  const saveChanges = useCallback(() => {
    if (!draft || !editable || saving || !hasChanges) return;
    const parsed = workoutDraftSchema.safeParse({ ...draft, session_date: today() });
    if (!parsed.success) { setSaveError(parsed.error.issues[0]?.message ?? 'Check the workout values.'); return; }
    setSaving(true);
    setSaveError('');
    try {
      // Persist first. The workspace sync provider is the only remote writer.
      storeWorkoutDraft(athleteId, parsed.data);
      setDraft(parsed.data);
      setSavedSnapshot(JSON.stringify(parsed.data));
      setPendingSync(true);
      setSaveStatus('Saved on this device - waiting to sync');
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Could not save this workout on the device.');
      setSaveStatus('Changes were not saved');
    } finally { setSaving(false); }
  }, [athleteId, draft, editable, hasChanges, saving]);

  useEffect(() => {
    if (!dirty || !editable) return;
    const timer = window.setTimeout(saveChanges, 450);
    return () => window.clearTimeout(timer);
  }, [dirty, draft, editable, saveChanges]);

  return <>
    {(loadError || historyError) && <tr><td colSpan={10}><div className="athlete-checkin-error" role="alert"><p>{loadError || historyError}</p><button className="button button-secondary" type="button" onClick={() => { setLocalVersion((value) => value + 1); refresh(); }}>Try again</button></div></td></tr>}
    {loading && sessions === null && <tr><td colSpan={10}><p role="status">Loading workout entries...</p></td></tr>}
    {day.exercises.map((exercise) => {
      const exerciseName = athleteExerciseName(exercise);
      if (!exerciseName) return null;
      if (!isLoggablePrescription(exercise)) return <tr key={exercise.id} className="athlete-program-unprescribed-row">
        <th scope="row" className="athlete-program-exercise">{exerciseName}</th>
        <td colSpan={9}>— <span>Not prescribed</span></td>
      </tr>;
      const sets = draft?.sets.filter((item) => item.program_exercise_id === exercise.id).sort((a, b) => a.set_number - b.set_number) ?? [];
      return <tr key={exercise.id}>
        <th scope="row" className="athlete-program-exercise">{exerciseName}</th>
        <td><span className={`athlete-program-set-type${exercise.set_type ? ` set-type-${exercise.set_type.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}` : ''}`}>{exercise.set_type ?? '—'}</span></td>
        <td>{exercise.sets ?? '—'}</td>
        <td>{exercise.reps || '—'}</td>
        <td>{exercise.rpe ?? '—'}</td>
        <td className="athlete-program-prescribed-load">{athleteLoadLabel(exercise, unit)}</td>
        <td className="athlete-program-coach-notes">{exercise.notes_coach || '—'}</td>
        <td colSpan={3}>
          <details className="athlete-program-set-log">
            <summary>Log sets <span>({sets.length})</span></summary>
            <div className="athlete-program-set-grid" aria-label={`${exerciseName} workout log`}>
              <div className="athlete-program-set-grid-header"><span>Set</span><span>Load lifted ({unit})</span><span>RPE lifted</span><span>Athlete notes</span></div>
              {sets.map((set) => <div className="athlete-program-set-grid-row" key={set.set_number}>
                <span className="athlete-program-set-number">Set {set.set_number}</span>
                <input className="athlete-program-log-input" aria-label={`${exerciseName}, set ${set.set_number}, load lifted`} type="number" inputMode="decimal" min="0" max="10000" step="0.5" value={set.load_lifted ?? ''} placeholder={unit} disabled={!editable || saving} onChange={(event) => updateSet(exercise.id, set.set_number, 'load_lifted', event.currentTarget.value === '' ? null : Number(event.currentTarget.value))} />
                <select className="athlete-program-log-input" aria-label={`${exerciseName}, set ${set.set_number}, RPE lifted`} value={set.rpe_lifted ?? ''} disabled={!editable || saving} onChange={(event) => updateSet(exercise.id, set.set_number, 'rpe_lifted', event.currentTarget.value ? Number(event.currentTarget.value) : null)}><option value="">Select RPE</option>{Array.from({ length: 9 }, (_, optionIndex) => 6 + optionIndex * 0.5).map((value) => <option key={value} value={value}>{value.toFixed(1)}</option>)}</select>
                <div className="athlete-program-set-note-controls">
                  <input className="athlete-program-log-input athlete-program-log-note" aria-label={`${exerciseName}, set ${set.set_number}, athlete notes`} maxLength={2000} value={set.notes_athlete ?? ''} placeholder="Add note" disabled={!editable || saving} onChange={(event) => updateNotes(exercise.id, set.set_number, event.currentTarget.value)} />
                  <button className="athlete-program-set-remove" type="button" aria-label={`Remove set ${set.set_number} from ${exerciseName}`} title="Remove set" disabled={!editable || saving} onClick={() => removeSet(exercise.id, set.set_number)}>×</button>
                </div>
              </div>)}
              <button className="athlete-program-add-set" type="button" disabled={!editable || saving || sets.length >= 100} onClick={() => addSet(exercise.id)}>+ Add set</button>
            </div>
          </details>
        </td>
      </tr>;
    })}
    {draft && !loadError && <tr className="athlete-program-log-save-row"><td colSpan={10}><div className="athlete-program-log-save-controls">
      <div><span className="checkin-status" role="status">{saving ? 'Saving changes…' : saveStatus || (pendingSync ? 'Waiting to sync' : 'Changes save automatically after a short pause.')}</span>{saveError && <p className="athlete-program-log-error" role="alert">{saveError}</p>}</div>
      <div className="athlete-program-log-actions"><Link className="button button-secondary" to={`/athlete/post-video?${new URLSearchParams({ assignmentId, dayId: day.id, dayName: day.name })}`}>Post Video</Link></div>
    </div></td></tr>}
  </>;
}
