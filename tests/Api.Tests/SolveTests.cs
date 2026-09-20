namespace Api.Tests;

using System.Net;
using System.Net.Http.Json;
using System.Net.Http.Headers;
using System.Net.Security;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;

public sealed class SolveTests : IClassFixture<WebApplicationFactory<Program>>
{
    private const string ExactRequest = """
        {"requestId":"example-1","source":[0.5,0.5],"target":[0.5,0.5],
         "costs":[[0,1],[1,0]],"regularization":1,"solver":"Basic",
         "maxIterations":1000,"threshold":1e-9,"traceMode":"Phases"}
        """;

    private readonly HttpClient client;

    public SolveTests(WebApplicationFactory<Program> factory)
    {
        client = factory.CreateClient();
    }

    [Fact]
    public async Task ExactBasicRequestReturnsUsableRealLibraryResult()
    {
        using HttpResponseMessage response = await client.PostAsync(
            "/api/solve",
            new StringContent(ExactRequest, Encoding.UTF8, "application/json"),
            TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using JsonDocument body = JsonDocument.Parse(await response.Content.ReadAsStreamAsync(
            TestContext.Current.CancellationToken));
        Assert.Equal("example-1", body.RootElement.GetProperty("requestId").GetString());
        Assert.Equal("Basic", body.RootElement.GetProperty("solver").GetString());
        Assert.Equal("0.9.6.post1", body.RootElement.GetProperty("referenceVersion").GetString());
        Assert.Equal(
            "85113e9a380f5fcf684c50c73c1ff6a164a7366e",
            body.RootElement.GetProperty("referenceCommit").GetString());
        JsonElement options = body.RootElement.GetProperty("options");
        Assert.Equal(1.0, options.GetProperty("regularization").GetDouble());
        Assert.Equal(1000, options.GetProperty("maxIterations").GetInt32());
        Assert.Equal(1e-9, options.GetProperty("threshold").GetDouble());
        Assert.Equal("none", options.GetProperty("preprocessingPolicy").GetString());
        JsonElement totals = body.RootElement.GetProperty("inputTotals");
        Assert.Equal(1.0, totals.GetProperty("source").GetDouble());
        Assert.Equal(1.0, totals.GetProperty("target").GetDouble());
        Assert.Equal("ThresholdMet", body.RootElement.GetProperty("termination").GetString());
        Assert.True(body.RootElement.GetProperty("checks").GetProperty("usable").GetBoolean());
    }

    [Fact]
    public async Task HealthReportsReadyAfterApplicationStartup()
    {
        using HttpResponseMessage response = await client.GetAsync(
            "/api/health",
            TestContext.Current.CancellationToken);
        string body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("{\"status\":\"ready\"}", body);
    }

    [Fact]
    public async Task RaggedCostMatrixReturnsBadRequest()
    {
        const string request = """
            {"requestId":"ragged","source":[0.5,0.5],"target":[0.5,0.5],
             "costs":[[0,1],[1]],"regularization":1,"solver":"Basic",
             "maxIterations":1000,"threshold":1e-9,"traceMode":"Phases"}
            """;

        using HttpResponseMessage response = await client.PostAsync(
            "/api/solve",
            new StringContent(request, Encoding.UTF8, "application/json"),
            TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task RequestBodyLargerThan256KiBReturnsPayloadTooLarge()
    {
        string request = $$"""
            {"requestId":"{{new string('x', (256 * 1024) + 1)}}","source":[1],"target":[1],
             "costs":[[0]],"regularization":1,"solver":"Basic",
             "maxIterations":1,"threshold":1e-9,"traceMode":"None"}
            """;

        using HttpResponseMessage response = await client.PostAsync(
            "/api/solve",
            new StringContent(request, Encoding.UTF8, "application/json"),
            TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, response.StatusCode);
    }

    [Fact]
    public async Task ChunkedRequestBodyLargerThan256KiBReturnsPayloadTooLarge()
    {
        string request = $$"""
            {"requestId":"{{new string('x', (256 * 1024) + 1)}}","source":[1],"target":[1],
             "costs":[[0]],"regularization":1,"solver":"Basic",
             "maxIterations":1,"threshold":1e-9,"traceMode":"None"}
            """;
        using var content = new ChunkedJsonContent(request);

        using HttpResponseMessage response = await client.PostAsync(
            "/api/solve",
            content,
            TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, response.StatusCode);
    }

    [Fact]
    public async Task BasicZeroSupportReturnsNumericalBreakdownResult()
    {
        var request = new
        {
            requestId = "zero-support",
            source = new[] { 1.0, 0.0 },
            target = new[] { 0.0, 1.0 },
            costs = new[] { new[] { 0.0, 1.0 }, new[] { 1.0, 0.0 } },
            regularization = 1.0,
            solver = "Basic",
            maxIterations = 1000,
            threshold = 1e-9,
            traceMode = "Phases",
        };

        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/solve",
            request,
            TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using JsonDocument body = JsonDocument.Parse(await response.Content.ReadAsStreamAsync(
            TestContext.Current.CancellationToken));
        Assert.Equal("NumericalBreakdown", body.RootElement.GetProperty("termination").GetString());
        Assert.False(body.RootElement.GetProperty("checks").GetProperty("usable").GetBoolean());
    }

    [Theory]
    [InlineData("\"solver\":0", "\"solver\":\"Basic\"")]
    [InlineData("\"traceMode\":0", "\"traceMode\":\"Phases\"")]
    public async Task EnumFieldsRejectNumericJsonValues(string replacement, string original)
    {
        string request = ExactRequest.Replace(original, replacement, StringComparison.Ordinal);

        using HttpResponseMessage response = await client.PostAsync(
            "/api/solve",
            new StringContent(request, Encoding.UTF8, "application/json"),
            TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task NullCostRowReturnsBadRequestInsteadOfServerFailure()
    {
        const string request = """
            {"requestId":"null-row","source":[0.5,0.5],"target":[0.5,0.5],
             "costs":[[0,1],null],"regularization":1,"solver":"Basic",
             "maxIterations":1000,"threshold":1e-9,"traceMode":"Phases"}
            """;

        using HttpResponseMessage response = await client.PostAsync(
            "/api/solve",
            new StringContent(request, Encoding.UTF8, "application/json"),
            TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [InlineData("\"source\":null", "\"source\":[0.5,0.5]")]
    [InlineData("\"target\":null", "\"target\":[0.5,0.5]")]
    [InlineData("\"costs\":null", "\"costs\":[[0,1],[1,0]]")]
    public async Task NullRequiredArraysReturnBadRequest(string replacement, string original)
    {
        string request = ExactRequest.Replace(original, replacement, StringComparison.Ordinal);

        using HttpResponseMessage response = await client.PostAsync(
            "/api/solve",
            new StringContent(request, Encoding.UTF8, "application/json"),
            TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private sealed class ChunkedJsonContent : HttpContent
    {
        private readonly byte[] payload;

        public ChunkedJsonContent(string json)
        {
            payload = Encoding.UTF8.GetBytes(json);
            Headers.ContentType = new MediaTypeHeaderValue("application/json");
        }

        protected override Task SerializeToStreamAsync(Stream stream, TransportContext? context) =>
            stream.WriteAsync(payload).AsTask();

        protected override bool TryComputeLength(out long length)
        {
            length = 0;
            return false;
        }
    }
}
