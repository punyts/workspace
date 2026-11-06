# workspace
The development workspace for the punyts system. Each library is its own repo, cloned into this folder on `develop`
and listed in the npm `workspaces`, so the libraries install, build and test together and on their own.

## Setup

You need Node 22 or later, npm and git; nothing else (the scripts are plain Node, so cmd, PowerShell, macOS and
Linux all work).

```bash
git clone -b develop https://github.com/punyts/workspace.git punyts
cd punyts
npm run setup     # clone every library repo on develop, install, build, and install Chromium for the browser tests
```

`npm run setup` is safe to run again: it skips the repos that are already cloned.

## Commands

| Command | What it does |
|---------|--------------|
| `npm run setup` | Clone the missing library repos (`npm run clone`), `npm install`, `npm run build`, and install Playwright's Chromium |
| `npm run build` | `npm run build` in every library, in build order, then `build:runtime-bundle` of `stateui-app` (the `stateui-mcp` tests and the host page need it) |
| `npm test` | Every library's node tests |
| `npm run typecheck` | Every library's type check |
| `npm run mcp:build` | Build only `stateui-mcp` and the libraries it uses, then the runtime bundle |
| `npm run mcp` | Start the StateUI MCP server: apps at http://127.0.0.1:4100/, MCP at http://127.0.0.1:4100/mcp, data in `stateui-mcp/data` |
| `npm run --silent mcp:stdio` | The same server, also speaking MCP on stdio, for a client that starts it (`--silent` keeps npm's output off stdout) |
| `npm run status` | Branch, changed files and unpushed commits of the workspace and each library repo |
| `node bin/workspace.mjs run <script> [library...]` | One npm script in the libraries that have it; stops at the first failure |

Browser tests run per library: `npm run test:browser -w @punyts/stateui-components`.

## StateUI MCP server

`npm run mcp` serves the MCP server over HTTP; `STATEUI_MCP_PORT`, `STATEUI_MCP_DATA_DIR` and the other
`STATEUI_MCP_*` variables change its settings (`node stateui-mcp/dist/cli.js --help` lists them). `.mcp.json` points
Claude Code sessions in this folder at http://127.0.0.1:4100/mcp, and `.claude/launch.json` starts the server from the
Claude desktop app's preview pane. Rebuild with `npm run mcp:build` after changing a library the server uses, then
restart it.

## Versions

`overrides` pins Playwright, vitest and vite to the versions in ai-minion's lockfile, so tests here run with the same
tools and in the same Chromium as there. Move them together with ai-minion's.

## ai-minion

ai-minion links its `libraries/<name>` to these repos (`bash bin/clone-libraries.sh --link` in ai-minion, which
expects this workspace at `../../punyts` from its repo root), so both build against the same checkouts. A library
`package.json` dependency change needs ai-minion's lockfile regenerated: `npx npm@10 install --package-lock-only`
there.

## stateui-3d

`stateui-3d` (graphics epic 3, `github.com/punyts/stateui-3d`) has no `package.json` until story G3.2, so it is not in
the npm `workspaces` (the repo list) yet: clone it by hand (`git clone -b develop https://github.com/punyts/stateui-3d.git`).
