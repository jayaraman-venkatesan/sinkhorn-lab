import { useEffect, useReducer, useRef, useState } from 'react';
import { scenarioRequest, solve } from '../api/solve';
import type { Scenario, SolveResponse } from '../contracts';
import { shipmentAt } from '../playback/shipment';
import { ordinaryScenario } from '../scenario/presets';
import { ComparisonView } from '../scenes/ComparisonView';
import { WarehouseScene, type RouteSelection } from '../scenes/WarehouseScene';
import {
  initialManualAllocationState,
  manualAllocationLimit,
  manualAllocationReducer,
  manualAllocationView,
  manualCosts,
  manualDemand,
  manualSupply,
} from './manualAllocation';

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
  const [allocationState, dispatch] = useReducer(manualAllocationReducer, initialManualAllocationState);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [targetIndex, setTargetIndex] = useState(0);
  const [amount, setAmount] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const { plan, accounting } = manualAllocationView(allocationState);
  const limit = manualAllocationLimit(allocationState, sourceIndex, targetIndex);
  const amountValid = Number.isFinite(amount) && amount > 0 && amount <= limit;
  const inputError = amount > 0 && !amountValid
    ? `Enter at most ${limit} kg: the smaller of remaining stock and demand.`
    : null;

  useEffect(() => {
    const currentDialog = dialog.current;
    if (!allocationState.preview || !currentDialog) return;
    currentDialog.showModal();
    return () => currentDialog.close();
  }, [allocationState.preview]);

  return <section className="lesson-scene manual-allocation" aria-labelledby="manual-allocation-title">
    <p className="eyebrow">Interactive scene · confirmed allocations only</p>
    <h2 id="manual-allocation-title">Try the 40 / 60 kg plan</h2>
    <div className="allocation-status" aria-label="Manual allocation status">
      {sourceLabels.map((label, index) => <div key={label}><span>{label} remaining</span><strong aria-label={`${label} remaining`}>{accounting.sourceRemaining[index]} kg</strong></div>)}
      {targetLabels.map((label, index) => <div key={label}><span>{label} remaining</span><strong aria-label={`${label} remaining`}>{accounting.targetRemaining[index]} kg</strong></div>)}
      {targetLabels.map((label, index) => <div key={`${label}-received`}><span>{label} received</span><strong aria-label={`${label} received`}>{accounting.targetReceived[index]} kg</strong></div>)}
      <div><span>Accumulated cost</span><strong>{accounting.cost}</strong></div>
    </div>
    <div className="allocation-controls">
      <label>From<select aria-label="Allocation source" value={sourceIndex} onChange={(event) => setSourceIndex(Number(event.currentTarget.value))}>
        {sourceLabels.map((label, index) => <option value={index} key={label}>{label}</option>)}
      </select></label>
      <label>To<select aria-label="Allocation destination" value={targetIndex} onChange={(event) => setTargetIndex(Number(event.currentTarget.value))}>
        {targetLabels.map((label, index) => <option value={index} key={label}>{label}</option>)}
      </select></label>
      <label>Amount (kg)<input type="number" min="0" max={limit} step="any" value={amount || ''} aria-label={`${sourceLabels[sourceIndex]} to ${targetLabels[targetIndex]} amount`} onChange={(event) => setAmount(event.currentTarget.valueAsNumber)} /></label>
      <button type="button" disabled={!amountValid} onClick={() => dispatch({ type: 'Preview', allocation: { source: sourceIndex, target: targetIndex, amount } })}>Preview allocation</button>
    </div>
    {(inputError ?? allocationState.error) && <p className="message error" role="alert">{inputError ?? allocationState.error}</p>}
    <div className="table-scroll">
      <table aria-label="Confirmed manual allocation plan">
        <thead><tr><th>From / to</th>{targetLabels.map((label) => <th key={label}>{label}</th>)}</tr></thead>
        <tbody>{sourceLabels.map((label, i) => <tr key={label}><th scope="row">{label}</th>{plan[i]!.map((value, j) => <td key={targetLabels[j]}>{value} kg</td>)}</tr>)}</tbody>
      </table>
    </div>
    {allocationState.confirmed.length === 0 ? <p className="muted">No allocations confirmed yet.</p> : <ol aria-label="Confirmed allocations">{allocationState.confirmed.map((allocation, index) => <li key={`${index}-${allocation.source}-${allocation.target}`}>{sourceLabels[allocation.source]} → {targetLabels[allocation.target]}: {allocation.amount} kg</li>)}</ol>}
    <div className="actions">
      <button className="quiet" type="button" disabled={allocationState.confirmed.length === 0} onClick={() => dispatch({ type: 'Undo' })}>Undo allocation</button>
      <button className="quiet" type="button" onClick={() => { dispatch({ type: 'Reset' }); setAmount(0); }}>Reset allocations</button>
    </div>
    {allocationState.preview && <dialog ref={dialog} aria-labelledby="confirm-allocation-title" onCancel={() => dispatch({ type: 'CancelPreview' })}>
      <h3 id="confirm-allocation-title">Confirm allocation</h3>
      <p>Commit {allocationState.preview.amount} kg from {sourceLabels[allocationState.preview.source]} to {targetLabels[allocationState.preview.target]} at {manualCosts[allocationState.preview.source]![allocationState.preview.target]} cost per kg?</p>
      <div className="actions"><button className="quiet" type="button" onClick={() => dispatch({ type: 'CancelPreview' })}>Cancel preview</button><button type="button" onClick={() => { dispatch({ type: 'Confirm' }); setAmount(0); }}>Confirm allocation</button></div>
    </dialog>}
  </section>;
}

function ProblemScene() {
  const [selection, setSelection] = useState<RouteSelection>(null);
  const emptyPlan = [[0, 0], [0, 0]];
  const startingState = shipmentAt(manualSupply, manualDemand, manualCosts, emptyPlan, 1);
  return <section className="lesson-scene" aria-label="Starting warehouse quantities and fill levels">
    <p className="eyebrow">Interactive scene · the problem before a plan</p>
    <WarehouseScene scenario={{ ...ordinaryScenario, costs: manualCosts }} plan={emptyPlan} shipment={startingState} selection={selection} onSelect={setSelection} flowing={false} mode="Problem" />
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
