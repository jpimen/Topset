import { useEffect, useMemo, useState } from 'react';
import type { Exercise, ExerciseCategory, Movement } from '../../lib/programs/types';
import { createExercise, deleteExercise, listExercises, updateExercise } from '../../lib/programs/repository';
import { CoachPageHeader } from './CoachPageHeader';
import { useCoachId } from './useCoachId';

interface ExerciseDraft { name: string; category: ExerciseCategory; movement: Movement; muscle_group: string; is_competition_lift: boolean; }
const emptyExercise: ExerciseDraft = { name: '', category: 'accessory', movement: 'other', muscle_group: '', is_competition_lift: false };

export function ExerciseLibraryPage() {
  const coachId = useCoachId();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'all' | ExerciseCategory>('all');
  const [draft, setDraft] = useState<ExerciseDraft>(emptyExercise);
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState(false);
  const refresh = () => listExercises().then(setExercises).catch(() => setError(true));
  useEffect(() => { void refresh(); }, []);
  const filtered = useMemo(() => exercises.filter((exercise) => (category === 'all' || exercise.category === category) && exercise.name.toLowerCase().includes(search.trim().toLowerCase())), [exercises, search, category]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(false); setNotice('');
    try {
      const values = { ...draft, name: draft.name.trim(), muscle_group: draft.muscle_group.trim() || null };
      if (editing) await updateExercise({ ...editing, ...values }); else await createExercise(coachId, values);
      setShowForm(false); setEditing(null); setDraft(emptyExercise); await refresh();
    } catch { setError(true); }
  };
  const editExercise = (exercise: Exercise) => { setEditing(exercise); setDraft({ ...exercise, muscle_group: exercise.muscle_group ?? '' }); setShowForm(true); setNotice(''); };
  const removeExercise = async (exercise: Exercise) => {
    if (!window.confirm(`Delete “${exercise.name}”?`)) return;
    try { await deleteExercise(exercise); await refresh(); setNotice('Custom exercise deleted.'); }
    catch (cause) { setNotice(cause instanceof Error ? cause.message : 'The exercise could not be deleted.'); }
  };
  return <main className="coach-page exercise-library-page">
    <CoachPageHeader eyebrow="COACH WORKSPACE / LIBRARY" title="Exercise library" description="Browse the built-in lifts and your custom movements." actions={<button className="button button-primary" onClick={() => { setEditing(null); setDraft(emptyExercise); setShowForm(true); }}>＋ Add custom exercise</button>} />
    <section className="coach-panel library-panel"><div className="list-toolbar"><label className="search-field"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search exercises" aria-label="Search exercises" /></label><div className="filter-chips" aria-label="Filter by category">{(['all', 'main', 'variation', 'accessory'] as const).map((option) => <button key={option} className={category === option ? 'selected' : ''} onClick={() => setCategory(option)}>{option === 'all' ? 'All' : option}</button>)}</div></div>
      {error && <div className="inline-state error-state" role="alert">We could not save or load exercises. Check your connection and retry.</div>}
      {notice && <div className="inline-state" role="status">{notice}</div>}
      <div className="exercise-cards">{filtered.map((exercise) => <article className="exercise-card" key={exercise.id}><div className="exercise-card-icon">{exercise.movement === 'other' ? 'EX' : exercise.movement.slice(0, 2).toUpperCase()}</div><div className="exercise-card-copy"><div className="exercise-title-line"><h2>{exercise.name}</h2>{exercise.owner_id ? <span className="tag tag-custom">CUSTOM</span> : <span className="tag">BUILT-IN</span>}</div><p>{exercise.category} · {exercise.movement}{exercise.muscle_group ? ` · ${exercise.muscle_group}` : ''}</p></div>{exercise.owner_id && <div className="exercise-actions"><button className="button button-quiet" onClick={() => editExercise(exercise)}>Edit</button><button className="button button-quiet danger-quiet" onClick={() => void removeExercise(exercise)}>Delete</button></div>}</article>)}</div>
      {!filtered.length && <div className="empty-state"><h2>No exercises found</h2><p>Adjust your search or filter.</p></div>}
    </section>
    {showForm && <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowForm(false); }}><form className="exercise-dialog" role="dialog" aria-modal="true" aria-labelledby="exercise-dialog-title" onSubmit={(event) => void submit(event)}><div className="panel-heading"><div><p className="eyebrow">CUSTOM EXERCISE</p><h2 id="exercise-dialog-title">{editing ? 'Edit exercise' : 'Add exercise'}</h2></div><button className="icon-button" type="button" aria-label="Close" onClick={() => setShowForm(false)}>×</button></div>{error && <p role="alert" className="inline-error">Could not save the exercise. Check its name is unique and retry.</p>}<label className="form-field">Name<input autoFocus required maxLength={120} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><div className="form-two-col"><label className="form-field">Category<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as ExerciseCategory })}><option value="main">Main</option><option value="variation">Variation</option><option value="accessory">Accessory</option></select></label><label className="form-field">Movement<select value={draft.movement} onChange={(event) => setDraft({ ...draft, movement: event.target.value as Movement })}><option value="squat">Squat</option><option value="bench">Bench</option><option value="deadlift">Deadlift</option><option value="other">Other</option></select></label></div><label className="form-field">Muscle group<input maxLength={80} value={draft.muscle_group} onChange={(event) => setDraft({ ...draft, muscle_group: event.target.value })} /></label><label className="checkbox-line"><input type="checkbox" checked={draft.is_competition_lift} onChange={(event) => setDraft({ ...draft, is_competition_lift: event.target.checked })} /> Competition lift</label><div className="dialog-actions"><button type="button" className="button button-secondary" onClick={() => setShowForm(false)}>Cancel</button><button className="button button-primary">Save exercise</button></div></form></div>}
  </main>;
}
