using Sinkhorn;

public sealed record SolveRequest
{
    public required string RequestId { get; init; }

    public required double[] Source { get; init; }

    public required double[] Target { get; init; }

    public required double[][] Costs { get; init; }

    public required double Regularization { get; init; }

    public required SolverKind Solver { get; init; }

    public required int MaxIterations { get; init; }

    public required double Threshold { get; init; }

    public required TraceMode TraceMode { get; init; }

    public double[,] ToRectangularCosts()
    {
        if (Costs is null)
        {
            throw new ArgumentNullException(nameof(Costs));
        }

        int rows = Costs.Length;
        int columns = rows == 0 || Costs[0] is null ? 0 : Costs[0].Length;
        var result = new double[rows, columns];
        for (int i = 0; i < rows; i++)
        {
            if (Costs[i] is null || Costs[i].Length != columns)
            {
                throw new ArgumentException("Cost rows must all have the same length.", nameof(Costs));
            }

            for (int j = 0; j < columns; j++)
            {
                result[i, j] = Costs[i][j];
            }
        }

        return result;
    }

    public void ValidateApiLimits()
    {
        if (string.IsNullOrWhiteSpace(RequestId) || RequestId.Length > 256)
        {
            throw new ArgumentException("requestId must contain 1 to 256 characters.", nameof(RequestId));
        }

        if (Source is null || Target is null || Costs is null)
        {
            throw new ArgumentException("source, target, and costs must not be null.");
        }

        if (Source.Length is < 1 or > 8 || Target.Length is < 1 or > 8)
        {
            throw new ArgumentException("source and target must each contain 1 to 8 entries.");
        }

        if (Costs.Length != Source.Length)
        {
            throw new ArgumentException("costs must have one row per source entry.", nameof(Costs));
        }

        _ = ToRectangularCosts();
        if (Costs.Any(row => row is null || row.Length != Target.Length))
        {
            throw new ArgumentException("costs must have one column per target entry.", nameof(Costs));
        }

        if (MaxIterations is < 1 or > 1000)
        {
            throw new ArgumentOutOfRangeException(nameof(MaxIterations), "maxIterations must be between 1 and 1000.");
        }
    }
}

public enum TraceMode
{
    None,
    Phases,
}
