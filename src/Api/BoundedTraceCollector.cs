using Sinkhorn;

public sealed class BoundedTraceCollector : ITraceObserver
{
    public const int DefaultRetainedFrameLimit = 200;

    private readonly List<ObservedFrame> retained = [];
    private int currentIndex = -1;
    private int priorIndex = -2;
    private int stride = 1;

    public int ObservedCount { get; private set; }

    public void Observe(TraceFrame frame)
    {
        ObservedCount++;
        if (frame.Index >= 0 && frame.Index != currentIndex)
        {
            priorIndex = currentIndex;
            currentIndex = frame.Index;
        }

        if (frame.Phase == TracePhase.Restored)
        {
            for (int i = 0; i < retained.Count; i++)
            {
                if (retained[i].Frame.Index == frame.Index)
                {
                    retained[i] = retained[i] with { Rejected = true };
                }
            }
        }

        retained.Add(new ObservedFrame(Copy(frame), frame.Rejected));
        Compact();
    }

    public TraceResponse Materialize(double[,] costs, double regularization)
    {
        List<TraceFrameResponse> frames = retained
            .Select(item => ToResponse(item, costs, regularization))
            .ToList();
        int omitted = ObservedCount - frames.Count;
        string policy = omitted == 0
            ? "Every observed phase was retained within the 200-frame limit."
            : $"Initial, last accepted/current pair, and restoration evidence retained; " +
              $"interior indices use deterministic stride {stride}, leaving {omitted} explicit phase gaps.";
        return new TraceResponse(frames, ObservedCount, omitted, omitted > 0, policy);
    }

    private void Compact()
    {
        while (retained.Count > DefaultRetainedFrameLimit)
        {
            stride *= 2;
            retained.RemoveAll(item =>
                !IsEssential(item.Frame) &&
                item.Frame.Index % stride != 0);

            if (retained.Count > DefaultRetainedFrameLimit)
            {
                int oldestInterior = retained.FindIndex(item => !IsEssential(item.Frame));
                if (oldestInterior < 0)
                {
                    throw new InvalidOperationException("Required trace evidence exceeds the frame limit.");
                }

                retained.RemoveAt(oldestInterior);
            }
        }
    }

    private bool IsEssential(TraceFrame frame) =>
        frame.Phase is TracePhase.Initial or TracePhase.Restored ||
        frame.Index == currentIndex ||
        frame.Index == priorIndex;

    private TraceFrameResponse ToResponse(
        ObservedFrame observed,
        double[,] costs,
        double regularization)
    {
        TraceFrame frame = observed.Frame;
        bool isLog = frame.Solver == SolverKind.LogDomain;
        return new TraceFrameResponse(
            frame.Index,
            frame.Phase,
            frame.Solver,
            ToDiagnostic(frame.SourceScaling),
            ToDiagnostic(frame.TargetScaling),
            isLog,
            observed.Rejected,
            MaterializePlan(frame, costs, regularization))
        {
            Essential = IsEssential(frame),
        };
    }

    private static TraceFrame Copy(TraceFrame frame) => new(
        frame.Index,
        frame.Phase,
        frame.Solver,
        (double[])frame.SourceScaling.Clone(),
        (double[])frame.TargetScaling.Clone(),
        frame.Rejected);

    private static DiagnosticNumber[][] MaterializePlan(
        TraceFrame frame,
        double[,] costs,
        double regularization)
    {
        var result = new DiagnosticNumber[frame.SourceScaling.Length][];
        bool isLog = frame.Solver == SolverKind.LogDomain;
        for (int i = 0; i < result.Length; i++)
        {
            result[i] = new DiagnosticNumber[frame.TargetScaling.Length];
            for (int j = 0; j < result[i].Length; j++)
            {
                result[i][j] = isLog
                    ? Math.Exp(frame.SourceScaling[i] + frame.TargetScaling[j] - (costs[i, j] / regularization))
                    : frame.SourceScaling[i] * Math.Exp(costs[i, j] / -regularization) * frame.TargetScaling[j];
            }
        }

        return result;
    }

    private static DiagnosticNumber[] ToDiagnostic(double[] values) =>
        values.Select(value => new DiagnosticNumber(value)).ToArray();

    private sealed record ObservedFrame(TraceFrame Frame, bool Rejected);
}
