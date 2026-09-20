namespace Api.Tests;

using System.Net;
using System.Text;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

public sealed class ConcurrencyTests
{
    private const string ValidRequest = """
        {"requestId":"concurrent","source":[0.5,0.5],"target":[0.5,0.5],
         "costs":[[0,1],[1,0]],"regularization":1,"solver":"Basic",
         "maxIterations":1000,"threshold":1e-9,"traceMode":"None"}
        """;

    [Fact]
    public async Task SecondRequestReturnsBusyWithoutWaiting()
    {
        var hook = new OneShotBlockingHook();
        await using var factory = new HookedFactory(hook);
        using HttpClient client = factory.CreateClient();
        Task<HttpResponseMessage> first = Post(client, ValidRequest, TestContext.Current.CancellationToken);
        await hook.Entered;

        using HttpResponseMessage second = await Post(
            client,
            ValidRequest,
            TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.TooManyRequests, second.StatusCode);
        hook.Release();
        using HttpResponseMessage completed = await first;
        Assert.Equal(HttpStatusCode.OK, completed.StatusCode);
    }

    [Fact]
    public async Task RequestCancellationReleasesGateWithoutSynthesizingAResult()
    {
        var hook = new OneShotBlockingHook();
        await using var factory = new HookedFactory(hook);
        using HttpClient client = factory.CreateClient();
        using var cancellation = new CancellationTokenSource();
        Task<HttpResponseMessage> canceled = Post(client, ValidRequest, cancellation.Token);
        await hook.Entered;

        cancellation.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => canceled);
        using HttpResponseMessage next = await Post(
            client,
            ValidRequest,
            TestContext.Current.CancellationToken);
        Assert.Equal(HttpStatusCode.OK, next.StatusCode);
    }

    [Fact]
    public async Task ValidationFailureReleasesGate()
    {
        await using var factory = new WebApplicationFactory<Program>();
        using HttpClient client = factory.CreateClient();
        const string invalid = """
            {"requestId":"bad","source":[1],"target":[1],"costs":[[0,1]],
             "regularization":1,"solver":"Basic","maxIterations":1,
             "threshold":1e-9,"traceMode":"None"}
            """;

        using HttpResponseMessage failed = await Post(
            client,
            invalid,
            TestContext.Current.CancellationToken);
        using HttpResponseMessage next = await Post(
            client,
            ValidRequest,
            TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.BadRequest, failed.StatusCode);
        Assert.Equal(HttpStatusCode.OK, next.StatusCode);
    }

    [Fact]
    public async Task ComputeDeadlineReturnsLabelledRequestTimeout()
    {
        await using var factory = new DeadlineFactory();
        using HttpClient client = factory.CreateClient();

        using HttpResponseMessage response = await Post(
            client,
            ValidRequest,
            TestContext.Current.CancellationToken);
        string body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.RequestTimeout, response.StatusCode);
        Assert.Contains("compute-timeout", body, StringComparison.Ordinal);
    }

    [Fact]
    public async Task UnexpectedFailureReturnsGeneric500AndReleasesGate()
    {
        var hook = new OneShotThrowingHook();
        await using var factory = new HookedFactory(hook);
        using HttpClient client = factory.CreateClient();

        using HttpResponseMessage failed = await Post(
            client,
            ValidRequest,
            TestContext.Current.CancellationToken);
        string failureBody = await failed.Content.ReadAsStringAsync(
            TestContext.Current.CancellationToken);
        using HttpResponseMessage next = await Post(
            client,
            ValidRequest,
            TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.InternalServerError, failed.StatusCode);
        Assert.DoesNotContain("sensitive-internal-detail", failureBody, StringComparison.Ordinal);
        Assert.Equal(HttpStatusCode.OK, next.StatusCode);
    }

    private static Task<HttpResponseMessage> Post(
        HttpClient client,
        string json,
        CancellationToken cancellationToken) => client.PostAsync(
            "/api/solve",
            new StringContent(json, Encoding.UTF8, "application/json"),
            cancellationToken);

    private sealed class HookedFactory(ISolveSchedulingHook hook) : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<ISolveSchedulingHook>();
                services.AddSingleton(hook);
            });
        }
    }

    private sealed class DeadlineFactory : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<ISolveDeadlineFactory>();
                services.AddSingleton<ISolveDeadlineFactory, AlreadyElapsedDeadline>();
            });
        }
    }

    private sealed class OneShotBlockingHook : ISolveSchedulingHook
    {
        private readonly TaskCompletionSource entered = new(TaskCreationOptions.RunContinuationsAsynchronously);
        private readonly TaskCompletionSource release = new(TaskCreationOptions.RunContinuationsAsynchronously);
        private int calls;

        public Task Entered => entered.Task;

        public async Task AfterGateAcquiredAsync(CancellationToken cancellationToken)
        {
            if (Interlocked.Increment(ref calls) != 1)
            {
                return;
            }

            entered.SetResult();
            await release.Task.WaitAsync(cancellationToken);
        }

        public void Release() => release.TrySetResult();
    }

    private sealed class AlreadyElapsedDeadline : ISolveDeadlineFactory
    {
        public CancellationTokenSource Create()
        {
            var cancellation = new CancellationTokenSource();
            cancellation.Cancel();
            return cancellation;
        }
    }

    private sealed class OneShotThrowingHook : ISolveSchedulingHook
    {
        private int calls;

        public Task AfterGateAcquiredAsync(CancellationToken cancellationToken)
        {
            if (Interlocked.Increment(ref calls) == 1)
            {
                throw new InvalidOperationException("sensitive-internal-detail");
            }

            return Task.CompletedTask;
        }
    }
}
