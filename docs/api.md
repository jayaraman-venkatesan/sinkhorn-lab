# Solve API contract

The local API calls the pinned `vendor/sinkhorn` project directly. It neither
normalizes inputs nor substitutes solvers. Numerical failure is a completed
solver outcome, distinct from an HTTP transport or validation error.

## Endpoints

`GET /api/health` returns HTTP 200 with `{"status":"ready"}` once the ASP.NET
application is accepting requests.

`POST /api/solve` accepts camel-case JSON:

```json
{
  "requestId": "example-1",
  "source": [0.5, 0.5],
  "target": [0.5, 0.5],
  "costs": [[0, 1], [1, 0]],
  "regularization": 1,
  "solver": "Basic",
  "maxIterations": 1000,
  "threshold": 1e-9,
  "traceMode": "Phases"
}
```

`solver` is `Basic` or `LogDomain`; `traceMode` is `None` or `Phases`. Enum
fields must be strings. Source and target lengths are 1–8, the matrix must be
rectangular and dimensionally exact, and `maxIterations` is 1–1,000. The API
also applies the library's finite-value, positive-setting, and equal-total
validation without repairing values. Request bodies are limited to 256 KiB.

An HTTP 200 response contains:

- `requestId`, plus library-owned `solver`, `referenceVersion`, and
  `referenceCommit` provenance;
- `options` (`regularization`, effective `maxIterations`, effective `threshold`,
  and `preprocessingPolicy`) and prepared `inputTotals` from library metadata;
- `plan`, `transportCost`, `termination`, `lastAttemptedIndex`, `attemptedPairs`,
  `acceptedPairs`, sampled `errors`, `scaling`, `checks`, and `warnings`;
- `trace.frames`, `observedCount`, `omittedCount`, `sampled`, and an explicit
  retention `policy`. Frames include iteration/phase, coordinate arrays,
  coordinate system, rejection state, and a display plan materialized from
  copied coordinates after solving.

`termination` is `ThresholdMet`, `IterationLimit`, or `NumericalBreakdown`.
The last two remain HTTP 200 numerical results. Consumers must inspect
`checks.usable`; a low transport cost does not make an unusable plan valid.

Every diagnostic double is either a JSON number or an object such as
`{"nonFinite":"NaN"}`, `{"nonFinite":"PositiveInfinity"}`, or
`{"nonFinite":"NegativeInfinity"}`. Nonfinite diagnostics are never replaced
with zero.

## Resource and error behavior

One solve may run per API process. A second request is not queued. CPU work runs
off the request event loop, observes request cancellation and a 30-second
compute deadline, and releases the gate in all exit paths. Trace collection is
bounded to 200 retained frames while observing. The API serializes before
sending headers and limits successful solve responses to 4 MiB, removing only
optional interior frames before rejecting mandatory-output overflow.

Transport errors use Problem Details without stack traces or internal exception
messages:

| HTTP | `title` | Meaning |
| --- | --- | --- |
| 400 | `invalid-request` | Malformed JSON, unknown fields, invalid shape/value/setting, or numeric enum value |
| 408 | `compute-timeout` | The 30-second compute deadline elapsed while the client remained connected |
| 413 | `request-size-limit` | The request body exceeded 256 KiB |
| 429 | `solve-busy` | Another solve already owns the single service gate |
| 500 | `response-size-limit` | Mandatory final result/status output could not fit within 4 MiB |
| 500 | generic Problem Details | An unexpected server failure; implementation details are not returned |

A disconnected client receives no synthesized solver result. Request
cancellation propagates through the same library cancellation path and is never
reported as numerical convergence.
