import type { SolveResponse, TraceFrame } from '../contracts';
import { describeTraceFrame } from '../playback/trace';
import { numberLabel } from './ResultSummary';

export function SolverTrace({ result, index }: { result: SolveResponse; index: number }) {
  const frame: TraceFrame | undefined = result.trace.frames[index];
  const presentation = frame ? describeTraceFrame(result.trace.frames, index) : null;
  const finiteErrors = result.errors.filter((error): error is { index: number; targetL2: number } => typeof error.targetL2 === 'number');
  const largest = Math.max(0, ...finiteErrors.map((error) => error.targetL2)) || 1;
  const lastIndex = Math.max(1, ...result.errors.map((error) => error.index));
  return <div className="solver-trace">
    <div className="phase-caption" aria-label="Current solver phase">
      {presentation ? <>
        <strong>{presentation.iterationLabel} · {presentation.phaseLabel}</strong>
        <span>{presentation.statusLabel}</span>
        {presentation.gapBefore && <span className="gap-notice">↪ {presentation.gapBefore}; step controls visit retained evidence only.</span>}
      </> : <span>No trace frames were returned. The final plan is shown.</span>}
    </div>
    <p className="trace-notice">{result.trace.sampled ? 'Sampled trace:' : 'Complete retained trace:'} {result.trace.frames.length} retained of {result.trace.observedCount} observed; {result.trace.omittedCount} omitted. {result.trace.policy}</p>
    <p className="muted">Tentative solver states, not shipments. A retained frame is an observed update phase, not an extra mathematical iteration.</p>
    {frame && <div className="table-scroll"><table aria-label="Solver coordinates">
      <caption>{frame.isLog ? 'Log-scaling' : 'Scaling'} coordinates · {frame.solver}</caption>
      <thead><tr><th scope="col">Coordinate</th><th scope="col">Sources</th><th scope="col">Destinations</th></tr></thead>
      <tbody><tr><th scope="row">{frame.isLog ? 'Log-scaling' : 'Scaling'}</th><td>{frame.sourceScaling.map(numberLabel).join(', ')}</td><td>{frame.targetScaling.map(numberLabel).join(', ')}</td></tr></tbody>
    </table></div>}
    <figure className="error-figure">
      <figcaption>Target L2 residual · recorded checkpoints only</figcaption>
      <svg className="error-chart" viewBox="0 0 640 160" role="img" aria-label="Target L2 residual at reported iteration indices">
        <path d="M45 12V130H620" fill="none" stroke="currentColor" />
        <text x="8" y="18">{numberLabel(largest)}</text><text x="25" y="132">0</text>
        {finiteErrors.map((error) => <circle key={error.index} data-iteration={error.index} cx={45 + error.index / lastIndex * 565} cy={130 - error.targetL2 / largest * 112} r="3"><title>Iteration {error.index}: {numberLabel(error.targetL2)}</title></circle>)}
        <text x="45" y="152">0</text><text x="565" y="152">{lastIndex}</text>
      </svg>
      <p className="muted">Horizontal: actual iteration index. Vertical: absolute target L2 error (kg). Nonfinite checks remain in the table; they are not plotted as zero.</p>
    </figure>
    <details><summary>Inspect all reported errors ({result.errors.length})</summary><div className="table-scroll error-table"><table aria-label="Reported target L2 errors">
      <caption>Library stopping checks · no invented intermediate values</caption>
      <thead><tr><th scope="col">Iteration index</th><th scope="col">Target L2 (kg)</th></tr></thead>
      <tbody>{result.errors.map((error) => <tr key={error.index}><th scope="row">{error.index}</th><td>{numberLabel(error.targetL2)}</td></tr>)}</tbody>
    </table></div></details>
  </div>;
}
