# sinkhorn-lab

Status: in development. The first API integration is implemented on the feature
branch; the complete learning application and distribution verification remain open.

Interactive optimal-transport lessons and a playground backed by the actual C# library.

- [Approved specification](docs/superpowers/specs/2026-09-19-sinkhorn-learning-design.md)
- [Implementation plans](docs/superpowers/plans/2026-09-19-sinkhorn-tickets.md)
- [Project issues](https://github.com/jayaraman-venkatesan/sinkhorn-lab/issues)

Development uses isolated feature worktrees and test-first subagent tasks.
Runnable usage and container instructions will be added with their verified implementation.

## Local API development

Initialize submodules, then use the pinned .NET 10 SDK:

```sh
git submodule update --init --recursive
/Users/jayaramanvenkatesan/.dotnet/dotnet restore --locked-mode
/Users/jayaramanvenkatesan/.dotnet/dotnet test -c Release
/Users/jayaramanvenkatesan/.dotnet/dotnet run --project src/Api/Api.csproj
```

`GET /api/health` returns `{"status":"ready"}` after startup. `POST /api/solve`
invokes the pinned library directly; see [the API contract](docs/api.md) for its
wire schema, limits, numerical-status semantics, and transport errors.

## Frontend development

Use Node 24 LTS and the committed npm lockfile:

```sh
cd web
npm ci
npm test -- --run
npm run test:e2e
npm run typecheck
npm run lint
npm run build
npm run dev
```

Start the API for frontend development with
`ASPNETCORE_URLS=http://127.0.0.1:5080 dotnet run --project src/Api/Api.csproj`.
The Vite development server proxies `/api` to that loopback address.

## Library lesson example

This executable snippet passes weights as kilograms, uses explicit regularization
and an absolute stopping threshold, and refuses to use an unusable plan. Numerical
update-pair counts are solver work; they are unrelated to shipment-playback frames.
The same source is compiled as `examples/LessonUsage` by the solution build.

<!-- lesson-usage:start -->
```csharp
using Sinkhorn;

var problem = new TransportProblem(
    [50.0, 50.0],
    [50.0, 50.0],
    new double[,] { { 0.0, 1.0 }, { 1.0, 0.0 } });

foreach (SolverKind kind in new[] { SolverKind.Basic, SolverKind.LogDomain })
{
    SolverResult result = SinkhornSolver.Solve(
        problem,
        regularization: 1.0,
        solver: kind,
        options: new SolverOptions(MaxIterations: 1000, Threshold: 1e-9));

    if (!result.Checks.Usable)
    {
        Console.Error.WriteLine(
            $"{kind}: {result.Termination}; " +
            $"source L1={result.Checks.SourceL1:R} kg; " +
            $"target L1={result.Checks.TargetL1:R} kg");
        return 1;
    }

    Console.WriteLine(
        $"{kind}: {result.AcceptedPairs} accepted update pair(s), " +
        $"transport cost {result.TransportCost:R}");
}

var zeroSupport = new TransportProblem(
    [1.0, 0.0],
    [0.0, 1.0],
    new double[,] { { 0.0, 1.0 }, { 1.0, 0.0 } });
SolverResult failed = SinkhornSolver.Solve(
    zeroSupport,
    regularization: 1.0,
    solver: SolverKind.Basic);
Console.WriteLine($"Basic zero support: {failed.Termination}");

return failed.Termination == TerminationReason.NumericalBreakdown
    && !failed.Checks.Usable
    ? 0
    : 1;
```
<!-- lesson-usage:end -->

Regularization is measured on the same scale as the cost matrix, while the
threshold and residuals use the supplied mass units. `ThresholdMet`, iteration
exhaustion, and numerical breakdown are distinct from plan usability. The Basic
and LogDomain implementations follow the pinned POT reference; see the shared
course for historical credit, failure examples, and possible uses.
