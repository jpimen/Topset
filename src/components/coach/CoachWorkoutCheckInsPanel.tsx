import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { loadCoachWorkoutCheckIns, type CoachWorkoutCheckIn } from '../../lib/coachWorkoutCheckIns';
import { listActiveAssignments, type ProgramAssignment } from '../../lib/programAssignments';
import { listCoachLinks } from '../../lib/coachAthletes';
import { useCoachId } from './useCoachId';
import { loadWorkoutSessions, type AthleteWorkoutSession } from '../../lib/athlete/logs';

type CheckInContextValue = {
  assignments: ProgramAssignment[];
  assignmentsLoading: boolean;
  assignmentsError: string;
  selected: ProgramAssignment | null;
  setSelectedId: (id: string) => void;
  rows: CoachWorkoutCheckIn[];
  sessions: AthleteWorkoutSession[];
  loading: boolean;
  error: string;
  retry: () => void;
};

const CheckInContext = createContext<CheckInContextValue | null>(null);

export function useCoachWorkoutLogSets(dayId: string, programExerciseId: string) {
  const context = useContext(CheckInContext);
  if (!context) throw new Error('Workout log cells must be inside CoachWorkoutCheckInsProvider.');
  const session = context.sessions.find((item) => item.day_id === dayId && item.logged_sets.some((set) => set.load_lifted !== null || set.rpe_lifted !== null || set.notes_athlete !== null));
  return session?.logged_sets.filter((item) => item.program_exercise_id === programExerciseId) ?? [];
}

export function CoachWorkoutCheckInsProvider({ preferredProgramId, children }: { preferredProgramId?: string; children: ReactNode }) {
  const coachId = useCoachId();
  const [assignments, setAssignments] = useState<ProgramAssignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);
  const [assignmentsError, setAssignmentsError] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [rows, setRows] = useState<CoachWorkoutCheckIn[]>([]);
  const [sessions, setSessions] = useState<AthleteWorkoutSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const selected = assignments.find((item) => item.id === selectedId)
    ?? assignments.find((item) => item.program_id === preferredProgramId)
    ?? assignments[0]
    ?? null;

  useEffect(() => {
    let active = true;
    setAssignmentsLoading(true);
    setAssignmentsError('');
    void Promise.all([listActiveAssignments(coachId), listCoachLinks(coachId)]).then(([items, links]) => {
      const linkedAthleteIds = new Set(links.filter((link) => link.status === 'active').map((link) => link.athlete_id));
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      if (active) setAssignments(items.filter((item) => linkedAthleteIds.has(item.athlete_id)
        && item.start_date <= today
        && (!preferredProgramId || item.program_id === preferredProgramId)));
    }).catch((cause: unknown) => {
      console.error('Coach check-in assignments could not be loaded.', cause);
      if (active) setAssignmentsError('We could not load linked athlete assignments. Try reloading this page.');
    }).finally(() => { if (active) setAssignmentsLoading(false); });
    return () => { active = false; };
  }, [coachId, preferredProgramId]);

  useEffect(() => {
    if (!selected) { setRows([]); setSessions([]); setLoading(false); setError(''); return; }
    let active = true;
    setLoading(true);
    setError('');
    void Promise.all([loadCoachWorkoutCheckIns(selected), loadWorkoutSessions(selected.id)]).then(([items, workoutSessions]) => {
      if (active) { setRows(items); setSessions(workoutSessions); }
    }).catch((cause: unknown) => {
      console.error('Athlete check-ins could not be loaded for coach review.', cause);
      if (active) setError('We could not load this athlete’s check-ins. Try again.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selected?.id, retryKey]);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    let refreshing = false;
    const refresh = async () => {
      if (refreshing || document.visibilityState !== 'visible') return;
      refreshing = true;
      try {
        const [items, workoutSessions] = await Promise.all([loadCoachWorkoutCheckIns(selected), loadWorkoutSessions(selected.id)]);
        if (active) { setRows(items); setSessions(workoutSessions); setError(''); }
      } catch (cause) {
        console.error('Coach workout logs could not be refreshed.', cause);
      } finally {
        refreshing = false;
      }
    };
    const timer = window.setInterval(() => void refresh(), 8000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [selected?.id]);

  const value: CheckInContextValue = {
    assignments,
    assignmentsLoading,
    assignmentsError,
    selected,
    setSelectedId,
    rows,
    sessions,
    loading,
    error,
    retry: () => setRetryKey((key) => key + 1),
  };

  return <CheckInContext.Provider value={value}>{children}</CheckInContext.Provider>;
}

function valueOrDash(value: number | null, unit = '') {
  return value === null ? '—' : `${value}${unit ? ` ${unit}` : ''}`;
}

export function CoachWorkoutCheckInsPanel({ dayId, dayName, unit = 'kg', exerciseNames = {} }: { dayId: string; dayName: string; unit?: 'kg' | 'lb'; exerciseNames?: Record<string, string> }) {
  const context = useContext(CheckInContext);
  if (!context) throw new Error('CoachWorkoutCheckInsPanel must be inside CoachWorkoutCheckInsProvider.');
  const { assignments, assignmentsLoading, assignmentsError, selected, setSelectedId, rows, sessions, loading, error, retry } = context;
  const checkIn = rows.find((row) => row.day_id === dayId) ?? null;
  const workoutSessions = sessions.filter((session) => session.day_id === dayId && session.logged_sets.some((set) => set.load_lifted !== null || set.rpe_lifted !== null || set.notes_athlete !== null));
  const titleId = `coach-checkin-${dayId}`;

  return <aside className="coach-panel coach-checkins-panel" aria-labelledby={titleId}>
    <header className="coach-checkins-heading">
      <div><p className="eyebrow">ATHLETE RESPONSE · {dayName.toUpperCase()}</p><h3 id={titleId}>Training check-in</h3><p>Recovery and nutrition for this day.</p></div>
      {selected && <button className="button button-quiet" type="button" onClick={retry} disabled={loading}>Refresh</button>}
    </header>
    {assignmentsLoading ? <div className="dashboard-skeleton coach-checkins-skeleton" aria-label="Loading assigned athletes" /> : assignmentsError ? <div className="coach-checkins-empty" role="alert"><p>{assignmentsError}</p></div> : assignments.length === 0 ? <div className="coach-checkins-empty"><h4>No athletes assigned</h4><p>Assign this program to a currently linked athlete to view check-ins.</p></div> : <>
      <label className="coach-checkins-select">Athlete
        <select aria-label={`${dayName}: select athlete`} value={selected?.id ?? ''} onChange={(event) => setSelectedId(event.currentTarget.value)}>
          {assignments.map((item) => <option key={item.id} value={item.id}>{item.athlete?.name ?? 'Athlete'}</option>)}
        </select>
      </label>
      {loading ? <div className="dashboard-skeleton coach-checkins-skeleton" aria-label={`Loading ${dayName} check-in`} /> : error ? <div className="coach-checkins-empty" role="alert"><p>{error}</p><button className="button button-secondary" onClick={retry}>Try again</button></div> : !checkIn ? <div className="coach-checkins-empty"><h4>No check-in yet</h4><p>{selected?.athlete?.name ?? 'This athlete'} has not submitted a check-in for {dayName}.</p></div> : <>
        <table className="coach-checkins-table coach-checkins-table-vertical">
          <caption className="visually-hidden">{selected?.athlete?.name ?? 'Athlete'} check-in for {dayName}</caption>
          <thead><tr><th scope="col">Metric</th><th scope="col">Response</th></tr></thead>
          <tbody>
            <tr><th scope="row">Bodyweight</th><td>{valueOrDash(checkIn.bodyweight, checkIn.bodyweight === null ? '' : checkIn.bodyweight_unit)}</td></tr>
            <tr><th scope="row">Sleep quality</th><td>{valueOrDash(checkIn.sleep_quality, checkIn.sleep_quality === null ? '' : '/5')}</td></tr>
            <tr><th scope="row">Sleep hours</th><td>{valueOrDash(checkIn.sleep_hours, checkIn.sleep_hours === null ? '' : 'h')}</td></tr>
            <tr><th scope="row">Protein</th><td>{valueOrDash(checkIn.protein_grams, checkIn.protein_grams === null ? '' : 'g')}</td></tr>
            <tr><th scope="row">Calories</th><td>{valueOrDash(checkIn.calories_kcal, checkIn.calories_kcal === null ? '' : 'kcal')}</td></tr>
            <tr><th scope="row">Carbohydrates</th><td>{valueOrDash(checkIn.carbs_grams, checkIn.carbs_grams === null ? '' : 'g')}</td></tr>
            <tr><th scope="row">Fatigue</th><td>{valueOrDash(checkIn.fatigue_level, checkIn.fatigue_level === null ? '' : '/10')}</td></tr>
          </tbody>
        </table>
        <p className="coach-checkins-updated">Updated <time dateTime={checkIn.updated_at}>{new Date(checkIn.updated_at).toLocaleString()}</time></p>
      </>}
    </>}
    <section className="coach-workout-log-review" aria-labelledby={`coach-workout-log-${dayId}`}>
      <div className="coach-workout-log-review-heading"><h4 id={`coach-workout-log-${dayId}`}>Athlete workout log</h4>{selected && <span>{selected.athlete?.name ?? 'Athlete'}</span>}</div>
      <p className="coach-workout-log-refresh">Updates automatically while this page is open.</p>
      {assignmentsLoading || loading ? <p className="coach-checkins-updated">Loading workout entries…</p> : error ? <p className="coach-checkins-updated">Workout logs could not be loaded.</p> : workoutSessions.length === 0 ? <p className="coach-checkins-updated">No workout entries have synced for this day yet.</p> : workoutSessions.map((session) => <div className="coach-workout-log-session" key={session.id}>
        <p className="coach-checkins-updated"><time dateTime={session.session_date}>{new Date(`${session.session_date}T12:00:00`).toLocaleDateString()}</time></p>
        {session.logged_sets.filter((set) => set.load_lifted !== null || set.rpe_lifted !== null || set.notes_athlete !== null).map((set, index) => <div className="coach-workout-log-entry" key={`${set.program_exercise_id}-${set.set_number}-${index}`}>
          <strong>{exerciseNames[set.program_exercise_id] ?? 'Exercise'}</strong><span>Set {set.set_number}</span><span>{set.load_lifted === null ? '—' : `${set.load_lifted} ${unit}`}</span><span>{set.rpe_lifted === null ? '—' : `RPE ${set.rpe_lifted}`}</span>{set.notes_athlete && <p>{set.notes_athlete}</p>}
        </div>)}
      </div>)}
    </section>
  </aside>;
}
