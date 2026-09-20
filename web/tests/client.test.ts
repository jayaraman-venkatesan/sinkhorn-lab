import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Scenario } from '../src/contracts';
import {
  decodeSolveResponse,
  solve,
  solveComparison,
  SolveDecodeError,
  SolveHttpError,
} from '../src/api/solve';
import { solveFixture } from './solveFixture';

const scenario: Scenario = {
  id: 'compare',
  sources: [
    { id: 'a', label: 'A', x: 0, y: 0, amount: 0.5 },
    { id: 'b', label: 'B', x: 1, y: 0, amount: 0.5 },
  ],
  targets: [
    { id: 'c', label: 'C', x: 0, y: 1, amount: 0.5 },
    { id: 'd', label: 'D', x: 1, y: 1, amount: 0.5 },
  ],
  costs: [
    [0, 1],
    [1, 0],
  ],
  costMode: 'Custom',
  regularization: 1,
  threshold: 1e-9,
  maxIterations: 1000,
};

afterEach(() => vi.unstubAllGlobals());

describe('strict solve client', () => {
  it('preserves the complete response including provenance, trace, and nonfinite diagnostics', () => {
    const payload = solveFixture();

    expect(decodeSolveResponse(payload)).toEqual(payload);
  });

  it.each([
    ['an unknown top-level field', { ...solveFixture(), unexpected: true }],
    ['an unknown solver', { ...solveFixture(), solver: 'Stable' }],
    [
      'an invalid diagnostic tag',
      { ...solveFixture(), transportCost: { nonFinite: 'Infinity' } },
    ],
    [
      'a malformed trace frame',
      {
        ...solveFixture(),
        trace: {
          ...solveFixture().trace,
          frames: [{ ...solveFixture().trace.frames[0], phase: 'Middle' }],
        },
      },
    ],
  ])('rejects %s', (_label, payload) => {
    expect(() => decodeSolveResponse(payload)).toThrow(SolveDecodeError);
  });

  it('surfaces non-200 Problem Details distinctly from solver results', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            type: 'urn:sinkhorn:error:solve-busy',
            title: 'solve-busy',
            status: 429,
          }),
          { status: 429, headers: { 'content-type': 'application/problem+json' } },
        ),
      ),
    );

    await expect(
      solve(
        {
          requestId: 'busy',
          source: [1],
          target: [1],
          costs: [[0]],
          regularization: 1,
          solver: 'Basic',
          maxIterations: 1,
          threshold: 1e-9,
          traceMode: 'Phases',
        },
        new AbortController().signal,
      ),
    ).rejects.toEqual(
      new SolveHttpError(429, 'solve-busy', 'urn:sinkhorn:error:solve-busy', null),
    );
  });

  it.each([
    ['request identity', solveFixture('Basic', 'other-request')],
    ['solver', solveFixture('LogDomain', 'expected-request')],
  ])('rejects a successful response for a different %s', async (_field, response) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(response))),
    );

    await expect(
      solve(
        {
          requestId: 'expected-request',
          source: [1],
          target: [1],
          costs: [[0]],
          regularization: 1,
          solver: 'Basic',
          maxIterations: 1,
          threshold: 1e-9,
          traceMode: 'Phases',
        },
        new AbortController().signal,
      ),
    ).rejects.toThrow('response identity does not match the solve request');
  });

  it('awaits Basic then LogDomain with identical numerical settings', async () => {
    const bodies: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as { solver: 'Basic' | 'LogDomain' };
        bodies.push(body);
        return new Response(JSON.stringify(solveFixture(body.solver)), { status: 200 });
      }),
    );
    const received: string[] = [];

    await solveComparison(scenario, 'request-1', new AbortController().signal, (result) => {
      received.push(result.solver);
    });

    expect(received).toEqual(['Basic', 'LogDomain']);
    expect(bodies).toHaveLength(2);
    const [basic, logDomain] = bodies as Array<Record<string, unknown>>;
    expect({ ...basic, solver: undefined }).toEqual({ ...logDomain, solver: undefined });
  });

  it('does not start LogDomain when cancellation follows the Basic result', async () => {
    let requests = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        requests += 1;
        const body = JSON.parse(String(init?.body)) as { solver: 'Basic' | 'LogDomain' };
        return new Response(JSON.stringify(solveFixture(body.solver)), { status: 200 });
      }),
    );
    const controller = new AbortController();

    await solveComparison(scenario, 'request-1', controller.signal, () => controller.abort());

    expect(requests).toBe(1);
  });
});
