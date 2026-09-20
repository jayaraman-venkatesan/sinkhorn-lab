FROM node:24.19.0-bookworm-slim@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df AS web-build

WORKDIR /source
COPY web/package.json web/package-lock.json ./web/
RUN cd web && npm ci
COPY web ./web
COPY content ./content
COPY docs/research ./docs/research
RUN cd web && npm run build && \
    mkdir -p /licenses/npm && \
    find node_modules -type f \( -iname 'LICENSE*' -o -iname 'COPYING*' -o -iname 'NOTICE*' \) \
      -exec cp --parents '{}' /licenses/npm/ \;

FROM mcr.microsoft.com/dotnet/sdk:10.0.201@sha256:127d7d4d601ae26b8e04c54efb37e9ce8766931bded0ee59fcd799afd21d6850 AS api-build

WORKDIR /source
COPY global.json Directory.Build.props ./
COPY src/Api ./src/Api
COPY vendor/sinkhorn/Directory.Build.props ./vendor/sinkhorn/
COPY vendor/sinkhorn/src/Sinkhorn ./vendor/sinkhorn/src/Sinkhorn
RUN dotnet restore src/Api/Api.csproj --locked-mode
COPY --from=web-build /source/web/dist ./src/Api/wwwroot
RUN dotnet publish src/Api/Api.csproj -c Release --no-restore -o /out

FROM mcr.microsoft.com/dotnet/aspnet:10.0.3@sha256:aec87aa74ddf129da573fa69f42f229a23c953a1c6fdecedea1aa6b1fe147d76 AS runtime

WORKDIR /app
COPY --from=api-build /out ./
COPY LICENSE THIRD_PARTY_NOTICES.md /app/licenses/
COPY web/package-lock.json /app/licenses/npm-package-lock.json
COPY --from=web-build /licenses/npm /app/licenses/npm/
ENV ASPNETCORE_HTTP_PORTS=8080 \
    DOTNET_EnableDiagnostics=0
EXPOSE 8080
USER app
ENTRYPOINT ["dotnet", "Api.dll"]
