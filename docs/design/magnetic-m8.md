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
- Chromium is not in the server image, and doesn't need to be: the suite runs on a developer machine and in CI. It
  always runs against its own server (`e2e/server.mjs`), on `MAGNETIC_E2E_PORT` (default 4390); there is no smoke
  test of the live site.

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

### N3: layout and placement
- **The sections:** the Properties tab now opens with two sections, above the component's own properties so they
  are found without scrolling. The component's properties follow under a "Properties" heading.
  - **Layout:** on a node whose component lays out parts (`layout: true` in the catalog) or that has a `layout`.
  - **Place in its parent:** on a node whose parent lays it out.
- **Where the fields come from:** stateui-app's `LAYOUTS`, sent once with `/components`.
  - A FieldSpec becomes a field: an enum is a select with "Not set" first, an integer or number a number field (with
    its min and max), a boolean a switch, and a size a text field (saved after a pause).
  - An emptied field takes its key out.
- **The writes:** one `set` of the node's `layout` (or `placement`) object, through the same `ui_nodes_write` as
  everything else, so undo and the agent's view stay one.
  - A type change carries over the settings the new type has.
  - In the same write, it sets each child's `placement` to the fields the new type gives a child.
- **The node route:** `/edit/<id>/node` now gives:
  - `parentLayout`: the parent's `layout.type`, `column` for a parent with children and no layout, and `null` for
    a root;
  - `childPlacements`;
  - `component.layout`.
- **The plan asked for a segmented control** for the type. It is a select, like the other fields: five options with
  English names fit a select and keep the panel one column wide.
- **Not checked:** the plan's "the agent, asked afterwards, describes the new layout". The agent reads the same
  document through `ui_tree`, but no test asks it.
- **Tests:**
  - Playwright "Layout and placement", 3 tests at two sizes: column to grid, span 2, the gap kept from column to row.
  - `inspectRoutes.test.ts`: the node's layout answers.
  - The suite runs 70 times: 68 pass and 2 are skipped.

### N4: screens
- **As built differently from the plan:** the plan gave every screen a live frame, made possible by a `localRoute`
  load option and a host that mounts one `LiveView` per frame. That is three changes deep (stateui-app, the host, the
  sync of `$.route`), and each live frame is a sync connection.
- **As built:**
  - **One live frame**, the app as before, moved into the slot of the screen it shows.
  - **The other screens are previews:** panels of the host (`stateuiHost.mount`, as the editor itself is), loaded
    with the app's document with `start` set to the screen. Each gets the live frame's `$.data` and its changes from
    `stateui:change`.
  - **No route trouble:** a preview never syncs, so moving around inside it moves nothing else. The live frame's route
    stays the owner's, as before.
  - **Pressing a preview** (a cover takes the pointer) navigates the live frame there with the new
    `stateuiHost.navigate`, and the live frame takes the preview's place.
  - **What a preview lacks:** it shows the screen as it is, but changes in it are not kept. To work on a screen, make
    it the live one.
- **Weight:** an `IntersectionObserver` mounts the previews in view and disposes the others. The plan's "last
  screenshot" of a frame out of view is its name instead: a frame from another origin cannot be drawn to a canvas from
  the page.
  - Asked for on 2026-11-18: "at a certain height the screens just show their name, all of them. That way we don't
    overload the browser. Maybe at the point more than 3-4 screens are visible". With more than four screens in view
    (the live frame counts, `MOST_IN_VIEW` in `screens.ts`), every preview shows only its name, so zooming out over
    many screens runs one app. This replaced a cap of six mounted previews.
  - Asked for on 2026-11-18, once names were in: "The screen should not render when only the name is shown, that's
    wasteful", "No screens should render when we're zoomed out at a certain level", "I like the idea that you can
    select a screen and it renders (at a certain zoom level), but we have to be able to deselect it as well".
  - **Names:** with more than four screens in view, or below a zoom of 0.15 (`NAMES_BELOW_ZOOM`), nothing
    renders: no preview mounts and the live frame hides, its screen a name tile like the others. A tile shows its name
    inside and no label above it.
  - **Selecting:** pressing a tile selects its screen: the live frame shows it in its slot while the others stay names.
    The × at the slot's corner, Escape, or a click on the empty board deselects it. Zooming in past the threshold
    ends names and the selection with it.
  - **Escape** on the page now runs the shell's whole Escape turn (inspector, then the selected screen, then the
    chat), as Escape from the editor's frame already did.
- **Ordering by name** (owner, 2026-11-18: "allow users to order the screens when they are just showing the name"):
  while the previews show their names, a name is dragged to another slot; a dashed drop slot marks where it goes, and
  letting go moves the screen there (`POST /edit/<id>/screens` `{ action: 'order', order }`). A press without a drag
  selects the screen. The order moves at once on the board and is posted after; a refusal puts it back.
- **A menu for each screen** (owner, 2026-11-18: "add a context menu to edit the screen meta data"): a right click, the
  menu key or a tile's ⋯ button opens a menu: work on it, its title and name (each with Save), move it earlier or later,
  open the app on it, copy, delete. A tile's only tool is that ⋯ (owner, 2026-11-18: "remove the delete icon from the
  tiles"). Deleting asks inside the menu (the panel's Delete too), since a native `confirm()` can be suppressed in an
  embedded browser. The title is new: the panel had no way to set it (`{ action: 'title', name, title }`).
- **Any screen may be deleted** (owner, 2026-11-18: "allow the user to delete ANY screen; showing an add screen tile if
  none"). Deleting the start screen passes the start to the next screen, else the previous one (stateui-mcp's
  `appWithoutScreen`); deleting the last leaves an app with no screens and no `start`, which stateui-app now accepts.
  The live frame then hides and the board holds one tile the frame's size, **Add a screen**, which adds `home` and works
  on it; the first screen of an app with none becomes its start (`ui_screen_create`). The blank app's hint hides while
  there are no screens, so the tile is the way on.
- **Sections while placing** (owner, 2026-11-18: "reveal the layout sections when dragging a component over the
  screen"): while a component is placed or dragged, the overlay outlines every layout section of the screen worked on,
  dashed, with its name and layout at its top left (the root, then each node with a layout, from `/views/screen`,
  measured in the live frame). The drop target still shows solid over them.
- **A turned frame** (owner, 2026-11-18: "a way to switch back and forth from landscape to portrait"): a button beside
  the frame size swaps the frame's width and height, for every size. It is kept per app with the view
  (`magnetic.view.<appId>`'s `turned`).
  - Both go through `ui_app_configure`'s `screens`, added to stateui-mcp for this: every screen once, `{ name, title? }`,
    in the new order. The app document is the order of `$.screens`.
  - The panel's list is keyed by screen name, and a write merges into the records there, where a key keeps its place;
    the shell clears a list whose ids changed before writing it, so a move or a rename shows in the panel in order.
- **The panel** shares the library's slot. `P` toggles it. Adding a screen gives it a blank column root through the
  agent's own `ui_screen_create`, and copying passes the screen's root to it.
- **The fit:** the board fits around the live frame wherever its slot is (`--slot-x`). A route the app moved to
  shifts the board to keep the live frame in place on the screen.
- **Also fixed:** stateui-mcp's showcase parts were stale after N2's catalog changes (`showcase.test.ts` caught it,
  since N2 did not run stateui-mcp's tests). They are built again.
- **Tests:**
  - `screens.spec.ts`: desktop only (names only, dragging a name, the menu, selecting and deselecting, deleting any
    screen, Add a screen); `editor.spec.ts`: the turned frame and the sections while placing.
  - `inspectRoutes.test.ts`: the screens route, with order and title.
  - stateui-mcp `partAppTools.test.ts`: `ui_app_configure` `screens`.
  - The suite runs 80 times: 73 pass and 7 are skipped.
  - stateui-mcp: 1069 tests pass.

### N5: adding people to an org
- **Changed from the plan: no adding without asking.** "Add by email" was to put an existing person straight into
  the org. It does not, for two reasons:
  - An org's admins can see a member's state in org apps ("See their state"), so joining is the person's choice.
  - An answer of "added" against "invited" would tell an admin which emails have an account.

  Instead, every invite is the same to the admin, and it reaches the person two ways:
  - by email;
  - on their Your apps, if their verified email has an account, where they Join or Decline.
- **The data:** `org_invite.declined_at`, with an index on open invites by email.
  - `Orgs.pendingFor` lists a person's open, current invites to orgs they are not in.
  - `acceptInvite` and `decline` act by invite id, only for the person whose verified email the invite names.
  - A declined invite's link stops working.
- **Email:** a `Mailer` port (`src/mail/Mailer.ts`).
  - `sesMailer` sends through SES v2 with the machine's credentials; `memoryMailer` is for tests.
  - `MAGNETIC_MAIL_FROM` turns it on.
  - A failed send is reported and the link shown, so the sandbox, or a missing permission, breaks nothing.
  - The SDK came in through the image's own npm 10, run in a container with `--package-lock-only` (362 lines added,
    3 changed: `tslib` is no longer dev-only), then `npm ci` locally. That avoids the pruning of the local npm 11.
- **AWS** (`infra/aws`):
  - The stack gets `MailIdentity` (the mail domain as an SES identity, Easy DKIM 2048) and its three DKIM CNAMEs in
    the zone.
  - The host role may `ses:SendEmail` from that identity only.
  - The workload boundary allows `ses:SendEmail` and `ses:SendRawEmail`, and the deployer gets `ses:*` in its two
    regions. Both are guardrails the deployer cannot change, so they are applied by hand in the account (below).
  - `host-deploy.sh` sets `MAGNETIC_MAIL_FROM=magnetic@ai-minion.com`.
- **Applied on 2026-11-16:**
  - The boundary and the deployer policy were updated by hand. The deployer's `iam:CreateServiceLinkedRole` is now
    limited to the roles of RDS, ECS, load balancing, auto scaling and Backup (the IAM editor flagged it on `*`).
  - The stack was updated through a change set, `ses-mail`: the host role changed in place, and the identity and its
    three DKIM records were added.
  - ai-minion.com verified at once (`VerifiedForSendingStatus` true, DKIM `SUCCESS`).
- **Out of the SES sandbox:** production access was granted (case 179479514700071), so invites reach any address.
  - Until then mail went only to verified identities, with a quota of 200 a day. The whole of ai-minion.com is one,
    so its own addresses got invites.
  - Production access was requested on 2026-11-16 (`put-account-details`, transactional, the site, a description of
    the invites and the operator's contact). The account's suppression list drops addresses that bounced or
    complained, as the request says.
  - Granted: `ProductionAccessEnabled` true, enforcement `HEALTHY`, a quota of 50,000 a day at 14 a second. Magnetic
    needed no change: it already sent through SES. The invite page still shows the link as well.
- **Filled after N6:** the editor's top bar shows the workspace an app is in: "Yours", or the org's name.

### N6: connections
- **Done as planned:**
  - a workspace's connections (`connection`, `connection_oauth`);
  - sealed secrets;
  - the four sign-ins, including OAuth sign-in with PKCE and refresh;
  - endpoints with `{param}` templates;
  - the `http` effect with its guards and rate limit;
  - every call logged with no secret or body;
  - the agent told of the connections;
  - the Share panel's note.
- **How the effect knows its app:** a stateui-mcp effect function gets only the request. `logicFunctions` can now be a
  factory called per running instance (`LogicInstance`), and Magnetic makes one `http` effect per app.
  - A `view` link runs no effect, because its viewer cannot write the state that starts one.
  - A `use` link runs effects on the owner's connections, and the Share panel says so.
- **The guard against reaching inside:**
  - `checkUrl` refuses non-https, credentials in the URL, IP literals in blocked ranges and `localhost`/`.local`/`.internal`.
  - The request's own `lookup` checks every address the name resolves to as the socket connects, so a name cannot
    pass a check and then resolve elsewhere (DNS rebinding).
  - Blocked: `node:net` `BlockList` with this machine, private networks, link-local, CGNAT, documentation, benchmarking,
    multicast and reserved ranges in both families. IPv4-mapped IPv6 is checked as IPv4.
  - Tests and the e2e server pass `connectionGuard: { allowHttp, allowPrivate }`, refused off loopback.
- **Connect is a link:** the settings pages' CSP has `form-action 'self'`, which also stops the redirect after a form.
  So Connect answers with a "Sign in at <host>" link to follow. Found by the Playwright test.
- **Filled after N6:**
  - **An org policy to turn connections off:** `connections`, on by default, an admin's switch on the org's page.
    - Off: `httpEffect`'s `allowed` refuses every call of the org's apps, the agent is not told of the org's
      connections, and the Connections page says so and has no Try.
    - An org's settings form without the box turns it off, as its other switches do.
  - **The Connections page in four languages** (`connectionText.ts`). The reasons a change was refused stay in English,
    as on the org pages.
  - **An editor panel for connections** (key C), in the library's place, from `GET /edit/<id>/connections`:
    - the endpoints with their method, host, path and params, never a secret;
    - pressing one asks the agent to show what it answers;
    - Manage connections for the people who manage them.
    - A row's id is `<connection>_<endpoint>`: a dot would split the state path (found by the Playwright test).
- **Tests:**
  - `connections.test.ts`: 11 tests;
  - `appCalls.test.ts`: 2, through the real server;
  - `e2e/connections.spec.ts`: 5 at two sizes.
  - The suite runs 96 times: 89 pass and 7 are skipped.
  - magnetic has 211 unit tests, and stateui-mcp 1069.
  - With the gaps filled: `appCalls.test.ts` has 4, `e2e/connections.spec.ts` 8 at two sizes; the suite runs 102
    times (95 pass, 7 skipped), and magnetic has 213 unit tests.

### After M8: the starter screen and layouts in the library (23 November 2026)
Asked for on 2026-11-23: "The app is blank modal is not closable. I tried dragging and dropping an accordion layout on
the app and nothing happened. A blank page should start with a row layout, including a header, body and footer. An
screen's layout should be configurable. and layout sections should accept layouts as a dropped item"

What was wrong:
- A new app's home screen was a bare `panel` with no layout and no children, 26px tall. The drop looks for the
  innermost node under the pointer that lays out children, and skipped an empty node with no `layout`, so it fell
  through to the app node and tried to place the component beside the screen `home` (`No sibling "home" at
  "root.children"`).
- The blank app's hint had no close button. It went only when a request was sent.
- A panel given the height left in a column (`grow`) kept its content height. Its box filled the host with
  `block-size: 100%`, which has nothing to resolve against when the height comes from a flex parent under an app that
  only has a `min-height`.

What was built:
- **The starter screen** (`src/editor/StarterScreen.ts`): a new app (`POST /new`, and an org's app) gets an app node
  laid out as a column, and a home screen that fills it (`grow`): a column of three empty sections, `header` (a row,
  centred), `body` (a column that grows) and `footer` (a row). A screen added from the Screens panel gets the same,
  without the screen's `grow` in an app made before the starter, whose app node has no layout and refuses it. The
  agent's instructions name the three sections and say it may fill them, change their layouts or replace the root.
- **Blank means only panels**: `isBlankApp` calls an app blank while every screen holds nothing but panels, so the
  starter shows the hint. The hint has a close button (`hintClose`) that keeps it closed until the page loads again,
  and it goes as soon as the inspector writes a node (`magneticShell.appChanged`).
- **Drops into empty sections** (`inspect.ts` `dropAt`): a node is a drop target when it has a layout, has children or
  its component lays out children (the catalog's `layout` flag, now on each library entry and on stateui-mcp's
  `CatalogFileComponent`). The app node is never a target: its children are the screens.
- **Layouts in the library**: the Layout category starts with `row layout`, `column layout`, `grid layout` (two
  columns) and `adhoc layout`, each dropped as an empty bordered panel with that layout. A dropped layout takes all of
  its container (owner, 2026-11-23: "A layout should take 100% of it's container"): `grow` 1 in a row or a column, `x`
  and `y` 0 with `width` and `height` 100% in an adhoc layout, and a grid's cell stretches it already. Several layouts
  in one row or column share its space. A component still lands at its own size. A region is not offered: its children each need a
  region, so nothing can be dropped into one. The card's texts are in all four languages (`library.layoutName`,
  `library.layout.*`).
- **A screen's layout is configured as any node's**: the screen root is a panel with a layout, so selecting it (from
  the breadcrumb) shows its Layout section. Nothing new was needed once the screen fills the frame.
- **stateui-components**: the panel's host is a column of one and its box grows in it, so a panel fills the height a
  column's `grow` gives it.
- **stateui-app: an app on the page fills the viewport** (owner, 2026-11-23: "Ideally, there will be one app in a
  browser, and that should take up the full viewport. If there are multiple apps, then they should go side by side").
  `mountApp` marks its host `sui-app` and the document adopts one sheet (`fillPage`): with an app on the body or on an
  element right below it, the body loses its margin and becomes a grid of one row of at least the viewport's height
  and an equal column per element; a host the page gives a size keeps it. The selectors are in `:where()`, so a page with its own body layout, such as
  Magnetic's, keeps it. An app deeper in the page, such as the editor's canvas, is sized by its page.
- **The editor's panels open over the app** (owner, 2026-11-23: "When the inspector is opened the screen scrunches
  down, the editor overlays should not be in the same flow"). The Desktop frame and the fit zoom follow the stage area,
  the canvas less the rail, the top corners and the chat bar (`canvas.stageArea` in `src/http/shell.ts`); the inspector
  and the library or screens list beside the rail cover part of the app rather than shrink it. Overlay positions and
  what counts as in view still use the free area.
- **A board's cards are as wide as its columns** (owner, 2026-11-23: "the outline for layout is past the app's
  viewport"). A board column's list never scrolls, so it keeps no scrollbar gutter (`--sui-list-gutter: auto` in
  `board.view.css`); before, the live app's card was 15px narrower than its frame and the selection outline, drawn from
  the frame, ran past the app's right edge. The card's column is also the screen's width plus the frame's 1px border
  on either side, and the card's panels draw no border, so the frame lies inside the card instead of running about
  5px past its right edge. The frame's corners are square (owner, 2026-11-23: "The rounded corner will cover up the
  corners of the app"), so the app's corners and the selection outline drawn at them stay in sight.

Tests: `src/editor/StarterScreen.test.ts`; stateui-app `src/dom/mount/pageFill.browser.test.ts`; stateui-components `test/composites/panel-toolbar.browser.test.ts` ("should
fill the height a column gives it with grow, so its own growing child fills it in turn"),
`test/composites/board.browser.test.ts` ("should make a card as wide as its column, keeping no room for a scrollbar the
list never shows"); `src/server/editor.browser.test.ts` ("should keep the Desktop frame and the zoom when the inspector
opens over the canvas"). Checked by hand in the
editor: a new app's header, body and footer measure 26, 731 and 26px of an 800px frame; the hint closes; an accordion
dragged onto the body lands in it; a row layout dropped into the header spans it, and an avatar dropped into that row
lands in it; the screen root's Layout section shows its column.

## Not in M8
- Reading another owner's state from an app's logic (statenet datasets by grant). Since built after M8:
  [magnetic-shared-data.md](magnetic-shared-data.md).
- Paying for more agent use after the $5. Since built after M8: [magnetic-payments.md](magnetic-payments.md).
- Running the Playwright suite in a hosted CI. Since built after M8: the CI workflow runs it.
