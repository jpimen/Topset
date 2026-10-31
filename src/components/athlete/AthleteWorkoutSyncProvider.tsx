import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { deleteWorkoutDraft, readWorkoutDrafts, syncWorkoutDraft } from '../../lib/athlete/logs';
import type { WorkoutSyncState } from '../../lib/athlete/types';

interface WorkoutSyncContextValue {
  state: WorkoutSyncState;
  offline: boolean;
  error: string;
  syncVersion: number;
  retry: () => Promise<void>;
}

const WorkoutSyncContext = createContext<WorkoutSyncContextValue | null>(null);

export function AthleteWorkoutSyncProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const location = useLocation();
  const [state, setState] = useState<WorkoutSyncState>('saved');
  const [offline, setOffline] = useState(!window.navigator.onLine);
  const [error, setError] = useState('');
  const [syncVersion, setSyncVersion] = useState(0);
  const syncing = useRef(false);
  const rerun = useRef(false);
  const syncTimer = useRef<number | null>(null);

  const retry = useCallback(async () => {
    if (!profile?.id) return;
    if (!window.navigator.onLine) {
      setOffline(true);
      setState('pending');
      return;
    }
    if (syncing.current) { rerun.current = true; return; }

    const queue = readWorkoutDrafts(profile.id);
    if (queue.length === 0) {
      setState('saved');
      setError('');
      return;
    }

    syncing.current = true;
    setState('saving');
    setError('');
    let failed = false;
    try {
      for (const submitted of queue) {
        await syncWorkoutDraft(submitted);
        const latest = readWorkoutDrafts(profile.id).find((item) => item.id === submitted.id);
        if (latest && JSON.stringify(latest) === JSON.stringify(submitted)) deleteWorkoutDraft(profile.id, submitted.id);
      }
      setSyncVersion((version) => version + 1);
    } catch (cause) {
      failed = true;
      console.error('Workout sync failed.', cause);
      setState(window.navigator.onLine ? 'error' : 'pending');
      setError(window.navigator.onLine
        ? 'Some workout entries are still saved on this device. Check your coach connection or retry sync.'
        : 'Workout saved on this device. It will sync when you are back online.');
    } finally {
      syncing.current = false;
    }

    if (!failed) {
      const remaining = readWorkoutDrafts(profile.id);
      setState(remaining.length === 0 ? 'saved' : 'pending');
      if (remaining.length === 0) setError('');
      else if (rerun.current) setError('');
    }
    if (rerun.current) {
      rerun.current = false;
      if (!failed) window.setTimeout(() => void retry(), 0);
    }
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) return;
    const online = () => {
      setOffline(false);
      setError('');
      if (syncTimer.current !== null) window.clearTimeout(syncTimer.current);
      void retry();
    };
    const offlineNow = () => {
      setOffline(true);
      if (syncTimer.current !== null) window.clearTimeout(syncTimer.current);
      if (readWorkoutDrafts(profile.id).length > 0) setState('pending');
    };
    const changed = (event: Event) => {
      if ((event as CustomEvent<{ athleteId: string }>).detail?.athleteId !== profile.id) return;
      const queue = readWorkoutDrafts(profile.id);
      if (queue.length > 0) setState('pending');
      if (window.navigator.onLine) {
        if (syncTimer.current !== null) window.clearTimeout(syncTimer.current);
        syncTimer.current = window.setTimeout(() => void retry(), 500);
      }
    };
    const storage = (event: StorageEvent) => {
      if (event.key?.startsWith(`topset:workout-drafts:v1:${profile.id}`)) changed(new CustomEvent('topset:workout-drafts-changed', { detail: { athleteId: profile.id } }));
    };
    window.addEventListener('online', online);
    window.addEventListener('offline', offlineNow);
    window.addEventListener('topset:workout-drafts-changed', changed);
    window.addEventListener('storage', storage);
    void retry();
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offlineNow);
      window.removeEventListener('topset:workout-drafts-changed', changed);
      window.removeEventListener('storage', storage);
      if (syncTimer.current !== null) window.clearTimeout(syncTimer.current);
    };
  }, [profile?.id, retry]);

  const value = useMemo(() => ({ state, offline, error, syncVersion, retry }), [state, offline, error, syncVersion, retry]);
  const pendingCount = profile?.id ? readWorkoutDrafts(profile.id).length : 0;
  const showPendingElsewhere = location.pathname !== '/athlete/program' && (state === 'error' || pendingCount > 0 && (offline || state === 'pending' || state === 'saving'));
  return <WorkoutSyncContext.Provider value={value}>
    {showPendingElsewhere && <div className="alert-banner alert-info athlete-global-sync" role="status"><span className="alert-mark">i</span><div>{error || (offline ? `${pendingCount} workout ${pendingCount === 1 ? 'entry is' : 'entries are'} saved on this device and waiting to sync.` : state === 'saving' ? 'Syncing your workout entries…' : `${pendingCount} workout ${pendingCount === 1 ? 'entry is' : 'entries are'} waiting to sync.`)}{pendingCount > 0 && state !== 'saving' && <button className="button button-quiet" onClick={() => void retry()}>Retry sync</button>}</div></div>}
    {children}
  </WorkoutSyncContext.Provider>;
}

export function useAthleteWorkoutSync() {
  const value = useContext(WorkoutSyncContext);
  if (!value) throw new Error('useAthleteWorkoutSync must be used inside AthleteWorkoutSyncProvider');
  return value;
}
