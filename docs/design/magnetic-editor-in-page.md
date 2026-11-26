# The editor as StateUI apps in one document

Status: B4a built (2026-11-19), B4b, B4c, B4d and B4e built (2026-11-20). B4 of [magnetic-screens-board.md](magnetic-screens-board.md); builds on B3b and B3c.

Asked for on 2026-11-19: "Start B4 of the screens board". B4 there reads: the editor's panels and Statenet leave their
frames the same way as the board, until the editor is StateUI apps in one document. The ask behind the whole board work
(2026-11-19): "We are changing this to use the stateui so we can edit the editor and prove that this is powerful enough
to make anything."

Asked for on 2026-11-20, with the canvas still a page element under the editor: "Let's get this finished", and then
"Remember, these are all in the same DOM." The canvas moves into the editor's document (B4e, section 4).

## The problem

After B3 the board and the apps on it run in the page. Everything else in the editor still does not:
- The editor (`magnetic-editor`, `src/editor/EditorApp.ts`) is mounted by `shell.ts` with `stateuiHost.mount` in a
  runtime frame laid over the whole window. The frame reports the boxes of the `stage`'s children and the page clips the
  frame to them, so a click elsewhere reaches the canvas. The editor's chords (`mod+shift+e`, the tool keys) come back
  from the frame as `stateui:key`.
- Statenet (`magnetic-statenet`) is mounted by `views.ts` in a frame of its own (`#statenet`) over the board.
- Magnetic's sign-in and link pages (`appPage.ts`) and Your apps (`home.ts`) fill the window in a frame.
- The Theme and Logic views, and the side panel Statenet opens on a card (a dataset's records, a model's fields, a path,
  a unit, a connection, the + forms), are hand-written DOM in `views.ts` (`view-sheet`). A person's copy of the editor
  cannot change them.
- The page scripts (`shell.ts`, `screens.ts`, `views.ts`) each mount their own app and decide in code which one shows.

## The design

### 1. Magnetic's own apps in the page

`stateuiHost.mount(element, { document, icons, keys, inPage: true })` (B3a) runs a standalone app on an element of the
page with the runtime core, takes the same writes and commands and raises the same `stateui:raised` and `stateui:ready`
on `element`. The editor, Statenet, the app pages and Your apps use it. The editor page, the sign-in and link pages and
Your apps are served with `data-surface="page"`, the page bundle and `APP_PAGE_CSP`, which allows no frames.

What the frame did that the page now does:
- **Click-through.** The editor's `stage` lies over the canvas. In a frame the page clipped the frame to the stage's
  children. In the page the stage takes no pointer events and its children do: `panel` has `passThrough` (boolean,
  reflected): the panel's own area draws no surface (no background, border or shadow) and lets presses through to what
  lies under it; its children take theirs. The editor's screen root and its `stage` are `passThrough`. The `app`
  component has `seeThrough` (boolean, reflected), which leaves out the app's own surface; the editor's app node sets it
  (`app: { seeThrough: true }` in its definition). The element the editor is mounted on (`#editor`) takes no pointer
  events either. The clipping code in `shell.ts`, the box reports and the page's layer of panel shadows go; the panels
  cast their own shadows. `shell.ts` still reads where the stage's children are (`panel.watch`), so the canvas fits the
  app between them.
- **Keys.** A chord is a `keydown` on the page. `shell.ts` handles the editor's chords on the window, and leaves a key
  alone while the person types in a field of any app (`input`, `textarea`, `select`, `[contenteditable]`): it reads
  the key's own target from `composedPath()[0]`, since the event's target is retargeted out of shadow DOM. The editor and
  Statenet are mounted without `keys`. An in-page mount that names keys still raises `stateui:key` for them: the board
  names Escape, and the live app the editor's chord (`data-host-keys`), so `shell.ts` keeps its `stateui:key`
  listener.
- **The look.** The page's language and mode reach the app as they reach a frame (`data-locale`, `data-mode`, `view`).

The share page keeps its frame: it shows another owner's app to a viewer, and an app from another owner must not run
on Magnetic's origin. The runtime port stays for it.

### 2. The views as pages

The hand-written views become `PageSpec`s, as Statenet is, each with de/fr/es locales and a `Hearing` table
(`src/http/raised.ts`) that reads the reports of its nodes' ids as the names `views.ts` acts on; the ids the table hears
are the page's contract (`required`):
- `magnetic-theme` (`src/theme/ThemePage.ts`): a head of the theme chooser, Make it the default, Clone for this app,
  Remove, Add a theme…, a preset and New theme; a specimen per mode (light, dark, high contrast), a `drawing` in the
  theme's own colours; and a `table` of tokens whose value for all modes and in each mode is an `input` in its cell,
  the value the theme sets or empty with the value shown as its placeholder. Its data is `$.data.theme`: `themes`,
  `chosen`, `others` (options), `specimens` (per mode `surface`, `border`, `text`, `accent`, `accentOn`), `tokens` (one
  record per token: `id` its path, `group`, `name`, `all` and each mode with `<column>Shown` and `<column>Label`, and
  `locked` and `modesLocked`), `sharedText`, the flags that hide its parts, `status`, `refusal` and `noBack`.
  `THEME_HEARING` hears `choose.change` as `choose` and `add.change` as `add` (a field's change, `{ value }`), each
  `<column>Value.change` as `token` with the token's row and the cell's value in that column (`views.ts` finds the column
  changed against the record it wrote), `editAll.press`, `clone.press` and `cloneShared.press` as `clone`,
  `makeDefault.press` as `default`, `remove.press`, `create.press` with the preset it kept from `preset.change`, and
  `back.press`.
  A shared theme's cells are disabled (`locked`) until Edit for all or Clone for this app.
  A token a mode overlay may not hold (outside `color` and `elevation`, stateui-app's `KIND_GROUPS`) has its mode
  cells disabled (`modesLocked`, from `moded` in `themeTokensOf`); its value for all modes stays editable.
- `magnetic-logic` (`src/logic/LogicPage.ts`): a head of the kind of a new unit and New; the two lanes, Server and
  Browser, as a `board` (`columnField: 'runs'`) of unit cards, each with its name as its title, its kind, what it does
  and its paths, and buttons to move it to the other lane and to delete it; and the screens' handlers in a `list`
  below. Its data is `$.data.logic`: `units` (`id`, `runs`, `order`, `kind`, `title`, `does`, `paths`, `chosen`,
  `fixed`, `noServer`, `noBrowser`), `handlers`, `group`, `hasUnits`, `noHandlers`, `status`, `refusal` and `noBack`.
  `LOGIC_HEARING` hears `unit.press` as `open` with the row's id, `toServer.press` and `toBrowser.press` as `move` with
  the row's id, `lanes.move` as `move` with the board's `{ key, from, to, index }` (a drag), `deleteUnit.press` as
  `delete` with the row's id, `create.press` with the group it kept from `group.change`, and `back.press`. A unit is
  edited as JSON in the side panel.
- `magnetic-side` (`src/side/SidePage.ts`): the side panel, one panel of sections, each hidden by a flag of its own:
  a head of the part's name and Close; notes; the buttons a part may have (open another app, open the Logic view, edit
  in the Theme view, make a theme the default, remove it, use a part in this app, open Connections); a list of links
  (an app's screens, a component's, a library's functions); a code editor with Save and Delete (a path of the state, a
  module's unit, a unit of the Logic view); a function's input and output schemas; a dataset's records as a `table`,
  one row per field of a record with its value an `input`; a model's fields, each a type to choose and a Remove; a
  connection's base URL, secret, Connect and endpoints with Try and Remove; and a form of a name, a choice, a second
  line and a new record's fields, sent with its button, last. Its data is `$.data.side`: `views.ts` writes the blank
  (`SIDE_BLANK`, every section hidden) and then the part's own fields, and keeps what each heard name does for the part
  shown (`sideActs`). `SIDE_HEARING` hears `close.press`, `link.press` with the row's id, each button's press by its id
  (`openApp`, `openLogic`, `editTheme`, `makeDefault`, `removeTheme`, `use`, `openConnections`), `code.change` as
  `code` (kept), `save.press` with the code kept, `delete.press`, `cell.change` and `fieldType.change` with the row and
  the changed value, `removeRecord.press` with the row's key, `removeField.press` with the row's name,
  `saveUrl.press` as `baseUrl` and `keep.press` as `secret` with the value kept from `baseUrl.change` and
  `secret.change`, `connect.press`, `try.press` and `removeEndpoint.press` with the row's endpoint, `choice.change` as
  `choose`, `recordValue.input` and `.change` (kept in the new record's rows), and `submit.press` with the form kept
  from `name.change`, `choice.change` and `second.change`.

`views.ts` keeps what it does with the server (the reads, `POST /edit/<id>/views/<what>`, the refusals) and writes
these pages' data instead of DOM. Of its reads only the last one started draws, so a read begun before a write cannot
show the old value over the new. The editor places the side panel (section 3) and the pages of the canvas (section 4).

### 3. The side panel in the editor's document

The editor document places the side panel. Its `stage` has a float keyed `side` (at the right below the corners, down
to above the chat bar, 360px wide but at most 45% of the window; below 760px a sheet over the bottom half), hidden by
`$.data.editor.sideHidden`. It holds a live `embeddedApp` of `magnetic-side` with `fill`, so the page takes the
float's size and scrolls inside it. The `embeddedApp` stays mounted while the float is hidden, so the panel is mounted
once per editor mount.

The page's app host opens Magnetic's pages by name. `stateuiHost.pages(provider)` (stateui-mcp) gives it a provider:
`open(name)` answers a page's document, icons and title, and the host mounts the page in the asking element as a panel
in the page (the runtime core, as `stateuiHost.mount` with `inPage`), filling the frame. `shell.ts` registers the
provider before the editor mounts; it knows `magnetic-side` and serves it from `/assets/side.json`. The host hands
the panel to the provider's `mounted(name, panel, element)` and calls `disposed(name, panel)` when the
`embeddedApp` lets it go; the page's reports reach the `embeddedApp` (its event `raised`) and `stateui:raised` on its
element. `magneticShell.page(name, { mounted, disposed })` passes them to the script that drives the page: `views.ts`
takes the side panel's panel there, writes `$.data.side` through it, listens to `stateui:raised` on the element, and
opens and
closes it with `sideHidden`. What the panel covers of Statenet's canvas is read from where the editor placed it, so a
copy that places it at the left moves the canvas's free area to the right.

A person's copy of the editor can move, restyle or drop the side panel like any part of the editor.

### 4. The canvas in the editor's document

The editor document places the canvas. The first children of its `stage` are four live `embeddedApp`s with `fill`, so
every panel after them lies over them: `board` (`magnetic-screens`) and `statenet` (`magnetic-statenet`) take the whole
window, `theme` (`magnetic-theme`) and `logic` (`magnetic-logic`) the area right of the rail, below the corners and
above the chat bar (on a narrow window below the rail along the top). Each is hidden by a flag of `$.data.editor`
(`boardHidden`, `statenetHidden`, `themeHidden`, `logicHidden`), which `views.ts` writes as the view changes: one
shows at a time. A hidden page stays mounted, so it keeps where the person left it and the next view shows at once. The
canvas pages set the `embed` tokens so their frames draw no border, corners or fill.

`shell.ts`'s provider knows the four pages beside the side panel and serves each from its asset; the board's names
Escape (`keys`). It keeps the document each page was opened with and passes it to `magneticShell.page`'s
`mounted(panel, element, document)`, where a script finds its page's `canvas` by key. `screens.ts` takes the board
there, and `views.ts` takes Statenet, Theme and Logic. Neither mounts a page of its own: there is no `#board`,
`#screens`, `#statenet` or `#view-page`. A page mounted again (a new editor) is given its data again: the board its
view and cards, Statenet its view and tree, Theme or Logic its view when it shows.

The layers over the board are in the same DOM as the board, so they lie between its canvas and the editor's panels by
being in the board page's own element. `magneticShell.boardLayer(node)` appends a layer to the element the provider
was handed for the board (the `embeddedApp`'s `.app`, after the page's panel), makes that element the layers'
containing block and takes the layers again when the board is mounted again. The inspector's layer (its shield and
overlay, `inspect.ts`) and the views' layers (`views.ts`) are drawn there. The element is inside the `embeddedApp`'s
shadow root, where the page's sheets do not reach, so the shell links `/assets/layers.css` (`LAYERS_CSS` of
`shell.ts` and `VIEWS_LAYERS_CSS` of `views.ts`) into that root; the colours are the page's custom properties,
which the root inherits. A layer is placed from `magneticShell.boardOrigin()`, where the board's element is in the
window.

Statenet's page shows the views' status and refusals itself (`status` with `noStatus`, `refusal` with `noRefusal`),
over its canvas at the top, as Theme and Logic do: the views' sheet goes, and `VIEWS_CSS` with it.

## Stages

| Stage | Delivers |
|---|---|
| B4a | The editor, Statenet, the sign-in and link pages and Your apps run in the page; `panel`'s `passThrough`, `app`'s `seeThrough`; keys on the page. |
| B4b | `magnetic-theme` and `magnetic-logic` replace the Theme and Logic views' DOM. |
| B4c | `magnetic-side` replaces the side panel's DOM. |
| B4d | The editor places the side panel as an `embeddedApp`; the app host opens Magnetic's pages by name and hands the script the page's panel; `embeddedApp`'s `fill`. |
| B4e | The editor places the canvas: the board, Statenet, Theme and Logic as `embeddedApp`s first on its stage, the layers in the board page's element, Statenet's own status. |

## Checks

- **B4a:** Magnetic's e2e passes with no `frameLocator` but the share page's: the editor, Statenet, sign-in, link and
  Your apps are found in the page; a press on the empty canvas reaches the board through the stage; the tool keys work and do
  nothing while typing in the chat.
- **B4b, B4c:** the views' e2e (`views.spec.ts`) passes on the pages: edit a token, clone a theme, move and delete a
  unit, add a dataset from Statenet's +, edit a record in the side panel.
- **B4d:** the views' e2e passes with the side panel in the editor's document; a person's copy of the editor that
  moves the side panel to the left keeps working (e2e).
- **B4e:** the screens', views' and editor's e2e pass with the canvas pages found in the editor (`BOARD`,
  `canvasPage`): the inspector selects and drops on the live app, the layers draw on the cards, a press on the empty
  Statenet canvas reaches it past the panels.

## Decisions

- The share page keeps its frame and the runtime port stays: it runs another owner's app.
- The sign-in and link pages move into the page with the editor. They run documents Magnetic's admins publish, who are
  Magnetic's own; a published page that does not load still gives way to the code's (`fallback`).
- Click-through is a property of `panel` (`passThrough`), not a page rule in CSS, so a copy of the editor keeps it. A
  panel that lets presses through also draws no surface: a surface that cannot be pressed would hide what takes the press.
- The editor's root draws nothing through the `app` component's own property (`seeThrough`), set on the editor's app
  node, so a copy of the editor keeps it too.
- Your apps moves with the sign-in and link pages: it is the person's own copy of a page of Magnetic's.
- The views become pages before the editor holds them (B4b and B4c before B4d), so each move is tested on its own.
- The Theme page has a column and a specimen for each of the three modes every theme has (light, dark, contrast),
  fixed in its definition: a table's columns are not data.
- The specimens draw their text in the page's font, not the theme's: a `drawText`'s font must be a token of the page's
  own theme.
- The status, the refusals and the way back to Statenet are in the Theme and Logic pages, not in a head of the
  page script's, so a copy of a page places them.
- A unit card's buttons sit in the card's row itself: a `panel` is an inline-size container, so one that does not grow
  in a row has no width of its own.
- The side panel is one screen of sections shown by flags, not a screen per kind of part: most parts share sections
  (notes, links, code, the form), and one screen keeps one mount and one contract.
- Every repeat in the library is virtual with rows of one height, so the side panel's records are a row per field of a
  record (the record's key on its first), not a row per record with a column per field: a dataset's fields are data,
  and a table's columns are not.
- No component repeats buttons from data in a row, so the side panel's actions are fixed buttons, each hidden by its
  own flag.
- The side panel's form comes last: what a part holds is read before what adds to it.
- The canvas is in the editor's document, and the layers over the board are in the board page's element (owner,
  2026-11-20: "Remember, these are all in the same DOM"). With no frame between them, a layer appended inside the board
  page lies over its canvas and under every panel the editor places after the board.
- The four canvas pages stay mounted and are shown by flags rather than mounted for the view shown: the editor's
  document holds them as it holds every panel, and a view comes back where the person left it.
- Theme and Logic take a fixed area of the stage (`VIEW_PLACEMENT`) rather than the free area the script measures:
  the editor's document places them, as it places its panels.
- No `canvasApp` field: the selector's `view` already names what the canvas shows.
- The app host attaches Magnetic's pages with the page runtime (`stateuiHost.mount`'s panel), not `mountApp`: the
  scripts need the panel's commands, language and mode switch and icons, which a `MountedApp` does not have.
- The provider is registered by `shell.ts`, before the editor mounts, so the editor's first ask finds it; a script
  that loads later takes the panel through `magneticShell.page`, which hands over a page already mounted.
- `disposed` names the panel it lets go: an editor mounted again mounts its side panel before the old editor's is let
  go, and only the panel mounted now counts.

## Rules and Constraints

- An app from another owner never runs in a page (screens board, Decisions). The app host refuses a name that is not
  the signed-in person's app or one of Magnetic's pages.
- The pages talk to Magnetic only through `$.data` and the events of their nodes' ids; a node found by its key
  (`canvas`, `stage`, `propertyFields`) is the one exception.
- Every write to the owner's parts goes through the person's tools on the server, as before.
- Texts are in four languages; the server's answers hold data, never words.
- `stateui` writes the DOM synchronously and never reads layout; `passThrough` is CSS (`pointer-events`), not measuring.
- No backwards compatibility: the frame clipping, the page's panel shadows, the frames' policies (`shellPageCsp`,
  `hostPageCsp`), the views' DOM, the views' sheet and `VIEWS_CSS` go.

## As built

B4a (2026-11-19):
- stateui-components: `components/composites/panel/` (`passThrough`), `components/composites/app/` (`seeThrough`);
  tests `test/composites/panel-toolbar.browser.test.ts` ("should let a press on its own area through with passThrough,
  draw no surface there, and give its children theirs"), `test/composites/app.browser.test.ts` ("should draw its
  surface, and none with seeThrough").
- Magnetic: `src/http/shell.ts` (the in-page editor, `placePanels`, `typing` by `composedPath`), `src/http/inspect.ts`,
  `src/http/views.ts` (Statenet in the page), `src/http/appPage.ts` and `src/http/home.ts` (`pageBundle`,
  `data-surface="page"`), `src/editor/EditorApp.ts` (`passThrough` on the screen root and `stage`, `seeThrough` on the
  app node), `src/server/startMagnetic.ts` (`APP_PAGE_CSP` for the shell, the app pages and Your apps; `sendHomePage`).
- Tests: `src/server/editor.browser.test.ts` ("should let clicks beside the panels through to the canvas, and draw no
  surface of its own there", "should take the tool keys from inside the editor, but not while the person types there"),
  the policy checks in `src/server/startMagnetic.test.ts`, `src/server/agentRoutes.test.ts` and
  `src/server/publicOrigins.test.ts`, and the e2e page objects in `e2e/fixtures.ts` with `orgs.spec.ts`,
  `share.spec.ts` and `views.spec.ts`, which find these apps in the page; `e2e/editor.spec.ts` ("a tip that reaches past
  its panel is shown whole, above the canvas").

B4b (2026-11-20):
- Magnetic: `src/theme/ThemePage.ts` (`THEME`, `THEME_MODES`, `THEME_PRESETS`), `src/logic/LogicPage.ts` (`LOGIC`,
  `UNIT_GROUPS`, `LOGIC_GROUPS`, `LANES`), served at `/assets/theme.json` and `/assets/logic.json` through
  `EDITOR_PAGES` in `src/server/startMagnetic.ts`; `src/server/viewRoutes.ts` takes the groups and presets from them;
  `src/http/views.ts` (`enterPage`, `leavePage`, `pageWrite`, `viewHeard`, `themeHeard`, `tokenChanged`,
  `logicHeard`, `readTurn`).
- Tests: `src/theme/ThemePage.test.ts` and `src/logic/LogicPage.test.ts` (served to the signed-in, localized, the
  contract kept, the columns, specimens, board and card as written); `e2e/views.spec.ts` ("the Theme view makes a theme
  and edits a token's value in one mode", "the Theme view clones a theme another app uses into one of the app's own",
  "the Logic view makes a rule on the server, moves it to the browser and deletes it", and the Statenet tests that lead
  to Theme and Logic and back).

B4c (2026-11-20):
- Magnetic: `src/side/SidePage.ts` (`SIDE`, `SIDE_BLANK`, `FIELD_TYPES`, `METHODS`), served at `/assets/side.json`
  through `EDITOR_PAGES` in `src/server/startMagnetic.ts`; `src/http/views.ts` (`mountSide`, `sideShow`,
  `sideWrite`, `sideActs`, `formOf`, and each part's editor writing the page's data), the views' DOM builders and
  their CSS removed; `src/http/text.ts` (`views.value`).
- Tests: `src/side/SidePage.test.ts` ("should serve a signed-in person the panel of every kind of part, in every
  language, with every node id of its contract"); `e2e/views.spec.ts` ("a dataset is made from Statenet's + with its
  first record, and a record's value is edited in the side panel", and the Statenet tests that open the side panel).

B4d (2026-11-20):
- stateui-mcp: `src/browser/host.ts` (`stateuiHost.pages`, `SitePages`, `attachPage`, the `fill` of a panel in
  the page); test `test/browser.integration.test.ts` ("should open a page of the site's own by name in an
  embeddedApp, hand its provider the panel and pass its raised events on").
- stateui-components: `components/composites/embedded-app/` (`fill`); test
  `test/composites/embedded-app.browser.test.ts` ("should take the size its node is given with fill, and width by
  height without").
- Magnetic: `src/editor/EditorApp.ts` (`sidePanel`, `SIDE_PLACEMENT`, `sideHidden`), `src/http/shell.ts`
  (`PLACED_PAGES`, the provider, `magneticShell.page`), `src/http/views.ts` (the side panel from the shell,
  `insetOf` from where it is placed; the sheet keeps only Statenet's status), `src/http/text.ts` (`views.side`),
  `e2e/server.mjs` (`POST /editor-node`) and `e2e/fixtures.ts` (`changeEditor`).
- Tests: `e2e/views.spec.ts` ("keeps the side panel working where the copy moves it, at the left", and the Statenet
  tests, which find the side panel as the region Details).

B4e (2026-11-20):
- Magnetic: `src/editor/EditorApp.ts` (`canvasPages`, `CANVAS_FRAME`, `VIEW_PLACEMENT`, the four hidden flags),
  `src/http/shell.ts` (the four pages in `PLACED_PAGES`, `LAYERS_CSS`, `magneticShell.boardLayer` and
  `boardOrigin`, the document passed to `mounted`), `src/http/screens.ts` (`boardMounted`, `boardDisposed`),
  `src/http/inspect.ts` and `src/http/views.ts` (the layers in the board page, `VIEWS_LAYERS_CSS`, the pages
  taken from the shell, `says` writing Statenet's or the shown page's status), `src/statenet/StatenetPage.ts`
  (`status`, `refusal`), `src/server/startMagnetic.ts` (`/assets/layers.css`), `src/storage/exclusive.ts`
  (callers of one key queue on their server before taking a connection: the editor asks for its pages at once).
- The sizes in one document: the editor's stage is the window less its border, and the board's and Statenet's
  canvases the window less the stage's, frame's and page's borders, so neither page scrolls; the editor's mount
  never scrolls (`.editor > .stateui-panel`). A board column is as wide as a screen and the board's gap
  (`space.gap.md`) is the room between columns; a card is a pass-through panel holding the tile, which is as tall
  as its head and screen, so the gaps across and down show the canvas and the tile's surface outlines its screen at
  any zoom (owner, 2026-11-20: "The screens have extra margin on the right side", "When zoomed out we lose the
  screen border").
- stateui-components: the viewport counts only `data-own-gestures` marks between the target and itself, so a
  viewport in a page that a live `embeddedApp` holds pans and wheels (owner, 2026-11-20: "Drag is not panning").
  Test: `test/composites/viewport.browser.test.ts` ("should pan and wheel inside a page that a live embeddedApp
  holds…"). An `embeddedApp` sized width by height scrolls an app taller than its screen inside it, and one with
  `fill` leaves its app to size itself (owner, 2026-11-20: "Looks like we are missing the scrollbar for the
  screens"), with a scrollbar of the `embed.scrollbar` token (owner, 2026-11-20: "The scrollbar is too dark to see"),
  and the `app` root fills the least height its host is given, so an app shorter than its screen fills it (owner,
  2026-11-20: "The Overlays screen doesn't take up the entire height"). Test:
  `test/composites/embedded-app.browser.test.ts`.
- A press on the board that is not on a card, such as the room under a screen, pans the canvas: the board leaves it to
  the viewport (owner, 2026-11-20: "When I drag under the screen it starts a grab"). Test:
  `test/composites/viewport.browser.test.ts`.
- Each canvas page is a stack of its own (`z: 0`), so the inspector's layer in the board page stays under the
  editor's panels wherever the live app runs.
- Tests: `e2e/fixtures.ts` (`BOARD`, `canvasPage`) with `e2e/screens.spec.ts`, `e2e/views.spec.ts` and
  `e2e/editor.spec.ts`; `src/server/startupRace.test.ts` ("should finish more callers of one key than the pool has
  connections, when the work itself queries"); `src/server/editor.browser.test.ts` (the chat and selection tests
  over the live app, and the press beside the panels followed through the shadow roots to the board's page).
