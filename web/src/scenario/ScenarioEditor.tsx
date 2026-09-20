import type { DiagnosticNumber, Point, Scenario, SolverKind } from '../contracts';
import type { EditorState } from './model';
import {
  addPoint,
  changeCostMode,
  removePoint,
  updateCost,
  updatePoint,
} from './model';

type RunChoice = SolverKind | 'Compare';

type ScenarioEditorProps = {
  state: EditorState;
  errors: string[];
  onEdit: (scenario: Scenario) => void;
  onRun: (choice: RunChoice) => void;
  onCancel: () => void;
};

function numericValue(value: number): number | '' {
  return Number.isFinite(value) ? value : '';
}

function diagnostic(value: DiagnosticNumber): string {
  return typeof value === 'number' ? value.toPrecision(6) : `not finite (${value.nonFinite})`;
}

function nextPoint(collection: 'sources' | 'targets', index: number): Point {
  const noun = collection === 'sources' ? 'Warehouse' : 'Destination';
  return {
    id: `${collection}-${crypto.randomUUID()}`,
    label: `${noun} ${index + 1}`,
    x: 20 + index * 12,
    y: collection === 'sources' ? 25 : 75,
    amount: 0,
  };
}

export function ScenarioEditor({ state, errors, onEdit, onRun, onCancel }: ScenarioEditorProps) {
  const { scenario } = state;
  const sourceTotal = scenario.sources.reduce((sum, point) => sum + point.amount, 0);
  const targetTotal = scenario.targets.reduce((sum, point) => sum + point.amount, 0);

  const pointEditor = (collection: 'sources' | 'targets', title: string) => (
    <fieldset className="panel point-panel">
      <legend>{title}</legend>
      {scenario[collection].map((point) => (
        <div className="point-row" key={point.id}>
          <label>
            Label
            <input
              type="text"
              value={point.label}
              onChange={(event) =>
                onEdit(updatePoint(scenario, collection, point.id, { label: event.currentTarget.value }))
              }
            />
          </label>
          {(['amount', 'x', 'y'] as const).map((field) => (
            <label key={field}>
              {field === 'amount' ? 'Quantity' : `${field.toUpperCase()} position`}
              <input
                type="number"
                min={field === 'amount' ? 0 : undefined}
                step="any"
                value={numericValue(point[field])}
                onChange={(event) =>
                  onEdit(
                    updatePoint(scenario, collection, point.id, {
                      [field]: event.currentTarget.valueAsNumber,
                    }),
                  )
                }
              />
            </label>
          ))}
          <button
            className="quiet danger"
            type="button"
            disabled={scenario[collection].length <= 1}
            onClick={() => onEdit(removePoint(scenario, collection, point.id))}
          >
            Remove {point.label}
          </button>
        </div>
      ))}
      <button
        className="quiet"
        type="button"
        disabled={scenario[collection].length >= 8}
        onClick={() =>
          onEdit(addPoint(scenario, collection, nextPoint(collection, scenario[collection].length)))
        }
      >
        Add {collection === 'sources' ? 'source' : 'destination'}
      </button>
    </fieldset>
  );

  return (
    <main>
      <header className="hero">
        <p className="eyebrow">Interactive optimal transport</p>
        <h1>Sinkhorn Lab</h1>
        <p>
          Edit the same quantities and costs sent to the C# solver. Nothing is normalized,
          rounded, or silently rebalanced.
        </p>
      </header>

      <section className="totals" aria-label="Scenario totals">
        <div><span>Supply</span><strong>{sourceTotal}</strong></div>
        <div><span>Demand</span><strong>{targetTotal}</strong></div>
        <div><span>Difference</span><strong>{sourceTotal - targetTotal}</strong></div>
      </section>

      <form onSubmit={(event) => event.preventDefault()}>
        <div className="point-grid">
          {pointEditor('sources', 'Sources')}
          {pointEditor('targets', 'Destinations')}
        </div>

        <fieldset className="panel">
          <legend>Cost table</legend>
          <label className="mode-control">
            Cost mode
            <select
              value={scenario.costMode}
              onChange={(event) => {
                const mode = event.currentTarget.value as Scenario['costMode'];
                const changed = changeCostMode(
                  scenario,
                  mode,
                  () => window.confirm('Replace every custom cost with straight-line distance?'),
                );
                if (changed !== scenario) onEdit(changed);
              }}
            >
              <option value="Distance">Straight-line distance (map units)</option>
              <option value="Custom">Custom costs</option>
            </select>
          </label>
          <div className="cost-table" role="group" aria-label="Costs by route">
            {scenario.costs.flatMap((row, sourceIndex) =>
              row.map((cost, targetIndex) => {
                const source = scenario.sources[sourceIndex];
                const target = scenario.targets[targetIndex];
                if (!source || !target) return null;
                return (
                  <label key={`${source.id}-${target.id}`}>
                    Cost from {source.label} to {target.label}
                    <input
                      type="number"
                      step="any"
                      disabled={scenario.costMode === 'Distance'}
                      value={numericValue(cost)}
                      onChange={(event) =>
                        onEdit(
                          updateCost(
                            scenario,
                            sourceIndex,
                            targetIndex,
                            event.currentTarget.valueAsNumber,
                          ),
                        )
                      }
                    />
                  </label>
                );
              }),
            )}
          </div>
        </fieldset>

        <fieldset className="panel settings">
          <legend>Solver settings</legend>
          <label>
            Regularization
            <input
              type="number"
              min="0"
              step="any"
              value={numericValue(scenario.regularization)}
              onChange={(event) =>
                onEdit({ ...scenario, regularization: event.currentTarget.valueAsNumber })
              }
            />
          </label>
          <label>
            Stopping threshold
            <input
              type="number"
              min="0"
              step="any"
              value={numericValue(scenario.threshold)}
              onChange={(event) =>
                onEdit({ ...scenario, threshold: event.currentTarget.valueAsNumber })
              }
            />
          </label>
          <label>
            Maximum update pairs
            <input
              type="number"
              min="1"
              max="1000"
              step="1"
              value={numericValue(scenario.maxIterations)}
              onChange={(event) =>
                onEdit({ ...scenario, maxIterations: event.currentTarget.valueAsNumber })
              }
            />
          </label>
        </fieldset>

        {errors.length > 0 && (
          <div className="message error" role="alert">
            <strong>Fix these inputs before running:</strong>
            <ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul>
          </div>
        )}
        {state.stale && (
          <p className="message warning" role="status">
            Inputs changed. The previous result is stale and was cleared.
          </p>
        )}
        {state.transportError && (
          <p className="message error" role="alert">Transport error: {state.transportError}</p>
        )}

        <div className="actions">
          {(['Basic', 'LogDomain', 'Compare'] as const).map((choice) => (
            <button
              type="button"
              key={choice}
              disabled={state.busy || errors.length > 0}
              onClick={() => onRun(choice)}
            >
              Run {choice === 'Compare' ? 'comparison' : choice}
            </button>
          ))}
          {state.busy && <button type="button" className="danger" onClick={onCancel}>Cancel</button>}
        </div>
      </form>

      <section className="results" aria-live="polite" aria-busy={state.busy}>
        <h2>Solver results</h2>
        {state.busy && <p>Solving the current revision…</p>}
        {Object.values(state.results).map((result) => (
          <article className="result-card" key={result.solver}>
            <div>
              <p className="eyebrow">{result.referenceVersion} · {result.referenceCommit.slice(0, 8)}</p>
              <h3>{result.solver}</h3>
            </div>
            <dl>
              <div><dt>Termination</dt><dd>{result.termination}</dd></div>
              <div><dt>Usable plan</dt><dd>{result.checks.usable ? 'Yes' : 'No'}</dd></div>
              <div><dt>Transport cost</dt><dd>{diagnostic(result.transportCost)}</dd></div>
              <div><dt>Accepted pairs</dt><dd>{result.acceptedPairs}</dd></div>
              <div><dt>Source residual</dt><dd>{diagnostic(result.checks.sourceL1)}</dd></div>
              <div><dt>Target residual</dt><dd>{diagnostic(result.checks.targetL1)}</dd></div>
            </dl>
            <p>
              Trace: {result.trace.frames.length} retained of {result.trace.observedCount} observed
              {result.trace.sampled ? ` (${result.trace.omittedCount} omitted)` : ''}.
            </p>
            {result.warnings.length > 0 && <p>Warnings: {result.warnings.join(', ')}</p>}
            <p className="muted">Shipment playback is not enabled in this editor.</p>
          </article>
        ))}
        {!state.busy && Object.keys(state.results).length === 0 && (
          <p className="muted">Run a solver explicitly to inspect its numerical result.</p>
        )}
      </section>
    </main>
  );
}
