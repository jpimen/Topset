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
function newWeek(position: number): PersonalWeek { return { id: crypto.randomUUID(), name: `Week ${position + 1}`, days: [] }; }
function newDay(position: number): PersonalDay { return { id: crypto.randomUUID(), name: `Day ${position + 1}`, exercises: [] }; }
function newExercise(): PersonalExercise { return { id: crypto.randomUUID(), name: 'Squat', sets: 3, reps: '5', rpe: null, load: '' }; }
function getProgramCounts(program: AthletePersonalProgram) {
  return {
    weeks: program.weeks.length,
    days: program.weeks.reduce((total, week) => total + week.days.length, 0),
    exercises: program.weeks.reduce((total, week) => total + week.days.reduce((dayTotal, day) => dayTotal + day.exercises.length, 0), 0),
  };
}
function ProgramSummary({ program }: { program: AthletePersonalProgram }) {
  const counts = getProgramCounts(program);
  return <div className="athlete-program-summary" aria-label="Program contents"><div><strong>{counts.weeks}</strong><span>weeks</span></div><div><strong>{counts.days}</strong><span>days</span></div><div><strong>{counts.exercises}</strong><span>exercises</span></div></div>;
}

export function AthletePersonalProgramPanel({
  program, defaultUnit, loadError, onSave, onCancel,
}: {
  program: AthletePersonalProgram | null;
  defaultUnit: 'kg' | 'lb';
  loadError: string;
  onSave: (program: AthletePersonalProgram) => Promise<void>;
  onCancel?: () => void;
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

  if (draft) return <section className="coach-panel athlete-personal-program-panel athlete-personal-program-panel-editing" aria-labelledby="athlete-personal-program-editor-title">
    <header className="athlete-personal-program-heading"><div><p className="eyebrow">PRIVATE TO YOU <span className="athlete-private-chip">{draft.unit.toUpperCase()}</span></p><h2 id="athlete-personal-program-editor-title">{program ? 'Edit your program' : 'Build a new program'}</h2><p>Set up your training cycle, then add days and exercises.</p></div><ProgramSummary program={draft} /></header>
    <form className="athlete-personal-program-editor" onSubmit={(event) => void save(event)}>
      <div className="athlete-program-identity">
        <div className="athlete-program-identity-heading"><span className="athlete-section-number">01</span><div><h3>Program details</h3><p>Name your plan and choose its weight unit.</p></div></div>
        <div className="athlete-personal-program-fields">
          <label className="form-field">Program name<input required maxLength={120} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.currentTarget.value })} /></label>
          <label className="form-field">Weight unit<select value={draft.unit} onChange={(event) => setDraft({ ...draft, unit: event.currentTarget.value as 'kg' | 'lb' })}><option value="kg">kg</option><option value="lb">lb</option></select></label>
        </div>
      </div>
      <div className="athlete-personal-program-weeks">
        {draft.weeks.map((week, weekIndex) => <fieldset className="athlete-personal-week" key={week.id} aria-label={week.name || 'Program week'}>
          <div className="athlete-personal-week-heading"><span className="athlete-section-number">{String(weekIndex + 2).padStart(2, '0')}</span><label className="form-field">Week name<input required maxLength={80} value={week.name} onChange={(event) => { const name = event.currentTarget.value; updateWeek(week.id, (current) => ({ ...current, name })); }} /></label><span className="athlete-week-count">{week.days.length} {week.days.length === 1 ? 'training day' : 'training days'}</span><button className="button button-quiet danger-quiet" type="button" onClick={() => setDraft({ ...draft, weeks: draft.weeks.filter((item) => item.id !== week.id) })}>Remove week</button></div>
          {week.days.map((day) => <div className="athlete-personal-day" key={day.id}>
            <div className="athlete-personal-day-heading"><span className="athlete-day-mark" aria-hidden="true">↳</span><label className="form-field">Training day<input required maxLength={80} value={day.name} onChange={(event) => { const name = event.currentTarget.value; updateDay(week.id, day.id, (current) => ({ ...current, name })); }} /></label><span className="athlete-exercise-count">{day.exercises.length} {day.exercises.length === 1 ? 'exercise' : 'exercises'}</span><button className="button button-quiet danger-quiet" type="button" onClick={() => updateWeek(week.id, (current) => ({ ...current, days: current.days.filter((item) => item.id !== day.id) }))}>Remove day</button></div>
            {day.exercises.length > 0 && <div className="athlete-exercise-labels" aria-hidden="true"><span>Movement</span><span>Sets</span><span>Reps</span><span>RPE</span><span>Load</span><span></span></div>}
            {day.exercises.map((exercise) => <div className="athlete-personal-exercise" key={exercise.id}>
              <label className="form-field">Exercise<input required maxLength={120} value={exercise.name} onChange={(event) => updateExercise(week.id, day.id, exercise.id, { name: event.currentTarget.value })} /></label>
              <label className="form-field">Sets<input type="number" min="1" max="100" step="1" value={exercise.sets ?? ''} onChange={(event) => updateExercise(week.id, day.id, exercise.id, { sets: event.currentTarget.value ? Number(event.currentTarget.value) : null })} /></label>
              <label className="form-field">Reps<input maxLength={24} value={exercise.reps} onChange={(event) => updateExercise(week.id, day.id, exercise.id, { reps: event.currentTarget.value })} /></label>
              <label className="form-field">RPE<input type="number" min="1" max="10" step="0.5" value={exercise.rpe ?? ''} onChange={(event) => updateExercise(week.id, day.id, exercise.id, { rpe: event.currentTarget.value ? Number(event.currentTarget.value) : null })} /></label>
              <label className="form-field">Load ({draft.unit})<input maxLength={40} value={exercise.load} onChange={(event) => updateExercise(week.id, day.id, exercise.id, { load: event.currentTarget.value })} placeholder="Optional" /></label>
              <button className="button button-quiet danger-quiet" type="button" onClick={() => updateDay(week.id, day.id, (current) => ({ ...current, exercises: current.exercises.filter((item) => item.id !== exercise.id) }))}>Remove exercise</button>
            </div>)}
            <button className="button button-secondary athlete-add-exercise" type="button" onClick={() => updateDay(week.id, day.id, (current) => ({ ...current, exercises: [...current.exercises, newExercise()] }))}>＋ Add exercise</button>
          </div>)}
          <button className="button button-secondary athlete-add-day" type="button" onClick={() => updateWeek(week.id, (current) => ({ ...current, days: [...current.days, newDay(current.days.length)] }))}>＋ Add training day</button>
        </fieldset>)}
      </div>
      <button className="button button-secondary athlete-add-week" type="button" onClick={() => setDraft({ ...draft, weeks: [...draft.weeks, newWeek(draft.weeks.length)] })}>＋ Add week</button>
      {error && <p className="inline-error" role="alert">{error}</p>}
      <div className="athlete-personal-program-actions"><button className="button button-quiet" type="button" onClick={() => { setDraft(null); setError(''); if (!program) onCancel?.(); }}>Cancel</button><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save my program'}</button></div>
    </form>
  </section>;

  if (!program) return <section className="coach-panel athlete-personal-program-panel athlete-program-empty" aria-labelledby="athlete-personal-program-title"><div className="athlete-program-empty-mark" aria-hidden="true">＋</div><div><p className="eyebrow">PRIVATE TO YOU</p><h2 id="athlete-personal-program-title">Make a program for yourself</h2><p>Create a personal plan that stays private to your Athlete account. Your Coach’s assigned plan remains separate.</p><button className="button button-primary" type="button" onClick={startEditing}>＋ Create program</button>{status && <p className="inline-state" role="status">{status}</p>}</div></section>;

  return <section className="coach-panel athlete-personal-program-panel" aria-labelledby="athlete-personal-program-title">
    <header className="athlete-personal-program-heading"><div><p className="eyebrow">PRIVATE TO YOU <span className="athlete-private-chip">{program.unit.toUpperCase()}</span></p><h2 id="athlete-personal-program-title">{program.name}</h2><p>Your training plan, organized by week and session.</p></div><button className="button button-secondary" type="button" onClick={startEditing}>Edit my program</button></header>
    <ProgramSummary program={program} />
    {program.weeks.length === 0 ? <div className="athlete-personal-program-empty"><span aria-hidden="true">+</span><div><strong>Your plan is ready for its first week.</strong><p>Add a week to start mapping out your training.</p></div></div> : program.weeks.map((week, weekIndex) => <section className="athlete-personal-week-view" key={week.id} aria-label={week.name}>
      <div className="athlete-view-week-heading"><span className="athlete-view-week-index">WEEK {String(weekIndex + 1).padStart(2, '0')}</span><h3>{week.name}</h3><span className="athlete-week-count">{week.days.length} {week.days.length === 1 ? 'session' : 'sessions'}</span></div>
      {week.days.length === 0 ? <p>No training days yet.</p> : week.days.map((day, dayIndex) => <div className="athlete-personal-day-view" key={day.id}>
        <div className="athlete-view-day-heading"><span>{String(dayIndex + 1).padStart(2, '0')}</span><h4>{day.name}</h4></div>
        {day.exercises.length === 0 ? <p>No exercises yet.</p> : <div className="athlete-personal-program-table-wrap">
          <table className="athlete-personal-program-table">
            <thead><tr><th scope="col">Exercise</th><th scope="col">Sets</th><th scope="col">Reps</th><th scope="col">RPE</th><th scope="col">Load</th></tr></thead>
            <tbody>{day.exercises.map((exercise) => <tr key={exercise.id}>
              <th scope="row">{exercise.name}</th>
              <td>{exercise.sets ?? '-'}</td>
              <td>{exercise.reps || '-'}</td>
              <td>{exercise.rpe !== null ? exercise.rpe : '-'}</td>
              <td>{exercise.load ? `${exercise.load} ${program.unit}` : '-'}</td>
            </tr>)}</tbody>
          </table>
        </div>}
      </div>)}
    </section>)}
    {status && <p className="inline-state" role="status">{status}</p>}
  </section>;
}
