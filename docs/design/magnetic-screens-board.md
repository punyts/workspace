# The screens board as a StateUI page, with apps in the page

Status: B1, B2 and B3a built (2026-11-19); B3b, B3c and B4 proposed.

Asked for on 2026-11-19: "Let's do it all", on moving the screens board onto `viewport` after Statenet moved
([magnetic-statenet-diagram.md](magnetic-statenet-diagram.md), "The screens board").

Asked on 2026-11-19, on how an app gets into the page: "I don't want to use iframes, they present CORS issues. A
browser should be able to hold multiple stateui apps, right? We are changing this to use the stateui so we can edit the
editor and prove that this is powerful enough to make anything." Then: "Yes, rewrite it", for a design around an app
component in the page, with no frames. Then: "Start building B1".

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

One thing stood in the way, and B1 removed it: the node resolver and node options in `stateui` were module-wide, and the
latest `mountApp` owned them.

## The design

### 1. Per-app node resolver and options (`stateui`)

The resolver and the node options belong to an app root, not to the module. `mount(host, store, path, options)` takes
`resolver` and `nodeOptions` beside `callable`, and a `<sui-node>` reads those of the nearest mounted root above it
when it attaches (`findNodeSettings`). They are kept beside the root's mount context, not in it, so a scope sees only
its store, base path and callable. `mountApp` passes its library's resolver and its options to its own root. Two apps
on different libraries, or with different theme mappers, render side by side, and disposing one leaves the other's
untouched.

### 2. `embeddedApp`: an app inside a node (`stateui-components`, `stateui-app`)

A component that mounts another StateUI app inside itself, in the same page.

| Property | Type | What |
|---|---|---|
| `app` | string | The app's name, as the page's host knows it. Never a URL. |
| `appScreen` | string | The screen it opens on, and moves to when this changes. |
| `width`, `height` | number | The app's own size in pixels, before any zoom around it (800 by 600). |
| `live` | boolean | The app itself: synced, takes input. False is a preview: it shows, is `inert`, and keeps nothing. |
| `active` | boolean | Whether it is mounted now (true). False shows `_label` instead, and a mounted app is disposed. |
| `_label` | string | The app's or screen's name, shown while not mounted and read by screen readers. |

Events: `press` on a preview (pressed, Enter or Space on it) and `menu` (a right press, the context-menu key,
Shift+F10), both with `{ app, screen }`; `navigated` with `{ screen }` when a live app moves to another screen itself;
`emit` with `{ name, payload }` for each emit of the app inside.

The component asks for the app with an event, as `scene3d` asks for its chunk: it raises the bubbling, composed
`ui-app-open` (`APP_OPEN_EVENT`) on its element with an `AppOpenRequest`, what it asks (`AppAsk`: `app`, `screen?`,
`live`), the element to mount in, `onEmit`, `onNavigate`, and `respond`, which takes the promise of an
`EmbeddedApp` (`navigate(screen)`, `dispose()`). The `mountApp` of the page answers it when it was given an **app
host** (`MountOptions.apps`, an `AppHost`), as the function catalogs are passed: `answerAppRequests`
(`stateui-app/src/dom/embed/`) stops the event and calls `apps.open(ask)`, which resolves to an `OpenedApp` (the
document, its library, `mode`, `instance`, `functions` and `apps` options, its hooks) or rejects. The answer mounts it
with `mountApp` in the request's element with `route: false` and `embedded: true`, moves it to the asked screen, and
watches `$.route` to call `onNavigate`. Without an app host, or when it refuses, the component shows `_label`; a
refusal is a warning naming the app. The component disposes the app when `active` turns false, `app` or `live`
changes, or the node goes; a change of `appScreen` only navigates it.

The child app has its own store, resolver and root; nothing of it is in the parent's state, and the parent reaches it
only through the component's properties and events. The dispatcher of each app runs a node's `on` only for events
raised inside its own store (the first library element on the event's path), so a press inside the child never runs
the parent node around it. The file and 3D requests (`transferFile`, `readFile`, `releaseFile`, `load3d`) are answered
only by the app they are raised in, so an app never lends its hooks to the app inside it; an app without the hook lets
the request go on to the page.
`embedded: true` sets `$.runtime.embedded`, and the `app` root then leaves the document title alone.

Previews take the live app's data: the host gives a preview's `OpenedApp` `follows`, the live app's store. Its
`$.data` is copied into the preview's document at mount, and each change after is written to the preview's store, in
the same page, with no messages. `mounted(app)` and `disposed(app)` tell the host when an app comes and goes, so it
can hand the live store to previews.

### 3. Magnetic's app host

`magnetic/src/http/apps.ts` (new) is the editor's app host. It resolves an app name for the signed-in person, as
`/edit/<id>` does now, loads the assembled document, and for the live app opens the sync client the frame's runtime
opens today, on the editor's own origin. It refuses an app the person may not open. The runtime port is no longer used
by the editor.

What the frames did for the page, and what replaces it:
- **The inspector** asks the live app about its nodes through `stateuiHost.inspect` and messages. In the page it reads
  the mounted app's elements directly, and its overlay sits inside the `embeddedApp` node, so it pans and zooms with it.
- **Host keys** (`data-host-keys`) were chords the frame gave back to the page. In the page a key goes to whatever has
  focus, and the editor's chords are handled where they are pressed.
- **`stateui:emit` and `stateui:change`** were raised on the window by the frame host. The `embeddedApp` component raises
  `emit`, and the app host gives the page the live store's changes.

### 4. The board as a page

`magnetic-screens` is a `PageSpec`, as Statenet's is. Its screen is a `viewport` keyed `canvas` (`grid`, the window's
height) around a `board` of cards in rows of `columns`, one per screen, each holding an `embeddedApp` node: the live one for
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

### 5. B3 in steps

What the frames carry today, and so what B3 moves into the page:
- The editor page loads no component library: `/assets/host.js` (`stateui-mcp/src/browser/host.ts`) puts each app in an
  iframe served from the runtime origin (`MAGNETIC_RUNTIME_PORT`), which runs the runtime bundle (`startRuntime`).
- The live app (`LiveView`) syncs through `createSyncClient` over `/apps/<id>/sync` and passes loads and writes into its
  frame by `postMessage`; the view messages (app, command, locale, theme, deleted, rejected) go the same way. A preview
  (`PageView`, `stateuiHost.mount`) is standalone and fed `$.data` from `stateui:change`.
- The inspector (`inspect.ts`) and the views' layers (`views.ts`) ask the frames with `stateuiHost.inspect` and
  `panelOf(name).inspect`; the answer is `stateui-app/src/runtime/inspect.ts`'s, in the frame's own pixels.
- The editor panels and Statenet are frames too; they move in B4.

Steps:
- **B3a: the page bundle and the in-page live app.** A page bundle beside the runtime bundle: `stateui-app`'s
  `mountApp`, the component library and the runtime core (`createRuntime`), set on `window.stateuiPage`, served by
  the app server (and so by Magnetic, which embeds it) on its own origin with the 3D chunk beside it. `LiveView` runs
  the runtime core in the page on an element instead of a frame, with the same protocol messages handed over by call,
  so the sync client, the view messages, the reports and the files work as they do for a frame. `stateuiHost.apps` is
  the page's `AppHost`: the live app is attached in an `embeddedApp`'s element (`AttachedApp`), and a preview
  follows its store. `inspect` and `watch` run on the app's own element and answer in its pixels, divided by the zoom
  around it.
- **B3b: the board as the `magnetic-screens` page.** The `PageSpec` of section 4, mounted with `mountApp` and that app
  host; `screens.ts` keeps its board logic (names, menu, order, add) and writes `$.data.screens` instead of DOM;
  `shell.ts`'s pan and zoom and `#world` go to the `viewport`.
- **B3c: the inspector, the views' layers and the e2e.** `inspect.ts` and `views.ts` reach the live app and previews
  through their `embeddedApp` elements; `e2e/fixtures.ts`, `screens.spec.ts` and `editor.spec.ts` find the apps in the
  page instead of with `frameLocator`. `views.ts` is changed after the statenet work in it is committed.

## Stages

| Stage | Delivers |
|---|---|
| B1 | Per-app resolver and node options in `stateui`; two apps on different libraries in one page. |
| B2 | The `embeddedApp` component and `mountApp`'s app host; a live app and previews of it in one page. |
| B3 | Magnetic's app host and the board as the `magnetic-screens` page; the live app and previews leave their frames. |
| B4 | The editor's panels and Statenet leave their frames the same way, until the editor is StateUI apps in one document. Its own design. |

## Checks

- **B1:** two apps on different libraries and themes in one page each render their own components and tokens, and
  disposing one leaves the other working (`stateui`, browser test).
- **B2:** an `embeddedApp` node mounts the app its host gives, follows `appScreen`, disposes it when `active` is false, shows
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
- The component is `embeddedApp`, not `app`: `app` is the root component of every app document. Its screen is
  `appScreen`, not `screen`: the route validator reads a string `screen` property (as on `link` and `menuItem`) as a
  screen of the page's own app.
- The in-page live app reuses the runtime core and its messages rather than a second path into `MountedApp`: the
  frame and the page then share one tested implementation of loads, writes, commands, files and inspect, and the frame
  stays available while B3b and B3c move Magnetic over.
- An app in the page runs on the page's origin. Its expressions need `'unsafe-eval'` (`@punyts/expression` evaluates
  literals with `Function`), which the page's policy now allows (`APP_PAGE_CSP`), and the app can reach what the page
  can: cookies, storage and the server. The frame isolated this with its own origin and `connect-src 'none'`. This is
  safe for the editor, where every app is the signed-in owner's own; an app from another owner must not be mounted in a
  page. To confirm with the owner before B3b ships it.
- The component asks for its app with a request event the page's `mountApp` answers, as `scene3d` asks for its chunk;
  it imports nothing of `stateui-app`, and an app inside an app answers its own requests.

## Rules and Constraints

- `stateui` writes the DOM synchronously and never reads layout. The `embeddedApp` controller does not measure; the page script
  decides which tiles are active from state.
- A document names an app and a screen, never a URL. The app host resolves the name for the signed-in person and
  refuses what they may not open.
- A child app's state is its own: the parent never links into it, and it never writes the parent's.
- The page talks to Magnetic only through `$.data` and emits; the canvas found by its key is the one exception.
- No backwards compatibility: the module-wide resolver and options are gone, and the board's code in `shell.ts` and
  `screens.ts` goes when the page replaces it.

## As built

B1:
- `stateui/src/component/context.ts`: `mount`'s `resolver` and `nodeOptions`, `findNodeSettings`.
  `stateui/src/node/options.ts`: the types, with `NodeSettings`; `stateui/src/node/SuiNode.ts` reads them when it
  attaches. Tests: `stateui/src/node/SuiNode.browser.test.ts` ("should render each root with its own resolver and
  options, and keep one working when the other is unmounted").
- `stateui-app/src/dom/mount/mountApp.ts` passes them to `mount`. Tests:
  `stateui-app/src/dom/mount/mountApp.browser.test.ts` ("should render two apps on different libraries side by side, and
  keep one working when the other is disposed").

B2:
- `stateui-app/src/dom/embed/`: `types.ts` (`APP_OPEN_EVENT`, `AppAsk`, `AppOpenRequest`, `EmbeddedApp`, `OpenedApp`,
  `AppHost`), `answer.ts` (`answerAppRequests`). `stateui-app/src/dom/mount/types.ts`: `MountOptions.apps` and
  `embedded`, `$.runtime.embedded`; `mountApp.ts` answers requests while mounted. `stateui-app/src/dom/on/dispatcher.ts`:
  events and requests raised in another store are ignored. Tests:
  `stateui-app/src/dom/on/dispatcher.browser.test.ts` ("should not answer a request raised in another app’s store, and
  let it go on").
- `stateui-components/components/composites/embedded-app/`: the component. `components/composites/app/app.controller.ts`
  leaves the title alone when embedded. `test/harness/createMountComponent.ts` passes `apps`. Tests:
  `stateui-components/test/composites/embedded-app.browser.test.ts` (mounts and follows `appScreen`, the label without a
  host or when refused, `active`, `emit` and `navigated` without running the page node, a preview that is inert,
  follows the live data and raises `press` and `menu`).
- `example/src/document/main.json` places an `embeddedApp`; `stateui-mcp/showcase/examples/layout.json` shows one.

B3a:
- `stateui-app/src/runtime/createRuntime.ts`: the runtime core (`RuntimeCore`, `inPage`, `chunkBase`);
  `startRuntime.ts` is its frame shell; `page.ts`: `StateuiPage`, `PAGE_GLOBAL`; `load3d.ts` takes a base.
  `runtime-bundle/page-entry.ts` and `build.ts` build the page bundle (manifest `page`).
  `src/dom/embed/types.ts` and `answer.ts`: `AttachedApp`. Tests: `src/runtime/createRuntime.browser.test.ts`,
  `src/dom/embed/answer.browser.test.ts`, `runtime-bundle/build.test.ts` ("should write the page bundle beside the
  runtime, name it in the manifest and replace it on the next build").
- `stateui-mcp/src/browser/host.ts`: `LiveView.surface`, `attach`, `liveStore`, `onRuntimeData`; `stateuiHost.apps`.
  `src/infrastructure/http/`: `runtimeBundle.ts` reads the page bundle, `HttpServer.ts` serves
  `/assets/page/<hash>.js` and `/apps/:appId?surface=page`, `pages.ts` the page variant, `security.ts`
  `APP_PAGE_CSP`. Tests: `stateui-mcp/test/browser.integration.test.ts`, "the live app in the page, B3a of the
  screens board" (no frame and the policy, a tool write shown, typing synced, inspect under a zoom, attached to an
  element of the page, a preview and a refused app).
