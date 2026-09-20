using Sinkhorn;

public sealed class SolveService
{
    private static readonly TraceResponse EmptyTrace = new(
        [],
        0,
        0,
        false,
        "Tracing was not requested.");

    private readonly SemaphoreSlim gate = new(1, 1);
    private readonly ISolveSchedulingHook schedulingHook;
    private readonly ISolveDeadlineFactory deadlineFactory;

    public SolveService(
        ISolveSchedulingHook schedulingHook,
        ISolveDeadlineFactory deadlineFactory)
    {
        this.schedulingHook = schedulingHook;
        this.deadlineFactory = deadlineFactory;
    }

    public async Task<SolveResponse> SolveAsync(
        SolveRequest request,
        CancellationToken requestAborted)
    {
        if (!await gate.WaitAsync(0, requestAborted))
        {
            throw new SolveBusyException();
        }

        try
        {
            await schedulingHook.AfterGateAcquiredAsync(requestAborted);
            using CancellationTokenSource deadline = deadlineFactory.Create();
            using var linked = CancellationTokenSource.CreateLinkedTokenSource(
                requestAborted,
                deadline.Token);
            try
            {
                return await Task.Run(
                    () => Solve(request, linked.Token),
                    CancellationToken.None);
            }
            catch (OperationCanceledException) when (
                deadline.IsCancellationRequested &&
                !requestAborted.IsCancellationRequested)
            {
                throw new SolveTimeoutException();
            }
        }
        finally
        {
            gate.Release();
        }
    }

    private static SolveResponse Solve(SolveRequest request, CancellationToken cancellationToken)
    {
        request.ValidateApiLimits();
        double[,] costs = request.ToRectangularCosts();
        BoundedTraceCollector? collector = request.TraceMode == TraceMode.Phases
            ? new BoundedTraceCollector()
            : null;
        var problem = new TransportProblem(request.Source, request.Target, costs);
        var options = new SolverOptions(request.MaxIterations, request.Threshold);
        SolverResult result = SinkhornSolver.Solve(
            problem,
            request.Regularization,
            request.Solver,
            options,
            collector,
            cancellationToken);
        SolverMetadata metadata = result.Metadata;

        return new SolveResponse(
            request.RequestId,
            metadata.Solver,
            metadata.ReferenceVersion,
            metadata.ReferenceCommit,
            new ResponseOptions(
                metadata.Regularization,
                metadata.EffectiveOptions.MaxIterations,
                metadata.EffectiveOptions.Threshold,
                metadata.PreprocessingPolicy),
            new InputTotals(metadata.SourceTotal, metadata.TargetTotal),
            ToDiagnostic(result.Plan),
            result.TransportCost,
            result.Termination,
            result.LastAttemptedIndex,
            result.AttemptedPairs,
            result.AcceptedPairs,
            result.Errors.Select(item => new ErrorResponse(item.Index, item.TargetL2)).ToArray(),
            new ScalingResponse(
                ToDiagnostic(result.Scaling.Source),
                ToDiagnostic(result.Scaling.Target),
                result.Scaling.IsLog),
            new ChecksResponse(
                result.Checks.Finite,
                result.Checks.Nonnegative,
                result.Checks.SourceL1,
                result.Checks.TargetL1,
                result.Checks.TotalMass,
                result.Checks.Usable),
            result.Warnings,
            collector?.Materialize(costs, request.Regularization) ?? EmptyTrace);
    }

    private static DiagnosticNumber[][] ToDiagnostic(double[,] matrix)
    {
        var result = new DiagnosticNumber[matrix.GetLength(0)][];
        for (int i = 0; i < result.Length; i++)
        {
            result[i] = new DiagnosticNumber[matrix.GetLength(1)];
            for (int j = 0; j < result[i].Length; j++)
            {
                result[i][j] = matrix[i, j];
            }
        }

        return result;
    }

    private static DiagnosticNumber[] ToDiagnostic(double[] values) =>
        values.Select(value => new DiagnosticNumber(value)).ToArray();
}

public interface ISolveSchedulingHook
{
    Task AfterGateAcquiredAsync(CancellationToken cancellationToken);
}

public sealed class NoOpSolveSchedulingHook : ISolveSchedulingHook
{
    public static NoOpSolveSchedulingHook Instance { get; } = new();

    private NoOpSolveSchedulingHook()
    {
    }

    public Task AfterGateAcquiredAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}

public interface ISolveDeadlineFactory
{
    CancellationTokenSource Create();
}

public sealed class SystemSolveDeadlineFactory : ISolveDeadlineFactory
{
    public static readonly TimeSpan DefaultComputeTimeout = TimeSpan.FromSeconds(30);

    public CancellationTokenSource Create() => new(DefaultComputeTimeout);
}

public sealed class SolveBusyException : Exception;

public sealed class SolveTimeoutException : Exception;
