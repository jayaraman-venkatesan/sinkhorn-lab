import { describe, expect, it } from 'vitest';
import type { Scenario } from '../src/contracts';
import {
  addPoint,
  changeCostMode,
  createEditorState,
  removePoint,
  updateCost,
  updatePoint,
  validateScenario,
} from '../src/scenario/model';
import { scenarioReducer } from '../src/scenario/reducer';
import { solveFixture } from './solveFixture';

const scenario: Scenario = {
  id: 'grain',
  sources: [{ id: 'a', label: 'Warehouse A', x: 0, y: 0, amount: 40 }],
  targets: [{ id: 'b', label: 'Destination B', x: 3, y: 4, amount: 40 }],
  costs: [[12]],
  costMode: 'Custom',
  regularization: 1,
  threshold: 1e-9,
  maxIterations: 1000,
};

const oldResult = solveFixture('Basic', 'old');

describe('scenario editing', () => {
  it('keeps the stale explanation across successive edits until a new run', () => {
    const running = scenarioReducer(createEditorState(scenario), { type: 'RunStarted', requestId: 'old', revision: 0 });
    const first = scenarioReducer(running, { type: 'Edit', scenario: { ...scenario, regularization: 2 } });
    const second = scenarioReducer(first, { type: 'Edit', scenario: { ...scenario, regularization: 3 } });
    expect(second.stale).toBe(true);
    expect(scenarioReducer(second, { type: 'RunStarted', requestId: 'new', revision: second.revision }).stale).toBe(false);
  });
  it('keeps custom costs when a point position changes', () => {
    const edited = updatePoint(scenario, 'sources', 'a', { x: 9, y: 8 });

    expect(edited.sources[0]).toMatchObject({ x: 9, y: 8, amount: 40 });
    expect(edited.costs).toEqual([[12]]);
    expect(edited.costs).toBe(scenario.costs);
  });

  it('does not accept a completed result after its revision was edited', () => {
    const started = scenarioReducer(createEditorState(scenario), {
      type: 'RunStarted',
      requestId: 'old',
      revision: 0,
    });
    const edited = scenarioReducer(started, {
      type: 'Edit',
      scenario: { ...scenario, regularization: 0.5 },
    });
    const finished = scenarioReducer(edited, {
      type: 'RunFinished',
      requestId: 'old',
      revision: 0,
      result: oldResult,
      isLast: true,
    });

    expect(finished.revision).toBe(1);
    expect(finished.results).toEqual({});
    expect(finished.requestId).toBeNull();
  });

  it('marks a cleared result stale when the scenario is edited', () => {
    const started = scenarioReducer(createEditorState(scenario), {
      type: 'RunStarted',
      requestId: 'current',
      revision: 0,
    });
    const finished = scenarioReducer(started, {
      type: 'RunFinished',
      requestId: 'current',
      revision: 0,
      result: { ...oldResult, requestId: 'current' },
      isLast: true,
    });

    const edited = scenarioReducer(finished, { type: 'Edit', scenario });

    expect(edited.results).toEqual({});
    expect(edited.stale).toBe(true);
  });

  it('ignores stale failures but accepts a failure for the active identity and revision', () => {
    const started = scenarioReducer(createEditorState(scenario), {
      type: 'RunStarted',
      requestId: 'current',
      revision: 0,
    });
    const staleFailure = scenarioReducer(started, {
      type: 'RunFailed',
      requestId: 'old',
      revision: 0,
      error: 'old failure',
    });
    const currentFailure = scenarioReducer(staleFailure, {
      type: 'RunFailed',
      requestId: 'current',
      revision: 0,
      error: 'network unavailable',
    });

    expect(staleFailure).toBe(started);
    expect(currentFailure).toMatchObject({
      busy: false,
      requestId: null,
      transportError: 'network unavailable',
    });
  });

  it('clears the active identity when a run is cancelled', () => {
    const started = scenarioReducer(createEditorState(scenario), {
      type: 'RunStarted',
      requestId: 'current',
      revision: 0,
    });

    expect(scenarioReducer(started, { type: 'Cancel' })).toMatchObject({
      busy: false,
      requestId: null,
    });
  });

  it('requires confirmation before replacing custom costs with distances', () => {
    let confirmations = 0;
    const cancelled = changeCostMode(scenario, 'Distance', () => {
      confirmations += 1;
      return false;
    });
    const accepted = changeCostMode(scenario, 'Distance', () => true);

    expect(confirmations).toBe(1);
    expect(cancelled).toBe(scenario);
    expect(accepted.costMode).toBe('Distance');
    expect(accepted.costs).toEqual([[5]]);
  });

  it.each([
    ['an empty source list', { sources: [] }, 'Add between 1 and 8 sources.'],
    [
      'more than eight targets',
      {
        targets: Array.from({ length: 9 }, (_, index) => ({
          id: `t${index}`,
          label: `T${index}`,
          x: index,
          y: 0,
          amount: 40 / 9,
        })),
        costs: [Array.from({ length: 9 }, () => 1)],
      },
      'Add between 1 and 8 destinations.',
    ],
    ['a nonfinite coordinate', { sources: [{ ...scenario.sources[0]!, x: Number.NaN }] }, 'All values must be finite numbers.'],
    ['a negative quantity', { sources: [{ ...scenario.sources[0]!, amount: -1 }] }, 'Quantities cannot be negative.'],
    ['unequal totals', { targets: [{ ...scenario.targets[0]!, amount: 39 }] }, 'Supply and demand totals must be equal before running.'],
    ['zero regularization', { regularization: 0 }, 'Regularization must be greater than zero.'],
    ['too many iterations', { maxIterations: 1001 }, 'Maximum iterations must be between 1 and 1000.'],
  ])('reports %s', (_label, patch, expected) => {
    expect(validateScenario({ ...scenario, ...patch })).toContain(expected);
  });

  it('keeps a custom matrix aligned when points are added, removed, and edited', () => {
    const withTarget = addPoint(scenario, 'targets', {
      id: 'c',
      label: 'Destination C',
      x: 1,
      y: 1,
      amount: 0,
    });
    const edited = updateCost(withTarget, 0, 1, 7);
    const removed = removePoint(edited, 'targets', 'b');

    expect(withTarget.costs).toEqual([[12, 0]]);
    expect(edited.costs).toEqual([[12, 7]]);
    expect(removed.costs).toEqual([[7]]);
  });
});
