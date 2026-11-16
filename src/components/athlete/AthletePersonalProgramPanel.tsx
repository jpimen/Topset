import { useState, type FormEvent } from 'react';
import {
  type AthletePersonalProgram,
  type PersonalDay,
  type PersonalExercise,
  type PersonalWeek,
} from '../../lib/athlete/personalPrograms';

function newPersonalProgram(unit: 'kg' | 'lb'): AthletePersonalProgram {
  return { id: crypto.randomUUID(), name: 'My program', unit, weeks: [] };
}

function newWeek(position: number): PersonalWeek {
  return { id: crypto.randomUUID(), name: `Week ${position + 1}`, days: [] };
}

function newDay(position: number): PersonalDay {
  return { id: crypto.randomUUID(), name: `Day ${position + 1}`, exercises: [] };
}

function newExercise(): PersonalExercise {
  return { id: crypto.randomUUID(), name: 'Squat', sets: 3, reps: '5', rpe: null, load: '' };
}

export function AthletePersonalProgramPanel({
  program, defaultUnit, loadError, onSave,
}: {
  program: AthletePersonalProgram | null;
  defaultUnit: 'kg' | 'lb';
  loadError: string;
  onSave: (program: AthletePersonalProgram) => Promise<void>;
}) {
  const [draft, setDraft] = useState<AthletePersonalProgram | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const startEditing = () => { setDraft(program ? structuredClone(program) : newPersonalProgram(defaultUnit)); setError(''); setStatus(''); };
  const updateWeek = (weekId: string, transform: (week: PersonalWeek) => PersonalWeek) => setDraft((current) => current && ({ ...current, weeks: current.weeks.map((week) => week.id === weekId ? transform(week) : week) }));
  const updateDay = (weekId: string, dayId: string, transform: (day: PersonalDay) => PersonalDay) => updateWeek(weekId, (week) => ({ ...week, days: week.days.map((day) => day.id === dayId ? transform(day) : day) }));
  const updateExercise = (weekId: string, dayId: string, exerciseId: string, patch: Partial<PersonalExercise>) => updateDay(weekId, dayId, (day) => ({ ...day, exercises: day.exercises.map((exercise) => exercise.id === exerciseId ? { ...exercise, ...patch } : exercise) }));

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) return;
    setSaving(true); setError(''); setStatus('');
    try {
      await onSave(draft);
      setDraft(null);
      setStatus('Saved privately to your account.');
    } catch (cause) {
      console.error('Athlete personal program could not be saved.', cause);
      setError('Your program could not be saved. Check your connection and try again.');
    } finally { setSaving(false); }
  };

  if (loadError) return <section className="coach-panel athlete-personal-program-panel" role="alert"><p className="eyebrow">MY PROGRAM</p><h2>Personal program unavailable</h2><p>{loadError}</p></section>;

  if (draft) return <section className="coach-panel athlete-personal-program-panel" aria-labelledby="athlete-personal-program-editor-title">
    <div className="athlete-personal-program-heading"><div><p className="eyebrow">PRIVATE TO YOU</p><h2 id="athlete-personal-program-editor-title">{program ? 'Edit my program' : 'Create my program'}</h2><p>Only you can view or edit this plan.</p></div></div>
    <form className="athlete-personal-program-editor" onSubmit={(event) => void save(event)}>
      <div className="athlete-personal-program-fields">
        <label className="form-field">Program name<input required maxLength={120} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.currentTarget.value })} /></label>
        <label className="form-field">Weight unit<select value={draft.unit} onChange={(event) => setDraft({ ...draft, unit: event.currentTarget.value as 'kg' | 'lb' })}><option value="kg">kg</option><option value="lb">lb</option></select></label>
      </div>
      <div className="athlete-personal-program-weeks">
        {draft.weeks.map((week) => <fieldset className="athlete-personal-week" key={week.id} aria-label={week.name || 'Program week'}>
          <div className="athlete-personal-week-heading"><label className="form-field">Week name<input required maxLength={80} value={week.name} onChange={(event) => { const name = event.currentTarget.value; updateWeek(week.id, (current) => ({ ...current, name })); }} /></label><button className="button button-quiet danger-quiet" type="button" onClick={() => setDraft({ ...draft, weeks: draft.weeks.filter((item) => item.id !== week.id) })}>Remove week</button></div>
          {week.days.map((day) => <div className="athlete-personal-day" key={day.id}>
            <div className="athlete-personal-day-heading"><label className="form-field">Training day<input required maxLength={80} value={day.name} onChange={(event) => { const name = event.currentTarget.value; updateDay(week.id, day.id, (current) => ({ ...current, name })); }} /></label><button className="button button-quiet danger-quiet" type="button" onClick={() => updateWeek(week.id, (current) => ({ ...current, days: current.days.filter((item) => item.id !== day.id) }))}>Remove day</button></div>
            {day.exercises.map((exercise) => <div className="athlete-personal-exercise" key={exercise.id}>
              <label className="form-field">Exercise<input required maxLength={120} value={exercise.name} onChange={(event) => updateExercise(week.id, day.id, exercise.id, { name: event.currentTarget.value })} /></label>
              <label className="form-field">Sets<input type="number" min="1" max="100" step="1" value={exercise.sets ?? ''} onChange={(event) => updateExercise(week.id, day.id, exercise.id, { sets: event.currentTarget.value ? Number(event.currentTarget.value) : null })} /></label>
              <label className="form-field">Reps<input maxLength={24} value={exercise.reps} onChange={(event) => updateExercise(week.id, day.id, exercise.id, { reps: event.currentTarget.value })} /></label>
              <label className="form-field">RPE<input type="number" min="1" max="10" step="0.5" value={exercise.rpe ?? ''} onChange={(event) => updateExercise(week.id, day.id, exercise.id, { rpe: event.currentTarget.value ? Number(event.currentTarget.value) : null })} /></label>
              <label className="form-field">Load ({draft.unit})<input maxLength={40} value={exercise.load} onChange={(event) => updateExercise(week.id, day.id, exercise.id, { load: event.currentTarget.value })} placeholder="Optional" /></label>
              <button className="button button-quiet danger-quiet" type="button" onClick={() => updateDay(week.id, day.id, (current) => ({ ...current, exercises: current.exercises.filter((item) => item.id !== exercise.id) }))}>Remove exercise</button>
            </div>)}
            <button className="button button-secondary" type="button" onClick={() => updateDay(week.id, day.id, (current) => ({ ...current, exercises: [...current.exercises, newExercise()] }))}>＋ Add exercise</button>
          </div>)}
          <button className="button button-secondary" type="button" onClick={() => updateWeek(week.id, (current) => ({ ...current, days: [...current.days, newDay(current.days.length)] }))}>＋ Add training day</button>
        </fieldset>)}
      </div>
      <button className="button button-secondary" type="button" onClick={() => setDraft({ ...draft, weeks: [...draft.weeks, newWeek(draft.weeks.length)] })}>＋ Add week</button>
      {error && <p className="inline-error" role="alert">{error}</p>}
      <div className="athlete-personal-program-actions"><button className="button button-quiet" type="button" onClick={() => { setDraft(null); setError(''); }}>Cancel</button><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save my program'}</button></div>
    </form>
  </section>;

  if (!program) return <section className="coach-panel athlete-personal-program-panel"><p className="eyebrow">PRIVATE TO YOU</p><h2>Make a program for yourself</h2><p>Create a personal plan that stays private to your Athlete account. Your Coach’s assigned plan remains separate.</p><button className="button button-primary" type="button" onClick={startEditing}>＋ Add my program</button>{status && <p className="inline-state" role="status">{status}</p>}</section>;

  return <section className="coach-panel athlete-personal-program-panel" aria-labelledby="athlete-personal-program-title">
    <header className="athlete-personal-program-heading"><div><p className="eyebrow">PRIVATE TO YOU · {program.unit.toUpperCase()}</p><h2 id="athlete-personal-program-title">{program.name}</h2><p>Only you can view this personal plan.</p></div><button className="button button-secondary" type="button" onClick={startEditing}>Edit my program</button></header>
    {program.weeks.length === 0 ? <p className="athlete-personal-program-empty">No weeks yet. Edit your program to add a week.</p> : program.weeks.map((week) => <section className="athlete-personal-week-view" key={week.id} aria-label={week.name}><h3>{week.name}</h3>{week.days.length === 0 ? <p>No training days yet.</p> : week.days.map((day) => <div className="athlete-personal-day-view" key={day.id}><h4>{day.name}</h4>{day.exercises.length === 0 ? <p>No exercises yet.</p> : <ul>{day.exercises.map((exercise) => <li key={exercise.id}><strong>{exercise.name}</strong><span>{exercise.sets ?? '—'} × {exercise.reps || '—'}{exercise.rpe !== null ? ` · RPE ${exercise.rpe}` : ''}{exercise.load ? ` · ${exercise.load} ${program.unit}` : ''}</span></li>)}</ul>}</div>)}</section>)}
    {status && <p className="inline-state" role="status">{status}</p>}
  </section>;
}
