export type SolverKind = 'Basic' | 'LogDomain';

export type NonFiniteKind = 'NaN' | 'PositiveInfinity' | 'NegativeInfinity';
export type DiagnosticNumber = number | { nonFinite: NonFiniteKind };

export type Point = {
  id: string;
  label: string;
  x: number;
  y: number;
  amount: number;
};

export type Scenario = {
  id: string;
  sources: Point[];
  targets: Point[];
  costs: number[][];
  costMode: 'Distance' | 'Custom';
  regularization: number;
  threshold: number;
  maxIterations: number;
};

export type TraceMode = 'None' | 'Phases';
export type TerminationReason = 'ThresholdMet' | 'IterationLimit' | 'NumericalBreakdown';
export type TracePhase = 'Initial' | 'AfterDestination' | 'AfterSource' | 'Restored';

export type TraceFrame = {
  index: number;
  phase: TracePhase;
  solver: SolverKind;
  sourceScaling: DiagnosticNumber[];
  targetScaling: DiagnosticNumber[];
  isLog: boolean;
  rejected: boolean;
  plan: DiagnosticNumber[][];
};

export type SolveChecks = {
  finite: boolean;
  nonnegative: boolean;
  sourceL1: DiagnosticNumber;
  targetL1: DiagnosticNumber;
  totalMass: DiagnosticNumber;
  usable: boolean;
};

export type SolveRequest = {
  requestId: string;
  source: number[];
  target: number[];
  costs: number[][];
  regularization: number;
  solver: SolverKind;
  maxIterations: number;
  threshold: number;
  traceMode: TraceMode;
};

export type SolveResponse = {
  requestId: string;
  solver: SolverKind;
  referenceVersion: string;
  referenceCommit: string;
  options: {
    regularization: DiagnosticNumber;
    maxIterations: number;
    threshold: DiagnosticNumber;
    preprocessingPolicy: string;
  };
  inputTotals: { source: DiagnosticNumber; target: DiagnosticNumber };
  plan: DiagnosticNumber[][];
  transportCost: DiagnosticNumber;
  termination: TerminationReason;
  lastAttemptedIndex: number;
  attemptedPairs: number;
  acceptedPairs: number;
  errors: Array<{ index: number; targetL2: DiagnosticNumber }>;
  scaling: { source: DiagnosticNumber[]; target: DiagnosticNumber[]; isLog: boolean };
  checks: SolveChecks;
  warnings: string[];
  trace: {
    frames: TraceFrame[];
    observedCount: number;
    omittedCount: number;
    sampled: boolean;
    policy: string;
  };
};
