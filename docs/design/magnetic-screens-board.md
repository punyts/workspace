# The screens board on `viewport`

Status: proposed 2026-11-19. Nothing here is built.

Asked for on 2026-11-19: "Let's do it all", on moving the screens board onto `viewport` after Statenet moved
([magnetic-statenet-diagram.md](magnetic-statenet-diagram.md), "The screens board").

## The problem

Statenet is a StateUI page: a `viewport` whose `x`, `y` and `zoom` are state, around a `treeDiagram`. The screens board
is not. `shell.ts` pans and zooms the board's world with its own code, and `screens.ts` lays out the tiles, mounts the
previews, drags tiles to reorder, opens the tile menu and switches to name tiles when zoomed out. The editor therefore
carries two pan-and-zoom implementations, and the board is the one part of the editor that a person's copy of the
editor cannot change.

The board cannot be a document today because its tiles are apps: the live frame is the person's app in its own frame
(synced, inspected, edited), and each preview is a host panel (`stateuiHost.mount`) loaded with the app's document on
one screen. No component holds an app.

## The design

### 1. `appFrame`: a component that holds an app

A component in `stateui-components` (category `layout`) that reserves a box for an app and lets the host fill it.

| Property | Type | What |
|---|---|---|
| `app` | string | The app's id, as the host knows it. |
| `screen` | string | The screen the app shows. |
| `width`, `height` | number | The box, in pixels: the app's own size, before any zoom around it. |
| `live` | boolean | The live app (synced, takes input) rather than a preview (no input, a cover over it). |
| `active` | boolean | Whether the host should mount it now. False shows `_label` in the box instead. |
| `_label` | string | The screen's name, shown while not mounted and read by screen readers. |

Events: `press` (the cover was pressed, or Enter on it), `menu` (right click, the context-menu key, or its ⋯ button),
both with `{ app, screen }`.

The component never creates a frame. It renders an empty box marked with the app and screen, and calls a **frame
host** that the consumer passes to `mount` (stateui-app's mount adapters, as storage and functions are passed in):
`frames.attach(box, { app, screen, live })` returns a handle with `dispose()`. Magnetic's frame host mounts its live
frame or a preview panel there. Without a frame host the box shows `_label`. This keeps `stateui` and its components
free of frames, `src` attributes and anything a document could point at another origin.

`active` is the consumer's: Magnetic sets it for the tiles in view, from the viewport's `x`, `y`, `zoom` and the tile
places, so only those are mounted (today's weight rule) without the component reading the viewport.

### 2. The board as a page

`magnetic-screens` is a `PageSpec`, as Statenet's is: a `viewport` keyed `canvas` (`grid`, the window's height) whose
content is a `board` of `appFrame` cards, one per screen, in rows of `columns`. Its data is `$.data.screens`:
- `tiles`: one record per screen (`id` the screen name, `title`, `index`, `live`, `active`, `width`, `height`).
- `columns`, kept per app (as today, in this browser, until the person's state holds editor settings).
- `view`: `{ x, y, zoom }`, linked to the viewport, kept per person and app on the server as Statenet's is
  (`editor_view` with `view = 'screens'`).
- `names`: true while zoomed below `NAMES_BELOW_ZOOM` or with more than `MOST_IN_VIEW` tiles in view; the cards show
  their names and no frame is active.

The page script (`screens.ts`) writes these and acts on the emits: `press` makes the screen the one worked on, `menu`
opens the tile menu in the side panel's place, the board's reorder event posts the new order, and `view` keeps the view.

### 3. What stays the shell's

- The **inspection overlay** (the boxes over the live frame's nodes) is drawn over the live frame by `inspect.ts`. It
  reads the live frame's place from the frame host's handle (`handle.box()`), not from the board's own layout.
- The **zoom control and its keys** drive the canvas through the host panel's `command` on the node keyed `canvas`, as
  for Statenet (`magneticShell.canvas.drive`). `shell.ts`'s board pan and zoom are removed.
- **No screens**: the page shows one card, Add a screen, which emits `add`.

## Open questions

1. Is a frame host passed to `mount` the right seam, or should Magnetic place its frames over the page's boxes from
   outside (as the editor's frame lies over the board today), keeping `stateui-app` without the adapter?
2. Should `board`'s drag reorder serve the tiles, or does the screens board keep its own drag with a drop slot?
3. The name tiles: a mode of the page (`names` in the data) or a property of `appFrame` that the viewport's zoom drives?

## Decisions

- No component creates a frame; the host fills a reserved box (proposed).
- The board's view is kept as Statenet's is, per person and app on the server (proposed).

## Rules and Constraints

- `stateui` never reads layout; `appFrame`'s controller may measure its own box, and only the page script decides
  which tiles are active.
- A document cannot name a URL for a frame: `app` and `screen` are names the frame host resolves for the signed-in
  person, and it refuses what they may not open.
- The page talks to Magnetic only through `$.data` and emits; the canvas found by its key is the one exception.
- No backwards compatibility: the board's code in `shell.ts` and `screens.ts` is removed when the page replaces it.
