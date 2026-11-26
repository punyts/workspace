# Magnetic: the apps every person's own space starts with

Status: built, deployed 2026-11-24. Magnetic's tile 2026-11-23; Northwind Ops and the Lumen desktop rebuilt as parts apps
2026-11-24.

Asked for on 2026-11-23, answering which apps every new org gets:

> let's say every user org, aka the user org ids have the showcase, northwind, OS and magnetic

And, on Magnetic as an app in everyone's own space:

> yes, or if we think splitting the editor into it's own app, the editor

## What every person's own space holds
- **The component showcase**, as now: `installShowcaseInto` (stateui-mcp `src/config/showcase.ts`) when the workspace
  is first opened. An org's workspace starts empty.
- **Magnetic**: the person's own copy of the editor (`EditorApps`, `src/editor/EditorApp.ts`), which already lives in
  their workspace, shown as the first tile on their board (`/orgs/me`) with the note "Your own copy of the editor".
  Zooming in opens it in the editor, where changing the editor shows in the editor around it. Your apps still leaves it
  out: its list is the apps a person made or was given.
- **Northwind Ops** and **the Lumen desktop** ("OS"): the example's two apps rebuilt as parts apps, installed with the
  showcase.

## Northwind and the desktop
Both are documents of the older single-document form, run by code, and neither converts to parts. Looked at on
2026-11-23, while trying to build the conversion:
- **Their `$.data` is UI state, not datasets.** A parts app's `$.data` holds only bound datasets, each a map of records
  of a model. Northwind's holds `view` (the section shown and a hidden flag per section), `ui`, `requests`,
  `selectedOrder`, `detail`, `draft`, `wizard`, `stats` and more beside its orders and customers, and its
  383 KB screen links into all of it. `splitDocument` (stateui-app `core/convert`) would make each key a dataset,
  but it refuses a document that already has screens, and the keys that are not records would not make datasets anyway.
- **Northwind runs on code.** `example/src/bootstrap.ts` hears the events of its nodes' ids through `onRaised`, read by
  its `HEARING` table as 25 names (`ordersTrail.select` and `palette.run` as `nav.goto`, `rowShip.press` as
  `order.ship`, `newOrderForm.submitted` as `order.create`, `fulfilmentBoard.move` as `board.move`, the assistant's and
  support's, and others), derives each section's hidden flag
  (`sections.ts`), mirrors store writes into component commands ("bridges"), and generates its orders and customers
  (`data.ts`, `seed.ts`; deterministic). The archive section asks a host effect (`archive.ts`), Ridgeline a host
  game (`ridgeline.ts`), the warehouse loads models through the host's `load3d`.
- **The desktop is its host functions.** Its rules (`DESK_LOGIC`) are one-line calls of 13 pure functions of
  `desk.ts` (the window manager `deskAct`, the file system `fsAct` and its helpers, notes, the viewer, the
  wallpaper) and Ridgeline's. The logic engine has no way to write them: expressions have no loops over the windows
  or the files other than iterators, and no function definitions.

So each is a new app of parts with the same look, built by the agent with its own tools (the stateui MCP tools), from
the example as the reference.

### Northwind Ops (`northwind-ops`)
Eight screens, each placing the header (`northwind-header`) and the menu (`northwind-menu`): the dashboard (figures,
fulfilment, orders by status, revenue by month, low stock, latest orders), orders (search and a status filter), an
order (its steps, next step, ship, cancel with a confirm, a note), a new order, fulfilment (a board of orders by
status), customers (with their orders), products (stock level, restock, price) and help. Datasets: 40 orders, 24
customers, 8 products and 12 months of revenue. The app's logic is 21 rules and 3 tables (order status, order total,
stock level). Left out: the archive, Ridgeline, the 3D warehouse, deliveries, the catalog, support and the assistant,
settings and the other locales.

### The Lumen desktop (`lumen-desktop`)
One screen: a wallpaper, desktop icons, four windows (Files, Notes, Viewer, Settings) on an adhoc surface and a
taskbar with a launcher and a button per open window. Each window's state is a record of `lumen-windows` (open,
minimized, snap, x, y, width, height, z); 39 rules and 2 tables open, focus, raise, move, resize, minimize, maximize,
snap and close them. Files browses `lumen-folders` and lists `lumen-files`, opens a note in Notes and a picture in
Viewer, and makes, renames and deletes notes and folders; Notes edits a note's Markdown with a preview; Viewer can set
the wallpaper, as Settings does. Left out: Ridgeline, painting in Viewer, folders as rows of the file list.

### How they ship
Their part bodies are committed in stateui-mcp `showcase/starters/<app>/<kind>/<name>.json`, every part named with
the app's prefix (`northwind-`, `lumen-`). `npm run showcase:build` adds them to `showcase/parts` with stable ids,
so `installShowcase` and `installShowcaseInto` install them with the showcase in every new person's workspace. Each
workspace gets its own copy of the datasets. Workspaces made before 2026-11-24 do not get them.

### What building them found in the platform
Building them found five gaps, fixed on 2026-11-24 (the starter apps keep their workarounds, which still work):
- An instance took only keys the definition has, so a list filled by `query` lost its rows on load: a node now also
  takes a property its component declares, and a property's value takes new keys (stateui-app `layInstance`).
- A screen name with a dash read as a subtraction in an expression: it is now read whole (`withScreenNames`).
- Logic on the server did not see a screen's definition values: `$.screens` is read through the document, as `$.app`
  is (stateui-mcp `AppLogic`).
- `query` into `$.data` was refused for its position keys: there it writes a list in result order.
- A link could reach only an exposed runtime property: `#name.prop` now reaches a stored property too (a field's
  `value`), at the node's state path.

Two limits of the logic engine followed on 2026-11-24 (owner: "Fix the limits"):
- `was` with a list did not match one of its values: `is` and `was` now match any item of a list.
- A stamp rule (a path trigger, `set` to `now()`) ran at start for every record and stamped the seed orders with
  today: a rule that reads `$previous`, `now()` or `today()` now waits for a change.

A test run wrote the owner's datasets (`ui_interact`, a press in the preview), and `ui_state_reset` reset the
instance, not them. Test runs now write copies that a reset throws away (stateui-test-runs.md).

## Open questions
- Whether the editor becomes its own app (a blueprint people install, rather than a copy of Magnetic's page). The tile
  works either way: it opens the person's copy.

## Decisions
- Every person's own space has the showcase, Northwind, the desktop and Magnetic (owner, 2026-11-23).
- Magnetic's tile is the person's existing copy of the editor; no new app is made for it. Made while building it.
- "OS" is read as the Lumen desktop, the example's operating-system-like app (the owner left the open questions to this
  design, 2026-11-23).
- Both are rebuilt as parts apps, with no closed catalog of host functions: the owner said to build what was planned
  (2026-11-24), and the recommendation was parts apps.
- No starter copy that drops the code-run parts: Northwind without the events it hears and its section flags cannot change
  section, and the desktop without its functions opens no window. Made on 2026-11-23 after trying the conversion.

## As built
- Magnetic `src/server/startMagnetic.ts` (`appsBoardRoute`): the person's editor copy first on `/orgs/me`; text
  `apps.editorNote` in `src/http/text.ts`.
- Test: `src/apps/AppsPage.test.ts` (Magnetic first on the own space, once).
- stateui-mcp `showcase/starters/northwind-ops/`, `showcase/starters/lumen-desktop/`; `scripts/buildShowcase.mjs`
  (`STARTER_APPS`, `starterParts`), the built parts in `showcase/parts`.
- Tests: stateui-mcp `test/showcase.test.ts` ("the starter apps": built with their app parts, a part without the
  prefix refused, both installed and valid); Magnetic `src/server/startMagnetic.test.ts` (a new workspace has the
  showcase and both starters).

## Rules and Constraints
- Starter apps have the same ids in every workspace; links to them are refused.
- A starter app is pure StateUI: no host function beyond what Magnetic gives every app.
