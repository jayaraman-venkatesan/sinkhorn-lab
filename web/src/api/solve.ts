import type {
  DiagnosticNumber,
  Scenario,
  SolveRequest,
  SolveResponse,
  SolverKind,
  TracePhase,
} from '../contracts';

export class SolveDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SolveDecodeError';
  }
}

export class SolveHttpError extends Error {
  constructor(
    readonly status: number,
    readonly title: string,
    readonly type: string,
    readonly detail: string | null,
  ) {
    super(detail ?? title);
    this.name = 'SolveHttpError';
  }
}

type JsonObject = Record<string, unknown>;

function object(value: unknown, path: string): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new SolveDecodeError(`${path} must be an object.`);
  }
  return value as JsonObject;
}

function exact(value: unknown, keys: readonly string[], path: string): JsonObject {
  const result = object(value, path);
  const actual = Object.keys(result).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new SolveDecodeError(`${path} has unexpected or missing fields.`);
  }
  return result;
}

function string(value: unknown, path: string): string {
  if (typeof value !== 'string') throw new SolveDecodeError(`${path} must be a string.`);
  return value;
}

function boolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') throw new SolveDecodeError(`${path} must be a boolean.`);
  return value;
}

function integer(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new SolveDecodeError(`${path} must be an integer.`);
  }
  return value;
}

function oneOf<T extends string>(value: unknown, values: readonly T[], path: string): T {
  if (typeof value !== 'string' || !values.includes(value as T)) {
    throw new SolveDecodeError(`${path} has an unknown value.`);
  }
  return value as T;
}

function array<T>(value: unknown, decode: (item: unknown, path: string) => T, path: string): T[] {
  if (!Array.isArray(value)) throw new SolveDecodeError(`${path} must be an array.`);
  return value.map((item, index) => decode(item, `${path}[${index}]`));
}

function diagnostic(value: unknown, path: string): DiagnosticNumber {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const tagged = exact(value, ['nonFinite'], path);
  return {
    nonFinite: oneOf(
      tagged.nonFinite,
      ['NaN', 'PositiveInfinity', 'NegativeInfinity'] as const,
      `${path}.nonFinite`,
    ),
  };
}

function diagnosticVector(value: unknown, path: string): DiagnosticNumber[] {
  return array(value, diagnostic, path);
}

function diagnosticMatrix(value: unknown, path: string): DiagnosticNumber[][] {
  return array(value, diagnosticVector, path);
}

const solvers = ['Basic', 'LogDomain'] as const;
const terminations = ['ThresholdMet', 'IterationLimit', 'NumericalBreakdown'] as const;
const tracePhases = ['Initial', 'AfterDestination', 'AfterSource', 'Restored'] as const;

function traceFrame(value: unknown, path: string): SolveResponse['trace']['frames'][number] {
  const frame = exact(
    value,
    ['index', 'phase', 'solver', 'sourceScaling', 'targetScaling', 'isLog', 'rejected', 'plan'],
    path,
  );
  return {
    index: integer(frame.index, `${path}.index`),
    phase: oneOf<TracePhase>(frame.phase, tracePhases, `${path}.phase`),
    solver: oneOf<SolverKind>(frame.solver, solvers, `${path}.solver`),
    sourceScaling: diagnosticVector(frame.sourceScaling, `${path}.sourceScaling`),
    targetScaling: diagnosticVector(frame.targetScaling, `${path}.targetScaling`),
    isLog: boolean(frame.isLog, `${path}.isLog`),
    rejected: boolean(frame.rejected, `${path}.rejected`),
    plan: diagnosticMatrix(frame.plan, `${path}.plan`),
  };
}

export function decodeSolveResponse(value: unknown): SolveResponse {
  const response = exact(
    value,
    [
      'requestId', 'solver', 'referenceVersion', 'referenceCommit', 'options', 'inputTotals',
      'plan', 'transportCost', 'termination', 'lastAttemptedIndex', 'attemptedPairs',
      'acceptedPairs', 'errors', 'scaling', 'checks', 'warnings', 'trace',
    ],
    'response',
  );
  const options = exact(
    response.options,
    ['regularization', 'maxIterations', 'threshold', 'preprocessingPolicy'],
    'response.options',
  );
  const inputTotals = exact(response.inputTotals, ['source', 'target'], 'response.inputTotals');
  const scaling = exact(response.scaling, ['source', 'target', 'isLog'], 'response.scaling');
  const checks = exact(
    response.checks,
    ['finite', 'nonnegative', 'sourceL1', 'targetL1', 'totalMass', 'usable'],
    'response.checks',
  );
  const trace = exact(
    response.trace,
    ['frames', 'observedCount', 'omittedCount', 'sampled', 'policy'],
    'response.trace',
  );

  return {
    requestId: string(response.requestId, 'response.requestId'),
    solver: oneOf(response.solver, solvers, 'response.solver'),
    referenceVersion: string(response.referenceVersion, 'response.referenceVersion'),
    referenceCommit: string(response.referenceCommit, 'response.referenceCommit'),
    options: {
      regularization: diagnostic(options.regularization, 'response.options.regularization'),
      maxIterations: integer(options.maxIterations, 'response.options.maxIterations'),
      threshold: diagnostic(options.threshold, 'response.options.threshold'),
      preprocessingPolicy: string(options.preprocessingPolicy, 'response.options.preprocessingPolicy'),
    },
    inputTotals: {
      source: diagnostic(inputTotals.source, 'response.inputTotals.source'),
      target: diagnostic(inputTotals.target, 'response.inputTotals.target'),
    },
    plan: diagnosticMatrix(response.plan, 'response.plan'),
    transportCost: diagnostic(response.transportCost, 'response.transportCost'),
    termination: oneOf(response.termination, terminations, 'response.termination'),
    lastAttemptedIndex: integer(response.lastAttemptedIndex, 'response.lastAttemptedIndex'),
    attemptedPairs: integer(response.attemptedPairs, 'response.attemptedPairs'),
    acceptedPairs: integer(response.acceptedPairs, 'response.acceptedPairs'),
    errors: array(
      response.errors,
      (value, path) => {
        const error = exact(value, ['index', 'targetL2'], path);
        return {
          index: integer(error.index, `${path}.index`),
          targetL2: diagnostic(error.targetL2, `${path}.targetL2`),
        };
      },
      'response.errors',
    ),
    scaling: {
      source: diagnosticVector(scaling.source, 'response.scaling.source'),
      target: diagnosticVector(scaling.target, 'response.scaling.target'),
      isLog: boolean(scaling.isLog, 'response.scaling.isLog'),
    },
    checks: {
      finite: boolean(checks.finite, 'response.checks.finite'),
      nonnegative: boolean(checks.nonnegative, 'response.checks.nonnegative'),
      sourceL1: diagnostic(checks.sourceL1, 'response.checks.sourceL1'),
      targetL1: diagnostic(checks.targetL1, 'response.checks.targetL1'),
      totalMass: diagnostic(checks.totalMass, 'response.checks.totalMass'),
      usable: boolean(checks.usable, 'response.checks.usable'),
    },
    warnings: array(response.warnings, string, 'response.warnings'),
    trace: {
      frames: array(trace.frames, traceFrame, 'response.trace.frames'),
      observedCount: integer(trace.observedCount, 'response.trace.observedCount'),
      omittedCount: integer(trace.omittedCount, 'response.trace.omittedCount'),
      sampled: boolean(trace.sampled, 'response.trace.sampled'),
      policy: string(trace.policy, 'response.trace.policy'),
    },
  };
}

function problemDetails(value: unknown, fallbackStatus: number): SolveHttpError {
  const body = object(value, 'problem details');
  const status = typeof body.status === 'number' ? body.status : fallbackStatus;
  const title = typeof body.title === 'string' ? body.title : 'request-failed';
  const type = typeof body.type === 'string' ? body.type : 'about:blank';
  const detail = typeof body.detail === 'string' ? body.detail : null;
  return new SolveHttpError(status, title, type, detail);
}

export async function solve(request: SolveRequest, signal: AbortSignal): Promise<SolveResponse> {
  const response = await fetch('/api/solve', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  });
  const payload: unknown = await response.json();
  if (!response.ok) throw problemDetails(payload, response.status);
  const result = decodeSolveResponse(payload);
  if (result.requestId !== request.requestId || result.solver !== request.solver) {
    throw new SolveDecodeError('response identity does not match the solve request.');
  }
  return result;
}

export function scenarioRequest(
  scenario: Scenario,
  solver: SolverKind,
  requestId: string,
): SolveRequest {
  return {
    requestId,
    source: scenario.sources.map((point) => point.amount),
    target: scenario.targets.map((point) => point.amount),
    costs: scenario.costs.map((row) => [...row]),
    regularization: scenario.regularization,
    solver,
    maxIterations: scenario.maxIterations,
    threshold: scenario.threshold,
    traceMode: 'Phases',
  };
}

export async function solveComparison(
  scenario: Scenario,
  requestId: string,
  signal: AbortSignal,
  onResult: (result: SolveResponse, isLast: boolean) => void,
): Promise<void> {
  for (const solver of solvers) {
    if (signal.aborted) return;
    const result = await solve(scenarioRequest(scenario, solver, requestId), signal);
    onResult(result, solver === 'LogDomain');
  }
}
