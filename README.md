# sinkhorn-lab

Status: in development. The first API integration is implemented on the feature
branch; the complete learning application and distribution verification remain open.

Interactive optimal-transport lessons and a playground backed by the actual C# library.

- [Approved specification](docs/superpowers/specs/2026-09-19-sinkhorn-learning-design.md)
- [Implementation plans](docs/superpowers/plans/2026-09-19-sinkhorn-tickets.md)
- [Project issues](https://github.com/jayaraman-venkatesan/sinkhorn-lab/issues)

Development uses isolated feature worktrees and test-first subagent tasks.
Runnable usage and container instructions will be added with their verified implementation.

## Local API development

Initialize submodules, then use the pinned .NET 10 SDK:

```sh
git submodule update --init --recursive
/Users/jayaramanvenkatesan/.dotnet/dotnet restore --locked-mode
/Users/jayaramanvenkatesan/.dotnet/dotnet test -c Release
/Users/jayaramanvenkatesan/.dotnet/dotnet run --project src/Api/Api.csproj
```

`GET /api/health` returns `{"status":"ready"}` after startup. `POST /api/solve`
invokes the pinned library directly; see [the API contract](docs/api.md) for its
wire schema, limits, numerical-status semantics, and transport errors.
