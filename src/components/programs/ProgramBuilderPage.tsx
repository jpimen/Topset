import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { EditableGridCell, focusProgramGridCell } from './EditableGridCell';
import { useCoachId } from '../coach/useCoachId';
import { createBlankRow, createProgramHistory, createRow, parseReps, programReducer, validateLoad } from '../../lib/programs/document';
import { listExercises, loadProgram, saveProgram } from '../../lib/programs/repository';
import type { Exercise, LoadMode, ProgramDocument, ProgramExercise, ProgramWeek, SetType } from '../../lib/programs/types';
import { CoachWorkoutCheckInsPanel, CoachWorkoutCheckInsProvider, useCoachWorkoutLogSets, useCoachWorkoutSessions } from '../coach/CoachWorkoutCheckInsPanel';

function repsSummary(rows: ProgramExercise[]) {
  const sets = rows.reduce((sum, row) => sum + (row.sets ?? 0), 0);
  const repCounts = rows.reduce((sum, row) => { const parsed = parseReps(row.reps); return sum + (parsed.min ?? 0) * (row.sets ?? 0); }, 0);
  return `${sets} sets · ${repCounts || '—'} reps`;
}

const setTypeLabels: Record<string, string> = {
  '': '', top: 'Topset', backoff: 'Backoff', working: 'Working', warmup: 'Warmup', amrap: 'AMRAP',
};
const defaultSetTypeOptions = ['top', 'backoff', 'working', 'warmup', 'amrap'];

function SetTypeCell({ row, value, options, onManageOptions, onCommit, onClear }: {
  row: number; value: string; options: string[]; onManageOptions: () => void;
  onCommit: (value: string) => void; onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    window.document.addEventListener('pointerdown', close);
    return () => window.document.removeEventListener('pointerdown', close);
  }, [open]);
  const choose = (option: string) => { onCommit(option); setOpen(false); };
  const listedOptions = value && !options.includes(value) ? [...options, value] : options;
  return <div ref={root} role="gridcell" data-grid-cell={`${row}:1`} className={`builder-cell set-type-cell type-${value.toLowerCase().replace(/[^a-z0-9_-]/g, '-') || 'empty'} set-type-menu-cell`}>
    <button type="button" aria-label={`Set type: ${(setTypeLabels[value] ?? value) || 'empty'}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === 'F2' || event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); }
      else if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); onClear(); }
      else if (event.key === 'ArrowLeft') { event.preventDefault(); focusProgramGridCell(row, 0); }
      else if (event.key === 'ArrowRight') { event.preventDefault(); focusProgramGridCell(row, 2); }
    }}>{(setTypeLabels[value] ?? value) || <span className="builder-cell-placeholder">—</span>}<span aria-hidden="true">⌄</span></button>
    {open && <div className="set-type-menu" role="menu" aria-label="Set type options">
      <button type="button" role="menuitem" onClick={() => choose('')}>—</button>
      {listedOptions.map((option) => <button type="button" role="menuitem" key={option} aria-current={value === option ? 'true' : undefined} onClick={() => choose(option)}>{setTypeLabels[option] ?? option}</button>)}
      <div className="set-type-menu-divider" />
      <button type="button" role="menuitem" className="set-type-add-option" onClick={() => { setOpen(false); onManageOptions(); }}>＋ Add option</button>
    </div>}
  </div>;
}

interface SetTypeOptionDraft { original: string | null; value: string; }

function SetTypeOptionsDialog({ options, onClose, onSave }: {
  options: string[]; onClose: () => void; onSave: (draft: SetTypeOptionDraft[]) => void;
}) {
  const [draft, setDraft] = useState<SetTypeOptionDraft[]>(() => options.map((value) => ({ original: value, value: setTypeLabels[value] ?? value })));
  const [error, setError] = useState('');
  const save = () => {
    const normalized = draft.map((item) => ({ ...item, value: item.value.trim() }));
    if (normalized.some((item) => !item.value)) { setError('Enter a name or remove the blank option.'); return; }
    if (normalized.some((item) => item.value.length > 40)) { setError('Option names must be 40 characters or fewer.'); return; }
    if (new Set(normalized.map((item) => item.value.toLowerCase())).size !== normalized.length) { setError('Each option needs a unique name.'); return; }
    setError('');
    onSave(normalized.map((item) => ({ ...item, value: item.original && setTypeLabels[item.original] === item.value ? item.original : item.value })));
  };
  return <div className="dialog-backdrop set-type-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="exercise-dialog set-type-options-dialog" role="dialog" aria-modal="true" aria-labelledby="set-type-options-title">
      <div className="panel-heading"><div><p className="eyebrow">PROGRAM BUILDER</p><h2 id="set-type-options-title">Manage set types</h2></div><button type="button" className="icon-button" aria-label="Close" onClick={onClose}>×</button></div>
      <p className="set-type-dialog-help">Edit the built-in types or add your own. Renaming updates matching rows in this program.</p>
      <div className="set-type-option-list"><p className="eyebrow set-type-option-heading">SET TYPE OPTIONS</p>{draft.map((item, index) => <div className="set-type-option-editor" key={item.original ?? `new-${index}`}>
        <input aria-label={`Custom set type ${index + 1}`} maxLength={40} autoFocus={item.original === null && index === draft.length - 1} value={item.value} placeholder="e.g. Pause set" onChange={(event) => setDraft((current) => current.map((option, optionIndex) => optionIndex === index ? { ...option, value: event.target.value } : option))} />
        <button type="button" className="button button-quiet danger-quiet" aria-label={`Remove ${item.value || 'blank option'}`} onClick={() => setDraft((current) => current.filter((_, optionIndex) => optionIndex !== index))}>Remove</button>
      </div>)}</div>
      {error && <p className="set-type-dialog-error" role="alert">{error}</p>}
      <div className="set-type-dialog-actions"><button type="button" className="button button-secondary" onClick={() => setDraft((current) => [...current, { original: null, value: '' }])}>＋ Add option</button><span /><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button type="button" className="button button-primary" onClick={save}>Save options</button></div>
    </section>
  </div>;
}

function saveFailureMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(message)) {
    return 'Could not reach the server. Check that Supabase is running and try Save changes again.';
  }
  if (/exercise_id.*not-null|null value in column.*exercise_id/i.test(message)) {
    return 'This database has not been updated to save blank exercise rows. Apply migration 202611030001_allow_blank_program_exercise_rows.sql, then retry.';
  }
  if (/weeks_program_id_week_number_key|days_week_id_day_number_key/i.test(message)) {
    return 'This database has not been updated to save week or day changes. Apply migration 202611030003_defer_program_order_uniques.sql, then retry.';
  }
  if (/program_conflict/i.test(message)) {
    return 'This program changed elsewhere. Reload the latest version before saving again.';
  }
  return `Save failed: ${message}`;
}

function ProgramNameTab({ kind, label, value, fallback, selected, onSelect, onRename }: {
  kind: 'block' | 'week'; label: string; value: string; fallback: string; selected: boolean;
  onSelect: () => void; onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => { if (!editing) setDraft(value); }, [editing, value]);
  const commit = () => { const name = draft.trim() || fallback; onRename(name); setDraft(name); setEditing(false); };
  return <span className={`program-name-tab ${kind}-name-tab${selected ? ' selected' : ''}`}>
    {editing
      ? <input autoFocus aria-label={`Rename ${label}`} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => {
        if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
        if (event.key === 'Escape') { event.preventDefault(); setDraft(value); setEditing(false); }
      }} />
      : <><button type="button" className="program-name-tab-select" aria-pressed={selected} onClick={onSelect}>{value || fallback}</button>{selected && <button type="button" className="program-name-tab-edit" aria-label={`Rename ${label}`} title={`Rename ${label}`} onClick={() => { setDraft(value); setEditing(true); }}>✎</button>}</>}
  </span>;
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
  return <div role="gridcell" data-grid-cell={`${index}:0`} className="builder-cell exercise-name-cell">{editing || !exercise ? <><input autoFocus={editing} aria-label="Exercise" maxLength={120} list={`exercise-options-${row.id}`} value={value} onChange={(event) => setValue(event.target.value)} onBlur={() => { void selectValue(); }} onKeyDown={handleInputKeyDown} /><datalist id={`exercise-options-${row.id}`}>{exercises.map((item) => <option key={item.id} value={item.name} />)}</datalist></> : <button type="button" aria-label={`Exercise: ${exercise.name}`} onClick={startEditing} onKeyDown={handleButtonKeyDown}>{exercise.name}</button>}</div>;
}

function ProgramRow({ row, rowIndex, dayId, exercises, programUnit, setTypeOptions, onManageSetTypes, onPatch, onDelete, onDuplicate, onCreateExercise }: { row: ProgramExercise; rowIndex: number; dayId: string; exercises: Exercise[]; programUnit: 'kg' | 'lb'; setTypeOptions: string[]; onManageSetTypes: () => void; onPatch: (patch: Partial<ProgramExercise>) => void; onDelete: () => void; onDuplicate: () => void; onCreateExercise: (name: string) => Promise<Exercise | undefined> }) {
  const loggedSets = useCoachWorkoutLogSets(dayId, row.id);
  const chosenExercise = exercises.find((item) => item.id === row.exercise_id) ?? row.exercise ?? undefined;
  const mode = row.load_mode;
  const loadValue = row.load_min !== null && row.load_max !== null && row.load_min !== row.load_max ? `${row.load_min}-${row.load_max}` : row.load_value === null ? '' : String(row.load_value);
  const loadHint = validateLoad(loadValue, mode, programUnit, row.reps, row.rpe);
  const orderedLogs = [...loggedSets].sort((left, right) => left.set_number - right.set_number);
  const loggedLoads = orderedLogs.flatMap((item) => item.load_lifted === null ? [] : [item.load_lifted]);
  const loggedRpes = orderedLogs.flatMap((item) => item.rpe_lifted === null ? [] : [item.rpe_lifted]);
  const loggedNotes = [...new Set(loggedSets.flatMap((item) => item.notes_athlete ? [item.notes_athlete] : []))];
  const loadSummary = loggedLoads.length ? loggedLoads.map((value) => `${value} ${programUnit}`).join(' / ') : '—';
  const rpeSummary = loggedRpes.length ? loggedRpes.join(' / ') : '—';
  const notesSummary = loggedNotes.join(' · ') || '—';
  const repsPerSet = parseReps(row.reps);
  const totalLifted = loggedSets.reduce((sum, set) => sum + (set.load_lifted ?? 0) * (repsPerSet.valid ? repsPerSet.min ?? 0 : 0), 0);
  const commitReps = (value: string) => { const parsed = parseReps(value); onPatch({ reps: value, reps_min: parsed.valid ? parsed.min : null, reps_max: parsed.valid ? parsed.max : null }); };
  const commitLoad = (value: string) => {
    const result = validateLoad(value, mode, programUnit, row.reps, row.rpe);
    if (result.valid && mode !== 'rpe') onPatch({ load_value: result.min === result.max ? result.min : null, load_min: result.min, load_max: result.max });
  };
  return <div role="row" className="builder-grid-row with-athlete-columns">
    <ExerciseNameCell row={row} index={rowIndex} exercise={chosenExercise} exercises={exercises} onChoose={(item) => onPatch(item.id.startsWith('draft:')
      ? { exercise_id: null, exercise_name: item.name, exercise: item }
      : { exercise_id: item.id, exercise_name: null, exercise: item })} onCreate={onCreateExercise} />
    <SetTypeCell row={rowIndex} value={row.set_type ?? ''} options={setTypeOptions} onManageOptions={onManageSetTypes} onCommit={(value) => onPatch({ set_type: value ? value as SetType : null })} onClear={() => onPatch({ set_type: null })} />
    <EditableGridCell row={rowIndex} column={2} label="Sets" value={row.sets === null ? '' : String(row.sets)} onCommit={(value) => { if (!value) onPatch({ sets: null }); else { const parsed = Number(value); if (Number.isInteger(parsed) && parsed > 0 && parsed <= 100) onPatch({ sets: parsed }); } }} onClear={() => onPatch({ sets: null })} />
    <EditableGridCell row={rowIndex} column={3} label="Reps" value={row.reps} onCommit={commitReps} onClear={() => commitReps('')} className={row.reps && !parseReps(row.reps).valid ? 'cell-invalid' : ''} />
    <EditableGridCell row={rowIndex} column={4} label="RPE" value={row.rpe === null ? '' : row.rpe.toFixed(1).replace('.0', '')} inputOptions={Array.from({ length: 11 }, (_, index) => (5 + index * 0.5).toFixed(1).replace('.0', ''))} placeholder="5–10" className={row.rpe !== null ? `rpe-cell rpe-${Math.floor(row.rpe)}` : ''} onCommit={(value) => { const parsed = value ? Number(value) : null; if (parsed === null || (parsed >= 5 && parsed <= 10 && parsed * 2 === Math.trunc(parsed * 2))) onPatch({ rpe: parsed }); }} onClear={() => onPatch({ rpe: null })} />
    <div role="gridcell" data-grid-cell={`${rowIndex}:5`} className="builder-cell load-cell"><select aria-label="Load mode" value={mode} onChange={(event) => { const next = event.target.value as LoadMode; onPatch({ load_mode: next, load_value: null, load_min: null, load_max: null, percent_of: next === 'percent' ? 'e1rm' : null }); }}><option value="absolute">kg/lb</option><option value="percent">%</option><option value="rpe">RPE</option><option value="none">—</option></select>{mode === 'rpe' ? <span className="load-mode-note">Derived</span> : mode !== 'none' && <input aria-label="Load" key={`${row.id}-${mode}`} defaultValue={loadValue} placeholder={mode === 'percent' ? '85' : '130-132.5'} onBlur={(event) => commitLoad(event.currentTarget.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); window.requestAnimationFrame(() => focusProgramGridCell(rowIndex + 1, 5)); } else if (event.key === 'Tab') { event.preventDefault(); event.currentTarget.blur(); window.requestAnimationFrame(() => focusProgramGridCell(rowIndex, event.shiftKey ? 4 : 6)); } else if (event.key === 'Escape') event.currentTarget.value = loadValue; }} />}{mode === 'percent' && <select aria-label="Percent basis" value={row.percent_of ?? 'e1rm'} onChange={(event) => onPatch({ percent_of: event.target.value as 'e1rm' | 'tm' })}><option value="e1rm">e1RM</option><option value="tm">TM</option></select>}</div>
    <EditableGridCell row={rowIndex} column={6} label="Coach notes" value={row.notes_coach ?? ''} placeholder="Add note" onCommit={(value) => onPatch({ notes_coach: value || null })} onClear={() => onPatch({ notes_coach: null })} />
    <div role="gridcell" className="athlete-grid-cell" title={orderedLogs.filter((item) => item.load_lifted !== null).map((item) => `Set ${item.set_number}: ${item.load_lifted} ${programUnit}`).join(' · ') || 'No load logged'} aria-label={`Load lifted by set: ${loadSummary}`}>{loadSummary}</div><div role="gridcell" className="athlete-grid-cell" title={orderedLogs.filter((item) => item.rpe_lifted !== null).map((item) => `Set ${item.set_number}: RPE ${item.rpe_lifted}`).join(' · ') || 'No RPE logged'} aria-label={`RPE lifted by set: ${rpeSummary}`}>{rpeSummary}</div><div role="gridcell" className="athlete-grid-cell athlete-grid-log-note" title={notesSummary}>{notesSummary}</div><div role="gridcell" className="athlete-grid-cell athlete-grid-total" aria-label={`Total load volume: ${totalLifted ? `${totalLifted.toLocaleString()} ${programUnit}` : 'not logged'}`}>{totalLifted ? `${totalLifted.toLocaleString()} ${programUnit}` : '—'}</div>
    <div className="row-actions"><button aria-label="Duplicate row" title="Duplicate row" onClick={onDuplicate}>⧉</button><button aria-label="Delete row" title="Delete row" onClick={onDelete}>×</button></div>
    {mode === 'rpe' && <span className={`load-validation-hint${loadHint.valid ? ' hint-preview' : ''}`} role="status">{loadHint.hint}</span>}
    {mode !== 'rpe' && mode !== 'none' && loadValue && !loadHint.valid && <span className="load-validation-hint" role="status">{loadHint.hint}</span>}
  </div>;
}

function WeekLiftTotals({ week, exercises, unit }: { week: ProgramWeek; exercises: Exercise[]; unit: 'kg' | 'lb' }) {
  const sessions = useCoachWorkoutSessions();
  const byExercise = new Map(week.days.flatMap((day) => day.exercises.map((row) => [row.id, row] as const)));
  const totals = { squat: 0, bench: 0, deadlift: 0 };
  for (const session of sessions) {
    if (!week.days.some((day) => day.id === session.day_id)) continue;
    for (const set of session.logged_sets) {
      const row = byExercise.get(set.program_exercise_id);
      if (!row || set.load_lifted === null) continue;
      const movement = exercises.find((exercise) => exercise.id === row.exercise_id)?.movement;
      const reps = parseReps(row.reps);
      if ((movement === 'squat' || movement === 'bench' || movement === 'deadlift') && reps.valid) {
        totals[movement] += set.load_lifted * (reps.min ?? 0);
      }
    }
  }
  const format = (value: number) => value ? `${value.toLocaleString()} ${unit}` : '—';
  return <section className="week-lift-totals" aria-label={`${week.name} logged lift totals`}>
    <div><p className="eyebrow">WEEKLY LIFTED TOTALS</p><p className="week-lift-totals-note">Load × prescribed reps, from the selected athlete’s logs</p></div>
    <dl><div><dt>Squat</dt><dd>{format(totals.squat)}</dd></div><div><dt>Bench</dt><dd>{format(totals.bench)}</dd></div><div><dt>Deadlift</dt><dd>{format(totals.deadlift)}</dd></div></dl>
  </section>;
}

function DayCard({ week, day, exercises, document, dispatch, setTypeOptions, onManageSetTypes, onCreateExercise }: { week: ProgramWeek; day: ProgramWeek['days'][number]; exercises: Exercise[]; document: ProgramDocument; dispatch: React.Dispatch<Parameters<typeof programReducer>[1]>; setTypeOptions: string[]; onManageSetTypes: () => void; onCreateExercise: (name: string) => Promise<Exercise | undefined> }) {
  const [collapsed, setCollapsed] = useState(false);
  const allRowCount = week.days.reduce((sum, current) => sum + current.exercises.length, 0);
  const rowStart = 1 + week.days.slice(0, week.days.findIndex((current) => current.id === day.id)).reduce((sum, current) => sum + current.exercises.length, 0);
  const addRow = (exercise?: Exercise, values: Partial<ProgramExercise> = {}) => {
    const newRowIndex = keyboardRowIndex(day.exercises.length);
    const row = exercise
      ? createRow(day.id, exercise.id, day.exercises.length, { exercise, ...values })
      : createBlankRow(day.id, day.exercises.length);
    dispatch({ type: 'add-row', weekId: week.id, dayId: day.id, row });
    if (!exercise) {
      window.requestAnimationFrame(() => {
        window.document.querySelector<HTMLInputElement>(`[data-grid-cell="${newRowIndex}:0"] input`)?.focus();
      });
    }
  };
  const keyboardRowIndex = (index: number) => rowStart + index;
  return <article className="day-card"><header className="day-card-header"><button className="collapse-day" onClick={() => setCollapsed(!collapsed)} aria-expanded={!collapsed} aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${day.name}`}>{collapsed ? '▸' : '▾'}</button><label className="day-name-field"><span className="eyebrow">SESSION {String(day.day_number).padStart(2, '0')}</span><input aria-label="Day name" value={day.name} onChange={(event) => dispatch({ type: 'rename-day', weekId: week.id, dayId: day.id, name: event.target.value })} /></label><span className="day-summary">{repsSummary(day.exercises)}</span><div className="day-header-actions"><Link className="button button-quiet" to={`/coach/programs/${document.program.id}/days/${day.id}/videos`}>Videos</Link><button className="button button-quiet" onClick={() => addRow()}>＋ Add row</button><button className="button button-quiet" onClick={() => { const movement = window.prompt('Main lift (squat, bench, or deadlift)', 'squat')?.toLowerCase(); const exercise = exercises.find((item) => item.is_competition_lift && item.movement === movement); if (!exercise) return; addRow(exercise, { set_type: 'top', sets: 1, reps: '1', reps_min: 1, reps_max: 1, rpe: 7, load_mode: 'rpe' }); addRow(exercise, { set_type: 'backoff', sets: 3, reps: '3', reps_min: 3, reps_max: 3, rpe: 6, load_mode: 'rpe' }); }}>Quick add</button><button className="icon-button danger-icon" aria-label={`Delete ${day.name}`} title="Delete day" onClick={() => { if (window.confirm(`Delete ${day.name} and its exercise rows?`)) dispatch({ type: 'delete-day', weekId: week.id, dayId: day.id }); }}>×</button></div></header>
    {!collapsed && <div className="day-card-body"><div role="grid" aria-label={`${week.name} ${day.name} program grid`} className="program-grid">
      <div role="row" className="builder-grid-header with-athlete-columns"><div role="columnheader">Exercise</div><div role="columnheader">Set type</div><div role="columnheader">Sets</div><div role="columnheader">Reps</div><div role="columnheader">RPE</div><div role="columnheader">Load</div><div role="columnheader">Coach notes</div><div role="columnheader" className="athlete-col">Load lifted</div><div role="columnheader" className="athlete-col">RPE lifted</div><div role="columnheader" className="athlete-col">Athlete notes</div><div role="columnheader" className="athlete-col">Total lifted</div></div>
      {day.exercises.map((row, index) => <ProgramRow key={row.id} row={row} rowIndex={keyboardRowIndex(index)} dayId={day.id} exercises={exercises} programUnit={document.program.unit} setTypeOptions={setTypeOptions} onManageSetTypes={onManageSetTypes} onPatch={(patch) => dispatch({ type: 'update-row', weekId: week.id, dayId: day.id, rowId: row.id, patch })} onDelete={() => dispatch({ type: 'delete-row', weekId: week.id, dayId: day.id, rowId: row.id })} onDuplicate={() => dispatch({ type: 'add-row', weekId: week.id, dayId: day.id, row: { ...row, id: crypto.randomUUID(), position: day.exercises.length } })} onCreateExercise={onCreateExercise} />)}
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
  const [history, dispatch] = useReducer(programReducer, null, () => createProgramHistory({ program: { id: '', coach_id: coachId, name: '', description: null, unit: 'kg', updated_at: '' }, blocks: [], weeks: [] }));
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [customSetTypes, setCustomSetTypes] = useState<string[]>(defaultSetTypeOptions);
  const [manageSetTypes, setManageSetTypes] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<'saved' | 'saving' | 'error' | 'conflict'>('saved');
  const [saveError, setSaveError] = useState('');
  const [savedAt, setSavedAt] = useState('');
  const [savedDocument, setSavedDocument] = useState<ProgramDocument | null>(null);
  const [selectedWeek, setSelectedWeek] = useState('');
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const pendingSelectLastWeek = useRef(false);
  const pendingSelectLastBlock = useRef(false);
  const expectedAt = useState({ current: '' })[0];
  const document = history.present;
  const setTypeOptions = customSetTypes;
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(`topset:set-type-options:${coachId}`);
      const parsed: unknown = stored ? JSON.parse(stored) : [];
      const savedOptions = Array.isArray(parsed) ? [...defaultSetTypeOptions, ...parsed] : parsed && typeof parsed === 'object' && 'options' in parsed && Array.isArray(parsed.options) ? parsed.options : defaultSetTypeOptions;
      const unique = savedOptions.filter((value): value is string => typeof value === 'string' && value.trim().length > 0).filter((value, index, values) => values.findIndex((candidate) => candidate.toLowerCase() === value.toLowerCase()) === index);
      setCustomSetTypes(unique);
    } catch { setCustomSetTypes(defaultSetTypeOptions); }
  }, [coachId]);
  const saveSetTypeOptions = (draft: SetTypeOptionDraft[]) => {
    const next = draft.map((item) => item.value);
    for (const item of draft) {
      if (item.original && item.original !== item.value) dispatch({ type: 'rename-set-type', from: item.original, to: item.value });
    }
    setCustomSetTypes(next);
    try { window.localStorage.setItem(`topset:set-type-options:${coachId}`, JSON.stringify({ version: 2, options: next })); } catch { /* Current edits remain available for this session. */ }
    setManageSetTypes(false);
  };
  const hasUnsaved = ready && document !== savedDocument;
  const saveCurrent = useCallback(async () => {
    setSaveError('');
    setStatus('saving');
    try {
      const timestamp = await saveProgram(document, expectedAt.current);
      expectedAt.current = timestamp;
      setSavedAt(timestamp);
      setSavedDocument(document);
      setStatus('saved');
    } catch (error) {
      setStatus(error instanceof Error && error.message === 'PROGRAM_CONFLICT' ? 'conflict' : 'error');
      setSaveError(saveFailureMessage(error));
      console.error('Coach program could not be saved.', error);
      throw error;
    }
  }, [document, expectedAt]);
  const saveAndNavigate = useCallback(async (destination: string) => {
    try {
      await saveCurrent();
      navigate(destination);
    } catch {
      // Keep the builder open; the status and retry action expose the failure.
    }
  }, [navigate, saveCurrent]);
  useEffect(() => {
    let active = true;
    setLoading(true); setReady(false); setLoadError(false);
    void Promise.all([loadProgram(programId), listExercises()]).then(([loaded, library]) => {
      if (!active) return;
      dispatch({ type: 'replace', document: loaded });
      expectedAt.current = loaded.program.updated_at;
      setSavedAt(loaded.program.updated_at);
      setSavedDocument(loaded);
      setSelectedBlockId(loaded.blocks?.[0]?.id ?? null);
      setSelectedWeek(loaded.weeks.find((week) => week.block_id === (loaded.blocks?.[0]?.id ?? null))?.id ?? '');
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
      void saveAndNavigate(`${destination.pathname}${destination.search}${destination.hash}`);
    };
    window.document.addEventListener('click', confirmInternalNavigation, true);
    return () => window.document.removeEventListener('click', confirmInternalNavigation, true);
  }, [document, hasUnsaved, saveAndNavigate]);
  const blocks = useMemo(() => document.blocks ?? [], [document.blocks]);
  const visibleWeeks = useMemo(() => document.weeks.filter((week) => week.block_id === selectedBlockId), [document.weeks, selectedBlockId]);
  const activeWeek = visibleWeeks.find((week) => week.id === selectedWeek) ?? visibleWeeks[0];
  const reloadConflict = async () => { setLoading(true); try { const remote = await loadProgram(programId); dispatch({ type: 'replace', document: remote }); expectedAt.current = remote.program.updated_at; setSavedAt(remote.program.updated_at); setSavedDocument(remote); setStatus('saved'); setReady(true); } catch { setStatus('error'); } finally { setLoading(false); } };
  const addCustomInline = async (name: string): Promise<Exercise | undefined> => {
    const found = exercises.find((exercise) => exercise.name.toLowerCase() === name.toLowerCase());
    if (found) return found;
    return {
      id: `draft:${crypto.randomUUID()}`, owner_id: null, name, category: 'accessory', movement: 'other',
      muscle_group: null, is_competition_lift: false,
    };
  };
  const addWeek = () => { pendingSelectLastWeek.current = true; dispatch({ type: 'add-week', blockId: selectedBlockId }); };
  const addBlock = () => { pendingSelectLastBlock.current = true; dispatch({ type: 'add-block' }); };
  useEffect(() => {
    if (pendingSelectLastBlock.current) {
      pendingSelectLastBlock.current = false;
      const block = blocks.at(-1);
      setSelectedBlockId(block?.id ?? null);
      setSelectedWeek(document.weeks.find((week) => week.block_id === block?.id)?.id ?? '');
    } else if (pendingSelectLastWeek.current) {
      pendingSelectLastWeek.current = false;
      setSelectedWeek([...visibleWeeks].at(-1)?.id ?? document.weeks.at(-1)?.id ?? '');
    } else if (selectedBlockId && !blocks.some((block) => block.id === selectedBlockId)) {
      const firstBlock = blocks[0];
      setSelectedBlockId(firstBlock?.id ?? null);
      setSelectedWeek(document.weeks.find((week) => week.block_id === (firstBlock?.id ?? null))?.id ?? '');
    } else if (!visibleWeeks.some((week) => week.id === selectedWeek)) {
      setSelectedWeek(visibleWeeks[0]?.id ?? '');
    }
  }, [blocks, document.weeks, selectedBlockId, selectedWeek, visibleWeeks]);
  if (loading) return <main className="coach-page builder-loading"><div className="skeleton-line" /><div className="skeleton-line short" /><div className="builder-skeleton" /></main>;
  if (loadError) return <main className="coach-page"><section className="coach-panel empty-state"><p className="eyebrow">PROGRAM UNAVAILABLE</p><h1>We could not open this program</h1><p>It may not exist, or it may belong to another coach.</p><Link className="button button-secondary" to="/coach/programs">Back to programs</Link></section></main>;

  return <main className="coach-page program-builder-page">
    <div className="builder-breadcrumb"><Link to="/coach/programs">← Programs</Link><span>/</span><span>Program builder</span></div>
    <header className="builder-topbar"><div className="builder-program-name"><p className="eyebrow">PROGRAM / EDITOR</p><input aria-label="Program name" value={document.program.name} onChange={(event) => dispatch({ type: 'rename-program', name: event.target.value })} /></div><div className="builder-top-actions"><div className={`save-indicator save-${status}`} role="status"><span />{status === 'saved' ? hasUnsaved ? 'Unsaved changes' : `Saved${savedAt ? ` · ${new Date(savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}` : status === 'saving' ? 'Saving…' : status === 'conflict' ? 'Changed elsewhere' : 'Save failed'}</div>{status === 'conflict' && <button className="button button-secondary" onClick={() => void reloadConflict()}>Reload latest</button>}<button className="button button-primary" disabled={!hasUnsaved || status === 'saving' || status === 'conflict'} onClick={() => void saveCurrent().catch(() => undefined)}>{status === 'saving' ? 'Saving…' : status === 'error' ? 'Retry save' : 'Save changes'}</button></div></header>
    {status === 'conflict' && <div role="alert" className="inline-state error-state">This program changed in another session. Reload the latest version before editing again.</div>}
    {status === 'error' && <div role="alert" className="inline-state error-state">Your edits are still here, but could not be saved. {saveError || 'Retry the save.'}</div>}
    <section className="week-navigation"><div className="block-navigation"><div className="block-tabs" role="group" aria-label="Program blocks">{blocks.map((block, index) => <ProgramNameTab key={block.id} kind="block" label={`block ${index + 1}`} value={block.name} fallback="Block" selected={selectedBlockId === block.id} onSelect={() => { setSelectedBlockId(block.id); setSelectedWeek(document.weeks.find((week) => week.block_id === block.id)?.id ?? ''); }} onRename={(name) => dispatch({ type: 'rename-block', blockId: block.id, name })} />)}</div><button className="button button-secondary" onClick={addBlock}>＋ Add block</button></div><div className="week-navigation-row"><div className="week-tabs" role="group" aria-label="Program weeks">{visibleWeeks.map((week) => <ProgramNameTab key={week.id} kind="week" label={week.name || 'Week'} value={week.name} fallback="Week" selected={activeWeek?.id === week.id} onSelect={() => setSelectedWeek(week.id)} onRename={(name) => dispatch({ type: 'rename-week', weekId: week.id, name })} />)}</div><div className="week-actions"><button className="button button-secondary" onClick={addWeek}>＋ Add week</button>{activeWeek && <button className="button button-quiet danger-quiet" onClick={() => { if (window.confirm(`Delete ${activeWeek.name || 'Week'} and all its days?`)) dispatch({ type: 'delete-week', weekId: activeWeek.id }); }}>Delete week</button>}</div></div></section>
    {!activeWeek ? <section className="coach-panel empty-state"><span className="empty-state-mark">＋</span><h2>Add a week to get started</h2><button className="button button-primary" onClick={addWeek}>Add week</button></section> : <><div className="week-heading"><div><p className="eyebrow">TRAINING CYCLE / WEEK</p><h2 className="week-title">{activeWeek.name || 'Week'}</h2></div><button className="button button-primary" onClick={() => dispatch({ type: 'add-day', weekId: activeWeek.id })}>＋ Add day</button></div>
      {activeWeek.days.length ? <CoachWorkoutCheckInsProvider preferredProgramId={programId}><div className="day-stack">{activeWeek.days.map((day) => <div className="builder-day-checkin-row" key={day.id}><DayCard week={activeWeek} day={day} exercises={exercises} document={document} dispatch={dispatch} setTypeOptions={setTypeOptions} onManageSetTypes={() => setManageSetTypes(true)} onCreateExercise={addCustomInline} /><CoachWorkoutCheckInsPanel dayId={day.id} dayName={day.name} unit={document.program.unit} exerciseNames={Object.fromEntries(day.exercises.map((row) => [row.id, exercises.find((exercise) => exercise.id === row.exercise_id)?.name ?? row.exercise_name ?? 'Exercise']))} /></div>)}</div><WeekLiftTotals week={activeWeek} exercises={exercises} unit={document.program.unit} /></CoachWorkoutCheckInsProvider> : <section className="coach-panel empty-state"><span className="empty-state-mark">＋</span><h2>No training days in this week</h2><p>Add a day to begin the spreadsheet.</p><button className="button button-primary" onClick={() => dispatch({ type: 'add-day', weekId: activeWeek.id })}>Add first day</button></section>}
    </>}
    <footer className="builder-footer"><span>WORKING DOCUMENT · {document.program.unit.toUpperCase()}</span><span>Save changes to sync the live plan with athletes.</span><button className="button button-quiet" onClick={() => { if (window.confirm('Save your recent edits and leave the builder?')) void saveAndNavigate('/coach/programs'); }}>Exit builder</button></footer>
    {manageSetTypes && <SetTypeOptionsDialog options={customSetTypes} onClose={() => setManageSetTypes(false)} onSave={saveSetTypeOptions} />}
  </main>;
}
