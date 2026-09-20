import { useState } from 'react';
import type { DiagnosticNumber, Point, Scenario, SolverKind } from '../contracts';
import { distanceCosts } from './costs';
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

function inputValue(value: number): number | '' {
  return Number.isFinite(value) ? value : '';
}

function showDiagnostic(value: DiagnosticNumber): string {
  return typeof value === 'number' ? value.toPrecision(6) : `not finite (${value.nonFinite})`;
}

function createPoint(collection: 'sources' | 'targets', index: number): Point {
  return {
    id: `${collection}-${crypto.randomUUID()}`,
    label: `${collection === 'sources' ? 'Warehouse' : 'Destination'} ${index + 1}`,
    x: collection === 'sources' ? 20 : 80,
    y: 20 + index * 15,
    amount: 0,
  };
}

function PointEditor({
  scenario,
  collection,
  onEdit,
}: {
  scenario: Scenario;
  collection: 'sources' | 'targets';
  onEdit: (scenario: Scenario) => void;
}) {
  const title = collection === 'sources' ? 'Sources' : 'Destinations';
  return (
    <fieldset className="panel point-panel">
      <legend>{title}</legend>
      {scenario[collection].map((point) => (
        <div className="point-row" key={point.id}>
          <label>
            Label
            <input
              aria-label={`${point.label} label`}
              value={point.label}
              onChange={(event) =>
                onEdit(updatePoint(scenario, collection, point.id, { label: event.currentTarget.value }))
              }
            />
          </label>
          {(['amount', 'x', 'y'] as const).map((field) => {
            const label = field === 'amount' ? 'quantity' : `${field.toUpperCase()} position`;
            return (
              <label key={field}>
                {label}
                <input
                  aria-label={`${point.label} ${label}`}
                  type="number"
                  min={field === 'amount' ? 0 : undefined}
                  step="any"
                  value={inputValue(point[field])}
                  onChange={(event) =>
                    onEdit(
                      updatePoint(scenario, collection, point.id, {
                        [field]: event.currentTarget.valueAsNumber,
                      }),
                    )
                  }
                />
              </label>
            );
          })}
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
          onEdit(addPoint(scenario, collection, createPoint(collection, scenario[collection].length)))
        }
      >
        Add {collection === 'sources' ? 'source' : 'destination'}
      </button>
    </fieldset>
  );
}

function ReplacementPreview({
  scenario,
  replacements,
  onCancel,
  onConfirm,
}: {
  scenario: Scenario;
  replacements: number[][];
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <section className="preview" role="dialog" aria-modal="true" aria-labelledby="preview-title">
      <h2 id="preview-title">Replace custom costs?</h2>
      <p>Review every custom value before replacing it with straight-line distance.</p>
      <div className="table-scroll">
        <table aria-label="Cost replacement preview">
          <thead>
            <tr><th>Route</th><th>Current custom cost</th><th>Distance replacement</th></tr>
          </thead>
          <tbody>
            {scenario.costs.flatMap((row, sourceIndex) =>
              row.map((current, targetIndex) => {
                const source = scenario.sources[sourceIndex];
                const target = scenario.targets[targetIndex];
                const replacement = replacements[sourceIndex]?.[targetIndex];
                if (!source || !target || replacement === undefined) return null;
                return (
                  <tr key={`${source.id}-${target.id}`}>
                    <th scope="row">{source.label} to {target.label}</th>
                    <td>{current}</td>
                    <td>{replacement}</td>
                  </tr>
                );
              }),
            )}
          </tbody>
        </table>
      </div>
      <div className="actions">
        <button type="button" className="quiet" onClick={onCancel}>Keep custom costs</button>
        <button type="button" onClick={onConfirm}>Replace costs</button>
      </div>
    </section>
  );
}

export function ScenarioEditor({ state, errors, onEdit, onRun, onCancel }: ScenarioEditorProps) {
  const { scenario } = state;
  const [replacements, setReplacements] = useState<number[][] | null>(null);
  const sourceTotal = scenario.sources.reduce((sum, point) => sum + point.amount, 0);
  const targetTotal = scenario.targets.reduce((sum, point) => sum + point.amount, 0);

  function selectCostMode(mode: Scenario['costMode']) {
    if (scenario.costMode === 'Custom' && mode === 'Distance') {
      setReplacements(distanceCosts(scenario.sources, scenario.targets));
      return;
    }
    if (mode !== scenario.costMode) onEdit(changeCostMode(scenario, mode, () => true));
  }

  return (
    <>
      <header className="hero">
        <p className="eyebrow">Interactive optimal transport</p>
        <h1>Sinkhorn Lab</h1>
        <p>
          Edit the same quantities and costs sent to the C# solver. Nothing is normalized,
          rounded, or silently rebalanced.
        </p>
      </header>

      <section className="totals" aria-label="Scenario totals">
        <div><span>Supply total:</span> <strong>{sourceTotal}</strong></div>
        <div><span>Demand total:</span> <strong>{targetTotal}</strong></div>
        <div><span>Difference:</span> <strong>{sourceTotal - targetTotal}</strong></div>
      </section>

      <form onSubmit={(event) => event.preventDefault()}>
        <div className="point-grid">
          <PointEditor scenario={scenario} collection="sources" onEdit={onEdit} />
          <PointEditor scenario={scenario} collection="targets" onEdit={onEdit} />
        </div>

        <fieldset className="panel">
          <legend>Cost table</legend>
          <label className="mode-control">
            Cost mode
            <select
              aria-label="Cost mode"
              value={scenario.costMode}
              onChange={(event) => selectCostMode(event.currentTarget.value as Scenario['costMode'])}
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
                const label = `Cost from ${source.label} to ${target.label}`;
                return (
                  <label key={`${source.id}-${target.id}`}>
                    {label}
                    <input
                      aria-label={label}
                      type="number"
                      step="any"
                      disabled={scenario.costMode === 'Distance'}
                      value={inputValue(cost)}
                      onChange={(event) =>
                        onEdit(updateCost(scenario, sourceIndex, targetIndex, event.currentTarget.valueAsNumber))
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
              aria-label="Regularization"
              type="number"
              min="0"
              step="any"
              value={inputValue(scenario.regularization)}
              onChange={(event) => onEdit({ ...scenario, regularization: event.currentTarget.valueAsNumber })}
            />
          </label>
          <label>
            Stopping threshold
            <input
              aria-label="Stopping threshold"
              type="number"
              min="0"
              step="any"
              value={inputValue(scenario.threshold)}
              onChange={(event) => onEdit({ ...scenario, threshold: event.currentTarget.valueAsNumber })}
            />
          </label>
          <label>
            Maximum update pairs
            <input
              aria-label="Maximum update pairs"
              type="number"
              min="1"
              max="1000"
              step="1"
              value={inputValue(scenario.maxIterations)}
              onChange={(event) => onEdit({ ...scenario, maxIterations: event.currentTarget.valueAsNumber })}
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
              key={choice}
              type="button"
              disabled={state.busy || errors.length > 0}
              onClick={() => onRun(choice)}
            >
              Run {choice === 'Compare' ? 'comparison' : choice}
            </button>
          ))}
          {state.busy && <button type="button" className="danger" onClick={onCancel}>Cancel</button>}
        </div>
      </form>

      {replacements && (
        <ReplacementPreview
          scenario={scenario}
          replacements={replacements}
          onCancel={() => setReplacements(null)}
          onConfirm={() => {
            onEdit(changeCostMode(scenario, 'Distance', () => true));
            setReplacements(null);
          }}
        />
      )}

      <section className="results" aria-live="polite" aria-busy={state.busy}>
        <h2>Solver results</h2>
        {state.busy && <p>Solving the current revision…</p>}
        {Object.values(state.results).map((result) => (
          <article className="result-card" aria-label={`${result.solver} result`} key={result.solver}>
            <p className="eyebrow">{result.referenceVersion} · {result.referenceCommit.slice(0, 8)}</p>
            <h3>{result.solver}</h3>
            <p>{result.termination}</p>
            <p>Usable plan: {result.checks.usable ? 'Yes' : 'No'}</p>
            <dl>
              <div><dt>Transport cost</dt><dd>{showDiagnostic(result.transportCost)}</dd></div>
              <div><dt>Accepted pairs</dt><dd>{result.acceptedPairs}</dd></div>
              <div><dt>Source residual</dt><dd>{showDiagnostic(result.checks.sourceL1)}</dd></div>
              <div><dt>Target residual</dt><dd>{showDiagnostic(result.checks.targetL1)}</dd></div>
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
    </>
  );
}
