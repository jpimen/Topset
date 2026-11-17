import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { loadAthletePersonalPrograms, saveAthletePersonalProgram, type AthletePersonalProgram } from '../../lib/athlete/personalPrograms';
import { AthletePersonalProgramPanel } from './AthletePersonalProgramPanel';

export function AthleteMyProgramPage() {
  const { profile } = useAuth();
  const [programs, setPrograms] = useState<AthletePersonalProgram[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [creatingProgram, setCreatingProgram] = useState(false);
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
    void loadAthletePersonalPrograms(profile.id).then((value) => {
      if (!active) return;
      setPrograms(value);
      setSelectedProgramId(value[0]?.id ?? '');
    }).catch((cause: unknown) => {
      console.error('Athlete personal programs could not be loaded.', cause);
      if (active) setLoadError('Your private programs could not be loaded. Try again later.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [profile?.id]);

  const saveProgram = useCallback(async (nextProgram: AthletePersonalProgram) => {
    if (!profile?.id) throw new Error('Your account is not available.');
    const savedProgram = await saveAthletePersonalProgram(profile.id, nextProgram);
    setPrograms((current) => current.some((item) => item.id === savedProgram.id)
      ? current.map((item) => item.id === savedProgram.id ? savedProgram : item)
      : [...current, savedProgram]);
    setSelectedProgramId(savedProgram.id);
    setCreatingProgram(false);
  }, [profile?.id]);

  const selectedProgram = programs.find((item) => item.id === selectedProgramId) ?? programs[0] ?? null;
  const visibleProgram = creatingProgram ? null : selectedProgram;

  if (loading) return <main className="athlete-page"><div className="dashboard-skeleton" aria-label="Loading your programs" /></main>;

  return <main className="athlete-page">
    <header className="athlete-page-heading">
      <div><p className="eyebrow">PRIVATE PLANS</p><h1>My programs</h1><p>Create and manage your own private training plans. They stay separate from your linked coach's program.</p></div>
    </header>
    <section className="athlete-private-programs" aria-label="Private programs">
      <div className="athlete-private-programs-divider"><span>YOUR PRIVATE PROGRAMS</span></div>
      {programs.length > 0 && <div className="athlete-private-programs-controls">
        <label className="form-field" htmlFor="athlete-private-program-select">Choose a program<select id="athlete-private-program-select" value={selectedProgram?.id ?? ''} disabled={creatingProgram} onChange={(event) => { setSelectedProgramId(event.currentTarget.value); setCreatingProgram(false); }}>
          {programs.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label>
        <button className="button button-secondary" type="button" onClick={() => setCreatingProgram(true)}>+ New private program</button>
      </div>}
      <AthletePersonalProgramPanel program={visibleProgram} defaultUnit={profile?.unit ?? 'kg'} loadError={loadError} onSave={saveProgram} onCancel={() => setCreatingProgram(false)} />
    </section>
  </main>;
}
