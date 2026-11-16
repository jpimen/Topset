import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { AthleteWorkoutCheckInPanel } from './AthleteWorkoutCheckInPanel';
import { AthleteWorkoutLogRows } from './AthleteWorkoutLogRows';
import { AthleteCoachLinkCard } from './AthleteCoachLinkCard';
import { AthletePersonalProgramPanel } from './AthletePersonalProgramPanel';
import { athleteExerciseName, athleteLoadLabel, hasUsableExerciseName, isLoggablePrescription } from '../../lib/athlete/prescriptions';
import { loadAthletePersonalProgram, saveAthletePersonalProgram, type AthletePersonalProgram } from '../../lib/athlete/personalPrograms';
import { useAthleteProgram } from './useAthleteProgram';
import { AthleteWorkoutSessionsProvider } from './AthleteWorkoutSessionsProvider';
import { normalizeProgramLayout, programLayoutColumns } from '../../lib/programs/layout';

const LEGACY_BLOCK_ID = '__legacy_block__';

export function AthleteProgramPage() {
  const { profile } = useAuth();
  const [personalProgram, setPersonalProgram] = useState<AthletePersonalProgram | null>(null);
  const [personalLoading, setPersonalLoading] = useState(true);
  const [personalLoadError, setPersonalLoadError] = useState('');
  const [selectedProgramSource, setSelectedProgramSource] = useState<'coach' | 'personal'>('coach');
  const [edits, setEdits] = useState<Record<string, boolean>>({});
  const onEditStateChange = useCallback((key: string, dirty: boolean) => {
    setEdits((current) => {
      if (Boolean(current[key]) === dirty) return current;
      const next = { ...current };
      if (dirty) next[key] = true; else delete next[key];
      return next;
    });
  }, []);
  const { result, loading, error, refresh, refreshDeferred, offline, verifiedAt, warning, syncWarning } = useAthleteProgram(profile?.id, Object.keys(edits).length > 0);
  useEffect(() => {
    let active = true;
    if (!profile?.id) { setPersonalLoading(false); return; }
    setPersonalLoading(true);
    setPersonalLoadError('');
    void loadAthletePersonalProgram(profile.id).then((program) => {
      if (active) setPersonalProgram(program);
    }).catch((cause: unknown) => {
      console.error('Athlete personal program could not be loaded.', cause);
      if (active) setPersonalLoadError('Your private program could not be loaded. Try again later.');
    }).finally(() => { if (active) setPersonalLoading(false); });
    return () => { active = false; };
  }, [profile?.id]);
  const savePersonalProgram = useCallback(async (program: AthletePersonalProgram) => {
    if (!profile?.id) throw new Error('Your account is not available.');
    setPersonalProgram(await saveAthletePersonalProgram(profile.id, program));
  }, [profile?.id]);
  const [selectedBlockId, setSelectedBlockId] = useState('');
  const [selectedWeek, setSelectedWeek] = useState(0);
  const displayBlocks = result ? (() => {
    const blocks = result.program.blocks;
    const hasUnmatchedWeek = result.program.weeks.some((week) => !week.block_id || !blocks.some((block) => block.id === week.block_id));
    return hasUnmatchedWeek ? [...blocks, { id: LEGACY_BLOCK_ID, name: 'Block', notes: null }] : blocks;
  })() : [];
  const activeBlockId = displayBlocks.some((block) => block.id === selectedBlockId) ? selectedBlockId : (displayBlocks[0]?.id ?? '');
  const activeBlock = displayBlocks.find((block) => block.id === activeBlockId);
  const visibleWeeks = result ? result.program.weeks.filter((week) =>
    (week.block_id && displayBlocks.some((block) => block.id === week.block_id) ? week.block_id : LEGACY_BLOCK_ID) === activeBlockId,
  ) : [];
  useEffect(() => { if (activeBlockId && activeBlockId !== selectedBlockId) { setSelectedBlockId(activeBlockId); setSelectedWeek(0); } }, [activeBlockId, selectedBlockId]);
  useEffect(() => { if (selectedWeek >= visibleWeeks.length) setSelectedWeek(0); }, [visibleWeeks.length, selectedWeek]);
  const isPersonalProgramSelected = () => selectedProgramSource === 'personal';

  if ((loading && !result) || personalLoading) return <main className="athlete-page"><div className="dashboard-skeleton" aria-label="Loading programs" /></main>;
  if ((error && !result) || !result || isPersonalProgramSelected()) return <main className="athlete-page">
    {result && <nav className="athlete-program-source-tabs" aria-label="Choose a program"><button type="button" aria-pressed={false} onClick={() => setSelectedProgramSource('coach')}>Coach’s program</button><button type="button" aria-pressed={true} className="selected">My program</button></nav>}
    {error && !result && <div className="coach-panel empty-state" role="alert"><h2>Coach program unavailable</h2><p>{error}</p><button className="button button-secondary" type="button" onClick={refresh}>Try again</button></div>}
    {!result && !error && !personalProgram && <section className="coach-panel empty-state"><p className="eyebrow">PROGRAM</p><h1>No assigned program yet</h1><p>Your coach’s assigned plan will appear here. You can also create a private program for yourself.</p>{warning && <p role="alert">{warning}</p>}</section>}
    {!result && personalProgram && <p className="inline-state">No Coach program is assigned yet. Your personal program is private to you.</p>}
    <AthletePersonalProgramPanel program={personalProgram} defaultUnit={profile?.unit ?? 'kg'} loadError={personalLoadError} onSave={savePersonalProgram} />
    {!result && <AthleteCoachLinkCard />}
  </main>;

  const week = visibleWeeks[selectedWeek];
  const layout = normalizeProgramLayout(result.program.layout);
  const tableColumnWeights = [
    layout.columns.exercise, layout.columns.set_type, layout.columns.sets, layout.columns.reps,
    layout.columns.rpe, layout.columns.load, layout.columns.coach_notes,
    layout.columns.athlete_load + layout.columns.athlete_rpe + layout.columns.athlete_notes + layout.columns.athlete_total,
  ];
  const tableColumnTotal = tableColumnWeights.reduce((sum, width) => sum + width, 0);
  return (
    <main className="athlete-page">
      {offline && <p className="inline-state" role="status">Offline copy · last verified {new Date(verifiedAt!).toLocaleString()}. Access changes cannot be checked until you reconnect. Copies expire after 24 hours.</p>}
      {error && <p className="inline-error" role="alert">{error}<button className="button button-secondary" onClick={refresh}>Try again</button></p>}
      {warning && <p className="inline-error" role="alert">{warning}</p>}
      {syncWarning && <p className="inline-state" role="status">{syncWarning}</p>}
      {refreshDeferred && <p className="inline-state" role="status">Program refresh paused while you have unsaved entries. Save your workout and check-in changes to load the latest plan.</p>}
      <p className="athlete-program-refresh-status" aria-live="polite" role={loading ? 'status' : undefined}>{loading ? 'Refreshing program…' : ''}</p>
      <header className="athlete-page-heading"><div><p className="eyebrow">PROGRAM · {result.assignment.sync_mode === 'live' ? 'LIVE PLAN' : 'SAVED SNAPSHOT'}</p><h1>{result.program.program.name}</h1><p>{result.program.program.description || 'Your coach’s plan, available here to review at any time.'}</p></div><div className="athlete-program-heading-actions"><span className="athlete-readonly-tag">Read only</span><button className="button button-secondary" onClick={refresh}>Refresh program</button></div></header>
      <nav className="athlete-program-source-tabs" aria-label="Choose a program"><button type="button" aria-pressed={selectedProgramSource === 'coach'} className={selectedProgramSource === 'coach' ? 'selected' : ''} onClick={() => setSelectedProgramSource('coach')}>Coach’s program</button><button type="button" aria-pressed={selectedProgramSource === 'personal'} className={selectedProgramSource === 'personal' ? 'selected' : ''} onClick={() => setSelectedProgramSource('personal')}>My program</button></nav>
      <AthleteWorkoutSessionsProvider key={`${profile?.id}:${result.assignment.id}`} athleteId={profile!.id} assignmentId={result.assignment.id} verifiedAt={verifiedAt}>
      {result.program.weeks.length === 0 ? <section className="coach-panel empty-state"><h2>Your program is being prepared</h2><p>There are no weeks in this plan yet.</p></section> : <>
        {displayBlocks.length > 0 && <nav className="athlete-block-tabs" aria-label="Program blocks">
          {displayBlocks.map((block, index) => <button key={block.id} className={activeBlockId === block.id ? 'selected' : ''} aria-pressed={activeBlockId === block.id} onClick={() => { setSelectedBlockId(block.id); setSelectedWeek(0); }}>{block.name || `Block ${index + 1}`}</button>)}
        </nav>}
        {activeBlock?.notes && <p className="athlete-week-note athlete-block-note">{activeBlock.notes}</p>}
        <nav className="athlete-week-tabs" aria-label="Program weeks">
          {visibleWeeks.map((item, index) => <button key={item.id} className={selectedWeek === index ? 'selected' : ''} aria-pressed={selectedWeek === index} onClick={() => setSelectedWeek(index)}>{item.name}</button>)}
        </nav>
        {week && <section className="athlete-program-days" aria-label={week.name}>
            {week.notes && <p className="athlete-week-note">{week.notes}</p>}
            {week.days.length === 0 ? <div className="coach-panel empty-state"><h2>No days added</h2><p>Your coach has not added training days to this week.</p></div> : week.days.map((day) => <div className={profile?.id ? 'athlete-day-checkin-layout' : undefined} key={day.id}><details className="coach-panel athlete-program-day" open>
              <summary><span><strong>{day.name}</strong><small>{day.exercises.filter(hasUsableExerciseName).length} {day.exercises.filter(hasUsableExerciseName).length === 1 ? 'exercise' : 'exercises'}</small></span><span aria-hidden="true">⌄</span></summary>
              {day.notes && <p className="athlete-coach-note"><strong>Coach note</strong>{day.notes}</p>}
              {day.exercises.filter(hasUsableExerciseName).length === 0 ? <p className="athlete-program-empty-day">No exercises in this day.</p> : <div className="athlete-program-table-viewport" role="region" aria-label={`${week.name} ${day.name} prescriptions`} tabIndex={0}>
                <p className="athlete-program-scroll-hint">Swipe horizontally to view more workout columns.</p>
                <table className="athlete-program-table" style={{ '--program-row-height': `${layout.rowHeight}px`, '--program-table-min-width': `${tableColumnTotal}px` } as CSSProperties}>
                  <caption className="visually-hidden">{week.name}, {day.name} exercise prescriptions and athlete workout log</caption>
                  <colgroup>{tableColumnWeights.map((weight, index) => <col key={programLayoutColumns[index]?.id ?? 'workout-log'} style={{ width: `${(weight / tableColumnTotal) * 100}%` }} />)}</colgroup>
                  <thead><tr><th scope="col">Exercise</th><th scope="col">Set type</th><th scope="col">Sets</th><th scope="col">Reps</th><th scope="col">RPE</th><th scope="col">Load</th><th scope="col">Coach notes</th><th scope="col">Workout log · {result.program.program.unit}</th></tr></thead>
                  <tbody>{profile?.id ? <AthleteWorkoutLogRows athleteId={profile.id} assignmentId={result.assignment.id} day={day} unit={result.program.program.unit} onEditStateChange={onEditStateChange} /> : day.exercises.filter(hasUsableExerciseName).map((row) => <tr key={row.id}>
                    <th scope="row" className="athlete-program-exercise">{athleteExerciseName(row)}</th>
                    <td><span className={`athlete-program-set-type${row.set_type ? ` set-type-${row.set_type.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}` : ''}`}>{row.set_type ?? '—'}</span></td>
                    <td>{row.sets ?? '—'}</td>
                    <td>{row.reps || '—'}</td>
                    <td>{row.rpe ?? '—'}</td>
                    <td className="athlete-program-prescribed-load">{athleteLoadLabel(row, result.program.program.unit)}</td>
                    <td className="athlete-program-coach-notes">{row.notes_coach || '—'}</td>
                    <td>{isLoggablePrescription(row) ? '—' : <span className="athlete-program-unprescribed">— Not prescribed</span>}</td>
                  </tr>)}</tbody>
                </table>
              </div>}
            </details>{profile?.id && <AthleteWorkoutCheckInPanel athleteId={profile.id} assignmentId={result.assignment.id} dayId={day.id} dayName={day.name} defaultUnit={result.program.program.unit} onEditStateChange={onEditStateChange} />}</div>)}
          </section>}
      </>}
      </AthleteWorkoutSessionsProvider>
    </main>
  );
}
