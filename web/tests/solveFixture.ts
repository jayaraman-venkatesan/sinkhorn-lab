import type { SolveResponse } from '../src/contracts';

export function solveFixture(
  solver: SolveResponse['solver'] = 'Basic',
  requestId = 'request-1',
): SolveResponse {
  return {
    requestId,
    solver,
    referenceVersion: '0.9.6.post1',
    referenceCommit: '85113e9a380f5fcf684c50c73c1ff6a164a7366e',
    options: {
      regularization: 1,
      maxIterations: 1000,
      threshold: 1e-9,
      preprocessingPolicy: 'none',
    },
    inputTotals: { source: 1, target: 1 },
    plan: [
      [0.4, 0.1],
      [0.1, 0.4],
    ],
    transportCost: 0.2,
    termination: 'ThresholdMet',
    lastAttemptedIndex: 10,
    attemptedPairs: 11,
    acceptedPairs: 11,
    errors: [
      { index: 0, targetL2: { nonFinite: 'PositiveInfinity' } },
      { index: 10, targetL2: 1e-10 },
    ],
    scaling: {
      source: [1, { nonFinite: 'NaN' }],
      target: [1, 1],
      isLog: solver === 'LogDomain',
    },
    checks: {
      finite: true,
      nonnegative: true,
      sourceL1: 1e-10,
      targetL1: 1e-10,
      totalMass: 1,
      usable: true,
    },
    warnings: ['diagnostic-overflow'],
    trace: {
      frames: [
        {
          index: 0,
          phase: 'AfterDestination',
          solver,
          sourceScaling: [1, 1],
          targetScaling: [{ nonFinite: 'NegativeInfinity' }, 1],
          isLog: solver === 'LogDomain',
          rejected: false,
          plan: [
            [0.4, 0.1],
            [0.1, 0.4],
          ],
        },
      ],
      observedCount: 1,
      omittedCount: 0,
      sampled: false,
      policy: 'All observed phases retained.',
    },
  };
}
