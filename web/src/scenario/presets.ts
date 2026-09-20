import type { Point, Scenario } from '../contracts';
import { distanceCosts } from './costs';

const sources: Point[] = [
  { id: 'warehouse-a', label: 'Warehouse A', x: 15, y: 25, amount: 40 },
  { id: 'warehouse-b', label: 'Warehouse B', x: 25, y: 75, amount: 60 },
];
const targets: Point[] = [
  { id: 'destination-a', label: 'Destination A', x: 75, y: 25, amount: 50 },
  { id: 'destination-b', label: 'Destination B', x: 85, y: 75, amount: 50 },
];
export const ordinaryScenario: Scenario = {
  id: 'grain-starter', sources, targets, costs: distanceCosts(sources, targets),
  costMode: 'Distance', regularization: 10, threshold: 1e-9, maxIterations: 1000,
};
export const zeroSupportScenario: Scenario = {
  ...ordinaryScenario, id: 'zero-support',
  sources: sources.map((point, i) => ({ ...point, amount: i === 0 ? 1 : 0 })),
  targets: targets.map((point, i) => ({ ...point, amount: i === 0 ? 0 : 1 })),
  costs: [[0, 1], [1, 0]], costMode: 'Custom', regularization: 1,
};
export const tinyRegularizationScenario: Scenario = {
  ...ordinaryScenario, id: 'tiny-regularization', regularization: 1e-6,
};
