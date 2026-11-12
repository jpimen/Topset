import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { AthleteWorkoutCheckInPanel } from './AthleteWorkoutCheckInPanel';
import { AthleteWorkoutLogRows } from './AthleteWorkoutLogRows';
import { athleteExerciseName, athleteLoadLabel, hasUsableExerciseName, isLoggablePrescription } from '../../lib/athlete/prescriptions';
import { useAthleteProgram } from './useAthleteProgram';
import { AthleteWorkoutSessionsProvider } from './AthleteWorkoutSessionsProvider';

const LEGACY_BLOCK_ID = '__legacy_block__';

export function AthleteProgramPage() {
  const { profile } = useAuth();
  const [edits, setEdits] = useState<Record<string, boolean>>({});
  const onEditStateChange = useCallback((key: string, dirty: boolean) => {
    setEdits((current) => {
      if (Boolean(current[key]) === dirty) return current;
      const next = { ...current };
      if (dirty) next[key] = true; else delete next[key];
      return next;
    });
  }, []);
  const { result, loading, error, refresh, refreshDeferred, offline, verifiedAt, warning, liveSyncWarning } = useAthleteProgram(profile?.id, Object.keys(edits).length > 0);
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

  if (loading && !result) return <main className="athlete-page"><div className="dashboard-skeleton" aria-label="Loading assigned program" /></main>;
  if (error && !result) return <main className="athlete-page"><section className="coach-panel empty-state" role="alert"><h1>Program unavailable</h1><p>{error}</p><button className="button button-secondary" onClick={refresh}>Try again</button></section></main>;
  if (!result) return <main className="athlete-page"><section className="coach-panel empty-state"><p className="eyebrow">PROGRAM</p><h1>No assigned program yet</h1><p>Your coach’s assigned plan will appear here.</p>{warning && <p role="alert">{warning}</p>}</section></main>;

  const week = visibleWeeks[selectedWeek];
  return (
    <main className="athlete-page">
      {offline && <p className="inline-state" role="status">Offline copy · last verified {new Date(verifiedAt!).toLocaleString()}. Access changes cannot be checked until you reconnect. Copies expire after 24 hours.</p>}
      {error && <p className="inline-error" role="alert">{error}<button className="button button-secondary" onClick={refresh}>Try again</button></p>}
      {warning && <p className="inline-error" role="alert">{warning}</p>}
      {liveSyncWarning && <p className="inline-state" role="status">{liveSyncWarning}</p>}
      {refreshDeferred && <p className="inline-state" role="status">Program refresh paused while you have unsaved entries. Save your workout and check-in changes to load the latest plan.</p>}
      <p className="athlete-program-refresh-status" aria-live="polite" role={loading ? 'status' : undefined}>{loading ? 'Refreshing program…' : ''}</p>
      <header className="athlete-page-heading"><div><p className="eyebrow">PROGRAM · {result.assignment.sync_mode === 'live' ? 'LIVE PLAN' : 'SAVED SNAPSHOT'}</p><h1>{result.program.program.name}</h1><p>{result.program.program.description || 'Your coach’s plan, available here to review at any time.'}</p></div><div className="athlete-program-heading-actions"><span className="athlete-readonly-tag">Read only</span><button className="button button-secondary" onClick={refresh}>Refresh program</button></div></header>
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
                <p className="athlete-program-scroll-hint">Swipe across the table to view each exercise and workout log column.</p>
                <table className="athlete-program-table">
                  <caption className="visually-hidden">{week.name}, {day.name} exercise prescriptions and athlete workout log</caption>
                  <thead><tr><th scope="col">Exercise</th><th scope="col">Set type</th><th scope="col">Sets</th><th scope="col">Reps</th><th scope="col">RPE</th><th scope="col">Load</th><th scope="col">Coach notes</th><th scope="col" colSpan={3}>Workout log · {result.program.program.unit}</th></tr></thead>
                  <tbody>{profile?.id ? <AthleteWorkoutLogRows athleteId={profile.id} assignmentId={result.assignment.id} day={day} unit={result.program.program.unit} onEditStateChange={onEditStateChange} /> : day.exercises.filter(hasUsableExerciseName).map((row) => <tr key={row.id}>
                    <th scope="row" className="athlete-program-exercise">{athleteExerciseName(row)}</th>
                    <td><span className={`athlete-program-set-type${row.set_type ? ` set-type-${row.set_type.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}` : ''}`}>{row.set_type ?? '—'}</span></td>
                    <td>{row.sets ?? '—'}</td>
                    <td>{row.reps || '—'}</td>
                    <td>{row.rpe ?? '—'}</td>
                    <td className="athlete-program-prescribed-load">{athleteLoadLabel(row, result.program.program.unit)}</td>
                    <td className="athlete-program-coach-notes">{row.notes_coach || '—'}</td>
                    <td colSpan={3}>{isLoggablePrescription(row) ? '—' : <span className="athlete-program-unprescribed">— Not prescribed</span>}</td>
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
