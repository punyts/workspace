# The agent sees the page

Status: designed 2026-11-22; building on this machine ([../work-split.md](../work-split.md)).

Asked for on 2026-11-22, after the list of what is left ("The agent cannot see the page" first among Magnetic's): "Let's
do all of what you think we should do here."

Magnetic's agent builds apps with `ui_validate` as its only check. `ui_preview`, `ui_screenshot` and `ui_interact` are
withheld (`WITHHELD_TOOLS` in `magnetic/src/agent/AgentTurns.ts`), and the image has no Chromium. Two things kept them
out (`magnetic/README.md`, "Not yet"): each workspace would start its own Chromium, and its headless page cannot sign in
to reach the app.

## The design

### One Chromium per server, a context per workspace

stateui-mcp's `BrowserPreview` launches a Chromium and opens one page per app. It gains a page source: a function that
answers a new page. Without one it launches its own browser as today. stateui-mcp exports a `SharedChromium`: one
headless Chromium, started on first use, and one browser context per key, each with its own cookies and storage.
Magnetic makes one `SharedChromium` per server and hands each workspace a page source from the context keyed by that
workspace.

Memory is the constraint: the host is a t3.small with 2 GB and runs two Magnetic servers. So:

- A context closes after 10 minutes without a tool call, and Chromium closes when no context is open. An idle server
  holds no browser.
- At most 4 contexts are open per server; opening a fifth closes the one used longest ago.
- At most 3 pages per context; the oldest closes first.

### The headless page signs in as an agent

The headless page loads the server it runs in, over loopback (`http://127.0.0.1:4300/apps/<id>`), not the public name.
Caddy routes the public name to either server by a sticky cookie, and the live-view hub that waits for the page's
render is in the memory of the server that opened it.

Before the context opens a page, Magnetic mints an **agent session** for the workspace's owner and puts it in the
context as the session cookie, for the loopback origin only. An agent session:

- is kept in the server's memory, not the `session` table, and dies with the server or the context;
- is accepted only on requests from a loopback address;
- reaches the view of that workspace's apps and nothing else: the view page, its socket and the file routes a view
  uses. Every other route answers as if no one were signed in;
- lasts as long as its context.

The runtime frame is loaded from the runtime origin as a person's view loads it. It serves only the runtime and carries
no session.

### The tools come back

`WITHHELD_TOOLS` keeps `ui_call_answer` and `ui_effect_answer` (Magnetic answers calls and effects itself) and gives
back `ui_preview`, `ui_screenshot` and `ui_interact`. The agent's instructions name the check as `ui_validate`, then
`ui_screenshot`, then `ui_interact` for what the user will do. A `ui_screenshot` image goes to the model as an image
block and counts against the turn's budget like any other input.

When Chromium cannot start (not installed, or the sandbox refuses), the three tools answer `BrowserUnavailableError` and
the agent falls back to `ui_validate`. Magnetic starts with `--agent-browser off` to withhold them as before.

### The image

The image installs Playwright's Chromium and its system libraries in the runtime stage, at the version the root
`overrides` pin. Chromium runs as the image's user with its sandbox on. If the container's seccomp profile refuses the
sandbox, the fallback is `--no-sandbox` for this browser only, which is acceptable because it loads only our own
origins over loopback and the runtime origin, and the runtime frame is sandboxed itself.

## Rules and Constraints

- An agent session never reaches anything but the views of its own workspace's apps, and only from loopback.
- No session token is logged or sent to the model. A screenshot contains only the app's page.
- The headless page loads its own server, never the other one through Caddy.
- Chromium never runs while no agent is checking: idle contexts close, and the browser closes with the last one.
- `BrowserPreview` without a page source behaves exactly as today (stateui-mcp's tests and standalone use).

## Decisions

- One Chromium per server with a context per workspace, not one per workspace (memory on the 2 GB host).
- Agent sessions live in memory, scoped to one workspace's views and to loopback, rather than a row in `session` that
  could reach the whole account.
- The limits (10 minutes idle, 4 contexts, 3 pages) are starting values; the deploy's memory check after this ships
  decides whether they move.

## As built

Not built yet.
