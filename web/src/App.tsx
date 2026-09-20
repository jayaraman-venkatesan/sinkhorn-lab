import { useEffect, useReducer, useRef } from 'react';
import { scenarioRequest, solve, solveComparison } from './api/solve';
import type { Point, Scenario, SolverKind } from './contracts';
import { distanceCosts } from './scenario/costs';
import { ScenarioEditor } from './scenario/ScenarioEditor';
import { createEditorState, validateScenario } from './scenario/model';
import { scenarioReducer } from './scenario/reducer';

const sources: Point[] = [
  { id: 'warehouse-a', label: 'Warehouse A', x: 15, y: 25, amount: 40 },
  { id: 'warehouse-b', label: 'Warehouse B', x: 25, y: 75, amount: 60 },
];
const targets: Point[] = [
  { id: 'destination-a', label: 'Destination A', x: 75, y: 25, amount: 50 },
  { id: 'destination-b', label: 'Destination B', x: 85, y: 75, amount: 50 },
];
const initialScenario: Scenario = {
  id: 'grain-starter',
  sources,
  targets,
  costs: distanceCosts(sources, targets),
  costMode: 'Distance',
  regularization: 10,
  threshold: 1e-9,
  maxIterations: 1000,
};

export default function App() {
  const [state, dispatch] = useReducer(scenarioReducer, initialScenario, createEditorState);
  const activeController = useRef<AbortController | null>(null);
  const errors = validateScenario(state.scenario);

  useEffect(() => () => activeController.current?.abort(), []);

  function edit(scenario: Scenario) {
    activeController.current?.abort();
    activeController.current = null;
    dispatch({ type: 'Edit', scenario });
  }

  function cancel() {
    activeController.current?.abort();
    activeController.current = null;
    dispatch({ type: 'Cancel' });
  }

  async function run(choice: SolverKind | 'Compare') {
    if (validateScenario(state.scenario).length > 0) return;
    activeController.current?.abort();
    const controller = new AbortController();
    activeController.current = controller;
    const revision = state.revision;
    const requestId = crypto.randomUUID();
    dispatch({ type: 'RunStarted', requestId, revision });

    try {
      if (choice === 'Compare') {
        await solveComparison(state.scenario, requestId, controller.signal, (result, isLast) => {
          dispatch({ type: 'RunFinished', requestId, revision, result, isLast });
        });
      } else {
        const result = await solve(
          scenarioRequest(state.scenario, choice, requestId),
          controller.signal,
        );
        dispatch({ type: 'RunFinished', requestId, revision, result, isLast: true });
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        dispatch({
          type: 'RunFailed',
          requestId,
          revision,
          error: error instanceof Error ? error.message : 'The solve request failed.',
        });
      }
    } finally {
      if (activeController.current === controller) activeController.current = null;
    }
  }

  return (
    <ScenarioEditor
      state={state}
      errors={errors}
      onEdit={edit}
      onRun={(choice) => void run(choice)}
      onCancel={cancel}
    />
  );
}
