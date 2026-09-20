import { useEffect, useMemo, useRef, useState } from 'react';
import { scenarioRequest, solve } from '../api/solve';
import type { Scenario, SolveResponse } from '../contracts';
import { shipmentAt } from '../playback/shipment';
import { ordinaryScenario } from '../scenario/presets';
import { ComparisonView } from '../scenes/ComparisonView';
import { WarehouseScene, type RouteSelection } from '../scenes/WarehouseScene';

type Allocation = { source: number; target: number; amount: number };

const source = [40, 60];
const target = [50, 50];
const costs = [[1, 3], [2, 1]];
const sourceLabels = ['Warehouse A', 'Warehouse B'];
const targetLabels = ['Destination A', 'Destination B'];

type Fixture = {
  id: string;
  title: string;
  source: number[];
  target: number[];
  costs: number[][];
  regularization: number;
  threshold: number;
  maxIterations: number;
  expected: Record<string, { termination: string; attemptedPairs: number; acceptedPairs: number; transportCost: number; checks: { usable: boolean } }>;
};

const fixtureModules = import.meta.glob<Fixture>('../../../content/examples/*.json', { eager: true, import: 'default' });
const fixtures = new Map(Object.values(fixtureModules).map((fixture) => [fixture.id, fixture]));

function ManualAllocation() {
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [targetIndex, setTargetIndex] = useState(0);
  const [amount, setAmount] = useState(0);
  const [preview, setPreview] = useState<Allocation | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const plan = useMemo(() => {
    const matrix = [[0, 0], [0, 0]];
    for (const allocation of allocations) matrix[allocation.source]![allocation.target]! += allocation.amount;
    return matrix;
  }, [allocations]);
  const state = shipmentAt(source, target, costs, plan, 1);
  const limit = Math.min(state.sourceRemaining[sourceIndex]!, state.targetRemaining[targetIndex]!);
  const amountValid = Number.isFinite(amount) && amount > 0 && amount <= limit;

  useEffect(() => {
    const currentDialog = dialog.current;
    if (!preview || !currentDialog) return;
    currentDialog.showModal();
    return () => currentDialog.close();
  }, [preview]);

  return <section className="lesson-scene manual-allocation" aria-labelledby="manual-allocation-title">
    <p className="eyebrow">Interactive scene · confirmed allocations only</p>
    <h2 id="manual-allocation-title">Try the 40 / 60 kg plan</h2>
    <div className="allocation-status" aria-label="Manual allocation status">
      {sourceLabels.map((label, index) => <div key={label}><span>{label} remaining</span><strong aria-label={`${label} remaining`}>{state.sourceRemaining[index]} kg</strong></div>)}
      {targetLabels.map((label, index) => <div key={label}><span>{label} remaining</span><strong aria-label={`${label} remaining`}>{state.targetRemaining[index]} kg</strong></div>)}
      <div><span>Accumulated cost</span><strong>{state.cost}</strong></div>
    </div>
    <div className="allocation-controls">
      <label>From<select aria-label="Allocation source" value={sourceIndex} onChange={(event) => setSourceIndex(Number(event.currentTarget.value))}>
        {sourceLabels.map((label, index) => <option value={index} key={label}>{label}</option>)}
      </select></label>
      <label>To<select aria-label="Allocation destination" value={targetIndex} onChange={(event) => setTargetIndex(Number(event.currentTarget.value))}>
        {targetLabels.map((label, index) => <option value={index} key={label}>{label}</option>)}
      </select></label>
      <label>Amount (kg)<input type="number" min="0" max={limit} step="any" value={amount || ''} aria-label={`${sourceLabels[sourceIndex]} to ${targetLabels[targetIndex]} amount`} onChange={(event) => setAmount(event.currentTarget.valueAsNumber)} /></label>
      <button type="button" disabled={!amountValid} onClick={() => setPreview({ source: sourceIndex, target: targetIndex, amount })}>Preview allocation</button>
    </div>
    {!amountValid && amount > 0 && <p className="message error" role="alert">Enter at most {limit} kg: the smaller of remaining stock and demand.</p>}
    <div className="table-scroll">
      <table aria-label="Confirmed manual allocation plan">
        <thead><tr><th>From / to</th>{targetLabels.map((label) => <th key={label}>{label}</th>)}</tr></thead>
        <tbody>{sourceLabels.map((label, i) => <tr key={label}><th scope="row">{label}</th>{plan[i]!.map((value, j) => <td key={targetLabels[j]}>{value} kg</td>)}</tr>)}</tbody>
      </table>
    </div>
    {allocations.length === 0 ? <p className="muted">No allocations confirmed yet.</p> : <ol aria-label="Confirmed allocations">{allocations.map((allocation, index) => <li key={`${index}-${allocation.source}-${allocation.target}`}>{sourceLabels[allocation.source]} → {targetLabels[allocation.target]}: {allocation.amount} kg</li>)}</ol>}
    <div className="actions">
      <button className="quiet" type="button" disabled={allocations.length === 0} onClick={() => setAllocations((current) => current.slice(0, -1))}>Undo allocation</button>
      <button className="quiet" type="button" onClick={() => { setAllocations([]); setAmount(0); }}>Reset allocations</button>
    </div>
    {preview && <dialog ref={dialog} aria-labelledby="confirm-allocation-title" onCancel={() => setPreview(null)}>
      <h3 id="confirm-allocation-title">Confirm allocation</h3>
      <p>Commit {preview.amount} kg from {sourceLabels[preview.source]} to {targetLabels[preview.target]} at {costs[preview.source]![preview.target]} cost per kg?</p>
      <div className="actions"><button className="quiet" type="button" onClick={() => setPreview(null)}>Cancel preview</button><button type="button" onClick={() => { setAllocations((current) => [...current, preview]); setPreview(null); setAmount(0); }}>Confirm allocation</button></div>
    </dialog>}
  </section>;
}

function ProblemScene() {
  const [selection, setSelection] = useState<RouteSelection>(null);
  const emptyPlan = [[0, 0], [0, 0]];
  const startingState = shipmentAt(source, target, costs, emptyPlan, 1);
  return <section className="lesson-scene" aria-label="Starting warehouse quantities and fill levels">
    <p className="eyebrow">Interactive scene · the problem before a plan</p>
    <WarehouseScene scenario={{ ...ordinaryScenario, costs }} plan={emptyPlan} shipment={startingState} selection={selection} onSelect={setSelection} flowing={false} mode="Problem" />
  </section>;
}

const rectangularFixture = fixtures.get('rectangular');
if (!rectangularFixture) throw new Error('Missing shared rectangular lesson fixture.');
const guidedScenario: Scenario = {
  id: 'rectangular-guided',
  sources: rectangularFixture.source.map((amount, index) => ({ id: `source-${index}`, label: `Source ${String.fromCharCode(65 + index)}`, x: 15, y: 15 + index * 35, amount })),
  targets: rectangularFixture.target.map((amount, index) => ({ id: `target-${index}`, label: `Target ${String.fromCharCode(65 + index)}`, x: 85, y: 25 + index * 50, amount })),
  costs: rectangularFixture.costs.map((row) => [...row]),
  costMode: 'Custom',
  regularization: rectangularFixture.regularization,
  threshold: rectangularFixture.threshold,
  maxIterations: rectangularFixture.maxIterations,
};

function GuidedSolverScene() {
  const [result, setResult] = useState<SolveResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  async function run() {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setBusy(true);
    setError(null);
    try {
      setResult(await solve(scenarioRequest(guidedScenario, 'Basic', crypto.randomUUID()), controller.signal));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The guided solve failed.');
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      setBusy(false);
    }
  }

  return <section className="lesson-scene" aria-labelledby="guided-solver-title">
    <p className="eyebrow">Actual C# library scene · pinned rectangular inputs</p>
    <h2 id="guided-solver-title">Watch destination and source updates</h2>
    <p>Run explicitly, then use the existing solver controls to step through returned phase snapshots. These are tentative plans, not shipments.</p>
    <button type="button" disabled={busy} onClick={() => void run()}>{busy ? 'Running guided Basic solver…' : 'Run guided Basic solver'}</button>
    {error && <p className="message error" role="alert">{error}</p>}
    <ComparisonView scenario={guidedScenario} results={result ? { Basic: result } : {}} busy={busy} />
  </section>;
}

function FixtureSummary({ id }: { id: string }) {
  const fixture = fixtures.get(id);
  if (!fixture) return null;
  return <aside className="lesson-scene fixture-summary" aria-label={`${fixture.title} interactive summary`}>
    <p className="eyebrow">Shared verified example</p><h2>{fixture.title}</h2>
    <div className="table-scroll"><table><thead><tr><th>Solver</th><th>Stop</th><th>Pairs attempted / accepted</th><th>Cost</th><th>Usable</th></tr></thead><tbody>
      {Object.entries(fixture.expected).map(([solver, outcome]) => <tr key={solver}><th scope="row">{solver}</th><td>{outcome.termination}</td><td>{outcome.attemptedPairs} / {outcome.acceptedPairs}</td><td>{outcome.transportCost}</td><td>{outcome.checks.usable ? 'Yes' : 'No'}</td></tr>)}
    </tbody></table></div>
  </aside>;
}

const scenes: Record<string, () => React.ReactNode> = {
  'manual-allocation': () => <ManualAllocation />,
  balanced: () => <ProblemScene />,
  'solver-trace': () => <GuidedSolverScene />,
  rectangular: () => <FixtureSummary id="rectangular" />,
  'zero-support': () => <FixtureSummary id="zero-support" />,
  'tiny-regularization': () => <FixtureSummary id="tiny-regularization" />,
};

export function SceneRegistry({ ids }: { ids: string[] }) {
  return <>{[...new Set(ids)].map((id) => {
    const render = scenes[id];
    return render ? <div key={id}>{render()}</div> : null;
  })}</>;
}
