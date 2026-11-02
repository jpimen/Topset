import { useCallback, useEffect, useRef, useState } from 'react';
import { loadActiveAthleteProgram, type AthleteProgramLoad } from '../../lib/athlete/programs';

export function useAthleteProgram(athleteId: string | undefined, hasUnsavedEdits = false) {
  const [entry, setEntry] = useState<{ athleteId: string; value: AthleteProgramLoad } | null>(null);
  const loaded = entry && entry.athleteId === athleteId ? entry.value : null;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [refreshDeferred, setRefreshDeferred] = useState(false);
  const edits = useRef(hasUnsavedEdits);
  edits.current = hasUnsavedEdits;
  const refresh = useCallback(() => {
    if (edits.current) { setRefreshDeferred(true); return; }
    setReloadKey((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!hasUnsavedEdits && refreshDeferred) {
      setRefreshDeferred(false);
      setReloadKey((value) => value + 1);
    }
  }, [hasUnsavedEdits, refreshDeferred]);

  useEffect(() => {
    let active = true;
    if (!athleteId) { setEntry(null); setLoading(false); return; }
    setLoading(true);
    setError('');
    void loadActiveAthleteProgram(athleteId).then((value) => {
      if (!active) return;
      // An edit may have started while the request was in flight.
      if (edits.current) { setRefreshDeferred(true); return; }
      setEntry({ athleteId, value });
    }).catch((cause: unknown) => {
      console.error('Athlete program could not be loaded.', cause);
      if (!active) return;
      if (edits.current) { setRefreshDeferred(true); return; }
      setEntry(null);
      setError(cause instanceof Error ? cause.message : 'We could not load your assigned program. Check your connection and try again.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [athleteId, reloadKey]);

  useEffect(() => {
    if (!athleteId) return;
    const visible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('online', refresh);
    return () => {
      document.removeEventListener('visibilitychange', visible);
      window.removeEventListener('online', refresh);
    };
  }, [athleteId, refresh]);

  return {
    result: loaded?.state ?? null, loading: loading || Boolean(entry && entry.athleteId !== athleteId), error, refresh, refreshDeferred,
    offline: loaded?.source === 'offline', verifiedAt: loaded?.verifiedAt,
    warning: loaded?.warning ?? '',
  };
}
