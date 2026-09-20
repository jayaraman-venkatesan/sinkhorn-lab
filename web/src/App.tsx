import { useEffect, useReducer, useRef } from 'react';
import { scenarioRequest, solve, solveComparison } from './api/solve';
import type { Scenario, SolverKind } from './contracts';
import { ScenarioEditor } from './scenario/ScenarioEditor';
import { createEditorState, validateScenario } from './scenario/model';
import { scenarioReducer } from './scenario/reducer';
import { ordinaryScenario } from './scenario/presets';

export default function App() {
  const [state, dispatch] = useReducer(scenarioReducer, ordinaryScenario, createEditorState);
  const controllerRef = useRef<AbortController | null>(null);
  const errors = validateScenario(state.scenario);

  useEffect(() => () => controllerRef.current?.abort(), []);

  function edit(scenario: Scenario) {
    controllerRef.current?.abort();
    controllerRef.current = null;
    dispatch({ type: 'Edit', scenario });
  }

  function cancel() {
    controllerRef.current?.abort();
    controllerRef.current = null;
    dispatch({ type: 'Cancel' });
  }

  async function run(choice: SolverKind | 'Compare') {
    if (validateScenario(state.scenario).length > 0) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const requestId = crypto.randomUUID();
    const revision = state.revision;
    dispatch({ type: 'RunStarted', requestId, revision });
    try {
      if (choice === 'Compare') {
        await solveComparison(state.scenario, requestId, controller.signal, (result, isLast) => {
          dispatch({ type: 'RunFinished', requestId, revision, result, isLast });
        });
      } else {
        const result = await solve(scenarioRequest(state.scenario, choice, requestId), controller.signal);
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
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }

  return (
    <main>
      <ScenarioEditor
        state={state}
        errors={errors}
        onEdit={edit}
        onRun={(choice) => void run(choice)}
        onCancel={cancel}
      />
    </main>
  );
}
