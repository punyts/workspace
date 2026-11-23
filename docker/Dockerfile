# Magnetic and the statenet relay, built from the workspace (docs/design/statenet-relays.md, "Topology, in steps").
# Build from the workspace root: docker build -f docker/Dockerfile -t punyts/magnetic .
# The image runs `magnetic` (serve, migrate, relay-certificate, ...); `statenet-relay` is `node statenet/dist/relayCli.js`.
FROM node:22-bookworm-slim AS build
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
WORKDIR /punyts
COPY . .
RUN npm ci --no-audit --no-fund
# The runtime of the local embedding model (MAGNETIC_EMBEDDING=local), which the workspace leaves optional: without it
# semantic search is off. The model itself is fetched on first use into MAGNETIC_MODEL_CACHE
RUN npm install --no-save --no-audit --no-fund --workspaces=false @huggingface/transformers@4.3.2
RUN node bin/workspace.mjs run build core expression state state-sync statenet stateui stateui-3d stateui-app stateui-components stateui-mcp stateui-pg magnetic \
    && npm run build:runtime-bundle -w @punyts/stateui-app

FROM node:22-bookworm-slim
ENV NODE_ENV=production
# The agent's headless browser (docs/design/magnetic-agent-browser.md): Chromium's headless shell and the system
# libraries it needs, at the root's pinned Playwright, before the code so the layer is kept between builds. Playwright
# starts it without the sandbox, which needs a user namespace the container does not have
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx -y playwright@1.61.1 install --with-deps --only-shell chromium     && rm -rf /var/lib/apt/lists/* /root/.npm
WORKDIR /punyts
COPY --from=build /punyts /punyts
# Pages, the runtime origin, and the mesh the other servers and relays link to
EXPOSE 4300 4301 4310
ENTRYPOINT ["node", "magnetic/dist/cli.js"]
