import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { CALCULATOR_IDS, CALCULATOR_LABELS, DEFAULT_CALCULATOR_VISIBILITY, readCalculatorVisibility, storeCalculatorVisibility, type CalculatorId, type CalculatorVisibility } from '../lib/calculatorPreferences';
import { DEFAULT_COLLAR_KG_PER_SIDE, LB_PER_KG, calculateMinusPercentage, calculatePlates, calculateScores, estimateE1rm, generateWarmupPlan, loadFromE1rm, type E1rmFormula, type Sex, type Unit, type WarmupMethod } from '../lib/engine';

function NumberField({ label, value, onChange, min = 0, step = 'any', allowNegative = false }: { label: string; value: string; onChange: (value: string) => void; min?: number; step?: string; allowNegative?: boolean }) {
  return <label className="calc-field"><span>{label}</span><input aria-label={label} type="number" {...(!allowNegative ? { min } : {})} step={step} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
function Card({ title, children }: { title: string; children: React.ReactNode }) { return <section className="calc-card"><h2>{title}</h2>{children}</section>; }
function useCalculation<T>(calculate: () => T): { value?: T; error?: string } {
  try { return { value: calculate() }; } catch (error) { return { error: error instanceof Error ? error.message : 'Check the entered values.' }; }
}
function toKg(value: number, unit: Unit): number { return unit === 'kg' ? value : value / LB_PER_KG; }
function fromKg(value: number, unit: Unit): number { return unit === 'kg' ? value : value * LB_PER_KG; }
function formatLoad(value: number): string { return value.toLocaleString('en-US', { maximumFractionDigits: 3 }); }
function formatCalculatorValue(value: number): string { return value.toLocaleString('en-US', { maximumFractionDigits: 6 }); }
function ResultLine({ children }: { children: React.ReactNode }) { return <p className="calc-result">{children}</p>; }
function ErrorLine({ error }: { error?: string }) { return error ? <p className="calc-error" role="status">{error}</p> : null; }

function PlateLoadingDiagram({ plates, unit, withCollar }: { plates: number[]; unit: Unit; withCollar: boolean }) {
  const visiblePlateLimit = 8;
  const visiblePlates = plates.slice(0, visiblePlateLimit);
  const hiddenPlateCount = plates.length - visiblePlates.length;
  const plateHeight = (plate: number) => {
    const kilograms = toKg(plate, unit);
    return kilograms >= 7.5 ? 176 : kilograms >= 3.75 ? 142 : kilograms >= 1.75 ? 112 : 88;
  };
  const plateWidth = (plate: number) => {
    const kilograms = toKg(plate, unit);
    return kilograms >= 22.5 ? 24 : kilograms >= 17.5 ? 21 : kilograms >= 12.5 ? 18 : kilograms >= 7.5 ? 13 : kilograms >= 3.75 ? 11 : 9;
  };
  const plateColor = (plate: number) => {
    const kilograms = toKg(plate, unit);
    if (kilograms >= 22.5) return 'red';
    if (kilograms >= 17.5) return 'blue';
    if (kilograms >= 12.5) return 'yellow';
    if (kilograms >= 7.5) return 'green';
    if (kilograms >= 3.75) return 'white';
    return 'black';
  };
  const plateCounts = plates.reduce((counts, plate) => counts.set(plate, (counts.get(plate) ?? 0) + 1), new Map<number, number>());
  const listedPlates = [...plateCounts].map(([plate, count]) => ({ plate, count }));
  const naturalStackWidth = visiblePlates.reduce((sum, plate) => sum + plateWidth(plate), 0);
  const plateScale = naturalStackWidth > 104 ? 104 / naturalStackWidth : 1;
  const stackWidth = naturalStackWidth * plateScale;
  const stackStart = 68;

  return <div className="plate-loadout">
    <p className="plate-loadout-title">Put these plates on each side</p>
    <svg className="plate-diagram" viewBox="0 0 296 192" role="img" aria-label={`One-sided barbell loading diagram. ${listedPlates.length ? listedPlates.map(({ plate, count }) => `${count} ${plate} ${unit} ${count === 1 ? 'plate' : 'plates'}`).join(', ') + ' per side; repeat this stack on the other side.' : 'No plates per side.'} ${withCollar ? 'Collars included on both sides.' : 'No collars.'}`}>
      <rect className="plate-diagram-shaft" x="0" y="91" width="56" height="10" />
      <rect className="plate-diagram-shoulder" x="56" y="81" width="12" height="30" />
      <rect className="plate-diagram-sleeve" x="68" y="87" width="174" height="18" rx="4" />
      {visiblePlates.map((plate, index) => {
        const width = plateWidth(plate) * plateScale;
        const height = plateHeight(plate);
        const x = stackStart + visiblePlates.slice(0, index).reduce((sum, previous) => sum + plateWidth(previous) * plateScale, 0);
        return <rect key={`${plate}-${index}`} className={`plate-diagram-plate plate-diagram-plate-${plateColor(plate)}`} x={x} y={(192 - height) / 2} width={Math.max(width - 0.8, 6)} height={height} rx="1" />;
      })}
      {hiddenPlateCount > 0 && <text className="plate-diagram-more" x={Math.min(stackStart + stackWidth + 28, 262)} y="140" textAnchor="start">+{hiddenPlateCount}</text>}
      {withCollar && <g className="plate-diagram-collar-detail">
        <rect className="plate-diagram-collar-base" x={stackStart + stackWidth + 6} y="60" width="10" height="66" rx="2" />
        <rect className="plate-diagram-collar-pressure" x={stackStart + stackWidth + 9} y="75" width="14" height="34" rx="3" />
        <rect className="plate-diagram-collar" x={stackStart + stackWidth + 22} y="68" width="13" height="44" rx="1" />
        <rect className="plate-diagram-collar-screw" x={stackStart + stackWidth + 24} y="62" width="7" height="8" rx="1" />
        <rect className="plate-diagram-collar-lever" x={stackStart + stackWidth + 34} y="65" width="21" height="4" rx="1" />
      </g>}
    </svg>
    <div className="plate-loadout-list" aria-hidden="true">
      {listedPlates.length ? listedPlates.map(({ plate, count }) => <span key={plate} className={`plate-loadout-item plate-loadout-item-${plateColor(plate)}`}><strong>{plate}</strong><span>{unit}{count > 1 ? ` × ${count}` : ''}</span></span>) : <span className="plate-loadout-empty">Bar only</span>}
    </div>
    <p className="plate-loadout-caption">Per side · largest plates closest to the middle</p>
  </div>;
}

export function CalculatorsPage() {
  const { profile } = useAuth();
  const userId = profile?.id ?? '';
  const [visibility, setVisibility] = useState<CalculatorVisibility>(() => userId ? readCalculatorVisibility(userId) : { ...DEFAULT_CALCULATOR_VISIBILITY });
  const [organizerOpen, setOrganizerOpen] = useState(false);
  useEffect(() => {
    if (userId) storeCalculatorVisibility(userId, visibility);
  }, [userId, visibility]);
  function setCalculatorVisible(id: CalculatorId, visible: boolean) { setVisibility((current) => ({ ...current, [id]: visible })); }
  function showAllCalculators() {
    setVisibility(Object.fromEntries(CALCULATOR_IDS.map((id) => [id, true])) as CalculatorVisibility);
  }
  const [unit, setUnit] = useState<Unit>('kg');
  const [weight, setWeight] = useState('140'); const [reps, setReps] = useState('5'); const [formula, setFormula] = useState<E1rmFormula>('epley');
  const [e1rm, setE1rm] = useState('180'); const [rpeReps, setRpeReps] = useState('3'); const [rpe, setRpe] = useState('8');
  const [target, setTarget] = useState('142.5'); const [bar, setBar] = useState('20');
  const [withCollar, setWithCollar] = useState(false);
  const [topSet, setTopSet] = useState('140');
  const [warmupBar, setWarmupBar] = useState('20'); const [smallestChange, setSmallestChange] = useState('1.25'); const [warmupMethod, setWarmupMethod] = useState<WarmupMethod>('standard');
  const [total, setTotal] = useState('600'); const [bodyweight, setBodyweight] = useState('83'); const [sex, setSex] = useState<Sex>('male');
  const [percentage, setPercentage] = useState('-12'); const [baseNumber, setBaseNumber] = useState('160');
  function changeUnit(next: Unit) {
    if (next === unit) return;
    const convert = (value: string) => value.trim() ? String(Number((next === 'lb' ? Number(value) * LB_PER_KG : Number(value) / LB_PER_KG).toFixed(1))) : value;
    const previousBarDefault = unit === 'kg' ? '20' : '45';
    const previousIncrementDefault = unit === 'kg' ? '1.25' : '2.5';
    setWeight(convert(weight)); setE1rm(convert(e1rm)); setTarget(convert(target)); setBar(convert(bar)); setTopSet(convert(topSet));
    setWarmupBar(warmupBar === previousBarDefault ? (next === 'kg' ? '20' : '45') : convert(warmupBar));
    setSmallestChange(smallestChange === previousIncrementDefault ? (next === 'kg' ? '1.25' : '2.5') : convert(smallestChange));
    setTotal(convert(total)); setBodyweight(convert(bodyweight)); setUnit(next);
  }
  const e1 = useCalculation(() => estimateE1rm(toKg(Number(weight), unit), Number(reps), formula));
  const rpeResult = useCalculation(() => loadFromE1rm(toKg(Number(e1rm), unit), Number(rpeReps), Number(rpe), unit));
  const plateResult = useCalculation(() => calculatePlates({ target: Number(target), bar: Number(bar), unit, collarPerSide: withCollar ? fromKg(DEFAULT_COLLAR_KG_PER_SIDE, unit) : 0 }));
  const warmups = useCalculation(() => generateWarmupPlan(Number(topSet), unit, { method: warmupMethod, barWeight: Number(warmupBar), increment: Number(smallestChange) }));
  const scores = useCalculation(() => calculateScores(toKg(Number(total), unit), toKg(Number(bodyweight), unit), sex));
  const minusPercentage = useCalculation(() => {
    if (!percentage.trim() || !baseNumber.trim()) throw new RangeError('Enter a percentage and base number.');
    return calculateMinusPercentage(Number(baseNumber), Number(percentage));
  });
  return <main className="calculators-page">
    <header className="calc-header"><a href={`/${location.pathname.split('/')[1]}`} className="calc-brand" aria-label="Topset home"><span className="calc-brand-mark" aria-hidden="true">T</span><span className="calc-brand-word">TOPSET<span>.</span></span></a><div><p className="eyebrow">TRAINING TOOLS</p><h1>Calculators</h1><p>Quick estimates for the platform and the weight room.</p></div><label className="calc-field unit-toggle"><span>Display unit</span><select value={unit} onChange={(event) => changeUnit(event.target.value as Unit)}><option value="kg">Kilograms (kg)</option><option value="lb">Pounds (lb)</option></select></label></header>
    <section className="calc-organizer" aria-label="Calculator choices">
      <div className="calc-organizer-heading">
        <p>{CALCULATOR_IDS.filter((id) => visibility[id]).length} of {CALCULATOR_IDS.length} calculators selected</p>
        <button type="button" className="calc-organizer-trigger" aria-expanded={organizerOpen} aria-controls="calculator-organizer-panel" onClick={() => setOrganizerOpen((open) => !open)}>{organizerOpen ? 'Done' : 'Choose calculators'}</button>
      </div>
      {organizerOpen && <div className="calc-organizer-panel" id="calculator-organizer-panel">
        <p className="calc-organizer-hint">Choose which calculators to show.</p>
        <fieldset className="calc-choice-fieldset">
          <legend>Choose calculators to show</legend>
          <ol className="calc-choice-list">{CALCULATOR_IDS.map((id) => <li className={visibility[id] ? 'selected' : ''} key={id}>
            <label className="calc-choice-option">
              <input type="checkbox" aria-label={`Show ${CALCULATOR_LABELS[id]}`} checked={visibility[id]} onChange={(event) => setCalculatorVisible(id, event.target.checked)} />
              <span>{CALCULATOR_LABELS[id]}</span>
            </label>
          </li>)}</ol>
        </fieldset>
        <button type="button" className="calc-restore-button" onClick={showAllCalculators} disabled={CALCULATOR_IDS.every((id) => visibility[id])}>Show all calculators</button>
      </div>}
    </section>
    <div className="calc-grid">
      {CALCULATOR_IDS.every((id) => !visibility[id]) && <p className="calc-empty-state">Choose calculators above to show them here.</p>}
      {visibility['estimated-one-rep-max'] && <Card title="Estimated one-rep max"><div className="calc-inputs"><NumberField label={`Lift weight (${unit})`} value={weight} onChange={setWeight} min={0.01}/><NumberField label="Repetitions" value={reps} onChange={setReps} min={1} step="1"/><label className="calc-field"><span>Formula</span><select value={formula} onChange={(event) => setFormula(event.target.value as E1rmFormula)}><option value="epley">Epley</option><option value="brzycki">Brzycki</option></select></label></div><ErrorLine error={e1.error}/>{e1.value && <ResultLine>{fromKg(e1.value.e1rmKg, unit).toFixed(1)} {unit} {e1.value.lowConfidence && <small>Low confidence above 10 reps</small>}</ResultLine>}</Card>}
      {visibility['rpe-load'] && <Card title="RPE load"><div className="calc-inputs"><NumberField label={`e1RM (${unit})`} value={e1rm} onChange={setE1rm} min={0.01}/><NumberField label="Repetitions" value={rpeReps} onChange={setRpeReps} min={1} step="1"/><NumberField label="RPE (5–10)" value={rpe} onChange={setRpe} min={5} step="0.5"/></div><ErrorLine error={rpeResult.error}/>{rpeResult.value && <ResultLine>{(rpeResult.value.percent * 100).toFixed(1)}% 1RM · {rpeResult.value.load.toFixed(1)} {unit}</ResultLine>}</Card>}
      {visibility['plate-calculator'] && <Card title="Plate calculator"><div className="calc-inputs"><NumberField label={`Target load (${unit})`} value={target} onChange={setTarget} min={0}/><NumberField label={`Bar (${unit})`} value={bar} onChange={setBar} min={0.01}/><fieldset className="calc-field plate-collar-field"><legend>Collars</legend><div className="plate-collar-toggle" role="group" aria-label="Collar setting"><button type="button" aria-pressed={!withCollar} onClick={() => setWithCollar(false)}>No collar</button><button type="button" aria-pressed={withCollar} onClick={() => setWithCollar(true)}>With collar</button></div></fieldset></div><ErrorLine error={plateResult.error}/>{plateResult.value && <><PlateLoadingDiagram plates={plateResult.value.platesPerSide} unit={unit} withCollar={withCollar}/><p className="calc-help">Achieved: {plateResult.value.achievedLoad.toFixed(2)} {unit}{!plateResult.value.reachable && ` · Difference: ${plateResult.value.difference.toFixed(2)} ${unit}`}</p>{plateResult.value.difference < 0 && <p className="calc-help">Target is below the bar weight; remove the bar before loading.</p>}</>}</Card>}
      {visibility['warm-up-sets'] && <Card title="Warm-up sets">
        <div className="calc-inputs warmup-inputs">
          <NumberField label={`Top set (${unit})`} value={topSet} onChange={setTopSet} min={0.01}/>
          <NumberField label={`Barbell (${unit})`} value={warmupBar} onChange={setWarmupBar} min={0.01}/>
          <NumberField label={`Smallest change (${unit})`} value={smallestChange} onChange={setSmallestChange} min={0.01}/>
          <label className="calc-field"><span>Warm-up method</span><select value={warmupMethod} onChange={(event) => setWarmupMethod(event.target.value as WarmupMethod)}><option value="standard">Standard 4-step percentage ramp</option><option value="even-jumps">Even jumps method</option></select></label>
        </div>
        <ErrorLine error={warmups.error}/>
        {warmups.value && <div className="warmup-list">
          {warmups.value.length ? <>
            <div className="warmup-table-wrap"><table className="warmup-table"><caption className="visually-hidden">Warm-up sets calculated from the selected top set and loading increment</caption><thead><tr><th scope="col">Step</th><th scope="col">Target load</th><th scope="col">Reps</th><th scope="col">% of top set</th></tr></thead><tbody>{warmups.value.map((set, index) => <tr key={`${set.load}-${set.reps}`}><th scope="row"><span className="warmup-step-number">{index + 1}</span></th><td className="warmup-load">{formatLoad(set.load)} <span>{unit}</span></td><td>{set.reps}</td><td>{(set.load / Number(topSet) * 100).toFixed(1)}%</td></tr>)}</tbody></table></div>
            {warmupMethod === 'even-jumps' && warmups.value.some((set) => Math.abs(set.load - Number(topSet)) < 0.000001) && <p className="calc-help warmup-method-note">Step 4 reaches your top-set load. Use that single as your top set instead of repeating it.</p>}
            <p className="calc-help warmup-rounding-note">Loads are rounded to the nearest {formatLoad(Number(smallestChange))} {unit} increment.</p>
          </> : <p className="calc-help">No warm-up loads fall below the top set with these settings.</p>}
        </div>}
      </Card>}
      {visibility['strength-scores'] && <Card title="Strength scores"><div className="calc-inputs"><NumberField label={`Total (${unit})`} value={total} onChange={setTotal} min={0.01}/><NumberField label={`Bodyweight (${unit})`} value={bodyweight} onChange={setBodyweight} min={0.01}/><label className="calc-field"><span>Coefficient set</span><select value={sex} onChange={(event) => setSex(event.target.value as Sex)}><option value="male">Men</option><option value="female">Women</option></select></label></div><ErrorLine error={scores.error}/>{scores.value && <div className="score-results"><ResultLine>DOTS <strong>{scores.value.dots.toFixed(2)}</strong></ResultLine><ResultLine>Wilks <strong>{scores.value.wilks.toFixed(2)}</strong></ResultLine><ResultLine>IPF GL <strong>{scores.value.ipfGl.toFixed(2)}</strong></ResultLine></div>}</Card>}
      {visibility['minus-percentage'] && <Card title="Minus percentage"><div className="calc-inputs minus-percentage-inputs"><NumberField label="Percentage (%)" value={percentage} onChange={setPercentage} allowNegative/><NumberField label="Base number" value={baseNumber} onChange={setBaseNumber} allowNegative/></div><ErrorLine error={minusPercentage.error}/>{minusPercentage.value && <div className="score-results"><ResultLine>Percentage amount <strong>{formatCalculatorValue(minusPercentage.value.percentageAmount)}</strong></ResultLine><ResultLine>Adjusted result <strong>{formatCalculatorValue(minusPercentage.value.adjustedResult)}</strong></ResultLine></div>}</Card>}
    </div>
    <p className="calc-disclaimer">Estimates only. Calculators are guidance, not guarantees.</p>
  </main>;
}
