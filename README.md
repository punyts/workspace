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
| `npm run mcp:build` | Build only `stateui-mcp` and the libraries it uses (`statenet` included), then the runtime bundle |
| `npm run mcp` | Start what the StateUI live views need: the statenet at ws://127.0.0.1:4200/sync (data in `stateui-mcp/statenet-data`) and the Vite dev server of the view page at http://127.0.0.1:5180/ (the runtime frame on 5181) |
| `npm run --silent mcp:stdio` | The StateUI MCP server on stdio, for a client that starts it (`--silent` keeps npm's output off stdout); data in `stateui-mcp/data` |
| `npm run magnetic:build` | Build Magnetic and the libraries it uses, then the runtime bundle |
| `npm run ui:build` | Build only the UI layers, in order (`stateui`, `stateui-app`, `stateui-components`, `stateui-mcp`, `magnetic`), then the runtime bundle: about 20 s, for a change to a component, the engine or the editor. The bundle must follow the components, or it ships their old CSS |
| `npm run magnetic:dev` | `npm run ui:build`, then start Magnetic as `npm run magnetic` does |
| `npm run magnetic:live` | Start Magnetic with the real agent (Claude, through the Anthropic API) instead of the scripted one, with the same development users. It reads `ANTHROPIC_API_KEY` from `.env` at the workspace root, which git ignores: copy `.env.example` to `.env` and fill in the key. Each person may spend $1 a day and the server $100 a month by default (`--daily-budget`, `--monthly-budget`) |
| `npm run magnetic` | Start Magnetic at http://127.0.0.1:4300/ with the development users alice and bob, a mock sign-in provider and the scripted mock agent (no API key needed), data in `magnetic/data` |
| `npm run status` | Branch, changed files and unpushed commits of the workspace and each library repo |
| `node bin/workspace.mjs run <script> [library...]` | One npm script in the libraries that have it; stops at the first failure |

Browser tests run per library: `npm run test:browser -w @punyts/stateui-components`.

## StateUI MCP server

The MCP server serves no HTTP. It speaks MCP on stdio, and its tools write each app's live state to a statenet; the
view page that shows the apps is static (the Vite dev server of `stateui-mcp/view/` locally, a CDN in production) and
reads the state from that statenet. Three processes, then:

| Process | Port | Started by |
|---------|------|------------|
| statenet | 4200 (`ws://127.0.0.1:4200/sync`) | `npm run mcp` |
| Vite: the view page, and the runtime frame on a second origin | 5180, 5181 | `npm run mcp` |
| the MCP server | none (stdio) | the MCP client, through `.mcp.json` |

Start `npm run mcp` once, then open Claude Code in this folder: `.mcp.json` starts `node stateui-mcp/dist/cli.js` on
stdio. `ui_preview` answers the address of an app's view, such as `http://127.0.0.1:5180/?app=<id>&statenet=…`, and
http://127.0.0.1:5180/ lists the apps. The MCP server keeps working while the statenet is down and catches the views up
when it is back. `STATEUI_MCP_DATA_DIR`, `STATEUI_MCP_STATENET`, `STATEUI_MCP_VIEW_URL` and the other `STATEUI_MCP_*`
variables change its settings (`node stateui-mcp/dist/cli.js --help` lists them). `.claude/launch.json` starts
`npm run mcp` from the Claude desktop app's preview pane. Rebuild with `npm run mcp:build` after changing a library
the server uses, then restart the MCP server (`/mcp` in Claude Code).

## Versions

`overrides` pins Playwright, vitest and vite to the versions in ai-minion's lockfile, so tests here run with the same
tools and in the same Chromium as there. Move them together with ai-minion's.

## ai-minion

ai-minion links its `libraries/<name>` to these repos (`bash bin/clone-libraries.sh --link` in ai-minion, which
expects this workspace at `../../punyts` from its repo root), so both build against the same checkouts. A library
`package.json` dependency change needs ai-minion's lockfile regenerated: `npx npm@10 install --package-lock-only`
there.

## stateui-3d

`stateui-3d` (graphics epic 3, `github.com/punyts/stateui-3d`) is in the npm `workspaces` since story G3.2. It depends
on no other punyts library, so it builds early, and `stateui-mcp` takes it as an optional dependency (from G3.3 the server serves
its runtime chunk, `stateui-3d/dist/runtime-chunk/`), so `npm run mcp:build` builds it too (the view page's runtime origin serves the chunk). It brings `three` into
the workspace lockfile.
