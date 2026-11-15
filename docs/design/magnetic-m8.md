# Magnetic M8: building by hand, outside data, and the whole UI under test

## Summary
M7 put Magnetic on the internet. M8 lets a person build an app without the agent doing every step:
- add components from a library that is always in view;
- set a node's or a screen's layout;
- add screens and see them side by side on the canvas;
- connect the app to outside APIs, with static keys or OAuth;
- add people to an org.

A Playwright suite covers the whole UI, and it grows with each stage.

The beta's agent budget was changed first and is already in: each person gets $5 of agent use once, with no daily
pace. The server stops at $100 a month in all (`MAGNETIC_USER_ALLOWANCE`, `MAGNETIC_DAILY_BUDGET=off`).

## Where things stand
Found by reading the code on 2026-11-15.

| Need | Today | Gap |
|---|---|---|
| Component library | The Add tab of the inspector (`EditorApp.ts` `addTab`). A card is pressed, then the canvas clicked (`inspect.ts` `startPlacing`) | It is hidden behind the inspector, and there is no drag from the library |
| Layout | Five layouts (`column`, `row`, `grid`, `region`, `adhoc`), with typed settings in `LAYOUTS` (`stateui-app/src/core/layout/lists.ts`) | `fieldsOf` edits only plain properties, so the `layout` object has no fields |
| Screens | Only the agent adds them (`ui_screen_create`). The canvas has one frame. The runtime opens a screen from `?screen=` | No screen list, no add, and one frame only. The owner's `$.route` is synced, so frames of one instance would follow each other |
| Outside data | Logic effects exist (`logic.effects`, run by a host function). Magnetic registers none and turns agent answers off | No HTTP effect, no connections, no store for credentials |
| Org members | Invites by email with a role (`Orgs.invite`), accepted at `/invites/<token>` when the verified email matches. Members, groups and invites in `/settings/orgs/<id>` | No email is sent: the admin copies the link. An existing Magnetic person can't be added directly. The settings are hard to find from the editor |
| Browser tests | `editor.browser.test.ts`: 20 vitest tests driving Playwright's `chromium` directly | Most of the UI is not covered: home, org settings, share, phone sizes, sign-in pages |

## The three kinds of data
The question was whether Magnetic has a way to add APIs for outside data. It has a way for two of the three kinds
of data, and the third is this milestone's biggest piece.

1. **The app's own state:** `$.data` and `$.app`, bound through `uses.data`. This works.
2. **Other apps' and other owners' state:**
   - **Your own other apps:** `uses.external` reads your own state in another app, read-only, at
     `$.external.<alias>`. This works.
   - **Another owner's state:** a grant (M6) lets a person *use* another owner's app, but an app's logic can't read
     another owner's state through a grant.
   - Closing that is statenet work (a grant naming a dataset). M8 leaves it out and says so.
3. **Outside APIs:** none today. Stage N6 adds them.

## Decisions
### One Playwright suite, started first
- `@playwright/test` in `magnetic/e2e`, with one file per area of the UI and a page object for each: home, editor,
  library, inspector, layout, screens, connections, share, org settings, sign-in and privacy.
- **The suite starts its own server:**
  - `startMagnetic` on a fresh test schema, with dev users and the mock agent, so no tests need an API key or LinkedIn;
  - the mock OIDC provider drives the sign-in pages.
- **It runs at two sizes**, desktop and a phone (390×844), as two Playwright projects.
- **Each stage below lands with its own tests in the suite.** N1 covers what exists today.
- The existing vitest browser tests stay as they are. They test the overlay's internals; the suite tests what a
  person does.
- Chromium is not in the server image, and doesn't need to be: the suite runs on a developer machine. It can also
  point at the live site with `MAGNETIC_E2E_URL` for a smoke test that changes nothing.

### The library becomes a panel of its own
- The Add tab leaves the inspector and becomes a **library panel docked at the left of the canvas**, open by default
  in the editor. It shows a search box, categories as chips, and cards with a small preview.
  - A button on the rail opens and closes it, and `A` toggles it.
  - On a phone it is a sheet from the bottom.
- **Cards drag onto the canvas.** The page owns the pointer during a drag, because the frame is from another origin.
  So the drag lays the cover the Move tool uses over the frame, and asks the frame for the layout under each point
  (`nodeAt`, `nodeRects`, as placing does today). Dropping writes one `add`.
- Pressing a card and then clicking the canvas still works, so the library also works without dragging.
- The inspector keeps only Properties and State.

### Layout is a section of the properties panel
- A node with a layout (and a screen's root) gets a **Layout** section:
  - the type, as a segmented control of the five layouts;
  - then the settings of that type, made from `LAYOUTS`: gap and align as token pickers, and grid columns and
    rows as numbers.
- **The selected child gets a Placement section** from the same table (grow, span, region, x/y), so a node's place
  in its parent can be set too.
- Changing the type keeps the settings both types share and drops the rest. The children's placements are cleared
  where the new type doesn't have them.
- A change is one `ui_nodes_write`, the same tool the agent uses, so undo and the agent's view of the app are unchanged.

### Screens: a panel, and one frame per screen on the canvas
- **A Screens panel** (on the rail) lists the app's screens. From it a person can:
  - add a screen, blank (a column root) or from a screen pattern, as `ui_screen_create` does;
  - rename, duplicate or delete a screen;
  - set the home screen.
- **The canvas shows each screen as a frame, left to right**, all at the chosen size, with the screen's name above
  it. Selecting a frame makes it the one the inspector and library act on.
- **Weight:** the board of all apps was dropped because a frame is a runtime and a sync connection. Here it is one
  app, and only frames in view are live: a frame scrolled out of view is unmounted and shows its last screenshot.
  So the cost grows with what is on screen, not with the number of screens.
- **Route:** every frame of one instance would follow a synced `$.route`. The editor's frames therefore open with
  the route kept local to the view (a `localRoute` load option in stateui-app and the host), and each frame opens
  its own screen with `?screen=`. Navigation inside a frame stays inside that frame.
- **The host takes several frames:** stateui-mcp's host script mounts one `LiveView` per `[data-app-frame]` element,
  where today it mounts one per page.

### Connections: outside APIs as a store, used through effects
- **A connection** belongs to a workspace (a person's or an org's) and is made in a Connections page reached from the
  editor and from settings. It holds:
  - a name and a base URL (https only);
  - how it signs in:
    - none;
    - a static key, sent in a header or in the query;
    - OAuth 2: client credentials, or authorization code with refresh;
  - its endpoints: a name, a method, a path with `{params}`, query and body templates, and optionally the model the
    answer maps onto.
- **Secrets never reach a browser or an app document:**
  - keys, client secrets and tokens are sealed with `SecretBox` (the `MAGNETIC_SECRET_KEY` the server already has);
  - the page shows only "set" and lets a value be replaced, never read back.
- **OAuth's authorization code flow:**
  - a Connect button opens the provider's consent page;
  - the callback (`/connections/oauth/callback`) checks the state and stores the tokens;
  - the server refreshes them when they expire.
  - Magnetic's own LinkedIn sign-in is a separate client and is not reused.
- **Apps call endpoints through logic effects,** which exist already: `logic.effects.<name>: { request, run: 'http' }`.
  - Magnetic registers one host effect function, `http`. It resolves `{ connection, endpoint, params }` against the
    app's workspace, adds the credentials and calls out.
  - The answer lands where effects already put records and status, so tables, rules and screens bind to it as
    they do to any data.
  - The agent learns the connections and endpoints of the workspace (names only) and can write such effects.
- **Guarded on the server:**
  - the call goes only to the connection's own host, over https;
  - it never goes to a private, loopback or link-local address, checked after DNS resolution;
  - a timeout of 10 s, an answer of at most 1 MB, and a rate limit per app;
  - every call is logged per workspace, with no secret and no body;
  - an org can turn connections off in its policies.
- **Who can use a connection:** an app uses the connections of the workspace that owns it.
  - A person who only *uses* a shared app runs its effects on the owner's connections. That's what a shared app
    needs, so the Share panel says so before a link is made.
  - `view` links run no effects.

### Adding people to an org
- Invites already work. M8 makes them easy to reach, and adds direct adding:
  - **Add by email:** if a Magnetic person with that verified email exists, they are added at once with the chosen
    role, and see the org on their home next time. If not, an invite is made as today.
  - **Invites are emailed** through Amazon SES from `magnetic@ai-minion.com`, with the link that today must be copied.
    - SES needs the domain verified and the account moved out of the SES sandbox. That is an AWS console step for
      you.
    - Until then, the link is still shown to copy.
  - **Orgs are in sight:**
    - home shows your orgs, and a Make an org button;
    - the editor's top bar shows the workspace the app is in.
- Roles stay as they are (owner, admin, builder, member), with the same rule: admins add up to admin, and only owners
  add owners.

## Stages
Each stage ends in something you can run, is committed on `develop`, and is deployed.

| Stage | Delivers | Depends on |
|---|---|---|
| N1 | The Playwright suite on today's UI: sign-in, home, make an app, the editor's tools, share, org settings, privacy, at desktop and phone sizes | — |
| N2 | The library panel, with drag from it onto the canvas | N1 |
| N3 | Layout and Placement sections in the properties panel | N1 |
| N4 | The Screens panel and one frame per screen on the canvas (`localRoute`, several frames in the host) | N2 |
| N5 | Adding people to an org: add by email, emailed invites through SES, orgs on home | N1 |
| N6 | Connections: the store, static keys, OAuth 2, the `http` effect and its guards, the agent told of them | N1 |

N2, N3 and N5 can run beside each other. N4 comes after N2, because both change the canvas.
N6 is the largest: about as much work as N2 to N5 together.

## Checks
- **N1:** the suite passes on a clean checkout with only the test database. A failing step leaves a trace and a
  screenshot.
- **N2:**
  - a card dragged into a column lands in the gap shown;
  - a card dropped outside the frame adds nothing;
  - Escape cancels a drag;
  - press-then-click still places a card.
- **N3:**
  - switching a column to a grid of 3 lays its children out in three columns;
  - a child's span is kept;
  - the agent, asked afterwards, describes the new layout.
- **N4:**
  - adding a screen shows a new frame to the right;
  - navigating inside one frame doesn't move the others;
  - an unmounted frame shows its screenshot and comes back live when scrolled to.
- **N5:**
  - an existing person added by email sees the org;
  - a stranger gets an invite whose link only their verified email can accept;
  - an admin can't add an owner.
- **N6:**
  - a static-key endpoint answers into a table;
  - an OAuth connection signs in, refreshes and keeps working;
  - a call to `localhost`, to `169.254.169.254` or to a host other than the connection's own is refused;
  - no secret appears in a page, a document, a log or an agent's context;
  - a `view` link runs no effect.

## As built
### The beta's budget (before N1)
- Each person gets $5 of agent use once: `--user-allowance` / `MAGNETIC_USER_ALLOWANCE`, summed over the whole ledger.
- `MAGNETIC_DAILY_BUDGET=off` drops the daily pace, and the server stops at $100 a month.
- When the $5 is spent, the chat says so, and everything else still works.
- Deployed on 2026-11-15; the live server's log shows "budget $5 per user in all, $100 per month".

### N1: the Playwright suite
- **Where it lives:** `magnetic/e2e` and `magnetic/playwright.config.ts`, run with `@playwright/test` 1.61.1.
  `npm run e2e` builds, then runs it.
  - 29 tests in five specs, each run at 1440×900 and at a phone's 390×844: 58 runs, about 3 minutes, one worker.
  - A failure leaves a trace and a screenshot (`npm run e2e:report`).
- **The server:** `e2e/server.mjs` starts Magnetic from `dist` on a fresh schema of the test database, with:
  - the dev users alice, bob, carol and dan;
  - the mock provider;
  - the scripted agent;
  - the beta's budget.
  
  A control port (the page port + 2) sets who the mock provider signs in next, so a test can be a person with a
  verified email, as an invite needs.
- **What the page objects learned about the pages:**
  - Every Magnetic page except the org settings, Shared by me and privacy is a StateUI app in a frame from the
    runtime origin, and an accessibility snapshot does not reach into it. The page objects locate by role and text
    inside each frame instead.
  - The frames are:
    - the sign-in page: `#page-app iframe`;
    - Your apps: `body.home iframe`, with its notices on the page in `#notice`;
    - the editor: `#editor iframe`, over the app at `#artboard iframe`;
    - an app opened on its own: its only frame.
  - Pressing an idea on a blank app sends it at once; it does not fill the request.
  - Leaving the editor with Ctrl+Shift+E only drops the `editing` class, so the editor's frame stays in the DOM.
  - On a phone the frame opens at Phone size.
  - An invite link shows Join to anyone signed in; the email is checked when Join is pressed.
- **What the suite found:**
  - No broken flows.
  - One gap for N2: the library narrows only once Enter is pressed or the box is left. The `searchBox` component
    raises `change` on the native change event, not on each letter. N2's panel narrows as you type, and its test
    will type without Enter.
- The scripted agent adds each request as a text on the first screen. `EditorPage.ask` waits for that text, not just
  for Stop to go, because Stop is not yet shown just after Send.

### N2: the library panel
- **The panel:** `library` is a floating panel of the editor app beside the rail (`LIBRARY` in `EditorApp.ts`).
  - On a wide window it is 288px wide, from below the corners to above the chat bar.
  - Below 760px it is a sheet across the bottom, using the same `clamp` trick as the inspector.
  - It shows when the editor opens on a wide window and starts hidden on a phone. After that the browser keeps the
    person's choice (`magnetic.library`).
  - The rail has a fourth button under the tools, Components (A), which is soft while the panel shows. `A` toggles it
    from the page and from the editor's frame.
  - `freeArea` fits the app to the right of the panel.
  - The inspector lost its Add tab and keeps Properties and State.
- **Search as you type:** `searchBox` in stateui-components raises `input` with each letter, as `input` and
  `textarea` do. The library listens to `input` and `change`.
- **Drag, as built differently from the plan:**
  - The plan laid the Move tool's cover over the frame and dragged with the pointer.
  - A native HTML drag was tried next. It crosses frames in a browser, but Playwright cannot drive one out of a
    cross-origin frame (it ran `dragstart` but never `dragover` on the page, with site isolation on or off). It could
    not be tested, so it was dropped.
  - **As built:** the `card` component has `draggable`. A press that moves past 5px raises `dragStart`, then
    `dragMove` and `dragEnd` with the pointer's `{ x, y }` in its window. The card holds the pointer capture for
    the whole drag, so the editor's frame keeps the moves even over the canvas. That frame covers the window, so its
    pixels are the page's. Escape, or a cancelled pointer, ends the drag with `cancelled: true`. A drag is not a press.
  - **The page side** (`inspect.ts`): `grab` starts placing. `dragMove` over the artboard asks the frame where the
    component would land and draws the line. `dragEnd` there commits one `add`. Anywhere else, or cancelled, it says
    "Cancelled."
  - **Phones:** a touch on a card scrolls the list rather than dragging (no `touch-action: none`, so the list stays
    scrollable). On a phone the component is pressed, then placed.
- **Tests:**
  - stateui-components `card.browser.test.ts`: the drag events, a press without a drag, Escape and a cancelled pointer.
  - `search-box.browser.test.ts`: `input` with each letter.
  - The Playwright suite has a "component library" group: 5 tests at two sizes, with the two drag tests skipped on a
    phone. The suite now runs 64 times: 62 pass and 2 are skipped.
- **Also fixed:** `importFiles.test.ts` expected the old shape of `Budgets.spent`, from before the beta's allowance
  added `total`.

## Not in M8
- Reading another owner's state from an app's logic (statenet datasets by grant).
- Paying for more agent use after the $5.
- Running the Playwright suite in a hosted CI.
