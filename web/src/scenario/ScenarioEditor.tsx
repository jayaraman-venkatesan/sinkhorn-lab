import { useEffect, useRef, useState } from 'react';
import type { Point, Scenario, SolverKind } from '../contracts';
import { ComparisonView } from '../scenes/ComparisonView';
import { ScenarioMap } from './ScenarioMap';
import { ordinaryScenario, tinyRegularizationScenario, zeroSupportScenario } from './presets';
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
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="preview"
      aria-labelledby="preview-title"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
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
        <button type="button" className="quiet" autoFocus onClick={onCancel}>Keep custom costs</button>
        <button type="button" onClick={onConfirm}>Replace costs</button>
      </div>
    </dialog>
  );
}

export function ScenarioEditor({ state, errors, onEdit, onRun, onCancel }: ScenarioEditorProps) {
  const { scenario } = state;
  const [replacements, setReplacements] = useState<number[][] | null>(null);
  const [solver, setSolver] = useState<RunChoice>('Basic');
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
        <ScenarioMap scenario={scenario} onEdit={onEdit} />
        <div className="actions">
          <button type="button" className="quiet" onClick={() => onEdit(ordinaryScenario)}>Ordinary success preset</button>
          <button type="button" className="quiet" onClick={() => onEdit(zeroSupportScenario)}>Zero support preset</button>
          <button type="button" className="quiet" onClick={() => onEdit(tinyRegularizationScenario)}>Tiny regularization preset</button>
        </div>
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
          <label>Solver<select aria-label="Solver" value={solver} onChange={(event) => setSolver(event.currentTarget.value as RunChoice)}>
            <option>Basic</option><option>LogDomain</option><option>Compare</option>
          </select></label>
          <button type="button" disabled={state.busy || errors.length > 0} onClick={() => onRun(solver)}>Run</button>
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
            onEdit({
              ...scenario,
              costMode: 'Distance',
              costs: replacements.map((row) => [...row]),
            });
            setReplacements(null);
          }}
        />
      )}

      <ComparisonView scenario={scenario} results={state.results} busy={state.busy} />
    </>
  );
}
