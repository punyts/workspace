# Magnetic: the apps every person's own space starts with

Status: Magnetic's tile built 2026-11-23, not deployed. Northwind and the desktop do not convert (see below) and wait on
the owner's choice of how to make them.

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
- **Northwind Ops** and **the Lumen desktop** ("OS"): the example's two apps (`example/src/document`,
  `example/src/desktop`), as starter apps beside the showcase. Not built; see below.

## Northwind and the desktop
Both are documents of the older single-document form, run by code, and neither converts to parts. Looked at on
2026-11-23, while trying to build the conversion:
- **Their `$.data` is UI state, not datasets.** A parts app's `$.data` holds only bound datasets, each a map of records
  of a model. Northwind's holds `view` (the section shown and a hidden flag per section), `ui`, `requests`,
  `selectedOrder`, `detail`, `draft`, `wizard`, `stats` and more beside its orders and customers, and its
  383 KB screen links into all of it. `splitDocument` (stateui-app `core/convert`) would make each key a dataset,
  but it refuses a document that already has screens, and the keys that are not records would not make datasets anyway.
- **Northwind runs on code.** `example/src/bootstrap.ts` answers 19 kinds of emit (`nav.goto`, `order.ship`,
  `order.create`, `board.move`, the assistant's and support's, and others), derives each section's hidden flag
  (`sections.ts`), mirrors store writes into component commands ("bridges"), and generates its orders and customers
  (`data.ts`, `seed.ts`; deterministic). The archive section asks a host effect (`archive.ts`), Ridgeline a host
  game (`ridgeline.ts`), the warehouse loads models through the host's `load3d`.
- **The desktop is its host functions.** Its rules (`DESK_LOGIC`) are one-line calls of 13 pure functions of
  `desk.ts` (the window manager `deskAct`, the file system `fsAct` and its helpers, notes, the viewer, the
  wallpaper) and Ridgeline's. The logic engine has no way to write them: expressions have no loops over the windows
  or the files other than iterators, and no function definitions.

So a starter version of either is a new app of parts with the same look, not a conversion:
1. **Rebuild each as a parts app**, with datasets for what is data (orders, customers, products, files and notes) and
   the screens' own state for what is UI (`$.screens` values, the route), its behaviour as rules and machines. The
   agent can build it with its own tools, as Magnetic's own pages are built (`src/pages/PageApps.ts`), from the
   example as the reference. Sections that cannot be done in logic are left out (the archive's fake API, Ridgeline's
   opponent).
2. **Or give apps a closed catalog of these functions**, moved from the example into a library and loaded by the
   runtime, so the desktop runs as written. That puts an example's window manager and game into the platform's
   function list, which is the owner's call.
3. **The build script and the installer** (beside `scripts/buildShowcase.mjs`, fixed ids, installed by
   `installShowcaseInto`, links refused) follow whichever is chosen.

## Open questions
- Rebuild Northwind and the desktop as parts apps (1 above), or ship their functions as a closed catalog (2)? The
  recommendation is 1 for Northwind and 2 only if the desktop must run as it is.
- Whether the editor becomes its own app (a blueprint people install, rather than a copy of Magnetic's page). The tile
  works either way: it opens the person's copy.

## Decisions
- Every person's own space has the showcase, Northwind, the desktop and Magnetic (owner, 2026-11-23).
- Magnetic's tile is the person's existing copy of the editor; no new app is made for it. Made while building it.
- "OS" is read as the Lumen desktop, the example's operating-system-like app (the owner left the open questions to this
  design, 2026-11-23).
- No starter copy that drops the code-run parts: Northwind without its emits and section flags cannot change section,
  and the desktop without its functions opens no window. Made on 2026-11-23 after trying the conversion.

## As built
- Magnetic `src/server/startMagnetic.ts` (`appsBoardRoute`): the person's editor copy first on `/orgs/me`; text
  `apps.editorNote` in `src/http/text.ts`.
- Test: `src/apps/AppsPage.test.ts` (Magnetic first on the own space, once).

## Rules and Constraints
- Starter apps have the same ids in every workspace; links to them are refused.
- A starter app is pure StateUI: no host function beyond what Magnetic gives every app.
