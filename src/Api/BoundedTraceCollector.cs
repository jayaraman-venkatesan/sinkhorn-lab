using Sinkhorn;

public sealed class BoundedTraceCollector : ITraceObserver
{
    public const int DefaultRetainedFrameLimit = 200;

    private readonly int retainedFrameLimit;
    private readonly List<RetainedFrame> frames = [];
    private int currentIndex = -1;
    private int previousIndex = -2;
    private int stride = 1;

    public BoundedTraceCollector(int retainedFrameLimit = DefaultRetainedFrameLimit)
    {
        if (retainedFrameLimit < 5)
        {
            throw new ArgumentOutOfRangeException(
                nameof(retainedFrameLimit),
                "At least five slots are needed for required trace evidence.");
        }

        this.retainedFrameLimit = retainedFrameLimit;
    }

    public int ObservedCount { get; private set; }

    public void Observe(TraceFrame frame)
    {
        ObservedCount++;
        if (frame.Index >= 0 && frame.Index != currentIndex)
        {
            previousIndex = currentIndex;
            currentIndex = frame.Index;
        }

        if (frame.Phase == TracePhase.Restored)
        {
            for (int i = 0; i < frames.Count; i++)
            {
                if (frames[i].Frame.Index == frame.Index)
                {
                    frames[i] = frames[i] with { Rejected = true };
                }
            }
        }

        frames.Add(new RetainedFrame(Copy(frame), frame.Rejected));
        Compact();
    }

    public TraceResponse Materialize(double[,] costs, double regularization)
    {
        List<TraceFrameResponse> result = frames
            .Select(item => ToResponse(item, costs, regularization))
            .ToList();
        int omitted = ObservedCount - result.Count;
        string policy = omitted == 0
            ? "All observed phases retained within the bounded collector."
            : $"Initial, latest accepted/current pair, and restoration evidence retained; " +
              $"interior iteration indices sampled at deterministic stride {stride}; explicit gaps account for {omitted} omitted phases.";
        return new TraceResponse(result, ObservedCount, omitted, omitted > 0, policy);
    }

    private void Compact()
    {
        while (frames.Count > retainedFrameLimit)
        {
            stride *= 2;
            frames.RemoveAll(item =>
                !IsEssential(item.Frame) && item.Frame.Index % stride != 0);

            if (frames.Count > retainedFrameLimit)
            {
                int removable = frames.FindIndex(item => !IsEssential(item.Frame));
                if (removable < 0)
                {
                    throw new InvalidOperationException("Required trace evidence exceeds the retention limit.");
                }

                frames.RemoveAt(removable);
            }
        }
    }

    private bool IsEssential(TraceFrame frame) =>
        frame.Phase == TracePhase.Initial ||
        frame.Phase == TracePhase.Restored ||
        frame.Index == currentIndex ||
        frame.Index == previousIndex;

    private TraceFrameResponse ToResponse(
        RetainedFrame retained,
        double[,] costs,
        double regularization)
    {
        TraceFrame frame = retained.Frame;
        bool isLog = frame.Solver == SolverKind.LogDomain;
        return new TraceFrameResponse(
            frame.Index,
            frame.Phase,
            frame.Solver,
            ToDiagnostic(frame.SourceScaling),
            ToDiagnostic(frame.TargetScaling),
            isLog,
            retained.Rejected,
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
                double exponent = isLog
                    ? frame.SourceScaling[i] + frame.TargetScaling[j] - (costs[i, j] / regularization)
                    : 0.0;
                double value = isLog
                    ? Math.Exp(exponent)
                    : frame.SourceScaling[i] * Math.Exp(costs[i, j] / -regularization) * frame.TargetScaling[j];
                result[i][j] = value;
            }
        }

        return result;
    }

    private static DiagnosticNumber[] ToDiagnostic(double[] values) =>
        values.Select(value => new DiagnosticNumber(value)).ToArray();

    private sealed record RetainedFrame(TraceFrame Frame, bool Rejected);
}
