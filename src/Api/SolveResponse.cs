using System.Text.Json.Serialization;
using Sinkhorn;

public sealed record SolveResponse(
    string RequestId,
    SolverKind Solver,
    string ReferenceVersion,
    string ReferenceCommit,
    ResponseOptions Options,
    InputTotals InputTotals,
    DiagnosticNumber[][] Plan,
    DiagnosticNumber TransportCost,
    TerminationReason Termination,
    int LastAttemptedIndex,
    int AttemptedPairs,
    int AcceptedPairs,
    ErrorResponse[] Errors,
    ScalingResponse Scaling,
    ChecksResponse Checks,
    string[] Warnings,
    TraceResponse Trace);

public sealed record ResponseOptions(
    DiagnosticNumber Regularization,
    int MaxIterations,
    DiagnosticNumber Threshold,
    string PreprocessingPolicy);

public sealed record InputTotals(DiagnosticNumber Source, DiagnosticNumber Target);

public sealed record ErrorResponse(int Index, DiagnosticNumber TargetL2);

public sealed record ScalingResponse(
    DiagnosticNumber[] Source,
    DiagnosticNumber[] Target,
    bool IsLog);

public sealed record ChecksResponse(
    bool Finite,
    bool Nonnegative,
    DiagnosticNumber SourceL1,
    DiagnosticNumber TargetL1,
    DiagnosticNumber TotalMass,
    bool Usable);

public sealed record TraceResponse(
    List<TraceFrameResponse> Frames,
    int ObservedCount,
    int OmittedCount,
    bool Sampled,
    string Policy);

public sealed record TraceFrameResponse(
    int Index,
    TracePhase Phase,
    SolverKind Solver,
    DiagnosticNumber[] SourceScaling,
    DiagnosticNumber[] TargetScaling,
    bool IsLog,
    bool Rejected,
    DiagnosticNumber[][] Plan)
{
    [JsonIgnore]
    public bool Essential { get; init; }
}
