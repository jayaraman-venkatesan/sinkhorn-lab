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
