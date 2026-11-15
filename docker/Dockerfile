# Magnetic and the statenet relay, built from the workspace (docs/design/statenet-relays.md, "Topology, in steps").
# Build from the workspace root: docker build -f docker/Dockerfile -t punyts/magnetic .
# The image runs `magnetic` (serve, migrate, relay-certificate, ...); `statenet-relay` is `node statenet/dist/relayCli.js`.
FROM node:22-bookworm-slim AS build
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
WORKDIR /punyts
COPY . .
RUN npm ci --no-audit --no-fund
RUN node bin/workspace.mjs run build core expression state state-sync statenet stateui stateui-3d stateui-app stateui-components stateui-mcp stateui-pg magnetic \
    && npm run build:runtime-bundle -w @punyts/stateui-app

FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /punyts
COPY --from=build /punyts /punyts
# Pages, the runtime origin, and the mesh the other servers and relays link to
EXPOSE 4300 4301 4310
ENTRYPOINT ["node", "magnetic/dist/cli.js"]
