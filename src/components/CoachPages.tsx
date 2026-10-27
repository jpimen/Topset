import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { EditableGridCell, focusProgramGridCell } from './programs/EditableGridCell';
import { createDebouncedSave } from '../lib/programs/autosave';
import { createProgramHistory, createRow, parseReps, programReducer, validateLoad } from '../lib/programs/document';
import {
  archiveProgram, createExercise, createProgram, deleteExercise, duplicateProgram,
  getCoachSummary, listExercises, listPrograms, loadProgram, saveProgram, updateExercise,
} from '../lib/programs/repository';
import type { Exercise, ExerciseCategory, LoadMode, Movement, ProgramDocument, ProgramExercise, ProgramWeek, SetType } from '../lib/programs/types';

function useCoachId() {
  const { profile } = useAuth();
  return profile?.id ?? '';
}

function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description?: string; actions?: React.ReactNode }) {
  return <header className="coach-page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="coach-header-actions">{actions}</div>}</header>;
}

export function CoachDashboard() {
  const coachId = useCoachId();
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getCoachSummary>> | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => { let active = true; void getCoachSummary(coachId).then((value) => active && setSummary(value)).catch(() => active && setError(true)); return () => { active = false; }; }, [coachId]);
  return <main className="coach-page dashboard-page">
    <PageHeader eyebrow="COACH WORKSPACE / OVERVIEW" title="Dashboard" description="Your programs and roster at a glance." actions={<Link className="button button-primary" to="/coach/programs">Open programs <span aria-hidden="true">→</span></Link>} />
    {error ? <div className="inline-state error-state" role="alert">We could not load your dashboard. Refresh to try again.</div> : !summary ? <div className="dashboard-skeleton" aria-label="Loading dashboard" /> : <>
      <section className="metric-cards" aria-label="Workspace counts"><article><span>PROGRAMS</span><strong>{summary.programCount}</strong><small>Active program documents</small></article><article><span>ACTIVE ATHLETES</span><strong>{summary.athleteCount}</strong><small>Roster links available</small></article></section>
      <section className="coach-panel recent-programs"><div className="panel-heading"><div><p className="eyebrow">RECENT WORK</p><h2>Recently updated programs</h2></div><Link to="/coach/programs">View all <span aria-hidden="true">→</span></Link></div>
        {summary.recent.length ? <div className="recent-list">{summary.recent.map((program) => <Link className="recent-program" key={program.id} to={`/coach/programs/${program.id}`}><span className="recent-program-icon">P</span><span><strong>{program.name}</strong><small>{program.unit.toUpperCase()} · Updated {new Date(program.updated_at).toLocaleDateString()}</small></span><b aria-hidden="true">→</b></Link>)}</div> : <div className="empty-state compact-empty"><span className="empty-state-mark">＋</span><h3>Your first program starts here</h3><p>Create a program to begin building training weeks and sessions.</p><Link className="button button-primary" to="/coach/programs">Create a program</Link></div>}
      </section>
    </>}
  </main>;
}

export function ProgramsPage() {
  const coachId = useCoachId();
  const navigate = useNavigate();
  const [programs, setPrograms] = useState<Awaited<ReturnType<typeof listPrograms>>>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const refresh = () => listPrograms(coachId).then(setPrograms).catch(() => setError(true));
  useEffect(() => { void refresh(); }, [coachId]);
  const filtered = programs.filter((program) => program.name.toLowerCase().includes(search.trim().toLowerCase()));
  const makeProgram = async () => { setBusy(true); try { navigate(`/coach/programs/${await createProgram(coachId)}`); } catch { setError(true); } finally { setBusy(false); } };
  const makeCopy = async (id: string) => { setBusy(true); try { navigate(`/coach/programs/${await duplicateProgram(id, coachId)}`); } catch { setError(true); } finally { setBusy(false); } };
  const archive = async (id: string, name: string) => { if (!window.confirm(`Archive “${name}”? It will leave the active program list.`)) return; setBusy(true); try { await archiveProgram(id); await refresh(); } catch { setError(true); } finally { setBusy(false); } };
  return <main className="coach-page programs-page">
    <PageHeader eyebrow="COACH WORKSPACE / PROGRAMS" title="Programs" description="Build and maintain your training plans." actions={<button className="button button-primary" disabled={busy} onClick={() => void makeProgram()}>＋ New program</button>} />
    <section className="coach-panel programs-panel"><div className="list-toolbar"><label className="search-field"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search programs" aria-label="Search programs" /></label><span className="result-count">{filtered.length} {filtered.length === 1 ? 'program' : 'programs'}</span></div>
      {error && <div className="inline-state error-state" role="alert">A program action failed. Check your connection and retry.</div>}
      {programs.length === 0 && !error ? <div className="empty-state"><span className="empty-state-mark">＋</span><h2>No programs yet</h2><p>Create your first program, then add weeks, days, and exercises in the builder.</p><button className="button button-primary" disabled={busy} onClick={() => void makeProgram()}>Create a program</button></div> : filtered.length === 0 ? <div className="empty-state"><h2>No matching programs</h2><p>Try a different search.</p></div> : <div className="program-list" role="list">{filtered.map((program) => <article className="program-list-row" key={program.id} role="listitem"><div className="program-list-icon">P</div><div className="program-list-main"><Link to={`/coach/programs/${program.id}`}>{program.name}</Link><p>{program.unit.toUpperCase()} · Updated {new Date(program.updated_at).toLocaleDateString()}</p></div><div className="program-row-actions"><Link className="button button-secondary" to={`/coach/programs/${program.id}`}>Open</Link><button className="button button-quiet" disabled={busy} onClick={() => void makeCopy(program.id)}>Duplicate</button><button className="button button-quiet danger-quiet" disabled={busy} onClick={() => void archive(program.id, program.name)}>Archive</button></div></article>)}</div>}
    </section>
  </main>;
}

export function AthletesPlaceholder() {
  return <main className="coach-page athletes-page"><PageHeader eyebrow="COACH WORKSPACE / ROSTER" title="Athletes" description="Your roster will appear here when coach-athlete linking is available." /><section className="coach-panel empty-state roster-empty"><span className="empty-state-mark">◎</span><h2>No athletes linked</h2><p>There are no active coach-athlete links on this account. Athlete linking arrives in Milestone 4.</p></section></main>;
}

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
    <PageHeader eyebrow="COACH WORKSPACE / LIBRARY" title="Exercise library" description="Browse the built-in lifts and your custom movements." actions={<button className="button button-primary" onClick={() => { setEditing(null); setDraft(emptyExercise); setShowForm(true); }}>＋ Add custom exercise</button>} />
    <section className="coach-panel library-panel"><div className="list-toolbar"><label className="search-field"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search exercises" aria-label="Search exercises" /></label><div className="filter-chips" aria-label="Filter by category">{(['all', 'main', 'variation', 'accessory'] as const).map((option) => <button key={option} className={category === option ? 'selected' : ''} onClick={() => setCategory(option)}>{option === 'all' ? 'All' : option}</button>)}</div></div>
      {error && <div className="inline-state error-state" role="alert">We could not save or load exercises. Check your connection and retry.</div>}
      {notice && <div className="inline-state" role="status">{notice}</div>}
      <div className="exercise-cards">{filtered.map((exercise) => <article className="exercise-card" key={exercise.id}><div className="exercise-card-icon">{exercise.movement === 'other' ? 'EX' : exercise.movement.slice(0, 2).toUpperCase()}</div><div className="exercise-card-copy"><div className="exercise-title-line"><h2>{exercise.name}</h2>{exercise.owner_id ? <span className="tag tag-custom">CUSTOM</span> : <span className="tag">BUILT-IN</span>}</div><p>{exercise.category} · {exercise.movement}{exercise.muscle_group ? ` · ${exercise.muscle_group}` : ''}</p></div>{exercise.owner_id && <div className="exercise-actions"><button className="button button-quiet" onClick={() => editExercise(exercise)}>Edit</button><button className="button button-quiet danger-quiet" onClick={() => void removeExercise(exercise)}>Delete</button></div>}</article>)}</div>
      {!filtered.length && <div className="empty-state"><h2>No exercises found</h2><p>Adjust your search or filter.</p></div>}
    </section>
    {showForm && <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowForm(false); }}><form className="exercise-dialog" role="dialog" aria-modal="true" aria-labelledby="exercise-dialog-title" onSubmit={(event) => void submit(event)}><div className="panel-heading"><div><p className="eyebrow">CUSTOM EXERCISE</p><h2 id="exercise-dialog-title">{editing ? 'Edit exercise' : 'Add exercise'}</h2></div><button className="icon-button" type="button" aria-label="Close" onClick={() => setShowForm(false)}>×</button></div>{error && <p role="alert" className="inline-error">Could not save the exercise. Check its name is unique and retry.</p>}<label className="form-field">Name<input autoFocus required maxLength={120} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><div className="form-two-col"><label className="form-field">Category<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as ExerciseCategory })}><option value="main">Main</option><option value="variation">Variation</option><option value="accessory">Accessory</option></select></label><label className="form-field">Movement<select value={draft.movement} onChange={(event) => setDraft({ ...draft, movement: event.target.value as Movement })}><option value="squat">Squat</option><option value="bench">Bench</option><option value="deadlift">Deadlift</option><option value="other">Other</option></select></label></div><label className="form-field">Muscle group<input maxLength={80} value={draft.muscle_group} onChange={(event) => setDraft({ ...draft, muscle_group: event.target.value })} /></label><label className="checkbox-line"><input type="checkbox" checked={draft.is_competition_lift} onChange={(event) => setDraft({ ...draft, is_competition_lift: event.target.checked })} /> Competition lift</label><div className="dialog-actions"><button type="button" className="button button-secondary" onClick={() => setShowForm(false)}>Cancel</button><button className="button button-primary">Save exercise</button></div></form></div>}
  </main>;
}

export function CoachSettingsPlaceholder() {
  return <main className="coach-page"><PageHeader eyebrow="COACH WORKSPACE / SETTINGS" title="Settings" description="Workspace settings will be added in a later milestone." /><section className="coach-panel empty-state"><h2>Settings are not available yet</h2><p>Your profile and team settings are unchanged.</p></section></main>;
}

function repsSummary(rows: ProgramExercise[]) {
  const sets = rows.reduce((sum, row) => sum + (row.sets ?? 0), 0);
  const repCounts = rows.reduce((sum, row) => { const parsed = parseReps(row.reps); return sum + (parsed.min ?? 0) * (row.sets ?? 0); }, 0);
  return `${sets} sets · ${repCounts || '—'} reps`;
}

function useProgramSave(document: ProgramDocument, expectedAt: React.MutableRefObject<string>, enabled: boolean, setStatus: (value: 'saved' | 'saving' | 'error' | 'conflict') => void, setSavedAt: (value: string) => void) {
  const previousDocument = useRef<ProgramDocument | null>(null);
  const saver = useMemo(() => createDebouncedSave(async (next: ProgramDocument) => {
    setStatus('saving');
    try {
      const timestamp = await saveProgram(next, expectedAt.current);
      expectedAt.current = timestamp;
      setSavedAt(timestamp);
      setStatus('saved');
    } catch (error) {
      setStatus(error instanceof Error && error.message === 'PROGRAM_CONFLICT' ? 'conflict' : 'error');
    }
  }, 600), [expectedAt, setStatus, setSavedAt]);
  useEffect(() => {
    if (!enabled || !document.program.id) {
      previousDocument.current = document;
      return;
    }
    if (previousDocument.current === document) return;
    if (previousDocument.current?.program.id !== document.program.id) {
      previousDocument.current = document;
      return;
    }
    previousDocument.current = document;
    setStatus('saving');
    saver.schedule(document);
  }, [document, enabled, saver, setStatus]);
  useEffect(() => () => saver.cancel(), [saver]);
  return saver;
}

function ExerciseNameCell({ row, index, exercise, exercises, onChoose, onCreate }: { row: ProgramExercise; index: number; exercise?: Exercise; exercises: Exercise[]; onChoose: (value: Exercise) => void; onCreate: (name: string) => Promise<Exercise | undefined> }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(exercise?.name ?? '');
  useEffect(() => { if (!editing) setValue(exercise?.name ?? ''); }, [exercise?.id, exercise?.name, editing]);
  const selectValue = async () => {
    const chosen = exercises.find((item) => item.name.toLowerCase() === value.trim().toLowerCase());
    if (chosen) onChoose(chosen);
    else if (value.trim()) {
      const created = await onCreate(value.trim());
      if (created) onChoose(created);
    }
    setEditing(false);
  };
  const startEditing = () => { setEditing(true); };
  const handleButtonKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === 'F2') { event.preventDefault(); startEditing(); }
    else if (event.key === 'ArrowDown') { event.preventDefault(); focusProgramGridCell(index + 1, 0); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); focusProgramGridCell(index - 1, 0); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); focusProgramGridCell(index, 1); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); focusProgramGridCell(index, -1); }
  };
  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') { event.preventDefault(); void selectValue(); window.requestAnimationFrame(() => focusProgramGridCell(index + 1, 0)); }
    else if (event.key === 'Tab') { event.preventDefault(); void selectValue(); window.requestAnimationFrame(() => focusProgramGridCell(index, event.shiftKey ? -1 : 1)); }
    else if (event.key === 'Escape') { event.preventDefault(); setValue(exercise?.name ?? ''); setEditing(false); window.requestAnimationFrame(() => focusProgramGridCell(index, 0)); }
  };
  return <div role="gridcell" data-grid-cell={`${index}:0`} className="builder-cell exercise-name-cell">{editing ? <><input autoFocus aria-label="Exercise" list={`exercise-options-${row.id}`} value={value} onChange={(event) => setValue(event.target.value)} onBlur={() => { void selectValue(); }} onKeyDown={handleInputKeyDown} /><datalist id={`exercise-options-${row.id}`}>{exercises.map((item) => <option key={item.id} value={item.name} />)}</datalist></> : <button type="button" aria-label={`Exercise: ${exercise?.name ?? 'empty'}`} onClick={startEditing} onKeyDown={handleButtonKeyDown}>{exercise?.name ?? <span className="builder-cell-placeholder">Choose lift…</span>}</button>}</div>;
}

function ProgramRow({ row, rowIndex, exercises, programUnit, onPatch, onDelete, onDuplicate, onCreateExercise, showAthleteColumns }: { row: ProgramExercise; rowIndex: number; exercises: Exercise[]; programUnit: 'kg' | 'lb'; onPatch: (patch: Partial<ProgramExercise>) => void; onDelete: () => void; onDuplicate: () => void; onCreateExercise: (name: string) => Promise<Exercise | undefined>; showAthleteColumns: boolean }) {
  const chosenExercise = exercises.find((item) => item.id === row.exercise_id) ?? row.exercise;
  const mode = row.load_mode;
  const loadValue = row.load_min !== null && row.load_max !== null && row.load_min !== row.load_max ? `${row.load_min}-${row.load_max}` : row.load_value === null ? '' : String(row.load_value);
  const loadHint = validateLoad(loadValue, mode, programUnit, row.reps, row.rpe);
  const commitReps = (value: string) => { const parsed = parseReps(value); onPatch({ reps: value, reps_min: parsed.valid ? parsed.min : null, reps_max: parsed.valid ? parsed.max : null }); };
  const commitLoad = (value: string) => {
    const result = validateLoad(value, mode, programUnit, row.reps, row.rpe);
    if (result.valid && mode !== 'rpe') onPatch({ load_value: result.min === result.max ? result.min : null, load_min: result.min, load_max: result.max });
  };
  return <div role="row" className={`builder-grid-row${showAthleteColumns ? ' with-athlete-columns' : ''}`}>
    <ExerciseNameCell row={row} index={rowIndex} exercise={chosenExercise} exercises={exercises} onChoose={(item) => onPatch({ exercise_id: item.id, exercise: item })} onCreate={onCreateExercise} />
    <EditableGridCell row={rowIndex} column={1} label="Set type" value={row.set_type ?? ''} options={['', 'top', 'backoff', 'working', 'warmup', 'amrap']} className={`set-type-cell type-${row.set_type ?? 'empty'}`} onCommit={(value) => onPatch({ set_type: value ? value as SetType : null })} onClear={() => onPatch({ set_type: null })} />
    <EditableGridCell row={rowIndex} column={2} label="Sets" value={row.sets === null ? '' : String(row.sets)} onCommit={(value) => { if (!value) onPatch({ sets: null }); else { const parsed = Number(value); if (Number.isInteger(parsed) && parsed > 0 && parsed <= 100) onPatch({ sets: parsed }); } }} onClear={() => onPatch({ sets: null })} />
    <EditableGridCell row={rowIndex} column={3} label="Reps" value={row.reps} onCommit={commitReps} onClear={() => commitReps('')} className={!parseReps(row.reps).valid ? 'cell-invalid' : ''} />
    <EditableGridCell row={rowIndex} column={4} label="RPE" value={row.rpe === null ? '' : row.rpe.toFixed(1).replace('.0', '')} inputOptions={Array.from({ length: 11 }, (_, index) => (5 + index * 0.5).toFixed(1).replace('.0', ''))} placeholder="5–10" className={row.rpe !== null ? `rpe-cell rpe-${Math.floor(row.rpe)}` : ''} onCommit={(value) => { const parsed = value ? Number(value) : null; if (parsed === null || (parsed >= 5 && parsed <= 10 && parsed * 2 === Math.trunc(parsed * 2))) onPatch({ rpe: parsed }); }} onClear={() => onPatch({ rpe: null })} />
    <div role="gridcell" data-grid-cell={`${rowIndex}:5`} className="builder-cell load-cell"><select aria-label="Load mode" value={mode} onChange={(event) => { const next = event.target.value as LoadMode; onPatch({ load_mode: next, load_value: null, load_min: null, load_max: null, percent_of: next === 'percent' ? 'e1rm' : null }); }}><option value="absolute">kg/lb</option><option value="percent">%</option><option value="rpe">RPE</option><option value="none">—</option></select>{mode === 'rpe' ? <span className="load-mode-note">Derived</span> : mode !== 'none' && <input aria-label="Load" key={`${row.id}-${mode}`} defaultValue={loadValue} placeholder={mode === 'percent' ? '85' : '130-132.5'} onBlur={(event) => commitLoad(event.currentTarget.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); window.requestAnimationFrame(() => focusProgramGridCell(rowIndex + 1, 5)); } else if (event.key === 'Tab') { event.preventDefault(); event.currentTarget.blur(); window.requestAnimationFrame(() => focusProgramGridCell(rowIndex, event.shiftKey ? 4 : 6)); } else if (event.key === 'Escape') event.currentTarget.value = loadValue; }} />}{mode === 'percent' && <select aria-label="Percent basis" value={row.percent_of ?? 'e1rm'} onChange={(event) => onPatch({ percent_of: event.target.value as 'e1rm' | 'tm' })}><option value="e1rm">e1RM</option><option value="tm">TM</option></select>}</div>
    <EditableGridCell row={rowIndex} column={6} label="Coach notes" value={row.notes_coach ?? ''} placeholder="Add note" onCommit={(value) => onPatch({ notes_coach: value || null })} onClear={() => onPatch({ notes_coach: null })} />
    {showAthleteColumns && <><div role="gridcell" className="athlete-grid-cell">—</div><div role="gridcell" className="athlete-grid-cell">—</div><div role="gridcell" className="athlete-grid-cell">—</div></>}
    <div className="row-actions"><button aria-label="Duplicate row" title="Duplicate row" onClick={onDuplicate}>⧉</button><button aria-label="Delete row" title="Delete row" onClick={onDelete}>×</button></div>
    {mode === 'rpe' && <span className={`load-validation-hint${loadHint.valid ? ' hint-preview' : ''}`} role="status">{loadHint.hint}</span>}
    {mode !== 'rpe' && mode !== 'none' && loadValue && !loadHint.valid && <span className="load-validation-hint" role="status">{loadHint.hint}</span>}
  </div>;
}

function DayCard({ week, day, exercises, document, dispatch, onCreateExercise, showAthleteColumns }: { week: ProgramWeek; day: ProgramWeek['days'][number]; exercises: Exercise[]; document: ProgramDocument; dispatch: React.Dispatch<Parameters<typeof programReducer>[1]>; onCreateExercise: (name: string) => Promise<Exercise | undefined>; showAthleteColumns: boolean }) {
  const [collapsed, setCollapsed] = useState(false);
  const allRowCount = week.days.reduce((sum, current) => sum + current.exercises.length, 0);
  const rowStart = 1 + week.days.slice(0, week.days.findIndex((current) => current.id === day.id)).reduce((sum, current) => sum + current.exercises.length, 0);
  const addRow = (exercise?: Exercise, values: Partial<ProgramExercise> = {}) => {
    const first = exercise ?? exercises.find((item) => item.name === 'Comp Squat') ?? exercises.find((item) => item.category === 'main') ?? exercises[0];
    if (!first) return;
    dispatch({ type: 'add-row', weekId: week.id, dayId: day.id, row: createRow(day.id, first.id, day.exercises.length, { exercise: first, ...values }) });
  };
  const keyboardRowIndex = (index: number) => rowStart + index;
  return <article className="day-card"><header className="day-card-header"><button className="collapse-day" onClick={() => setCollapsed(!collapsed)} aria-expanded={!collapsed} aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${day.name}`}>{collapsed ? '▸' : '▾'}</button><label className="day-name-field"><span className="eyebrow">SESSION {String(day.day_number).padStart(2, '0')}</span><input aria-label="Day name" value={day.name} onChange={(event) => dispatch({ type: 'rename-day', weekId: week.id, dayId: day.id, name: event.target.value })} /></label><span className="day-summary">{repsSummary(day.exercises)}</span><div className="day-header-actions"><button className="button button-quiet" onClick={() => addRow()}>＋ Add row</button><button className="button button-quiet" onClick={() => { const movement = window.prompt('Main lift (squat, bench, or deadlift)', 'squat')?.toLowerCase(); const exercise = exercises.find((item) => item.is_competition_lift && item.movement === movement); if (!exercise) return; addRow(exercise, { set_type: 'top', sets: 1, reps: '1', reps_min: 1, reps_max: 1, rpe: 7, load_mode: 'rpe' }); addRow(exercise, { set_type: 'backoff', sets: 3, reps: '3', reps_min: 3, reps_max: 3, rpe: 6, load_mode: 'rpe' }); }}>Quick add</button><button className="icon-button danger-icon" aria-label={`Delete ${day.name}`} title="Delete day" onClick={() => { if (window.confirm(`Delete ${day.name} and its exercise rows?`)) dispatch({ type: 'delete-day', weekId: week.id, dayId: day.id }); }}>×</button></div></header>
    {!collapsed && <div className="day-card-body"><div role="grid" aria-label={`${week.name} ${day.name} program grid`} className="program-grid">
      <div role="row" className={`builder-grid-header${showAthleteColumns ? ' with-athlete-columns' : ''}`}><div role="columnheader">Exercise</div><div role="columnheader">Set type</div><div role="columnheader">Sets</div><div role="columnheader">Reps</div><div role="columnheader">RPE</div><div role="columnheader">Load</div><div role="columnheader">Coach notes</div>{showAthleteColumns && <><div role="columnheader" className="athlete-col">Load lifted</div><div role="columnheader" className="athlete-col">RPE lifted</div><div role="columnheader" className="athlete-col">Athlete notes</div></>}</div>
      {day.exercises.map((row, index) => <ProgramRow key={row.id} row={row} rowIndex={keyboardRowIndex(index)} exercises={exercises} programUnit={document.program.unit} onPatch={(patch) => dispatch({ type: 'update-row', weekId: week.id, dayId: day.id, rowId: row.id, patch })} onDelete={() => dispatch({ type: 'delete-row', weekId: week.id, dayId: day.id, rowId: row.id })} onDuplicate={() => dispatch({ type: 'add-row', weekId: week.id, dayId: day.id, row: { ...row, id: crypto.randomUUID(), position: day.exercises.length } })} onCreateExercise={onCreateExercise} showAthleteColumns={showAthleteColumns} />)}
      {!day.exercises.length && <div className="grid-empty"><span className="empty-state-mark">＋</span><strong>Add your first exercise</strong><span>Start typing in the exercise column after adding a row.</span><button className="button button-secondary" onClick={() => addRow()}>Add first row</button></div>}
      {Boolean(day.exercises.length) && <button className="add-row-line" onClick={() => addRow()}>＋ Add row</button>}
      {allRowCount === 0 && !day.exercises.length && <span className="visually-hidden">No exercises</span>}
    </div></div>}
  </article>;
}

export function ProgramBuilderPage() {
  const coachId = useCoachId();
  const { id: programId = '' } = useParams();
  const navigate = useNavigate();
  const [history, dispatch] = useReducer(programReducer, null, () => createProgramHistory({ program: { id: '', coach_id: coachId, name: '', description: null, unit: 'kg', updated_at: '' }, weeks: [] }));
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<'saved' | 'saving' | 'error' | 'conflict'>('saved');
  const [savedAt, setSavedAt] = useState('');
  const [selectedWeek, setSelectedWeek] = useState('');
  const [showAthleteColumns, setShowAthleteColumns] = useState(false);
  const pendingSelectLastWeek = useRef(false);
  const expectedAt = useState({ current: '' })[0];
  const document = history.present;
  const saver = useProgramSave(document, expectedAt, ready, setStatus, setSavedAt);
  const hasUnsaved = ready && status !== 'saved';
  useEffect(() => {
    let active = true;
    setLoading(true); setReady(false); setLoadError(false);
    void Promise.all([loadProgram(programId), listExercises()]).then(([loaded, library]) => {
      if (!active) return;
      dispatch({ type: 'replace', document: loaded });
      expectedAt.current = loaded.program.updated_at;
      setSavedAt(loaded.program.updated_at);
      setSelectedWeek(loaded.weeks[0]?.id ?? '');
      setExercises(library);
      setReady(true);
    }).catch(() => { if (active) setLoadError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [programId, coachId]);
  useEffect(() => {
    if (!hasUnsaved) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasUnsaved]);
  useEffect(() => {
    const confirmInternalNavigation = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const anchor = target.closest<HTMLAnchorElement>('a[href]');
      if (!anchor || !hasUnsaved || anchor.target || event.defaultPrevented) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin || destination.pathname === window.location.pathname && destination.search === window.location.search && destination.hash === window.location.hash) return;
      event.preventDefault();
      event.stopPropagation();
      if (!window.confirm('You have unsaved program changes. Save them before leaving?')) return;
      void saver.flush().finally(() => navigate(`${destination.pathname}${destination.search}${destination.hash}`));
    };
    window.document.addEventListener('click', confirmInternalNavigation, true);
    return () => window.document.removeEventListener('click', confirmInternalNavigation, true);
  }, [hasUnsaved, navigate, saver]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const target = event.target as HTMLElement;
      if (target.matches('input, textarea, select') && event.key.toLowerCase() !== 'z' && event.key.toLowerCase() !== 'y') return;
      if (event.key.toLowerCase() === 'z') { event.preventDefault(); dispatch({ type: event.shiftKey ? 'redo' : 'undo' }); }
      if (event.key.toLowerCase() === 'y') { event.preventDefault(); dispatch({ type: 'redo' }); }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, []);
  const activeWeek = document.weeks.find((week) => week.id === selectedWeek) ?? document.weeks[0];
  const retry = () => { setStatus('saving'); saver.schedule(document); void saver.flush(); };
  const reloadConflict = async () => { setLoading(true); try { const remote = await loadProgram(programId); dispatch({ type: 'replace', document: remote }); expectedAt.current = remote.program.updated_at; setSavedAt(remote.program.updated_at); setStatus('saved'); setReady(true); } catch { setStatus('error'); } finally { setLoading(false); } };
  const addCustomInline = async (name: string): Promise<Exercise | undefined> => {
    const found = exercises.find((exercise) => exercise.name.toLowerCase() === name.toLowerCase());
    if (found) return found;
    if (!window.confirm(`Create “${name}” as a custom accessory exercise?`)) return undefined;
    try {
      const created = await createExercise(coachId, { name, category: 'accessory', movement: 'other', muscle_group: null, is_competition_lift: false });
      setExercises((current) => [...current, created]);
      return created;
    } catch { setStatus('error'); return undefined; }
  };
  const addWeek = () => { pendingSelectLastWeek.current = true; dispatch({ type: 'add-week' }); };
  useEffect(() => {
    if (pendingSelectLastWeek.current) {
      pendingSelectLastWeek.current = false;
      setSelectedWeek(document.weeks.at(-1)?.id ?? '');
    } else if (!document.weeks.some((week) => week.id === selectedWeek)) {
      setSelectedWeek(document.weeks[0]?.id ?? '');
    }
  }, [document.weeks, selectedWeek]);
  if (loading) return <main className="coach-page builder-loading"><div className="skeleton-line" /><div className="skeleton-line short" /><div className="builder-skeleton" /></main>;
  if (loadError) return <main className="coach-page"><section className="coach-panel empty-state"><p className="eyebrow">PROGRAM UNAVAILABLE</p><h1>We could not open this program</h1><p>It may not exist, or it may belong to another coach.</p><Link className="button button-secondary" to="/coach/programs">Back to programs</Link></section></main>;

  return <main className="coach-page program-builder-page">
    <div className="builder-breadcrumb"><Link to="/coach/programs">← Programs</Link><span>/</span><span>Program builder</span></div>
    <header className="builder-topbar"><div className="builder-program-name"><p className="eyebrow">PROGRAM / EDITOR</p><input aria-label="Program name" value={document.program.name} onChange={(event) => dispatch({ type: 'rename-program', name: event.target.value })} /></div><div className="builder-top-actions"><div className={`save-indicator save-${status}`} role="status"><span />{status === 'saved' ? `Saved${savedAt ? ` · ${new Date(savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}` : status === 'saving' ? 'Saving…' : status === 'conflict' ? 'Changed elsewhere' : 'Error, retry'}</div>{(status === 'error' || status === 'conflict') && <button className="button button-secondary" onClick={() => status === 'conflict' ? void reloadConflict() : retry()}>{status === 'conflict' ? 'Reload latest' : 'Retry save'}</button>}<fieldset className="unit-toggle builder-unit"><legend className="visually-hidden">Program unit</legend>{(['kg', 'lb'] as const).map((unit) => <label key={unit}><input type="radio" name="program-unit" checked={document.program.unit === unit} onChange={() => dispatch({ type: 'set-unit', unit })} /><span>{unit.toUpperCase()}</span></label>)}</fieldset><button className="button button-quiet" disabled={!history.past.length} onClick={() => dispatch({ type: 'undo' })} title="Undo (Ctrl+Z)">↶ Undo</button><button className="button button-quiet" disabled={!history.future.length} onClick={() => dispatch({ type: 'redo' })} title="Redo (Ctrl+Y)">↷ Redo</button></div></header>
    {status === 'conflict' && <div role="alert" className="inline-state error-state">This program changed in another session. Reload the latest version before editing again.</div>}
    {status === 'error' && <div role="alert" className="inline-state error-state">Your edits are still here, but could not be saved. Check your connection and retry.</div>}
    <section className="week-navigation"><div className="week-tabs" role="tablist" aria-label="Program weeks">{document.weeks.map((week) => <button key={week.id} role="tab" aria-selected={activeWeek?.id === week.id} className={activeWeek?.id === week.id ? 'selected' : ''} onClick={() => setSelectedWeek(week.id)}>{week.name || `Week ${week.week_number}`}</button>)}</div><div className="week-actions"><button className="button button-secondary" onClick={addWeek}>＋ Add week</button>{activeWeek && <button className="button button-quiet danger-quiet" onClick={() => { if (window.confirm(`Delete ${activeWeek.name || `Week ${activeWeek.week_number}`} and all its days?`)) dispatch({ type: 'delete-week', weekId: activeWeek.id }); }}>Delete week</button>}<label className="athlete-columns-toggle"><input type="checkbox" checked={showAthleteColumns} onChange={(event) => setShowAthleteColumns(event.target.checked)} /> Athlete columns</label></div></section>
    {!activeWeek ? <section className="coach-panel empty-state"><span className="empty-state-mark">＋</span><h2>Add a week to get started</h2><button className="button button-primary" onClick={addWeek}>Add week</button></section> : <><div className="week-heading"><div><p className="eyebrow">TRAINING CYCLE / WEEK {String(activeWeek.week_number).padStart(2, '0')}</p><input aria-label="Week name" value={activeWeek.name} onChange={(event) => dispatch({ type: 'rename-week', weekId: activeWeek.id, name: event.target.value })} /></div><button className="button button-primary" onClick={() => dispatch({ type: 'add-day', weekId: activeWeek.id })}>＋ Add day</button></div>
      {activeWeek.days.length ? <div className="day-stack">{activeWeek.days.map((day) => <DayCard key={day.id} week={activeWeek} day={day} exercises={exercises} document={document} dispatch={dispatch} onCreateExercise={addCustomInline} showAthleteColumns={showAthleteColumns} />)}</div> : <section className="coach-panel empty-state"><span className="empty-state-mark">＋</span><h2>No training days in this week</h2><p>Add a day to begin the spreadsheet.</p><button className="button button-primary" onClick={() => dispatch({ type: 'add-day', weekId: activeWeek.id })}>Add first day</button></section>}
    </>}
    <footer className="builder-footer"><span>WORKING DOCUMENT · {document.program.unit.toUpperCase()}</span><span>Autosaves after edits</span><button className="button button-quiet" onClick={() => { if (window.confirm('Leave the builder? Your recent edits may still be saving.')) navigate('/coach/programs'); }}>Exit builder</button></footer>
  </main>;
}

