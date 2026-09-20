import type { DiagnosticNumber, Scenario, SolveResponse } from '../contracts';

export function numberLabel(value: DiagnosticNumber): string {
  if (typeof value !== 'number') return `not finite (${value.nonFinite})`;
  if (value !== 0 && Math.abs(value) < 0.0001) return value.toExponential(4);
  return Number(value.toPrecision(7)).toString();
}

export function ResultSummary({ result, scenario }: { result: SolveResponse; scenario: Scenario }) {
  return (
    <>
      <p className="eyebrow">{result.referenceVersion} · {result.referenceCommit.slice(0, 8)}</p>
      <h3>{result.solver}</h3>
      <p className={`result-status ${result.checks.usable ? 'usable' : 'unusable'}`}>
        {result.termination === 'NumericalBreakdown' ? 'Numerical breakdown' : result.termination}
      </p>
      <p>Usable plan: {result.checks.usable ? 'Yes' : 'No'}</p>
      {!result.checks.usable && <p className="message warning">⚠ Infeasible or invalid plan: not a meaningful cost comparison. Shipment is unavailable.</p>}
      <dl>
        <div><dt>Transport cost</dt><dd>{numberLabel(result.transportCost)}</dd></div>
        <div><dt>Accepted pairs</dt><dd>{result.acceptedPairs}</dd></div>
        <div><dt>Attempted pairs</dt><dd>{result.attemptedPairs}</dd></div>
        <div><dt>Requested supply / demand</dt><dd>{numberLabel(result.inputTotals.source)} / {numberLabel(result.inputTotals.target)} kg</dd></div>
        <div><dt>Actual plan total</dt><dd>{numberLabel(result.checks.totalMass)} kg</dd></div>
        <div><dt>Source / target L1 residuals</dt><dd>{numberLabel(result.checks.sourceL1)} / {numberLabel(result.checks.targetL1)} kg</dd></div>
      </dl>
      <details className="final-plan"><summary>Inspect final returned plan</summary>
        <p>Fixed result from the library. Finite entries: {result.checks.finite ? 'Yes' : 'No'}; nonnegative entries: {result.checks.nonnegative ? 'Yes' : 'No'}. Last attempted index: {result.lastAttemptedIndex}.</p>
        <div className="table-scroll"><table aria-label="Final returned transport plan">
          <caption>Final returned quantities (kg) · independent of the selected trace phase</caption>
          <thead><tr><th scope="col">From / to</th>{scenario.targets.map((target) => <th scope="col" key={target.id}>{target.label}</th>)}</tr></thead>
          <tbody>{scenario.sources.map((source, i) => <tr key={source.id}><th scope="row">{source.label}</th>{result.plan[i]!.map((value, j) => <td key={scenario.targets[j]!.id} data-value={typeof value === 'number' ? value : value.nonFinite}>{numberLabel(value)}</td>)}</tr>)}</tbody>
        </table></div>
      </details>
      {result.warnings.length > 0 && <p className="message warning">⚠ Warnings: {result.warnings.join(', ')}</p>}
    </>
  );
}
