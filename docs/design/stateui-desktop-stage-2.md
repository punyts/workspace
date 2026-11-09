# Lumen stage 2: the `window` component

## Summary
A new composite in stateui-components, `window`, holds content with a title bar and frame buttons. It can be dragged
and resized when it sits in an `adhoc` layout. Lumen's composed `appWindow` and its focus code are replaced by it.

## Decisions
- **A composite like `panel`.** `window` has `layout: true`, so its content is laid out like a panel's. Its header
  holds an optional icon, the title and the frame buttons, and its body scrolls.
- **Properties.**
  - `_title`, `icon`.
  - `controls`: which frame buttons show, chosen from `snapLeft`, `snapRight`, `minimize`, `maximize` and `close`.
    The default is minimize, maximize and close.
  - `movable` and `resizable` (both `true` by default).
  - `active` (reflected): the window is in front, so its title bar shows the accent.
  - `maximized` (reflected): the maximize button shows Restore, and the window cannot be moved or resized.
  - `minWidth` and `minHeight` in pixels (240 and 160 by default).
  - Content labels: `_minimizeLabel`, `_maximizeLabel`, `_restoreLabel`, `_closeLabel`, `_snapLeftLabel`,
    `_snapRightLabel` and `_moveLabel`, with German text.
- **Events.**
  - One per frame button: `snapLeft`, `snapRight`, `minimize`, `maximize`, `close`. Double-clicking the title bar
    raises `maximize`. The window never hides or closes itself; the app decides what each event does.
  - `activate`: a pointer down anywhere in the window, or focus moving into it from outside. The app brings the
    window to the front.
  - `move` and `resize`, with `{ x, y, width, height }` in pixels, raised after the new placement is written.
- **Dragging writes the placement on release.**
  - **Move:** pressing on the title bar outside its buttons and moving at least 4 px starts a move.
  - **Resize:** a drag on the right edge, the bottom edge or the bottom-right corner resizes the window, with
    `minWidth` and `minHeight` as the lower limits.
  - **During the drag:** only the element's inline `translate`, `width` and `height` change, and nothing is written.
    This is how `splitPane` and the 2D drag work.
  - **On release:** the window writes `placement.x`, `.y`, `.width` and `.height` as pixel lengths, measured from the
    layout box it sits in. It then raises one `move` or `resize` event. `z` is never written.
  - **Limits:** at least 48 px of the title bar stays inside the layout box, and the top edge never goes above it.
  - **Escape or a cancelled pointer** puts the window back.
- **Works with a bound placement.** A write below a bound path reaches its target, so a window with
  `"<-placement": "$.data.…"` moves its data record. A window that is not in an `adhoc` layout (no `x` and `y` in its
  placement) does not move or resize.
- **Keyboard.** The title bar is focusable and labelled with `_moveLabel` and the title.
  - Arrow keys move the window by 16 px, and Shift with an arrow key resizes it by 16 px. Each key writes the placement
    and raises `move` or `resize`.
  - Enter raises `maximize`.
  - Every frame button is a real button with its label.
- **New core icons:** `layout-sidebar`, `layout-sidebar-right` and `squares` (for Restore). They are added to the
  core list so `window` works without the app's icon list.

## Lumen changes
- Each window becomes a `window` node.
  - `hidden`, `placement`, `active` and `maximized` are bound to the desk state.
  - `controls` lists all five buttons.
  - Each `on` entry writes a desk command: `minimize files`, `snap files left`, `focus files` for `activate`, and so on.
- **A new `place <app>` command for `deskAct`.** After a move or resize, the window's bound placement already holds
  the new pixels. `place` reads them into the free geometry and sets `snap` to `free`, so a snapped or maximized
  window that is dragged becomes a free window where it was dropped.
- `deskAct` also derives `focused` and `maximized` per app for the bindings.
- **Removed:** the composed `appWindow` and the pointer-down focus code in `bootstrap.ts`.

## Not in this stage
- Resizing from the left or top edge (which would also move the window).
- Snapping by dragging a window to a screen edge.

## Checks
- **Component browser tests:**
  - drag the title bar to move, and drag the edge and corner to resize, each with one write on release and limits on
    each side;
  - Escape cancels a drag;
  - the keyboard moves and resizes;
  - the frame buttons raise their events, and the title bar's double click and Enter raise `maximize`;
  - `activate` is raised once per press;
  - a bound placement moves its data;
  - a window outside an `adhoc` layout does not move;
  - `maximized` blocks dragging and shows Restore;
  - German labels.
- **Catalog and MCP:** the catalog test lists `window` among the later composites, and the MCP tests still pass.
- **Lumen browser tests:** dragging a window moves it and keeps it in the desk state; dragging a snapped window frees
  it; pressing a window brings it to the front through `activate`.

## What building it found
- **Built as designed.** `window` is in stateui-components with `src/shared/window/geometry.ts` (11 unit tests) and
  12 browser tests. Lumen's six windows are `window` nodes, `deskAct` has `place <app>` and the `focused` and
  `maximized` maps, and the focus code and the composed `appWindow` are gone from Lumen. A real mouse drag in the
  browser pane moves a window and the desk state follows it.
- **Northwind places it too.** The Northwind coverage test needs every catalog component in its document, so the
  warehouse section has a "Shift notes" window. It sits in a column, so it shows as a framed panel and does not drag.
- **An `adhoc` area has no height of its own.** Its children are absolutely placed, so a panel with an `adhoc` layout
  is as tall as its padding unless code sizes it, as Lumen's bootstrap does for the surface. That is why Northwind's
  window is not in an `adhoc` area. A `height` (or `minHeight`) on `panel`, or a layout setting, would let a document
  do it.
- **A window can hang over the taskbar.** The window keeps 48 pixels of its title bar and its top edge inside the
  surface but not its bottom edge, and the surface does not clip, so a tall window dragged low covers the taskbar.
  Clipping the `adhoc` host (an `overflow` layout setting) or clamping the bottom edge in Lumen would fix it.
- **Synthetic pointers cannot be captured.** `setPointerCapture` throws for a pointer the browser does not know, so the
  controller tries it and drags without capture when it fails. The tests drive drags with synthetic pointer events.
- **Two slow tests.** The library tests that build the whole library and every Tabler icon passed 5 seconds when the
  suite ran in parallel; both now have a 30 second timeout.
- **The MCP showcase needs every component.** stateui-mcp's showcase has a `window` card on the layout screen (a framed
  panel, as in Northwind), and `npm run showcase:build` rewrote its parts. Its headless preview runs the runtime bundle
  of stateui-app, which holds the components, so `npm run build:runtime-bundle` there is needed after a new component;
  until then the preview reports `SUI-NODE-UNKNOWN`.
- **Results.** stateui-components: 1524 unit and 1993 browser tests. Example: 126 tests, both documents valid, and
  the build. stateui-mcp: 1005 tests.
