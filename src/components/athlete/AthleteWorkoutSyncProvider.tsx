import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { deleteWorkoutDraft, readWorkoutDrafts, syncWorkoutDraft } from '../../lib/athlete/logs';

export function AthleteWorkoutSyncProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(!navigator.onLine);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const athleteId = profile?.role === 'athlete' ? profile.id : undefined;
    if (!athleteId) return;
    let active = true;
    let syncing = false;
    let rerun = false;
    let timer: number | undefined;
    const readQueue = () => {
      const queue = readWorkoutDrafts(athleteId);
      if (active) setPendingCount(queue.length);
      return queue;
    };
    const retry = async () => {
      if (!active) return;
      if (syncing) { rerun = true; return; }
      syncing = true;
      setError('');
      try {
        const queue = readQueue();
        if (!navigator.onLine) { setOffline(true); return; }
        setSaving(queue.length > 0);
        for (const submitted of queue) {
          if (!active) return;
          await syncWorkoutDraft(submitted);
          if (!active) return;
          const latest = readQueue().find((item) => item.id === submitted.id);
          // A newer edit made during this request must remain queued.
          if (latest && JSON.stringify(latest) === JSON.stringify(submitted)) {
            deleteWorkoutDraft(athleteId, submitted.id);
          }
        }
        readQueue();
      } catch (cause) {
        console.error('Workout sync failed.', cause);
        if (active) {
          setError(cause instanceof Error && cause.message.startsWith('Pending workouts')
            ? cause.message
            : 'Some workout entries are still saved on this device. Check your connection or coach assignment, then retry sync.');
        }
        rerun = false;
      } finally {
        syncing = false;
        if (active) {
          setSaving(false);
          if (rerun) { rerun = false; timer = window.setTimeout(() => void retry(), 0); }
        }
      }
    };
    const changed = (event: Event) => {
      if ((event as CustomEvent<{ athleteId: string }>).detail?.athleteId !== athleteId) return;
      try { readQueue(); } catch (cause) { setError((cause as Error).message); return; }
      if (syncing) { rerun = true; return; }
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void retry(), 500);
    };
    const storage = (event: StorageEvent) => {
      if (event.key === null || event.key === `topset:workout-drafts:v1:${athleteId}`) {
        changed(new CustomEvent('topset:workout-drafts-changed', { detail: { athleteId } }));
      }
    };
    const connection = () => {
      setOffline(!navigator.onLine);
      if (navigator.onLine) void retry();
    };
    window.addEventListener('online', connection);
    window.addEventListener('offline', connection);
    window.addEventListener('storage', storage);
    window.addEventListener('topset:workout-drafts-changed', changed);
    void retry();
    return () => {
      active = false;
      window.clearTimeout(timer);
      window.removeEventListener('online', connection);
      window.removeEventListener('offline', connection);
      window.removeEventListener('storage', storage);
      window.removeEventListener('topset:workout-drafts-changed', changed);
    };
  }, [profile?.id, profile?.role, retryKey]);

  return <>
    {(error || pendingCount > 0) && <div className="alert-banner alert-info athlete-global-sync" role="status"><span className="alert-mark">i</span><div>
      {error || (saving ? 'Syncing your workout entries…' : `${pendingCount} workout ${pendingCount === 1 ? 'entry' : 'entries'} saved on this device${offline ? ' · offline' : ' · waiting to sync'}.`)}
      {!saving && <button className="button button-quiet" onClick={() => setRetryKey((value) => value + 1)}>Retry sync</button>}
    </div></div>}
    {children}
  </>;
}
