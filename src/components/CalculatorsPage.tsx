import { useState } from 'react';
import { LB_PER_KG, calculatePlates, calculateScores, estimateE1rm, generateWarmups, loadFromE1rm, type E1rmFormula, type Sex, type Unit } from '../lib/engine';

function NumberField({ label, value, onChange, min = 0, step = 'any' }: { label: string; value: string; onChange: (value: string) => void; min?: number; step?: string }) {
  return <label className="calc-field"><span>{label}</span><input aria-label={label} type="number" min={min} step={step} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
function Card({ title, children }: { title: string; children: React.ReactNode }) { return <section className="calc-card"><h2>{title}</h2>{children}</section>; }
function useCalculation<T>(calculate: () => T): { value?: T; error?: string } {
  try { return { value: calculate() }; } catch (error) { return { error: error instanceof Error ? error.message : 'Check the entered values.' }; }
}
function toKg(value: number, unit: Unit): number { return unit === 'kg' ? value : value / LB_PER_KG; }
function fromKg(value: number, unit: Unit): number { return unit === 'kg' ? value : value * LB_PER_KG; }
function ResultLine({ children }: { children: React.ReactNode }) { return <p className="calc-result">{children}</p>; }
function ErrorLine({ error }: { error?: string }) { return error ? <p className="calc-error" role="status">{error}</p> : null; }

export function CalculatorsPage() {
  const [unit, setUnit] = useState<Unit>('kg');
  const [weight, setWeight] = useState('140'); const [reps, setReps] = useState('5'); const [formula, setFormula] = useState<E1rmFormula>('epley');
  const [e1rm, setE1rm] = useState('180'); const [rpeReps, setRpeReps] = useState('3'); const [rpe, setRpe] = useState('8');
  const [target, setTarget] = useState('142.5'); const [bar, setBar] = useState('20');
  const [topSet, setTopSet] = useState('140');
  const [total, setTotal] = useState('600'); const [bodyweight, setBodyweight] = useState('83'); const [sex, setSex] = useState<Sex>('male');
  function changeUnit(next: Unit) {
    if (next === unit) return;
    const convert = (value: string) => value.trim() ? String(Number((next === 'lb' ? Number(value) * LB_PER_KG : Number(value) / LB_PER_KG).toFixed(1))) : value;
    setWeight(convert(weight)); setE1rm(convert(e1rm)); setTarget(convert(target)); setBar(convert(bar)); setTopSet(convert(topSet)); setTotal(convert(total)); setBodyweight(convert(bodyweight)); setUnit(next);
  }
  const e1 = useCalculation(() => estimateE1rm(toKg(Number(weight), unit), Number(reps), formula));
  const rpeResult = useCalculation(() => loadFromE1rm(toKg(Number(e1rm), unit), Number(rpeReps), Number(rpe), unit));
  const plateResult = useCalculation(() => calculatePlates({ target: Number(target), bar: Number(bar), unit }));
  const warmups = useCalculation(() => generateWarmups(Number(topSet), unit));
  const scores = useCalculation(() => calculateScores(toKg(Number(total), unit), toKg(Number(bodyweight), unit), sex));
  return <main className="calculators-page">
    <header className="calc-header"><a href={`/${location.pathname.split('/')[1]}`} className="calc-brand">topset<span>.</span></a><div><p className="eyebrow">TRAINING TOOLS</p><h1>Calculators</h1><p>Quick estimates for the platform and the weight room.</p></div><label className="calc-field unit-toggle"><span>Display unit</span><select value={unit} onChange={(event) => changeUnit(event.target.value as Unit)}><option value="kg">Kilograms (kg)</option><option value="lb">Pounds (lb)</option></select></label></header>
    <div className="calc-grid">
      <Card title="Estimated one-rep max"><div className="calc-inputs"><NumberField label={`Lift weight (${unit})`} value={weight} onChange={setWeight} min={0.01}/><NumberField label="Repetitions" value={reps} onChange={setReps} min={1} step="1"/><label className="calc-field"><span>Formula</span><select value={formula} onChange={(event) => setFormula(event.target.value as E1rmFormula)}><option value="epley">Epley</option><option value="brzycki">Brzycki</option></select></label></div><ErrorLine error={e1.error}/>{e1.value && <ResultLine>{fromKg(e1.value.e1rmKg, unit).toFixed(1)} {unit} {e1.value.lowConfidence && <small>Low confidence above 10 reps</small>}</ResultLine>}</Card>
      <Card title="RPE load"><div className="calc-inputs"><NumberField label={`e1RM (${unit})`} value={e1rm} onChange={setE1rm} min={0.01}/><NumberField label="Repetitions" value={rpeReps} onChange={setRpeReps} min={1} step="1"/><NumberField label="RPE (5–10)" value={rpe} onChange={setRpe} min={5} step="0.5"/></div><ErrorLine error={rpeResult.error}/>{rpeResult.value && <ResultLine>{(rpeResult.value.percent * 100).toFixed(1)}% 1RM · {rpeResult.value.load.toFixed(1)} {unit}</ResultLine>}</Card>
      <Card title="Plate calculator"><div className="calc-inputs"><NumberField label={`Target load (${unit})`} value={target} onChange={setTarget} min={0}/><NumberField label={`Bar (${unit})`} value={bar} onChange={setBar} min={0.01}/></div><ErrorLine error={plateResult.error}/>{plateResult.value && <><ResultLine>{plateResult.value.platesPerSide.length ? plateResult.value.platesPerSide.map((plate, index) => <span className="plate-chip" key={`${plate}-${index}`}>{plate} {unit}</span>) : <span>Bar only</span>}</ResultLine><p className="calc-help">Achieved: {plateResult.value.achievedLoad.toFixed(2)} {unit}{!plateResult.value.reachable && ` · Difference: ${plateResult.value.difference.toFixed(2)} ${unit}`}</p></>}</Card>
      <Card title="Warm-up sets"><NumberField label={`Top set (${unit})`} value={topSet} onChange={setTopSet} min={0.01}/><ErrorLine error={warmups.error}/>{warmups.value && <div className="warmup-list">{warmups.value.length ? warmups.value.map((set, index) => <ResultLine key={index}>{set.load.toFixed(1)} {unit} × {set.reps} reps</ResultLine>) : <p className="calc-help">Top set is too light for the default bar-based warm-up steps.</p>}</div>}</Card>
      <Card title="Strength scores"><div className="calc-inputs"><NumberField label={`Total (${unit})`} value={total} onChange={setTotal} min={0.01}/><NumberField label={`Bodyweight (${unit})`} value={bodyweight} onChange={setBodyweight} min={0.01}/><label className="calc-field"><span>Coefficient set</span><select value={sex} onChange={(event) => setSex(event.target.value as Sex)}><option value="male">Men</option><option value="female">Women</option></select></label></div><ErrorLine error={scores.error}/>{scores.value && <div className="score-results"><ResultLine>DOTS <strong>{scores.value.dots.toFixed(2)}</strong></ResultLine><ResultLine>Wilks <strong>{scores.value.wilks.toFixed(2)}</strong></ResultLine><ResultLine>IPF GL <strong>{scores.value.ipfGl.toFixed(2)}</strong></ResultLine></div>}</Card>
    </div><p className="calc-disclaimer">Estimates only. Calculators are guidance, not guarantees.</p>
  </main>;
}
