# The editor as StateUI apps in one document

Status: B4a built (2026-11-19), B4b built (2026-11-20); B4c and B4d proposed. B4 of [magnetic-screens-board.md](magnetic-screens-board.md); builds on B3b and B3c.

Asked for on 2026-11-19: "Start B4 of the screens board". B4 there reads: the editor's panels and Statenet leave their
frames the same way as the board, until the editor is StateUI apps in one document. The ask behind the whole board work
(2026-11-19): "We are changing this to use the stateui so we can edit the editor and prove that this is powerful enough
to make anything."

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
page with the runtime core, takes the same writes and commands and raises the same `stateui:emit` and `stateui:ready`
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

The hand-written views become `PageSpec`s, as Statenet is, each with de/fr/es locales and a contract of emits:
- `magnetic-theme` (`src/theme/ThemePage.ts`): a head of the theme chooser, Make it the default, Clone for this app,
  Remove, Add a theme…, a preset and New theme; a specimen per mode (light, dark, high contrast), a `drawing` in the
  theme's own colours; and a `table` of tokens whose value for all modes and in each mode is an `input` in its cell,
  the value the theme sets or empty with the value shown as its placeholder. Its data is `$.data.theme`: `themes`,
  `chosen`, `others` (options), `specimens` (per mode `surface`, `border`, `text`, `accent`, `accentOn`), `tokens` (one
  record per token: `id` its path, `group`, `name`, `all` and each mode with `<column>Shown` and `<column>Label`, and
  `locked`), `sharedText`, the flags that hide its parts, `status`, `refusal` and `noBack`. It emits `choose` and `add`
  (a field's change, `{ value }`), `token` with the token's record once a cell changes (`views.ts` finds the column
  changed against the record it wrote), `editAll`, `clone`, `default`, `remove`, `create` with the preset, and `back`.
  A shared theme's cells are disabled (`locked`) until Edit for all or Clone for this app.
- `magnetic-logic` (`src/logic/LogicPage.ts`): a head of the kind of a new unit and New; the two lanes, Server and
  Browser, as a `board` (`columnField: 'runs'`) of unit cards, each with its name as its title, its kind, what it does
  and its paths, and buttons to move it to the other lane and to delete it; and the screens' handlers in a `list`
  below. Its data is `$.data.logic`: `units` (`id`, `runs`, `order`, `kind`, `title`, `does`, `paths`, `chosen`,
  `fixed`, `noServer`, `noBrowser`), `handlers`, `group`, `hasUnits`, `noHandlers`, `status`, `refusal` and `noBack`. It
  emits `open` with a unit's id, `move` with a unit's id (its button) or the board's `{ key, from, to, index }` (a
  drag), `delete` with a unit's id, `create` with the group, and `back`. A unit is edited as JSON in the side panel.
- `magnetic-side`: the side panel, one screen per kind of part (`dataset`, `model`, `path`, `unit`, `connection`,
  `add`), its data `$.data.side` written by `views.ts` from the `/graph` answer and the part's own read. It emits
  `save`, `delete`, `close` and the form's `submit`.

`views.ts` keeps what it does with the server (the reads, `POST /edit/<id>/views/<what>`, the refusals) and writes
these pages' data instead of DOM. It mounts Theme and Logic in the page on an element of the board (`#view-page`),
placed in the area the editor's panels leave free, and its sheet keeps only the side panel and Statenet's status. Of
its reads only the last one started draws, so a read begun before a write cannot show the old value over the new.
Its `element(...)` builders and `VIEWS_CSS` go with the side panel (B4c).

### 3. One document

The editor document holds the canvas. Under its `stage`, below the floating panels, it places an `embeddedApp` keyed
`canvas`, `'<-app': '$.data.editor.canvasApp'` (`magnetic-screens`, `magnetic-statenet`, `magnetic-theme` or
`magnetic-logic`), and the side panel as an `embeddedApp` keyed `side` (`magnetic-side`, `'<-active':
'$.data.editor.sideOpen'`). The view selector's `view` emit sets `canvasApp`; nothing in code decides which app shows.

Magnetic's app host (B3) opens these names as well as the person's own apps: a name of one of Magnetic's pages resolves to
the page's current version for the signed-in person (the person's copy where `PersonPages` keeps one, else the site's),
mounted standalone. The host's `mounted` and `disposed` hooks hand each script its app: `screens.ts` gets the board,
`views.ts` gets Statenet, Theme, Logic and the side panel. The scripts write their app's `$.data` and listen to its
emits through the `MountedApp`, not through `stateuiHost.mount`. The editor page mounts one app, the editor, with
`stateuiPage.mountApp` and that host.

The zoom control drives whichever canvas app has a node keyed `canvas`, through its `MountedApp`'s commands; Theme and
Logic have none, and the control hides.

A person's copy of the editor can then move, restyle or drop any part of the editor, the canvas and the side panel
included, and a copy of a view page changes that view.

## Stages

| Stage | Delivers |
|---|---|
| B4a | The editor, Statenet, the sign-in and link pages and Your apps run in the page; `panel`'s `passThrough`, `app`'s `seeThrough`; keys on the page. |
| B4b | `magnetic-theme` and `magnetic-logic` replace the Theme and Logic views' DOM. |
| B4c | `magnetic-side` replaces the side panel's DOM. |
| B4d | One document: the editor places the canvas and the side panel as `embeddedApp`s; the app host opens Magnetic's pages; the scripts take their apps from the host. |

## Checks

- **B4a:** Magnetic's e2e passes with no `frameLocator` but the share page's: the editor, Statenet, sign-in, link and
  Your apps are found in the page; a press on the empty canvas reaches the board through the stage; the tool keys work and do
  nothing while typing in the chat.
- **B4b, B4c:** the views' e2e (`views.spec.ts`) passes on the pages: edit a token, clone a theme, move and delete a
  unit, add a dataset from Statenet's +, edit a record in the side panel.
- **B4d:** the editor page mounts one app; switching views changes `canvasApp` only; a person's copy of the editor
  that moves the side panel to the left keeps working (e2e).

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
- The side panel stays DOM in B4b: Logic's New and a card's press open it as before; it moves in B4c.

## Rules and Constraints

- An app from another owner never runs in a page (screens board, Decisions). The app host refuses a name that is not
  the signed-in person's app or one of Magnetic's pages.
- The pages talk to Magnetic only through `$.data` and emits; a node found by its key (`canvas`, `stage`,
  `propertyFields`) is the one exception.
- Every write to the owner's parts goes through the person's tools on the server, as before.
- Texts are in four languages; the server's answers hold data, never words.
- `stateui` writes the DOM synchronously and never reads layout; `passThrough` is CSS (`pointer-events`), not measuring.
- No backwards compatibility: the frame clipping, the page's panel shadows, the frames' policies (`shellPageCsp`,
  `hostPageCsp`), the views' DOM and `VIEWS_CSS` go.

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
  `src/http/views.ts` (`enterPage`, `leavePage`, `pageWrite`, `themeEmit`, `tokenChanged`, `logicEmit`, `readTurn`).
- Tests: `src/theme/ThemePage.test.ts` and `src/logic/LogicPage.test.ts` (served to the signed-in, localized, the
  contract kept, the columns, specimens, board and card as written); `e2e/views.spec.ts` ("the Theme view makes a theme
  and edits a token's value in one mode", "the Theme view clones a theme another app uses into one of the app's own",
  "the Logic view makes a rule on the server, moves it to the browser and deletes it", and the Statenet tests that lead
  to Theme and Logic and back).
