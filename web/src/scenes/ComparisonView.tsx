import { useEffect, useId, useReducer, useState } from 'react';
import type { Scenario, SolveResponse, SolverKind } from '../contracts';
import { createPlaybackState, playbackReducer } from '../playback/clock';
import { shipmentAt } from '../playback/shipment';
import { describeTraceFrame } from '../playback/trace';
import { PlanMatrix } from './PlanMatrix';
import { numberLabel, ResultSummary } from './ResultSummary';
import { PlaybackControls } from './PlaybackControls';
import { WarehouseScene, type RouteSelection } from './WarehouseScene';
import { SolverTrace } from './SolverTrace';
import './scenes.css';

function ResultPanel({ scenario, result }: { scenario: Scenario; result: SolveResponse }) {
  const panelId = useId();
  const [state, dispatch] = useReducer(playbackReducer, undefined, () => createPlaybackState(10000));
  const [selection, select] = useState<RouteSelection>(null);
  const [solverPlaying, setSolverPlaying] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [announcement, announce] = useState(`${result.solver} result ready: ${result.termination}.`);
  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => {
      setReducedMotion(preference.matches);
      if (preference.matches) {
        dispatch({ type: 'Pause', elapsedMs: performance.now() });
        setSolverPlaying(false);
        announce('Reduced motion enabled. Playback paused; use static steps.');
      }
    };
    preference.addEventListener('change', change);
    return () => preference.removeEventListener('change', change);
  }, []);
  const advancingSolver = solverPlaying && state.mode === 'Solver' && state.retainedFrameIndex < result.trace.frames.length - 1;
  useEffect(() => {
    if (!advancingSolver) return;
    const timer = setTimeout(() => dispatch({ type: 'SelectTraceFrame', frames: result.trace.frames, index: state.retainedFrameIndex + 1, elapsedMs: performance.now() }), 600 / state.speed);
    return () => clearTimeout(timer);
  }, [advancingSolver, result.trace.frames, state.retainedFrameIndex, state.speed]);
  useEffect(() => {
    if (!state.playing) return;
    let frameId: number;
    const tick = () => {
      dispatch({ type: 'Tick', elapsedMs: performance.now() });
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [state.playing]);
  const shipment = state.mode === 'Shipment' && result.checks.usable
    ? shipmentAt(scenario.sources.map((point) => point.amount), scenario.targets.map((point) => point.amount), scenario.costs, result.plan as number[][], state.progress)
    : null;
  const i = scenario.sources.findIndex((point) => point.id === selection?.sourceId);
  const j = scenario.targets.findIndex((point) => point.id === selection?.targetId);
  const plan = state.mode === 'Solver' ? result.trace.frames[state.retainedFrameIndex]?.plan ?? result.plan : result.plan;
  const selectedAmount = plan[i]?.[j];
  return <article className="result-card" aria-label={`${result.solver} result`}>
    <ResultSummary result={result} scenario={scenario} />
    <PlaybackControls state={state} result={result} reducedMotion={reducedMotion} panelId={panelId} onSolverReplay={() => {
      dispatch({ type: 'SelectTraceFrame', frames: result.trace.frames, index: 0, elapsedMs: performance.now() });
      setSolverPlaying(true);
      announce('Solver replay started from the first retained frame.');
    }} dispatch={(action) => {
      if (action.type !== 'SetSpeed') setSolverPlaying(false);
      dispatch(action);
      announce(action.type === 'ScrubShipment' ? `Shipment ${Math.round(action.progress * 100)}%.` : `${action.type === 'ShowSolver' ? 'Solver view' : action.type === 'ShowShipment' ? 'Shipment view' : action.type === 'Pause' ? 'Playback paused' : action.type === 'SetSpeed' ? `Speed ${action.speed} times` : 'Shipment playback started'}.`);
    }} solverPlaying={advancingSolver} onSolverPlay={(playing) => { setSolverPlaying(playing); announce(playing ? 'Solver playback started.' : 'Solver playback paused.'); }} onFrame={(index) => {
      setSolverPlaying(false);
      dispatch({ type: 'SelectTraceFrame', frames: result.trace.frames, index, elapsedMs: performance.now() });
      const frame = describeTraceFrame(result.trace.frames, index);
      announce(`${frame.iterationLabel}. ${frame.phaseLabel}. ${frame.statusLabel}.`);
    }} />
    <p className="sr-only" role="status" aria-label="Playback announcement">{state.mode === 'Shipment' && state.progress === 1 ? 'Shipment complete. Final residuals remain visible.' : solverPlaying && !advancingSolver && state.mode === 'Solver' ? 'Last retained solver phase reached.' : announcement}</p>
    <div role="tabpanel" id={panelId} aria-labelledby={`${panelId}-${state.mode}`}>
    <WarehouseScene scenario={scenario} plan={plan} shipment={shipment} selection={selection} onSelect={select} flowing={state.playing} />
    {shipment && <div className="running-cost"><span>Accumulated transport cost</span><strong aria-label="Accumulated transport cost" data-value={shipment.cost}>{numberLabel(shipment.cost)}</strong><small>Σ delivered kg × route cost. Display rounding only; residuals are preserved.</small></div>}
    <p className="selection-detail" aria-label="Selected route">{selection && selectedAmount !== undefined
      ? <>{scenario.sources[i]!.label} → {scenario.targets[j]!.label} · {numberLabel(selectedAmount)} kg assigned · cost contribution {typeof selectedAmount === 'number' ? numberLabel(selectedAmount * scenario.costs[i]![j]!) : 'not finite'}</>
      : 'Focus or hover a ribbon or matrix cell to inspect its route.'}</p>
    <PlanMatrix scenario={scenario} plan={plan} selection={selection} onSelect={select} />
    {state.mode === 'Solver' && <SolverTrace result={result} index={state.retainedFrameIndex} />}
    </div>
  </article>;
}

export function ComparisonView({ scenario, results, busy }: {
  scenario: Scenario; results: Partial<Record<SolverKind, SolveResponse>>; busy: boolean;
}) {
  return <section className="results" aria-label="Solver results" aria-busy={busy}>
    <h2>Follow the grain</h2>
    {Object.keys(results).length > 1 && <p>Same weights, costs, regularization, threshold, and budget. Independent solver states and playback; no cost winner is inferred.</p>}
    {busy && <p role="status">Solving the current revision…</p>}
    <div className="comparison-panels">{Object.values(results).map((result) => (
      <ResultPanel scenario={scenario} result={result} key={result.requestId + result.solver} />
    ))}</div>
    {!busy && Object.keys(results).length === 0 && <p className="muted">Run a solver explicitly to inspect its numerical result.</p>}
  </section>;
}
