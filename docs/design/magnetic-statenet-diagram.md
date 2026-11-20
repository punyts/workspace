# Statenet as a StateUI document

Status: built (2026-11-19).

Asked for on 2026-11-19, in the hard IP design: "The idea is that we can create anything with the stateui, including
something as complex as magnetic. We need to include the layout so we don't lose that ability."

Asked on 2026-11-19, choosing how: "Graph as a document (Recommended), but I want to make sure that the pan, zoom, etc. is
also handled by state", and on the cards: "I'm not sure building card layouts into the treeDiagram is the right way to go.
Shouldn't we let the consumer decide what cards to use?"

Asked on 2026-11-19: "Build it". The open questions were left unanswered, so the defaults below were built.

## The problem

Magnetic's Statenet view drew the owner's tree with its own code: a layout of cards in two sides and columns, curves
and links across, and the board's pan and zoom in `shell.ts`. `stateui-components` had `treeDiagram`, which did the same
layout through `layoutTree`, but with a fixed card and no pan or zoom. StateUI could not build the view Magnetic had,
and Magnetic carried a second layout engine.

## The design

Three pieces, each usable on its own: `treeDiagram` takes the consumer's card, the `viewport` component pans and zooms
through state, and Statenet is a page of Magnetic's that holds both.

### 1. `treeDiagram` draws the consumer's card

`card` is a node with `row: true`, as `board`'s `card` is: the consumer's template, drawn once per record with `$row`
linked to the record. The card decides its look; the record carries what the look depends on (Statenet's records hold
`corners`, `elevation`, `muted`, `current`, `noAdd` and the texts). A press inside the card acts through the card's own
`on`, with `$row` in its commands and emits. With no `card` the diagram draws a label-and-note card, a template node in
the controller (`DEFAULT_CARD`), so it takes the consumer's path.

What stays the diagram's:
- **Layout.** The controller measures each drawn card at its used size, rounded up so a fraction of a pixel does not make
  the diagram overflow, and passes the sizes to `layoutTree`. A card that changes size is measured again
  (`ResizeObserver`). A card sets `--layout-contain: normal`, so the layouts inside it size to their content.
  `wrapField` (default `wrap`) marks the records that may share a block of leaves.
- **Edges.** The tree's curves and the links across, drawn in one SVG under the cards.
- **Selection.** A press on a card selects it (`select`), a double press or Enter opens it (`open`), both with
  `{ id, box }`; `box` is the card's place in the diagram, which `viewport`'s `lookAt` takes. A press on the selected
  card, or between the cards, lets it go (`select` with `''`). A press on a control inside the card (a button, a link, a
  field) is the card's own. The selected card has the diagram's ring (token `selected`). The cards are a `tree` of
  `treeitem`s with one tab stop; the arrows move along the tree.
- **`layout`** with `{ width, height }`, raised when a layout of a new size or a new number of cards is placed: the moment
  a viewport around the diagram can `fit` it.

`labelField`, `noteField`, `addable`, `_add` and the `add` event are removed. The cards live in the runtime map `cards`,
aliased at the node before the view is drawn.

### 2. What the layout needs to draw Statenet

- **Leaf blocks.** `leafBlock` (a width in pixels, 0 for none): the children of a card that wrap and have none of their
  own, two or more, stand in rows inside that width, as one block placed where the first would stand, with one edge to
  the block (to its first card), mirrored on the left side.
- **When links across show.** `linksShown`, `selected` (the default: lit while one end is selected) or `always`. A link's
  `kind` is written on its path as `data-kind`, and its `label` as the path's title. All links share one look (`link`).

"N more" and "Show fewer" are not the diagram's. They are records the consumer puts in `nodes`, drawn by its card.

### 3. `viewport`: pan and zoom as state

A layout component that holds one child (`content`) and moves it with one transform.

| Property | Type | Default | What |
|---|---|---|---|
| `x`, `y` | number | 0 | The offset of the content's origin in the viewport, in screen pixels. |
| `zoom` | number | 1 | The scale, between `minZoom` and `maxZoom`. |
| `minZoom`, `maxZoom` | number | 0.1, 4 | |
| `inset` | object | all 0 | `{ top, right, bottom, left }` in pixels: the area panels cover, which the commands leave out. |
| `grid` | boolean | false | The dot grid, which moves and scales with the content. |
| `pannable` | boolean | true | Whether the gestures pan and zoom. |

The component writes `x`, `y` and `zoom` on a drag, the wheel (pans), Ctrl and the wheel or a pinch (zooms around the
pointer) and the keyboard, at most once a frame while a gesture runs. A document links them to where it keeps them, and
any writer of those paths moves the view.

Commands: `zoomIn` and `zoomOut` (a step of 1.25 around the middle of the free area), `zoomReset`, `fit` (the content into
the free area, zoom at most 1) and `lookAt` (a box, the value or the `box` of the event's payload, into view, moving as
little as it can).

Events: `change` with `{ x, y, zoom }` when a gesture ends and after each command; `press` with `{}` for a press on the
empty area (the viewport or the world, not the content) that does not pan.

The controllers of `viewport` and `treeDiagram` read layout. The renderer in `stateui` never does.

### 4. Statenet, the page

`magnetic-statenet` is a `PageSpec` (`magnetic/src/statenet/StatenetPage.ts`) with de/fr/es locales, served to a signed-in
person at `/assets/statenet.json`, as the editor's page is. Its one screen is a `viewport` keyed `canvas` (`grid`,
the window's height) holding a `treeDiagram` with `twoSided: true`, `columns: 2`, `leafBlock: 420` and a `card`: a `card`
component whose `corners`, `elevation` and `selected` come from the record, with the kind (an accent caption), the label
(muted when unused) and the note, and a small round + (`plus`, named by `addLabel`, hidden by `noAdd`) that emits `add`
with the record's id.

Its data is `$.data.statenet`, written by the page script (`magnetic/src/http/views.ts`):
- `nodes`: one record per card (`id`, `parent`, `wrap`, `label`, `kind`, `note`, the flags and the look), from the
  `/graph` answer and what the script shows (`shownNodes`, the unused cap `UNUSED_SHOWN`, the opened branches). A
  branch with more shows a pill `<path>#more`; selecting it opens or closes the branch.
- `links`: the edges across the tree whose two ends show.
- `selected`: the chosen path, also written when the side panel opens on a card.
- `view`: `{ x, y, zoom }`, linked to the viewport's `x`, `y` and `zoom`.
- `inset`: what the editor's panels and the side panel cover.

The page's emits, and what the script does:
- `select` with `{ id, box }`: the side panel opens on the card (a branch or the owner gets a small one with its path);
  an empty id closes it. `open` does the same.
- `add` with the record's id: the + form in the side panel.
- `press`: the side panel closes. Escape also closes it.
- `view` with `{ x, y, zoom }` after a pan or a zoom: kept per app in `localStorage` (`magnetic.statenet.<appId>`) and
  shown in the editor's zoom control.
- `layout`: the first one fits the tree, unless a view was kept.

The editor's zoom control drives the canvas while Statenet shows: `shell.ts`'s `magneticShell.canvas.drive(driver)` makes
its emits and keys (`=`, `-`, `0`, `1`) call the driver, which runs the viewport's commands through the host panel
(`command` on the node keyed `canvas`); `drive(null)` gives them back to the board. `showZoom` writes the shown zoom.
Finding the canvas by its key is the one place the script names a node, as the editor's page does with `stage`.

The page lies over the board in its own frame (`#statenet`), above the board's world, which is hidden while it shows;
the editor's frame and the side panel lie above it.

### The screens board

The screens view keeps `shell.ts`'s pan and zoom: its tiles are frames of the app being edited, mounted by code, and
moving them under a `viewport` needs a component that holds app frames, which is its own design.

## Decisions

- The consumer draws the card; the diagram owns layout, edges, selection and keys (owner, 2026-11-19).
- Pan and zoom are state on a component, linkable like any property (owner, 2026-11-19).
- The default card is a template node, not code, so it takes the consumer's path.
- `add`, `addable`, `labelField` and `noteField` are removed rather than kept beside the card slot.
- A card knows nothing of the diagram but its record: no slot fields. What a card's look depends on is a field of the
  record, written by the consumer, and the selected ring is the diagram's.
- A leaf block has one edge, to its first card.
- "N more" is a record the consumer draws, not a diagram feature.
- One link look; per-kind link colours are not designed.
- The editor's zoom reaches the canvas as a host-panel command on the node keyed `canvas`, not as app events.
- Defaults built for the questions left open (2026-11-19): the screens board keeps its own pan and zoom; the view stays
  per browser in `localStorage`; nothing loads lazily, since both components fit the bundle gate
  (`stateui-components/test/bundleSize.test.ts`).

## Rules and Constraints

- The renderer (`stateui`) never reads layout. Controllers may, and only `treeDiagram` and `viewport` measure here.
- The card template is JSON: no code, no `innerHTML`, no `on*` attributes. A card acts only through `on` commands and
  emits.
- `x`, `y` and `zoom` are written by the component at most once per frame during a gesture; a consumer that saves them
  saves on `change`.
- Statenet's page talks to Magnetic only through `$.data` and emits; the canvas found by its key is the one exception
  (`magnetic-show-views.md`). Every write to the owner's parts still goes through the person's tools on the server.
- Texts are in four languages; the `/graph` answer holds data, never words.
- Node keys of the graph are state paths, never integer-like.
- No backwards compatibility: `treeDiagram`'s removed properties are removed, and documents that use them fail
  validation until they use `card`.

## As built

stateui-components:
- `src/shared/diagram/layoutTree.ts`: `leafBlock`. Tests: `layoutTree.test.ts`.
- `components/composites/tree-diagram/`: `card`, `wrapField`, `linksShown`, `box` in `select` and `open`, `layout`, the
  press between the cards, the measuring and the `cards` alias. Tests: `test/composites/tree-diagram.browser.test.ts`,
  `test/catalog.browser.test.ts`.
- `components/composites/viewport/`: the component. Tests: `test/composites/viewport.browser.test.ts` (with a
  `treeDiagram` whose `select` runs `lookAt` through `$parent`, and "should raise press for a press on the empty area
  that does not pan, and not for one on the content"), `test/catalog.test.ts`.

example: `src/document/main.json`, the category map as a `viewport` around the diagram.

stateui-mcp: the showcase has both components (`showcase/examples/graphics.json`, `layout.json`).

magnetic:
- `src/statenet/StatenetPage.ts`, the page; `src/statenet/StatenetPage.test.ts` ("should serve a signed-in person the
  canvas around the tree, in every language, with the emits the page script acts on").
- `src/server/startMagnetic.ts`: `GET /assets/statenet.json`, and the page in `SitePages`.
- `src/http/views.ts`: the Statenet section (mount, records, emits, the kept view, the inset); the DOM graph is gone.
- `src/http/shell.ts`: `canvas.drive`, `showZoom` and `freeArea`.
- `src/http/text.ts`: `statenet.canvas`.
- `e2e/views.spec.ts`: the Statenet tests read the cards in the frame (`#statenet iframe`, `treeitem`s by `data-id`), at
  desktop and phone sizes.
