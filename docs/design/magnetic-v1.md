# Magnetic v1: an AI app builder you can hand out as a link

## Summary
Magnetic is a web app where a person signs in with LinkedIn, describes an app in a chat box, and watches an agent build
it as a live StateUI app. They can see the app's state, select components and change them by hand, drag new components
in from the library, and share the result as a link that they can revoke.

v1 has one goal: stand up a hosted server, post links on LinkedIn, and learn what people do with it.

Magnetic is the first product on the statenet idea. The statenet holds logic, persistence, transport and the shared
vocabulary (the taxonomy), and StateUI draws on top of it. A user owns their state, and sharing it is a grant they
can revoke. v1 builds the smallest real version of each of those, so the later work extends it rather than replacing it.

## What already exists
Most of the server is built. Magnetic composes these pieces rather than writing new ones:

| Need | Already in | Notes |
|---|---|---|
| Serve static files and the runtime | `stateui-mcp` `HttpServer` | The page and runtime are on two origins, and the app runs in a sandboxed frame |
| Websocket sync, many views, offline queue | `state-sync` Full mode, `stateui-mcp` `AppAuthorities` | One authority per instance namespace `instances.<persona>.<ownerId>.<appId>` |
| Server-side logic | `stateui-app` logic engine, run by each authority | Rules, machines, decision tables and expressions, with chain depth capped at 8 |
| Coded logic kept to the host | `startServer` `logicFunctions` and `procedures` | Only the host can register them |
| Building tools for an agent | `stateui-mcp` `createStateUiTools` (36 tools) | Parts, nodes, themes, data, logic, preview, screenshots and interaction |
| Owners and personas | `createServices({ ownerId, dataDir })`, persona instances | One owner per server, and only the `default` persona exists so far (`runTarget.ts`, `FileUiInstanceRepository`) |
| Persistence | File repositories, `statenet` `NamespaceStorage` port | A database adapter can replace the files later |
| Drag mechanics | `stateui-components` `shared/drag`, `board`, `window`, drawing drag | Pointer threshold, hit columns, keyboard moves |
| Component library | The catalog (`ui_components_search`, `ui_component_get`), the showcase | Has categories, summaries and examples |
| A tree for the state view | The `tree` composite | Draws 10,000 nodes with a bounded number of slots |

These pieces are new:
- Multiple users.
- Sign-in.
- The Magnetic shell with its chat and agent.
- The state view.
- The editor overlay.
- Grants and revocation.
- Hosting with cost limits.

## Decisions

### One server, one process, files
- A new repo, `punyts/magnetic`, holds the Magnetic server and the Magnetic client app. It depends on `stateui-mcp`
  as a library, not as a separate process.
- **One `Services` per user.** `createServices({ ownerId, dataDir: data/users/<userId> })` is created on a user's first
  request and kept in a bounded cache, with idle ones closed. Each user's parts, instances, files and authorities stay
  apart because each user has their own folder, so no repository needs a user filter.
- Storage stays on files for v1. A single machine with a persistent volume is enough for the LinkedIn test. The storage
  ports (`UiPartRepository`, `UiInstanceRepository`, `NamespaceStorage`) are where a database goes later.
- The headless Chromium is shared, with one browser context per user, and pages are closed when idle. The agent
  needs it for screenshots. A limit on open pages per user and in total keeps memory bounded.

### Two origins, as today
- `magnetic.<domain>` serves the shell, the sign-in pages and the API, and holds the session cookie.
- `run.<domain>` serves only the runtime frame. User apps run there, in the sandboxed frame with no network, so an app
  that someone else wrote can never read the session cookie.

### Sign-in: LinkedIn first, any OpenID Connect provider later
- LinkedIn's "Sign In with LinkedIn using OpenID Connect" product: the authorization code flow with PKCE and the
  scopes `openid profile email`. The name, picture and email come from the ID token and the userinfo endpoint.
- A generic OIDC client (`openid-client`) is configured per provider: issuer, client id, secret and scopes. Adding
  Google or GitHub later is configuration plus a button.
- **The identity is not the user.** An `identities` record maps `(provider, subject)` to a statenet user id, a UUID.
  The user id is the owner of everything. A second provider can later be linked to the same user.
- **Session.**
  - A signed, `HttpOnly`, `Secure`, `SameSite=Lax` cookie on the shell origin, with a server-side session record.
  - The websocket upgrade checks the cookie and the `Origin` header.
  - Sign-out ends the session and closes that session's sockets.
- **Authentication only.** Sign-in proves who someone is. What they can do is decided by the statenet's grants (below).
- **A development sign-in.** When the server runs on a local development host, a `--dev-users` option lets you pick a
  test user without LinkedIn, so tests and local runs never need real accounts.

### Ownership and grants
- Every namespace has an owner, the user id. The owner can do anything in it.
- **A grant** gives another principal a right on an app: `view` (a live, read-only view), `use` (their own persona
  instance of the app, so they can type into forms and keep their own data), or `remix` (copy it into their own parts).
  The principal is a user id or `link`, meaning anyone with the link.
- A shared link holds a random token that names the grant. Opening it as a signed-in user gives you a persona instance
  (`use`) or a read-only view (`view`). Signing in is required for every grant in v1, so every visit has a user behind
  it and the cost limits apply.
- **A `use` grant needs more than one persona.** Today only `default` exists. M6 keys persona instances by the
  viewer's user id: the instance key, the files under `personas/<userId>/`, and `runTarget`'s persona check. The
  instance namespace `instances.<persona>.<ownerId>.<appId>` already has a place for it.
- **Revoking is a change on the statenet.** The grant is removed, and every authority that serves that grant's
  principals:
  - closes their sockets with a new `revoked` error code;
  - tells the client to scrub. The `state-sync` client, on `revoked`, deletes the namespace from its local store (the
    confirmed state, pending changes and the document) and the app shows "This app is no longer shared with you".
  - A client that was offline scrubs the next time it connects. Its `hello` is answered with `revoked`.
- Copy-paste and screenshots are out of scope, as you said. A `remix` is a copy by design: revoking stops new remixes,
  but the copies already made belong to whoever remixed them. Magnetic says so on the share dialog.

### User logic: tables and expressions yes, code no
- The logic of a document runs on the server in its authority, as it does today:
  - rules
  - machines
  - decision tables (LUTs), including rows from data
  - expressions (the `@punyts/expression` parser, never `eval`)

  A user, or the agent working for them, writes all of it.
- **Coded logic stays with the host.** `logicFunctions` (compute, expressions, effects) and `procedures` are registered
  by Magnetic itself, never by a user. v1 registers none. A `call` or an effect with no registered function fails with
  `logic.failed`, instead of being queued for an agent to answer.
- **Limits per instance**, on top of the chain depth of 8 and the document and data limits that already exist:
  - timers (`after`, `debounce`): at most 20 may fire in any one second, or the logic stops and the owner sees why;
  - client changes: at most 50 frames a second per view socket, or the socket is closed.

  (As built in M1. The design first had an iterator cap and a separate budget of logic runs; see "As built".)
- **Relaying changes outside (1.5)** uses effects. It becomes possible once Magnetic registers vetted effects, such as a
  webhook to an allowed host. That is after v1.
- **Later**, each user's authorities move to a worker thread, so a heavy chain from one user cannot stall the others.

### The Magnetic shell
One page, with three areas:

```
┌────────────────────────────────────────────────────────────┐
│ app name ▾      [preview | state]            share  avatar │
├────────────────────────────────────────────┬───────────────┤
│                                            │ properties    │
│         the app (runtime frame)            │ of the        │
│         + editor overlay                   │ selected node │
│                                            │               │
├────────────────────────────────────────────┴───────────────┤
│  [theme] [layout] [data] [logic] [screens]                 │
│  ┌──────────────────────────────────────────────────┐      │
│  │ describe a change…                           ⏎   │      │
│  └──────────────────────────────────────────────────┘      │
└────────────────────────────────────────────────────────────┘
```

- The shell is itself a StateUI app, running from the runtime bundle like any other. Magnetic dogfoods the components.
- **The chat box** is a minimal text field. Above it are toggle buttons that pick which context goes into the prompt:
  `theme`, `layout`, `data`, `logic`, and `screens`. A selected node is always included.
- **The activity drawer** slides up from the chat box while the agent runs. It shows what the agent says and each tool
  call (`ui_nodes_write` on the `home` screen, a screenshot, and so on), as one line each that you can open. It closes
  4 seconds after the agent finishes, provided the pointer is not over it and nothing in it has focus. It can be
  pinned open.

### The agent
- Runs on the server through the Claude API, with tool use, over the user's own `createStateUiTools`. The API key
  never reaches the browser.
- The model is Claude Sonnet 5.5 by default, for cost, and can be switched in configuration. Prompt caching covers the
  system prompt, the instructions and the catalog, which are the same for every turn.
- **The context toggles** add facts to the turn:
  - **data:** the state outline (paths, types, record counts and a sample record per dataset), the bindings, and which
    paths the logic reads and writes.
  - **theme:** the token values.
  - **layout:** the tree of the current screen.
  - **logic:** the units and their triggers.
- The agent and the person edit through the same tools, so there is one write path, one revision history and one undo
  list. An agent write the person conflicts with is retried on the new revision.
- A turn can be stopped from the drawer.

### State is a first-class feature
The state view is a peer of the preview, not a debug panel.
- **The `state` tab** shows:
  - **The hierarchy** as a diagram: `$.data` bindings, `$.app` nodes, screens and route. It is drawn with the `tree`
    composite, with live values.
  - **Who uses each path:** which logic units read or write it, and which nodes bind it.
  - **Changes as they happen:** a change flashes its path, and a feed lists recent changes and the logic runs they
    caused (`ui_logic_trace`).
- **Selecting a path** shows its value, model and shape, and offers "ask the agent about this", which puts the path
  into the chat context.
- **The `data` toggle** shows the same diagram in a compact form above the chat box, so the person sees what the
  agent will be told.
- The state view only reads. Values are edited through the app, the properties panel or the agent.

### The editor overlay
- **It is an app of its own**, laid over the runtime frame in the shell page. It never runs inside the user's frame.
  It talks to the frame through the existing message protocol, with these new messages (all checked by nonce):
  - `nodeAt {x, y}` → the node path under a point;
  - `nodeRects {paths}` → the boxes of nodes and of their layout slots;
  - `highlight {path, mode}` → outline a node or show a layout's drop zones.

  Edits go to the server through the same tools as the agent's (`ui_nodes_write`), never through the frame.
- **Select.** Clicking in edit mode selects the node under the pointer. Breadcrumbs go up to its parents, and the
  properties panel shows its properties from the catalog: content, layout, placement and theme overrides.
- **The component library** is a panel of the catalog by category, searchable, with each entry's summary and example.
  Dragging an entry, or a selected node, into the app:
  - outlines the layout under the pointer;
  - shows where it would land: the gap in a column or row, the cell of a grid, or the point of an `adhoc` layout;
  - on drop, writes one `add` or `move` operation.

  Escape cancels. The arrow keys with a modifier move a selected node within its parent, so the editor works without
  a pointer.
- **The drag code** reuses `shared/drag` (threshold and nearest box) and the drag-and-drop work in `board`.

### Cost limits
- Every user has a daily token budget for agent turns, and the server has a monthly cap across everyone. When a budget
  runs out, the chat box says so and the rest of Magnetic keeps working.
- **Sign-ups are limited:** at most N new users a day, and a waiting list after that. You can let people in from it by
  hand.
- An agent turn has a limit on tool calls and on wall-clock time.

## Not in v1
- Running user code, or any coded logic beyond what Magnetic registers.
- Relaying changes to outside services (effects to external hosts).
- Providers other than LinkedIn.
- A database, and more than one server.
- The statenet as a separate service between servers (the federation).
- Extending another person's app through metadata, beyond `remix`.
- Protection against copy-paste or screenshots.

## Stages
Each stage ends in something you can run and is committed on `develop`, like the Lumen stages.

| Stage | Delivers | Depends on |
|---|---|---|
| M1 | Multi-user server: one `Services` per user, development sign-in, sessions, per-user websocket sync, logic limits, two origins | — |
| M2 | LinkedIn sign-in through generic OIDC, identities mapped to user ids | M1 |
| M3 | The Magnetic shell, the chat box with the context toggles, the server-side agent, the activity drawer, cost limits | M1 |
| M4 | The state view: hierarchy diagram, who uses each path, change feed, the `data` toggle's facts | M3 |
| M5 | The editor overlay: frame messages, select, properties panel, component library, drag and drop with layout highlight | M3 |
| M6 | Persona instances per viewer, grants and links (`view`, `use`, `remix`), revoke with the `revoked` scrub in `state-sync` | M1, M2 |
| M7 | Hosting: container with Chromium, TLS, the two domains, backups of the data volume, invite flow, then the LinkedIn post | all |

M2 can run beside M3. M4 and M5 can run beside each other once M3 is in.

## Checks
- **M1:**
  - Two test users never see each other's apps, files or state, whether through the API, the tools or the websocket.
  - A socket without a session is refused.
  - A rule that loops through a timer is stopped by the limits.
- **M2:**
  - The sign-in flow works against a mock OIDC provider in the tests.
  - A LinkedIn test application signs in locally.
- **M3:**
  - An agent turn against a recorded API response writes nodes, the drawer shows the calls and closes after 4 s idle.
  - A spent budget refuses a turn.
- **M4:** The diagram shows the bindings and the paths that logic reads and writes, and a change flashes its path.
- **M5:** Browser tests in the shell:
  - selecting by click and by breadcrumb;
  - dropping a library entry into a column, a grid cell and an `adhoc` layout;
  - moving a node by keyboard;
  - each of these as one `ui_nodes_write`.
- **M6:**
  - Revoking a `use` grant closes the viewer's socket and empties their local store.
  - A viewer who was offline is scrubbed when they reconnect.
  - A remix keeps working after the revoke.

## As built

### M1: the multi-user server
- **Where it lives.**
  - A new package, `magnetic/`, is in the npm `workspaces`.
  - It runs with `npm run magnetic`: development users alice and bob, on port 4300. Its repo is
    `github.com/punyts/magnetic`.
- **stateui-mcp changes.**
  - `startHttpServer` takes a `tenant`: one owner, or a function that finds the owner of each request and can
    refuse it. A refused page request can be redirected.
  - `retain(close)` tells the tenant when a view socket opens, and lets it close the socket.
  - `routes` lets the embedding server add its own routes. `mcp` is optional.
  - `socketMessagesPerSecond` is a rate limit per view socket.
  - `createServices` takes `agentAnswers: false` and `logicLimits.timerRunsPerSecond`.
- **Logic limits, changed from the design.**
  - **Built:**
    - a timer budget (20 per second per instance, which stops the logic);
    - a socket rate (50 frames a second);
    - the existing chain depth of 8;
    - the existing document and data limits.
  - **Not built: the iterator cap of 10,000 items.** Data limits already bound the iterator's input. A cap on nested
    iterations needs a counter inside `@punyts/expression`, so it moves to the worker-thread step, which bounds time
    as well.
  - **Changed: the 50 logic runs per second.** This is enforced through the socket rate instead. Each client change
    is one run, and the timer budget covers the runs the logic starts itself.
- **Sessions keep hashes.** The session token is random, and only its SHA-256 is stored, so no signing secret is
  needed.
- **What building it found.**
  - **Referrer policy breaks forms.** stateui-mcp's pages send `Referrer-Policy: no-referrer`, and with it Chrome
    posts a form with `Origin: null`, which the same-origin check refuses. Magnetic's own pages send `same-origin`.
    The node tests could not see this; the browser pane did.
  - **A headless browser per workspace.** Each workspace would open its own Chromium on first preview. M1 never
    previews, but M3 has to share one browser across workspaces, with a context per user. The headless page also has
    to sign in to reach the user's app.
  - **The runtime origin is still `http://<host>:<port>`.** Public HTTPS origins are M7.
  - **A flaky test.** stateui-mcp's showcase integration test timed out once under the load of the full run, and
    passed on its own.

### M2: LinkedIn sign-in
- **The flow.** `OidcSignIn` uses `openid-client` 6 for the authorization code flow, with state, nonce and PKCE
  (S256). Each provider is configured with its issuer, client id, secret and scopes, and found by discovery.
  `linkedInProvider(id, secret)` is LinkedIn's preset.
- **Binding to the browser.**
  - A sign-in in flight has a random key, held in the cookie `magnetic_signin` (`HttpOnly`, `SameSite=Lax`,
    `Path=/auth`, 10 minutes).
  - The state, nonce and verifier stay on the server under that key.
  - The callback is accepted once, only from the browser that started it. This stops login CSRF.
- **The ID token's signature is checked.** openid-client 6 does not check the signature of an ID token from the
  token endpoint unless asked, as OIDC allows over TLS. Magnetic turns it on (`enableNonRepudiationChecks`), so the
  token is checked against the provider's published keys, along with its issuer, audience, expiry and nonce. The
  mock provider's test with a token signed by another key found this.
- **The profile.** It comes from the ID token's claims and the userinfo endpoint:
  - The name, or the given and family names.
  - The email, unless `email_verified` is false.
  - The picture, if it is HTTPS.
- **Back to where they were.** A page request without a session goes to `/signin?next=<path>`, and every way of
  signing in returns there. `safeNext` allows only plain paths of this server.
- **Configuration.**
  - LinkedIn comes from `MAGNETIC_LINKEDIN_CLIENT_ID` and `MAGNETIC_LINKEDIN_CLIENT_SECRET`. These are environment
    variables only, so the secret stays out of the process list.
  - `--public-origin` sets the redirect URIs, `<origin>/auth/<provider>/callback`. Cookies are `Secure` when the
    public origin is HTTPS.
- **A mock provider.** `--mock-provider`, on loopback only, runs an OIDC provider beside the server that signs anyone
  in as a test person. `npm run magnetic` turns it on, so the whole redirect flow can be tried without LinkedIn. The
  tests use the same provider.
- **What building it found.**
  - **LinkedIn does not advertise PKCE.** Its discovery document has no `code_challenge_methods_supported`. Magnetic
    sends PKCE anyway, as designed. If LinkedIn refuses the verifier, `MAGNETIC_LINKEDIN_PKCE=false` turns PKCE
    off; the nonce still binds the code to the sign-in.
  - **LinkedIn's subjects are pairwise.** A person's `sub` is different for each LinkedIn app. A new client id would
    make every person a new user, so the client id must stay the same for the life of the server.
  - **Not yet checked against real LinkedIn.** That needs a LinkedIn app with the "Sign In with LinkedIn using
    OpenID Connect" product, and its redirect URI registered.

### M3: the editor and the agent
- **The editor page.** `/edit/<appId>` is a page of Magnetic's server, not a StateUI app as this design first had it.
  - Its body carries the attributes stateui-mcp's host script reads, so the script builds the live app frame
    beside the chat, as on `/apps/<appId>`. stateui-mcp now exports `hostPageCsp` and `requestHostName` for it.
  - The chat, the five context toggles and the activity drawer are a small script, `/assets/shell.js`.
  - Whether the shell becomes a StateUI app is left to M4 and M5, which add the state view and the editor overlay
    to it.
- **The agent.** `AgentTurns` runs on the server over the user's own tools (`createStateUiTools`).
  - **One turn at a time per user.** A second request while one runs is refused with a message.
  - **Each turn is a fresh conversation.** The last six exchanges of the chat go in as text, so no thinking block
    has to be carried, or edited, across turns.
  - **The toggles.** Each adds a `<context>` block, read with a read-only tool before the first request.
  - **The requests.** Each streams, with adaptive thinking (`display: "updates"` for the progress notes in the
    drawer), `eager_input_streaming` on each tool, and the system prompt cached with the tools.
  - **Refusals.** On Opus 5.5 and Sonnet 5.5 the request carries `fallbacks: "default"`, so a request the model
    declines is retried on the fallback model. A refusal that remains ends the turn with a message.
  - **The ends of a turn.** A turn ends when the model answers without a tool call, after 40 tool calls, after 5
    minutes, or on Stop.
  - **Tools withheld.** The browser tools are withheld, because each workspace would open its own Chromium and the
    headless page cannot sign in. `ui_call_answer` and `ui_effect_answer` are withheld too, because no logic waits
    for an agent here (`agentAnswers: false`).
- **The model.** The default is Opus 5.5 at `high` effort, set with `--model` and `--effort`; decision 5 is
  still yours.
- **Budgets.** Each request is priced from its token counts, cache reads and writes included.
  - Defaults: $1 per user per UTC day, and $100 for the server per UTC month.
  - The turn that crosses a limit finishes; the next is refused. Decision 3 sets the real numbers.
- **A mock agent.** `--mock-agent`, on loopback only, plays a scripted agent that reads the app and adds the request
  as a text on its first screen. `npm run magnetic` turns it on, so the editor can be tried without an API key.
- **The checks.** The tests run turns against recorded answers through the HTTP routes:
  - a turn writes nodes and streams its events;
  - Stop, the tool-call limit, a refusal, and a spent budget.

  The drawer's 4 s close, hovering, Stop and the live frame were checked in the browser pane with the mock agent.
- **What building it found.**
  - **A stop that came early was lost.** A turn wired its abort only after reading the chat, so a Stop in that
    moment did nothing. The turn now wires it first. The test of Stop found it when it ran after other tests.
  - **The drawer must open when the turn starts**, not at the first tool call, or Stop cannot be reached at once.
  - **Not yet run against the real API.** No API key was set while it was built, so the requests were checked only
    by their shape in the tests.

### M6: sharing
- **Grants are Magnetic's.** `Grants` keeps each link in `grants.json`: its token, owner, app, right, when it was
  revoked, and the people who opened it. The principal is always a signed-in user. A link adds the user as a member
  of its grant when they open it.
- **Persona instances.** A `use` member syncs with the persona named by their user id. stateui-mcp keeps each
  persona's instance under `personas/<persona>/` and runs one authority per persona. A `view` member syncs with the
  owner's `default` instance, read only: the server rejects each change and drops each event before the authority.
- **Who serves a shared app.** For `/apps/<appId>` of an app the person does not own, Magnetic answers with the
  owner's workspace, the persona and the access. A member with a live `use` and `view` link gets `use`.
- **Revoke.**
  - The grant is marked revoked, not removed, so its members can be told.
  - Each member's open views are closed. A member with no other live link is first sent the sync error `revoked`.
    `state-sync`'s client then deletes the namespace's `confirmed`, `outbox` and `document`, stops for good and
    calls `onRevoked`. The host script removes the frame and shows the note.
  - A member who was away gets a page with `data-revoked`, so the host script deletes the namespace before it
    connects. A socket opened anyway is sent the same error.
- **Remix** copies the app and the parts it reaches (`copyAppParts`) into the person's workspace. Parts with the same
  body are reused, and names already taken get `-2`. It copies no state and no uploaded files. Revoking a remix link
  stops new copies only.
- **The checks.**
  - Tests: revoke closes a `use` member's socket with `revoked`; a member who was away gets `data-revoked` and the
    error on connecting; a remix works after its link is revoked. The client's scrub is tested in `state-sync`.
  - In the browser pane, a second person opened a `use` link and got their own instance, and Revoke removed the
    frame, showed the note and emptied their local store. A reload kept it empty.
- **What building it found.**
  - **Starter apps share their ids.** The showcase has the same fixed id in every workspace, so a link to it opened
    the person's own copy. Only apps with random ids can be shared now.
  - **The client never heard a refusal.** `state-sync` ignored errors and reconnected forever, and the server
    refused only at the upgrade, which a browser cannot read. The revoked socket now opens to send the error, and
    the client stops on it.
  - **Not yet:** an app deleted by its owner leaves the other personas' instances and its links behind. A member
    moved from `use` to `view` keeps their `use` data in their browser.
- **Decision 4** was taken as recommended: the default link is `use`, and Remix is a link of its own.

### After M6: the model menu and the budget
- People pick the model of each turn in the editor: Haiku 5.5 (the default), Sonnet 5.5 or Opus 5.5.
- A turn now ends as soon as a request spends the last of a budget, so the $5 limit of the first run is passed by one
  request at most.
- **What a turn costs, estimated.** The fixed prefix (Magnetic's instructions, the guide and 32 tools) is 22,003
  tokens, counted with the token-counting endpoint. A build of about 15 requests, with the prefix and the growing
  chat cached, writes about 60K tokens to the cache, reads about 555K from it and outputs about 18K. That is roughly
  $0.02 on Haiku 5.5, $0.45 on Sonnet 5.5 and $0.80 on Opus 5.5. A small change of 3 to 5 requests costs a quarter of
  that.
- **The first real turn** (Haiku 5.5, "make a to-do list" on a new app) confirmed the API path: streaming, adaptive
  thinking, the cached prefix (22,071 tokens written once, then read) and the tools all worked. It cost **$0.0206**
  over 22 requests (50K tokens written to the cache, 773K read, 13K output), in 69 seconds, as estimated.
- **But it built nothing.** It reached the limit of 40 tool calls with an empty home screen:
  - 25 calls only read: guide topics, component descriptions and searches;
  - it called `ui_app_create` twice for an app that already existed, and was refused ("themes must be a list of
    theme names");
  - its one `ui_nodes_write` had blocking errors, and the retry used a stale revision;
  - it wrote no text to the person.

  Before the LinkedIn run, the agent needs work: tell it the app exists and how to start writing screens, read less
  up front, and check Haiku against Sonnet on the same requests.

### Tuning the agent
What went wrong, from a logged rerun:
- 20 of the first 21 calls only read, the request already shown in a guide topic.
- `themes` had no type in the tool schema, so Haiku sent the list as a string.
- It made "probe" screens to see what a pattern does.
- A big home screen in one deeply nested write broke the JSON (one closing brace too many after the list row), and
  the SDK's error for that was not retried.

What changed:
- Magnetic's instructions say the app exists, give a seven-step path and a to-do example built and checked in a
  browser (type a task, Add, tick a box: the dataset changes), and explain the two rules a model cannot guess: links
  write back, and a button only sets a flag that a rule acts on.
- `themes` has an array schema. Bad tool JSON is retried twice with a note asking for shallower writes.

Results on the same requests:

| Request | Model | Tool calls | Cost | Seconds | Outcome |
|---|---|---|---|---|---|
| To-do list (before) | Haiku 5.5 | 40 | $0.021 | 69 | nothing built |
| To-do list | Haiku 5.5 | 12 | $0.006 | 10 | built |
| Reading list | Haiku 5.5 | 17 | $0.008 | 35 | built; the read count does not go down on untick |
| Tip calculator | Haiku 5.5 | 20 | $0.014 | 45 | built, and tested its own sums |
| Reading list | Sonnet 5.5 | 15 | $0.161 | 27 | built; the count goes down too |

Haiku is about twenty times cheaper and right on simple apps; Sonnet makes fewer logic slips. With $5, Haiku turns
like these cost about 1 cent each, so the budget covers several hundred builds. Tuning spent about $0.25.

Seen while tuning, not yet fixed: a checkbox in a list row cannot run its own commands on the record (`$row` in an
`on` command is the row's copy, so the change is lost); a link is the only way, and anything more (a count that
follows the ticks) needs rules over the dataset.

## Decisions
1. **Hosting:** AWS, under `ai-minion.com`. M7 sets it up.
2. **Storage:** files, with a backup of the volume.
3. **AI cost:** a hard limit of $5 for the first run.
4. **Links:** the default link is `use`, and Remix is a link of its own (built in M6).
5. **The model:** people choose per turn. The default is Haiku 5.5, for the $5 limit.
