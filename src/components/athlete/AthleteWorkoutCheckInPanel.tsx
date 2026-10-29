import { useEffect, useState, type ChangeEvent } from 'react';
import { workoutCheckInDraftSchema, workoutCheckInSchema, loadWorkoutCheckIn, saveWorkoutCheckIn, type WorkoutCheckInDraft } from '../../lib/athlete/workoutCheckIns';

const sleepQualityOptions = [[1, '1 · Very poor'], [2, '2 · Poor'], [3, '3 · Okay'], [4, '4 · Good'], [5, '5 · Excellent']] as const;
const sleepHourOptions = Array.from({ length: 33 }, (_, index) => index / 2);

function emptyDraft(unit: 'kg' | 'lb'): WorkoutCheckInDraft {
  return { bodyweight: null, bodyweight_unit: unit, sleep_quality: null, sleep_hours: null, protein_grams: null, calories_kcal: null, carbs_grams: null, fatigue_level: null };
}

function numberValue(event: ChangeEvent<HTMLInputElement>) {
  return event.currentTarget.value === '' ? null : Number(event.currentTarget.value);
}

export function AthleteWorkoutCheckInPanel({ athleteId, assignmentId, dayId, dayName, defaultUnit }: {
  athleteId: string; assignmentId: string; dayId: string; dayName: string; defaultUnit: 'kg' | 'lb';
}) {
  const [draft, setDraft] = useState(() => emptyDraft(defaultUnit));
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadFailed(false);
    setError('');
    setStatus('');
    void loadWorkoutCheckIn(athleteId, assignmentId, dayId).then((value) => {
      if (active) setDraft(value ? workoutCheckInDraftSchema.parse(value) : emptyDraft(defaultUnit));
    }).catch((cause: unknown) => {
      console.error('Athlete workout check-in could not be loaded.', cause);
      if (active) { setLoadFailed(true); setError('We could not load this check-in. Try again before saving so existing entries are not overwritten.'); }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [athleteId, assignmentId, dayId, defaultUnit, retryKey]);

  const update = <Key extends keyof WorkoutCheckInDraft>(key: Key, value: WorkoutCheckInDraft[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setError('');
    setStatus('Unsaved changes');
  };
  const hasValues = Object.values(draft).some((value) => value !== null && value !== draft.bodyweight_unit);

  const save = async () => {
    const parsed = workoutCheckInSchema.safeParse({ ...draft, athlete_id: athleteId, assignment_id: assignmentId, day_id: dayId });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Check the values and try again.'); return; }
    setSaving(true); setError(''); setStatus('Saving…');
    try {
      const saved = await saveWorkoutCheckIn(parsed.data);
      setDraft(saved);
      setStatus('Saved to your account');
    } catch (cause) {
      console.error('Athlete workout check-in could not be saved.', cause);
      setError('We could not save this check-in. Your entries are still on this screen; try again.');
      setStatus('Not saved');
    } finally { setSaving(false); }
  };
  const setNumber = (key: 'bodyweight' | 'protein_grams' | 'calories_kcal' | 'carbs_grams') => (event: ChangeEvent<HTMLInputElement>) => update(key, numberValue(event));

  return (
    <aside className="coach-panel athlete-checkin-panel" aria-labelledby={`athlete-checkin-title-${dayId}`}>
      <header className="athlete-checkin-heading">
        <p className="eyebrow">ATHLETE CHECK-IN · {dayName.toUpperCase()}</p>
        <h3 id={`athlete-checkin-title-${dayId}`}>{dayName} check-in</h3>
        <p>Private to you. Record what you want to track for this training day.</p>
      </header>
      {loading ? <div className="dashboard-skeleton athlete-checkin-skeleton" aria-label="Loading training day check-in" /> : <>
        {error && <div className="athlete-checkin-error" role="alert"><p>{error}</p>{loadFailed && <button className="button button-secondary" type="button" onClick={() => setRetryKey((current) => current + 1)}>Try loading again</button>}</div>}
        <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <fieldset className="athlete-checkin-fields" disabled={loading || loadFailed || saving}>
            <table className="athlete-checkin-table">
              <caption className="visually-hidden">{dayName} health and recovery check-in</caption>
              <thead><tr><th scope="col">Metric</th><th scope="col">Entry</th></tr></thead>
              <tbody>
                <tr><th scope="row"><label htmlFor={`checkin-bodyweight-${dayId}`}>Bodyweight</label></th><td><div className="athlete-checkin-weight"><input id={`checkin-bodyweight-${dayId}`} type="number" min="0.1" max="500" step="0.1" value={draft.bodyweight ?? ''} onChange={setNumber('bodyweight')} placeholder="—" /><select aria-label="Bodyweight unit" value={draft.bodyweight_unit} onChange={(event) => update('bodyweight_unit', event.currentTarget.value as 'kg' | 'lb')}><option value="kg">kg</option><option value="lb">lb</option></select></div></td></tr>
                <tr><th scope="row"><label htmlFor={`checkin-sleep-quality-${dayId}`}>Sleep quality</label></th><td><select id={`checkin-sleep-quality-${dayId}`} value={draft.sleep_quality ?? ''} onChange={(event) => update('sleep_quality', event.currentTarget.value ? Number(event.currentTarget.value) : null)}><option value="">Choose rating</option>{sleepQualityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td></tr>
                <tr><th scope="row"><label htmlFor={`checkin-sleep-hours-${dayId}`}>Sleep hours</label></th><td><select id={`checkin-sleep-hours-${dayId}`} value={draft.sleep_hours ?? ''} onChange={(event) => update('sleep_hours', event.currentTarget.value ? Number(event.currentTarget.value) : null)}><option value="">Choose hours</option>{sleepHourOptions.map((value) => <option key={value} value={value}>{value} {value === 1 ? 'hour' : 'hours'}</option>)}</select></td></tr>
                <tr><th scope="row"><label htmlFor={`checkin-protein-${dayId}`}>Protein</label></th><td><div className="athlete-checkin-quantity"><input id={`checkin-protein-${dayId}`} type="number" min="0" max="1000" step="1" value={draft.protein_grams ?? ''} onChange={setNumber('protein_grams')} placeholder="—" /><span>g</span></div></td></tr>
                <tr><th scope="row"><label htmlFor={`checkin-calories-${dayId}`}>Calories</label></th><td><div className="athlete-checkin-quantity"><input id={`checkin-calories-${dayId}`} type="number" min="0" max="20000" step="1" value={draft.calories_kcal ?? ''} onChange={setNumber('calories_kcal')} placeholder="—" /><span>kcal</span></div></td></tr>
                <tr><th scope="row"><label htmlFor={`checkin-carbs-${dayId}`}>Carbohydrates</label></th><td><div className="athlete-checkin-quantity"><input id={`checkin-carbs-${dayId}`} type="number" min="0" max="2000" step="1" value={draft.carbs_grams ?? ''} onChange={setNumber('carbs_grams')} placeholder="—" /><span>g</span></div></td></tr>
                <tr><th scope="row"><label htmlFor={`checkin-fatigue-${dayId}`}>Fatigue</label></th><td><select id={`checkin-fatigue-${dayId}`} value={draft.fatigue_level ?? ''} onChange={(event) => update('fatigue_level', event.currentTarget.value ? Number(event.currentTarget.value) : null)}><option value="">Choose rating</option>{Array.from({ length: 10 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value} · {value === 1 ? 'Very fresh' : value === 10 ? 'Very fatigued' : 'Fatigue level'}</option>)}</select></td></tr>
              </tbody>
            </table>
          </fieldset>
          <div className="athlete-checkin-actions"><span className="checkin-status" role="status">{status}</span><button className="button button-primary" type="submit" disabled={!hasValues || saving || loading || loadFailed}>{saving ? 'Saving…' : 'Save check-in'}</button></div>
        </form>
      </>}
    </aside>
  );
}
