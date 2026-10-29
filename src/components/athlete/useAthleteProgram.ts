import { useCallback, useEffect, useState } from 'react';
import { loadActiveAthleteProgram, type AthleteProgramState } from '../../lib/athlete/programs';

export function useAthleteProgram(athleteId: string | undefined) {
  const [result, setResult] = useState<AthleteProgramState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const refresh = useCallback(() => setReloadKey((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    if (!athleteId) { setLoading(false); return; }
    setLoading(true);
    setError('');
    void loadActiveAthleteProgram(athleteId).then((value) => {
      if (active) setResult(value);
    }).catch((cause: unknown) => {
      console.error('Athlete program could not be loaded.', cause);
      if (active) setError('We could not load your assigned program. Check your connection and try again.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [athleteId, reloadKey]);

  useEffect(() => {
    if (!athleteId) return;
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') setReloadKey((value) => value + 1);
    };
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [athleteId]);

  return { result, loading, error, refresh };
}
