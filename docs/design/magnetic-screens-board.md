# The screens board as a StateUI page, with apps in the page

Status: proposed 2026-11-19. Nothing here is built.

Asked for on 2026-11-19: "Let's do it all", on moving the screens board onto `viewport` after Statenet moved
([magnetic-statenet-diagram.md](magnetic-statenet-diagram.md), "The screens board").

Asked on 2026-11-19, on how an app gets into the page: "I don't want to use iframes, they present CORS issues. A
browser should be able to hold multiple stateui apps, right? We are changing this to use the stateui so we can edit the
editor and prove that this is powerful enough to make anything." Then: "Yes, rewrite it", for a design around an app
component in the page, with no frames.

## The problem

Statenet is a StateUI page: a `viewport` whose `x`, `y` and `zoom` are state, around a `treeDiagram`. The screens board
is not. `shell.ts` pans and zooms `#world` with its own code, and `screens.ts` lays out the tiles, mounts the previews,
drags tiles to reorder, opens the tile menu and switches to name tiles when zoomed out. The editor has two pan-and-zoom
implementations, and the board is the one part of the editor that a person's copy of the editor cannot change.

Every app in the editor runs in an iframe: the live app (`#artboard`), each preview, the editor's panels and Statenet.
The frames are not StateUI's. They come from the live-view host (`stateui-mcp/src/browser/host.ts`), which puts each
runtime in a sandboxed frame served from a second origin, the runtime port, so that an app cannot reach the page. That
second origin is the source of the cross-origin trouble, and a frame is a wall a `viewport` cannot move through: the
viewport's transform moves only what is in its own document.

StateUI does not need the frames:
- `mountApp(host, document, library, hooks, options)` mounts an app on any element.
- Each app gets its own root element (`ensureAppRoot`) with its own token sheet, so two themes do not collide.
- Neither `stateui` nor `stateui-app` listens on `document` or `window`.
- A document cannot run code: no `eval`, no `new Function`, no `innerHTML` for text, no `on*` attributes or
  `javascript:` URLs, and expressions only through `@punyts/expression`. Running several apps in one page needs no
  origin wall around each.

One thing stands in the way: `setNodeResolver` and `setNodeOptions` in `stateui` are module-wide, and the latest
`mountApp` owns them.

## The design

### 1. Per-app node resolver and options (`stateui`)

The resolver and the node options belong to an app root, not to the module. `mount(host, store, options)` takes
`{ resolver, nodeOptions }`, and a `<sui-node>` asks the nearest app root above it (the host it was mounted under) for
them. `setNodeResolver` and `setNodeOptions` are removed. Two apps on different libraries, or with different theme
mappers, then render side by side, and disposing one leaves the other's untouched.

### 2. The `app` component: an app inside a node (`stateui-components`, `stateui-app`)

A component that mounts another StateUI app inside itself.

| Property | Type | What |
|---|---|---|
| `app` | string | The app's name, as the page's host knows it. Never a URL. |
| `screen` | string | The screen it opens on, and moves to when this changes. |
| `width`, `height` | number | The app's own size in pixels, before any zoom around it. |
| `live` | boolean | The app itself: synced, takes input. False is a preview: it shows, takes no input, and keeps nothing. |
| `active` | boolean | Whether it is mounted now. False shows `_label` instead, and a mounted app is disposed. |
| `_label` | string | The app's or screen's name, shown while not mounted and read by screen readers. |

Events: `press` on a preview (pressed, or Enter on it) and `menu` (right click, the context-menu key), both with
`{ app, screen }`; `navigated` with `{ screen }` when a live app moves to another screen itself; `emit` with
`{ name, payload }` for each emit of the app inside.

The component reaches apps through an **app host**, an adapter the page passes to `mountApp` (`options.apps`), as the
function catalogs are passed: `apps.open({ app, screen, live })` resolves to what to mount (the document, its library,
the mode, the persona's instance, and for a live app its sync connection) or to a refusal. Without an app host the
component shows `_label`. The controller calls `mountApp` on its own element with what the host gave, and disposes it
when `active` turns false or the node goes. The child app has its own store; nothing of it is in the parent's state,
and the parent reaches it only through the component's properties and events.

Previews take the live app's data: the app host gives a preview a read-only view of the live app's `$.data`, kept in
step in the same page, with no messages.

### 3. Magnetic's app host

`magnetic/src/http/apps.ts` (new) is the editor's app host. It resolves an app name for the signed-in person, as
`/edit/<id>` does now, loads the assembled document, and for the live app opens the sync client the frame's runtime
opens today, on the editor's own origin. It refuses an app the person may not open. The runtime port is no longer used
by the editor.

What the frames did for the page, and what replaces it:
- **The inspector** asks the live app about its nodes through `stateuiHost.inspect` and messages. In the page it reads
  the mounted app's elements directly, and its overlay sits inside the `app` node, so it pans and zooms with it.
- **Host keys** (`data-host-keys`) were chords the frame gave back to the page. In the page a key goes to whatever has
  focus, and the editor's chords are handled where they are pressed.
- **`stateui:emit` and `stateui:change`** were raised on the window by the frame host. The `app` component raises
  `emit`, and the app host gives the page the live store's changes.

### 4. The board as a page

`magnetic-screens` is a `PageSpec`, as Statenet's is. Its screen is a `viewport` keyed `canvas` (`grid`, the window's
height) around a `board` of cards in rows of `columns`, one per screen, each holding an `app` node: the live one for
the screen worked on, previews for the rest. Its data is `$.data.screens`:
- `tiles`: one record per screen (`id` the screen name, `title`, `live`, `active`, `width`, `height`).
- `columns`, as Screens in a row sets it.
- `view`: `{ x, y, zoom }`, linked to the viewport, kept per person and app on the server as Statenet's is
  (`editor_view` with `view = 'screens'`).
- `names`: true while zoomed below `NAMES_BELOW_ZOOM` or with more than `MOST_IN_VIEW` tiles in view; the cards show
  their names and no app is active.

The page script (`screens.ts`) writes these and sets `active` for the tiles in view from the view and the tile places,
so only those are mounted. It acts on the emits: `press` makes the screen the one worked on, `menu` opens the tile
menu, `board`'s reorder event posts the new order, `navigated` follows the live app to its screen, and `view` keeps
the view. With no screens the board holds one card, Add a screen, which emits `add`.

The zoom control drives the canvas through `command` on the node keyed `canvas`, as for Statenet. `shell.ts`'s board
pan and zoom, `#world`, and the board's DOM in `screens.ts` are removed.

## Stages

| Stage | Delivers |
|---|---|
| B1 | Per-app resolver and node options in `stateui`; two apps on different libraries in one page. |
| B2 | The `app` component and `mountApp`'s `apps` adapter; a live app and previews of it in one page. |
| B3 | Magnetic's app host and the board as the `magnetic-screens` page; the live app and previews leave their frames. |
| B4 | The editor's panels and Statenet leave their frames the same way, until the editor is StateUI apps in one document. Its own design. |

## Checks

- **B1:** two apps on different libraries and themes in one page each render their own components and tokens, and
  disposing one leaves the other working (`stateui`, browser test).
- **B2:** an `app` node mounts the app its host gives, follows `screen`, disposes it when `active` is false, shows
  `_label` without a host, and a preview follows the live app's data and takes no input (`stateui-components`).
- **B3:** Magnetic's e2e passes with no iframe on the board: select and edit a node of the live app, drag a component
  onto it, reorder screens, zoom out to names and back, and the board opens where it was left in a new browser.

## Decisions

- No frames: apps share the page, each with its own root, store and resolver (owner, 2026-11-19).
- An app in a page is a component, reached through an app host the page passes in; a document names apps, never URLs
  (owner, 2026-11-19).
- The tiles are reordered with `board`'s own drag and its event; the board's drag and drop slot in `screens.ts` go
  (owner, 2026-11-19).
- The name tiles are a mode of the page: the script writes `names` in `$.data.screens` from the zoom and the tiles in
  view, and no app is active while it holds (owner, 2026-11-19).
- The board's view is kept as Statenet's is, per person and app on the server.

## Rules and Constraints

- `stateui` writes the DOM synchronously and never reads layout. The `app` controller does not measure; the page script
  decides which tiles are active from state.
- A document names an app and a screen, never a URL. The app host resolves the name for the signed-in person and
  refuses what they may not open.
- A child app's state is its own: the parent never links into it, and it never writes the parent's.
- The page talks to Magnetic only through `$.data` and emits; the canvas found by its key is the one exception.
- No backwards compatibility: `setNodeResolver` and `setNodeOptions` are removed, and the board's code in `shell.ts`
  and `screens.ts` goes when the page replaces it.
