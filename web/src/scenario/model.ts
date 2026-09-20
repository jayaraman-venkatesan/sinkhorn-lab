import type { Point, Scenario, SolveResponse, SolverKind } from '../contracts';
import { distanceCosts } from './costs';

export type EditorState = {
  scenario: Scenario;
  revision: number;
  busy: boolean;
  requestId: string | null;
  results: Partial<Record<SolverKind, SolveResponse>>;
  transportError: string | null;
  stale: boolean;
};

export type EditorAction =
  | { type: 'Edit'; scenario: Scenario }
  | { type: 'RunStarted'; requestId: string; revision: number }
  | {
      type: 'RunFinished';
      requestId: string;
      revision: number;
      result: SolveResponse;
      isLast: boolean;
    }
  | { type: 'RunFailed'; requestId: string; revision: number; error: string }
  | { type: 'Cancel' };

export function createEditorState(scenario: Scenario): EditorState {
  return {
    scenario,
    revision: 0,
    busy: false,
    requestId: null,
    results: {},
    transportError: null,
    stale: false,
  };
}

export function updatePoint(
  scenario: Scenario,
  collection: 'sources' | 'targets',
  id: string,
  patch: Partial<Pick<Point, 'label' | 'x' | 'y' | 'amount'>>,
): Scenario {
  const points = scenario[collection].map((point) =>
    point.id === id ? { ...point, ...patch } : point,
  );
  const next = { ...scenario, [collection]: points };
  if (next.costMode === 'Custom') {
    return next;
  }

  return { ...next, costs: distanceCosts(next.sources, next.targets) };
}

export function changeCostMode(
  scenario: Scenario,
  mode: Scenario['costMode'],
  confirmReplacement: () => boolean,
): Scenario {
  if (mode === scenario.costMode) return scenario;
  if (mode === 'Distance') {
    if (!confirmReplacement()) return scenario;
    return {
      ...scenario,
      costMode: mode,
      costs: distanceCosts(scenario.sources, scenario.targets),
    };
  }

  return { ...scenario, costMode: mode, costs: scenario.costs.map((row) => [...row]) };
}

export function validateScenario(scenario: Scenario): string[] {
  const errors: string[] = [];
  if (scenario.sources.length < 1 || scenario.sources.length > 8) {
    errors.push('Add between 1 and 8 sources.');
  }
  if (scenario.targets.length < 1 || scenario.targets.length > 8) {
    errors.push('Add between 1 and 8 destinations.');
  }

  const points = [...scenario.sources, ...scenario.targets];
  const numericValues = [
    ...points.flatMap((point) => [point.x, point.y, point.amount]),
    ...scenario.costs.flat(),
    scenario.regularization,
    scenario.threshold,
  ];
  if (numericValues.some((value) => !Number.isFinite(value))) {
    errors.push('All values must be finite numbers.');
  }
  if (points.some((point) => point.amount < 0)) {
    errors.push('Quantities cannot be negative.');
  }

  const sourceTotal = scenario.sources.reduce((total, point) => total + point.amount, 0);
  const targetTotal = scenario.targets.reduce((total, point) => total + point.amount, 0);
  const totalTolerance = 1e-12 * Math.max(sourceTotal, targetTotal);
  if (
    !Number.isFinite(sourceTotal) ||
    !Number.isFinite(targetTotal) ||
    sourceTotal <= 0 ||
    targetTotal <= 0 ||
    Math.abs(sourceTotal - targetTotal) > totalTolerance
  ) {
    errors.push('Supply and demand totals must be equal before running.');
  }
  if (scenario.costs.length !== scenario.sources.length ||
      scenario.costs.some((row) => row.length !== scenario.targets.length)) {
    errors.push('The cost table must match every source and destination.');
  }
  if (!Number.isFinite(scenario.regularization) || scenario.regularization <= 0) {
    errors.push('Regularization must be greater than zero.');
  }
  if (!Number.isFinite(scenario.threshold) || scenario.threshold <= 0) {
    errors.push('Threshold must be greater than zero.');
  }
  if (!Number.isInteger(scenario.maxIterations) ||
      scenario.maxIterations < 1 ||
      scenario.maxIterations > 1000) {
    errors.push('Maximum iterations must be between 1 and 1000.');
  }
  return errors;
}

export function addPoint(
  scenario: Scenario,
  collection: 'sources' | 'targets',
  point: Point,
): Scenario {
  const next = { ...scenario, [collection]: [...scenario[collection], point] };
  if (next.costMode === 'Distance') {
    return { ...next, costs: distanceCosts(next.sources, next.targets) };
  }
  if (collection === 'sources') {
    return { ...next, costs: [...scenario.costs, scenario.targets.map(() => 0)] };
  }
  return { ...next, costs: scenario.costs.map((row) => [...row, 0]) };
}

export function removePoint(
  scenario: Scenario,
  collection: 'sources' | 'targets',
  id: string,
): Scenario {
  const removedIndex = scenario[collection].findIndex((point) => point.id === id);
  if (removedIndex < 0) return scenario;
  const next = {
    ...scenario,
    [collection]: scenario[collection].filter((point) => point.id !== id),
  };
  if (next.costMode === 'Distance') {
    return { ...next, costs: distanceCosts(next.sources, next.targets) };
  }
  const costs = collection === 'sources'
    ? scenario.costs.filter((_row, index) => index !== removedIndex)
    : scenario.costs.map((row) => row.filter((_cost, index) => index !== removedIndex));
  return { ...next, costs };
}

export function updateCost(
  scenario: Scenario,
  sourceIndex: number,
  targetIndex: number,
  cost: number,
): Scenario {
  return {
    ...scenario,
    costs: scenario.costs.map((row, rowIndex) =>
      rowIndex === sourceIndex
        ? row.map((value, columnIndex) => (columnIndex === targetIndex ? cost : value))
        : row,
    ),
  };
}
