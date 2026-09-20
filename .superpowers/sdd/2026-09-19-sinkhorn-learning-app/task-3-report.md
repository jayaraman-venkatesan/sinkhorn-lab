# Task 3 report — numerically faithful playback model

## Scope and result

Implemented the pure APP-03 playback model only:

- shipment accounting is recomputed from the original source, target, costs and
  plan for one clamped progress value;
- retained solver trace selection uses the retained array position separately
  from the frame's mathematical iteration index;
- trace presentation labels sampled iteration gaps, provisional states,
  rejected attempts and restored states;
- the playback reducer uses absolute monotonic millisecond timestamps and
  explicit anchors for play, pause, scrub, speed changes and replay;
- shipment mode is gated only by `checks.usable`; the clock stores no plan and
  introduces no extra numerical success policy;
- the decoded response wire shape is unchanged. `TraceFrame` and `SolveChecks`
  are named aliases for the existing inline structures.

No scene rendering, TypeScript solver, dependency, API change or end-to-end
browser behavior was added.

## Test-driven slices

All commands below ran from `web` with
`/Users/jayaramanvenkatesan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`
prepended to `PATH`. Each first RED used a compilable public API scaffold that
threw an explicit not-implemented error; behavioral production code was added
only after observing that failure.

### 1. One-progress shipment invariant

Production mutation caught: deriving counters or cost from a different progress
or route source.

RED command:

```text
npm test -- --run tests/shipment.test.ts
```

RED result: exit 1; 1 test failed with
`Error: shipment accounting is not implemented` at `shipmentAt`.

GREEN command:

```text
npm test -- --run tests/shipment.test.ts
```

GREEN result: exit 0; 1 file passed, 1 test passed.

### 2. Shipment boundaries and rejection

Production mutations caught: accepting nonfinite progress or a nonfinite plan,
indexing a short matrix, dropping zero routes, or clamping a small final solver
residual to zero.

RED command:

```text
npm test -- --run tests/shipment.test.ts
```

RED result: exit 1; 4 failed and 8 passed. The expected failures were
nonfinite progress, a nonfinite plan entry, a short plan row and a short cost
row not throwing. Missing rows already failed through the pre-existing access,
which confirmed the new shape tests also needed explicit short-row cases.

GREEN command:

```text
npm test -- --run tests/shipment.test.ts
```

GREEN result: exit 0; 1 file passed, 12 tests passed.

### 3. Actual retained trace endpoints and labels

Production mutations caught: interpolating/inventing a frame, conflating the
retained position with the mathematical iteration, hiding sampled gaps, or
presenting rejected/restored phases as ordinary accepted progress.

RED command:

```text
npm test -- --run tests/trace.test.ts
```

RED result: exit 1; 6 tests failed with the expected trace-selection or
trace-label not-implemented errors (invalid retained positions also received
`Error` rather than the required `RangeError`).

GREEN command:

```text
npm test -- --run tests/trace.test.ts
```

GREEN result: exit 0; 1 file passed, 6 tests passed.

### 4. Absolute-anchor playback clock and usability gate

Production mutations caught: accumulating tick deltas, counting paused time,
losing progress on resume/speed change, refusing backward scrub, replaying from
the endpoint incorrectly, entering Shipment for an unusable result, changing
shipment progress while selecting a trace endpoint, or accepting invalid clock
values.

RED command:

```text
npm test -- --run tests/clock.test.ts
```

RED result: exit 1; 11 tests failed with the expected playback-clock
not-implemented error (validation cases also received `Error` rather than the
required `RangeError`).

GREEN command:

```text
npm test -- --run tests/clock.test.ts
```

GREEN result: exit 0; 1 file passed, 11 tests passed.

Focused combined check:

```text
npm test -- --run tests/shipment.test.ts tests/trace.test.ts tests/clock.test.ts
```

Result: exit 0; 3 files passed, 29 tests passed.

## Final verification

```text
npm test -- --run
```

Exit 0; 6 test files passed, 67 tests passed.

```text
npm run typecheck
```

Exit 0; `tsc --noEmit` produced no diagnostics.

```text
npm run lint
```

Exit 0; `eslint .` produced no diagnostics.

```text
npm run build
```

Exit 0; TypeScript checking and Vite production build completed, with 21
modules transformed.

## Self-review

- Confirmed the required `0`, `1`, arbitrary-fraction, backward-scrub, replay,
  pause/resume, small-residual, nonfinite-plan, zero-route, sampled-gap,
  rejected/restored and unusable-result cases are executable tests.
- Confirmed shipment validation occurs before arithmetic and does not round or
  clamp residual masses. Only progress is clamped to its defined `[0, 1]`
  interval.
- Confirmed finite plans are the only plan-level playback prerequisite here;
  nonnegativity and marginal validity remain represented by the server-owned
  `checks.usable` decision rather than duplicated frontend policy.
- Confirmed a nonfinite computed cost is not independently treated as plan
  invalidity; the model does not invent a rule beyond `checks.usable`.
- Confirmed every clock action consumes an absolute `elapsedMs`, and pause,
  scrub and speed changes reset both anchor time and anchor progress.
- Confirmed no plan is stored in or mutated by the clock.
- Confirmed `git diff --check` reports no whitespace errors.

## Files

- `web/src/contracts.ts`
- `web/src/playback/shipment.ts`
- `web/src/playback/trace.ts`
- `web/src/playback/clock.ts`
- `web/tests/shipment.test.ts`
- `web/tests/trace.test.ts`
- `web/tests/clock.test.ts`

## Concerns and follow-up boundaries

No implementation blocker remains. Rich scene wiring, rendering, accessibility
controls and Playwright coverage remain deliberately outside APP-03. A later UI
must pass its monotonic animation timestamp into the reducer, use
`retainedFrameIndex` only as a retained-array position, obtain numerical values
from `selectTraceFrame`, and call `shipmentAt` only after the decoded result's
`checks.usable` gate succeeds.
