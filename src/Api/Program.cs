using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);
builder.Services.AddSingleton<SolveService>();
builder.Services.AddSingleton<ISolveSchedulingHook>(_ => NoOpSolveSchedulingHook.Instance);
builder.Services.AddSingleton<ISolveDeadlineFactory, SystemSolveDeadlineFactory>();
builder.Services.Configure<ApiResourceLimits>(_ => { });
builder.Services.ConfigureHttpJsonOptions(options => ConfigureJson(options.SerializerOptions));
builder.Services.AddProblemDetails();
WebApplication app = builder.Build();

app.UseExceptionHandler();
app.Use(async (context, next) =>
{
    ApiResourceLimits limits = context.RequestServices
        .GetRequiredService<IOptions<ApiResourceLimits>>()
        .Value;
    if (context.Request.Path == "/api/solve" &&
        context.Request.ContentLength is > 0 &&
        context.Request.ContentLength > limits.MaxRequestBytes)
    {
        context.Response.StatusCode = StatusCodes.Status413PayloadTooLarge;
        await context.Response.WriteAsJsonAsync(
            Problem("request-size-limit", StatusCodes.Status413PayloadTooLarge),
            cancellationToken: context.RequestAborted);
        return;
    }

    await next(context);
});

app.MapGet("/api/health", () => Results.Ok(new { status = "ready" }));
app.MapPost("/api/solve", SolveAsync);

app.Run();

static async Task<IResult> SolveAsync(
    HttpContext context,
    SolveService service,
    IOptions<ApiResourceLimits> configuredLimits)
{
    SolveRequest? request;
    try
    {
        JsonSerializerOptions options = new(JsonSerializerDefaults.Web)
        {
            UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
        };
        ConfigureJson(options);
        byte[] body = await ReadBodyWithinLimitAsync(
            context.Request.Body,
            configuredLimits.Value.MaxRequestBytes,
            context.RequestAborted);
        request = JsonSerializer.Deserialize<SolveRequest>(body, options);
        if (request is null)
        {
            return Results.BadRequest(Problem("invalid-request", StatusCodes.Status400BadRequest));
        }

        SolveResponse response = await service.SolveAsync(request, context.RequestAborted);
        return SerializeBounded(response, options, configuredLimits.Value.MaxResponseBytes);
    }
    catch (JsonException)
    {
        return Results.BadRequest(Problem("invalid-request", StatusCodes.Status400BadRequest));
    }
    catch (RequestBodyTooLargeException)
    {
        return Results.Json(
            Problem("request-size-limit", StatusCodes.Status413PayloadTooLarge),
            statusCode: StatusCodes.Status413PayloadTooLarge);
    }
    catch (ArgumentException exception)
    {
        return Results.BadRequest(Problem(
            "invalid-request",
            StatusCodes.Status400BadRequest,
            exception.Message));
    }
    catch (SolveBusyException)
    {
        return Results.Problem(
            statusCode: StatusCodes.Status429TooManyRequests,
            title: "solve-busy",
            type: "urn:sinkhorn:error:solve-busy");
    }
    catch (SolveTimeoutException)
    {
        return Results.Problem(
            statusCode: StatusCodes.Status408RequestTimeout,
            title: "compute-timeout",
            type: "urn:sinkhorn:error:compute-timeout");
    }
}

static async Task<byte[]> ReadBodyWithinLimitAsync(
    Stream body,
    int limit,
    CancellationToken cancellationToken)
{
    using var buffer = new MemoryStream(Math.Min(limit, 16 * 1024));
    var chunk = new byte[8192];
    while (true)
    {
        int read = await body.ReadAsync(chunk, cancellationToken);
        if (read == 0)
        {
            return buffer.ToArray();
        }

        if (buffer.Length + read > limit)
        {
            throw new RequestBodyTooLargeException();
        }

        await buffer.WriteAsync(chunk.AsMemory(0, read), cancellationToken);
    }
}

static IResult SerializeBounded(
    SolveResponse response,
    JsonSerializerOptions options,
    int maxResponseBytes)
{
    while (true)
    {
        byte[] payload = JsonSerializer.SerializeToUtf8Bytes(response, options);
        if (payload.Length <= maxResponseBytes)
        {
            return Results.Bytes(payload, "application/json; charset=utf-8");
        }

        int optionalIndex = response.Trace.Frames.FindIndex(frame => !frame.Essential);
        if (optionalIndex < 0)
        {
            return Results.Problem(
                statusCode: StatusCodes.Status500InternalServerError,
                title: "response-size-limit",
                type: "urn:sinkhorn:error:response-size-limit");
        }

        response.Trace.Frames.RemoveAt(optionalIndex);
        response = response with
        {
            Trace = response.Trace with
            {
                OmittedCount = response.Trace.OmittedCount + 1,
                Sampled = true,
                Policy = "Optional interior phases were removed for the response-size limit; final and failure evidence remains retained.",
            },
        };
    }
}

static void ConfigureJson(JsonSerializerOptions options)
{
    options.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    options.Converters.Add(new JsonStringEnumConverter(allowIntegerValues: false));
}

static object Problem(string label, int status, string? detail = null) => new
{
    type = $"urn:sinkhorn:error:{label}",
    title = label,
    status,
    detail,
};

public sealed class ApiResourceLimits
{
    public const int DefaultMaxRequestBytes = 256 * 1024;
    public const int DefaultMaxResponseBytes = 4 * 1024 * 1024;

    public int MaxRequestBytes { get; set; } = DefaultMaxRequestBytes;

    public int MaxResponseBytes { get; set; } = DefaultMaxResponseBytes;
}

public sealed class RequestBodyTooLargeException : Exception;

public partial class Program;
