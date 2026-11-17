import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { loadAthletePersonalProgram, saveAthletePersonalProgram, type AthletePersonalProgram } from '../../lib/athlete/personalPrograms';
import { AthletePersonalProgramPanel } from './AthletePersonalProgramPanel';
import { AthleteProgramSwitcher } from './AthleteProgramSwitcher';

export function AthleteMyProgramPage() {
  const { profile } = useAuth();
  const [program, setProgram] = useState<AthletePersonalProgram | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;
    if (!profile?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError('');
    void loadAthletePersonalProgram(profile.id).then((value) => {
      if (active) setProgram(value);
    }).catch((cause: unknown) => {
      console.error('Athlete personal program could not be loaded.', cause);
      if (active) setLoadError('Your private program could not be loaded. Try again later.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [profile?.id]);

  const saveProgram = useCallback(async (nextProgram: AthletePersonalProgram) => {
    if (!profile?.id) throw new Error('Your account is not available.');
    setProgram(await saveAthletePersonalProgram(profile.id, nextProgram));
  }, [profile?.id]);

  if (loading) return <main className="athlete-page"><div className="dashboard-skeleton" aria-label="Loading your program" /></main>;

  return <main className="athlete-page">
    <header className="athlete-page-heading">
      <div><p className="eyebrow">PRIVATE PLAN</p><h1>My program</h1><p>A training plan you manage for yourself. It stays separate from your linked coach’s program.</p></div>
    </header>
    <AthleteProgramSwitcher />
    <AthletePersonalProgramPanel program={program} defaultUnit={profile?.unit ?? 'kg'} loadError={loadError} onSave={saveProgram} />
  </main>;
}
