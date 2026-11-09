import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { loadWorkoutSessions, type AthleteWorkoutSession } from '../../lib/athlete/logs';

type SessionsState = { sessions: AthleteWorkoutSession[] | null; loading: boolean; error: string; refresh: () => void };
const SessionsContext = createContext<SessionsState | null>(null);

// Page-lifetime reuse only: all day rows consume one assignment-wide response.
// No health data is persisted here, and each identity/assignment mounts a new provider.
export function AthleteWorkoutSessionsProvider({ athleteId, assignmentId, verifiedAt, children }: {
  athleteId: string; assignmentId: string; verifiedAt?: number; children: ReactNode;
}) {
  const [sessions, setSessions] = useState<AthleteWorkoutSession[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  useEffect(() => {
    let active = true;
    let inFlight = false;
    let rerun = false;
    const load = async () => {
      if (inFlight) { rerun = true; return; }
      inFlight = true;
      setLoading(true);
      try {
        const rows = await loadWorkoutSessions(assignmentId);
        if (active) { setSessions(rows); setError(''); }
      } catch (cause) {
        console.error('Workout history could not be loaded.', cause);
        if (active) {
          setError(navigator.onLine
            ? 'Workout history could not be refreshed. Any loaded entries are still available; retry to check for newer entries.'
            : 'Offline: prescriptions and saved local drafts are available. Reconnect to load other workout entries.');
        }
      } finally {
        inFlight = false;
        if (active) {
          setLoading(false);
          if (rerun) { rerun = false; void load(); }
        }
      }
    };
    const changed = (event: Event) => {
      const detail = (event as CustomEvent<{ athleteId: string; synchronized?: boolean }>).detail;
      if (detail?.athleteId === athleteId && detail.synchronized && navigator.onLine) void load();
    };
    window.addEventListener('topset:workout-drafts-changed', changed);
    void load();
    return () => { active = false; window.removeEventListener('topset:workout-drafts-changed', changed); };
  }, [athleteId, assignmentId, verifiedAt, retryKey]);
  return <SessionsContext.Provider value={{ sessions, loading, error, refresh: () => setRetryKey((value) => value + 1) }}>{children}</SessionsContext.Provider>;
}

export function useAthleteWorkoutSessions() {
  const value = useContext(SessionsContext);
  if (!value) throw new Error('Workout rows must be inside AthleteWorkoutSessionsProvider.');
  return value;
}
