namespace Api.Tests;

using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Sinkhorn;

public sealed class TraceLimitTests
{
    [Fact]
    public void CollectorStaysBoundedAcrossMoreThanTwoThousandObservedPhases()
    {
        var collector = new BoundedTraceCollector();
        collector.Observe(Frame(-1, TracePhase.Initial));

        for (int index = 0; index < 1001; index++)
        {
            collector.Observe(Frame(index, TracePhase.AfterDestination));
            collector.Observe(Frame(index, TracePhase.AfterSource));
            Assert.InRange(
                collector.Materialize(new double[,] { { 0.0 } }, 1.0).Frames.Count,
                1,
                BoundedTraceCollector.DefaultRetainedFrameLimit);
        }

        TraceResponse trace = collector.Materialize(new double[,] { { 0.0 } }, 1.0);
        Assert.Equal(2003, trace.ObservedCount);
        Assert.Equal(trace.ObservedCount - trace.Frames.Count, trace.OmittedCount);
        Assert.True(trace.Sampled);
        Assert.Contains("stride", trace.Policy, StringComparison.Ordinal);
        Assert.Contains(trace.Frames, frame => frame.Phase == TracePhase.Initial);
        Assert.Contains(trace.Frames, frame => frame.Index == 999);
        Assert.Contains(trace.Frames, frame => frame.Index == 1000);
    }

    [Fact]
    public async Task BasicRollbackPhasesAreOrderedAndRejected()
    {
        await using var factory = new WebApplicationFactory<Program>();
        using HttpClient client = factory.CreateClient();
        const string request = """
            {"requestId":"rollback","source":[1,0],"target":[0,1],
             "costs":[[0,1],[1,0]],"regularization":1,"solver":"Basic",
             "maxIterations":1000,"threshold":1e-9,"traceMode":"Phases"}
            """;

        using HttpResponseMessage response = await client.PostAsync(
            "/api/solve",
            new StringContent(request, Encoding.UTF8, "application/json"),
            TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using JsonDocument body = JsonDocument.Parse(await response.Content.ReadAsStreamAsync(
            TestContext.Current.CancellationToken));
        JsonElement.ArrayEnumerator frames = body.RootElement
            .GetProperty("trace")
            .GetProperty("frames")
            .EnumerateArray();
        var phases = new List<string>();
        var rejected = new List<bool>();
        foreach (JsonElement frame in frames)
        {
            phases.Add(frame.GetProperty("phase").GetString()!);
            rejected.Add(frame.GetProperty("rejected").GetBoolean());
        }

        Assert.Equal(
            ["Initial", "AfterDestination", "AfterSource", "Restored"],
            phases);
        Assert.Equal([false, true, true, false], rejected);
    }

    [Fact]
    public void TracingDoesNotChangeRealLibraryResult()
    {
        var problem = new TransportProblem(
            [0.4, 0.6],
            [0.2, 0.3, 0.5],
            new double[,] { { 0.0, 1.0, 2.0 }, { 1.0, 0.0, 1.0 } });
        var collector = new BoundedTraceCollector();

        SolverResult withoutTrace = SinkhornSolver.Solve(
            problem,
            0.7,
            SolverKind.LogDomain,
            cancellationToken: TestContext.Current.CancellationToken);
        SolverResult withTrace = SinkhornSolver.Solve(
            problem,
            0.7,
            SolverKind.LogDomain,
            observer: collector,
            cancellationToken: TestContext.Current.CancellationToken);

        Assert.Equal(withoutTrace.Termination, withTrace.Termination);
        Assert.Equal(withoutTrace.LastAttemptedIndex, withTrace.LastAttemptedIndex);
        Assert.Equal(withoutTrace.TransportCost, withTrace.TransportCost);
        Assert.Equal(Flatten(withoutTrace.Plan), Flatten(withTrace.Plan));
    }

    [Fact]
    public void DiagnosticNumbersUseExplicitNonfiniteTags()
    {
        Assert.Equal("{\"nonFinite\":\"NaN\"}", JsonSerializer.Serialize(new DiagnosticNumber(double.NaN)));
        Assert.Equal(
            "{\"nonFinite\":\"PositiveInfinity\"}",
            JsonSerializer.Serialize(new DiagnosticNumber(double.PositiveInfinity)));
        Assert.Equal(
            "{\"nonFinite\":\"NegativeInfinity\"}",
            JsonSerializer.Serialize(new DiagnosticNumber(double.NegativeInfinity)));
        Assert.Equal("1.25", JsonSerializer.Serialize(new DiagnosticNumber(1.25)));
    }

    [Fact]
    public async Task OptionalFramesAreRemovedBeforeAConfiguredResponseCapIsExceeded()
    {
        const int cap = 12000;
        await using var factory = new CappedFactory(cap);
        using HttpClient client = factory.CreateClient();
        const string request = """
            {"requestId":"cap","source":[0.9,0.1],"target":[0.1,0.9],
             "costs":[[0,1],[1,0]],"regularization":0.0001,"solver":"LogDomain",
             "maxIterations":1000,"threshold":1e-9,"traceMode":"Phases"}
            """;

        using HttpResponseMessage response = await client.PostAsync(
            "/api/solve",
            new StringContent(request, Encoding.UTF8, "application/json"),
            TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        byte[] payload = await response.Content.ReadAsByteArrayAsync(TestContext.Current.CancellationToken);
        Assert.InRange(payload.Length, 1, cap);
        using JsonDocument body = JsonDocument.Parse(payload);
        JsonElement trace = body.RootElement.GetProperty("trace");
        Assert.True(trace.GetProperty("sampled").GetBoolean());
        Assert.True(trace.GetProperty("omittedCount").GetInt32() > 0);
        Assert.Equal(
            trace.GetProperty("observedCount").GetInt32(),
            trace.GetProperty("frames").GetArrayLength() + trace.GetProperty("omittedCount").GetInt32());
    }

    [Fact]
    public async Task MandatoryOutputOverflowReturnsLabelledProblemInsteadOfPartialJson()
    {
        await using var factory = new CappedFactory(1);
        using HttpClient client = factory.CreateClient();
        const string request = """
            {"requestId":"mandatory-cap","source":[1],"target":[1],"costs":[[0]],
             "regularization":1,"solver":"Basic","maxIterations":1,
             "threshold":1e-9,"traceMode":"None"}
            """;

        using HttpResponseMessage response = await client.PostAsync(
            "/api/solve",
            new StringContent(request, Encoding.UTF8, "application/json"),
            TestContext.Current.CancellationToken);
        string body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.Contains("response-size-limit", body, StringComparison.Ordinal);
        Assert.DoesNotContain("mandatory-cap", body, StringComparison.Ordinal);
    }

    [Fact]
    public void DefaultResourceLimitsMatchTheApprovedContract()
    {
        var limits = new ApiResourceLimits();

        Assert.Equal(256 * 1024, limits.MaxRequestBytes);
        Assert.Equal(4 * 1024 * 1024, limits.MaxResponseBytes);
        Assert.Equal(TimeSpan.FromSeconds(30), SystemSolveDeadlineFactory.DefaultComputeTimeout);
    }

    private static TraceFrame Frame(int index, TracePhase phase) =>
        new(index, phase, SolverKind.Basic, [1.0], [1.0], false);

    private static double[] Flatten(double[,] matrix)
    {
        var values = new double[matrix.Length];
        int offset = 0;
        for (int row = 0; row < matrix.GetLength(0); row++)
        {
            for (int column = 0; column < matrix.GetLength(1); column++)
            {
                values[offset++] = matrix[row, column];
            }
        }

        return values;
    }

    private sealed class CappedFactory(int cap) : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.ConfigureServices(services => services.Configure<ApiResourceLimits>(
                limits => limits.MaxResponseBytes = cap));
        }
    }
}
