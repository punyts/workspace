# Magnetic: the editor's views (Screens, Statenet, Theme, Logic)

Status: built 2026-11-18.

Asked for on 2026-11-18: "We also need to make the "SHOW" toolbar in the editor actually work. When theme is shown,
then we need to present the user with the theme and settings so they can edit it. When layout is selected, we need to
see the layouts without the content with names inside the layout sections. The data should show the statenet in a
graph with any external data nodes (APIs) shown as such, and allow the user to edit the state data and the API
settings by clicking in the graph nodes. Logic should show the logic in a way that allows the user to edit it."

Rethought by the owner the same day, after a first design: "We need to show the user these things at screen and app
level. 1. We have screen layouts, so we should show the layouts in the screen tile, with the named sections when that
is selected. 2. Each screen has state paths that it listens to as well as external data that they need to see in the
screen tile. 3. Each screen can have it's own logic, so we need to see the logic in the screen tile in a cool way.
4. The theme is app level, so the canvas should change to show just the theme data, in a cool way, that allows users
to edit it. 5. The app's statenet is app level, so the canvas should change to the graph. 6. There is app level logic,
so the canvas should change to show the logic used in the app in a cool way. 7. We need a way to switch back to the
screens view. Maybe we have a view selector at the top alongside the localization and light/dark theme. Users can
select screen, statenet, or theme. When on the screens view we have the tools for creating and editing screens. For
the theme view we have the tools for editing the themes. For the statenet, we have the tools to edit the statenet. For
the app level logic, we have the tools to edit and create logic and identify if it is ran server or browser side."

Then, on 2026-11-18, with the Statenet sheet in view: "Lets not have the statenet on its own tile. Have it on the
canvas"

Then, with the graph on the board as one tall column: "Can we get this to lay out a bit better. Maybe find an
algorithm for natural layout. Maybe group things based on path like a tree"

Then: "Could you run through the statenet in the browser like a user would, and tell me if this satisfies your needs."
The walkthrough found cards that led nowhere (the app, a component, a module, a theme that jumped away with no way
back), editors that asked with `prompt()` and removed without asking, and four bugs: a stray "null" in the dataset
editor, the blank app's hint over the graph, the side panel scrolling sideways, and the panel covering the chosen
card. The owner's answer: "Bugs and editor first".

Then: "Can you add the logic module?" The showcase had none to try the module card on. It now ships one
(owner, 2026-11-18): `showcase-tasks` in stateui-mcp's showcase, whose rule unassigns a task moved back to To do on
the board.

Then: "We need to make the statenet diagram fit the actual state pattern. `$.data` `$.themes.{theme}` `$.apps.{app}`
etc. Also, it should match the actual state paths. Branches should have a + button so you can add additional branches
and leafs". The owner's answers (2026-11-18): the tree shows every part of the owner, with what the app does not use
dimmed; a + makes the part and puts it to use in the app; one level is drawn below a part, each with its own +.
Then: "Let's update the diagram to use both left and right sides. Let's distribute the the direct root children".
Then: "We need to be able to deselect a node in the state or close its open modal", and "The buttons in the diagram
are terrible."
Then, asked whether to add the owner tree's `$.personas` root, showing only the person's own (owner, 2026-11-18): "Only
my own", and: "Persona shouldn't be "bob" that's the user, and is in the `$.user` state. Personas would be like "work"
or "comptia"", "It could even be comptia_bob".

## Summary
- **A view selector** in the top-right corner, before the bug, preferences and Share buttons: **Screens · Statenet ·
  Theme · Logic**.
- **Screens** is the canvas of screens. Its old SHOW toggles are now three layers drawn on every screen tile:
  **Layout** (the named sections), **Data** (the state paths and outside data the screen uses) and **Logic** (its
  handlers, the units that touch its paths, and where it leads).
- **Statenet**, **Theme** and **Logic** are app-level views. Statenet is a page of Magnetic's shown over the board in place
  of the screens, a canvas that pans and zooms (`magnetic-statenet-diagram.md`); Theme and Logic replace the board with a sheet. Each has its own tools in a head and an
  editor panel at its side.
- **Units can run in the browser.** A logic unit says `runs: "server" | "browser"`. The Logic view moves units between
  the two, and the library refuses what must stay on the server.

Every edit goes through the stateui-mcp tools the agent uses, with the revision the view read. Connections, which no
tool changes, go through the Connections page's own code.

## Where things stood
Found by reading the code on 2026-11-18.

- **SHOW** had five toggles: Theme, Layout, Data, Logic and Screens. They only chose which parts of the app the next
  request sent the agent as `<context>` (`AgentTurns.facts`). Nothing changed on screen.
- **A bug:** `AgentTurns.facts` read the theme from `uses.theme`, which does not exist. The field is `uses.themes`, a
  list whose first entry is the default, so the Theme context always said "The app uses the default theme". This piece
  fixes it.
- **Language and light/dark** belong to the editor, not the app. They sit in the preferences panel behind the
  top-right corner's icon.
- **The canvas** is code: `shell.ts`, `screens.ts` and `inspect.ts`. **The panels** are a StateUI app
  (`EditorApp.ts`), driven only through `$.data.editor` and its emits (`magnetic-editable.md`).
- **Logic belongs to the app**, not to a screen. What belongs to a screen is:
  - its nodes' links to state (`<-` and `<->`);
  - its nodes' `on` handlers;
  - the units that read or write its paths;
  - its `navigate` commands.
- **Where logic ran:** in a Full-mode app (every Magnetic app), the authority (`AppLogic`) ran every unit, and the
  browser ran only handlers.

## The design

### The view selector
- The selector is a `segmented` control (one radio per view) in the top-right corner. Below 760px, where the corners
  leave no room, it is a `selectField` named View at the head of the top rail; in the app views the top rail shows only
  that menu.
- The view is kept per app in this browser (`localStorage` `magnetic.editorView.<appId>`) and comes back on reload. It
  has no keys: 0 and 1 already reset and fit the zoom.
- **The agent sees the view.** Each request carries that view's part of the app as `<context>`
  (`magneticShell.contextOf`):
  - Theme: the theme;
  - Statenet: the data;
  - Logic: the logic;
  - Screens: the screens plus each layer that is on.
  - The chat bar shows it (owner, 2026-11-18: "Show the view as a chip in the chat bar"): in the bar's own row, between
    the chat button and the request, a fixed chip for the view and, in Screens, one for each layer that is on, as tall
    as the bar's controls. The removable chips of what was chosen stay on the line above the bar, after About.
- The rail (pointer tools, library, Screens, Connections and Shared data panels, then the layers) and the zoom show only
  in the Screens view. Switching to an app view picks the Use tool and closes the inspector and the canvas panels.

### Screens view: the layers
The rail's **Layers** group has three toggles, each solid while on: **Layout**, **Data** and **Logic**. They can be on
together, and the choice is kept in this browser (`magnetic.layers`). The canvas script draws them in a `.tile-layer`
over each tile: the live artboard and each mounted preview (`window.magneticScreens.panelOf`). Each tile's information
comes from `GET views/screen?screen=`.

- **Layout:** every node of the screen as an outlined box with its key, and layout nodes as named sections. On a
  rendered tile the boxes are the real ones, from the frame's `inspect({ paths })`. Otherwise they are a schematic
  drawn from the document (rows across, columns down).
- **Data:** a column of chips at the tile's right edge, one per state path the screen reads or writes (cut at the
  dataset, such as `$.data.tasks`), marked read, write or both. Outside data (`$.external.…`) is dashed. Pressing a chip
  puts that path into the chat as what the next request is about.
- **Logic:**
  - At the tile's left edge: a chip with the handler count (they run in the browser), then a chip for each app unit that
    reads or writes the screen's paths, marked Server or Browser. Pressing a unit chip opens the Logic view.
  - A ⚡ badge on each part with a handler, titled with its event and commands.
  - An arrow in the board's world from each tile to every screen its handlers or touching units `navigate` to.

The layers are redrawn when the screens change, when the artboard moves or resizes, when the screen names show, and
after each change to the app (`data-revision`).

### The app views
Each has a sheet (`#view-sheet`) with:
- a head: the view's name, its tools, and a status line (Saving, Saved, or the refusal). On the board (Statenet) the
  name is left out, since the selector shows it, and the head shows only while it holds a tool, a status or the way
  back;
- a main area;
- a side panel at the right, the editor of what was pressed. Below 760px the side panel is a sheet at the bottom.
  Escape closes it.

For Theme and Logic the sheet covers the board, which hides. For Statenet the sheet is only its head and its side
panel, floating over the board (`.on-canvas`); the main area is empty.

A change to the app from elsewhere (the agent, another tab) reloads the view, after the field being edited is left.

### Statenet view
**On the board:** the graph is the page `magnetic-statenet` (`magnetic-statenet-diagram.md`): a `viewport` around a
`treeDiagram`, in its own frame (`#statenet`) over the board, while the screens, the live frame and the layers hide.
The editor's zoom and Fit (1) drive its canvas (`magneticShell.canvas.drive`); its view is kept per app in this
browser (`magnetic.statenet.<appId>`), and the tree is fitted once when no view was kept. The board keeps its own place,
so a return to Screens finds the screens where they were.

**The graph is the owner's tree by state path** (`ownerTreeOf` in `viewInfo.ts`; `cardOf` and `drawGraph` in `views.ts` write
its records to `$.data.statenet.nodes`, and `layoutTree` places them). Each node's id is its path, which the card
carries as `data-id`.
- **`$`**, then a pill per branch: `$.apps`, `$.themes`, `$.data`, `$.models`, `$.logic`, `$.components`, `$.patterns`
  (when the owner has any), `$.connections` and `$.people`.
- **Every part of the owner** under its branch. A part the app being edited does not use is flat with its label
  muted ("Not used by this app"). The app being edited is selected; the owner's other apps open in their own editor.
- **One level below a part:**
  - the app: `screens`, `uses.data` (each binding, with the dataset it binds, or a per-person binding with its model),
    `data` (its own state keys no binding holds) and `uses.external` (shared datasets with their owner, other apps;
    dashed);
  - a dataset: its records, the first eight (`TREE_RECORDS`), and how many more;
  - a model: its fields with their types (`$.models.<model>.fields.<field>`);
  - a logic module: its units (`$.logic.<module>.<group>.<unit>`);
  - a connection: its endpoints, plus endpoints the logic calls that are missing from it;
  - the person editing: the apps of the workspace they have state in (`$.people.<person>.apps.<app id>`), the most
    recently used first: the app being edited and the most recent others, eight in all (`TREE_RECORDS`), and how many
    more. A dashed edge joins an app to its instance.
- **`$.people` holds the person editing only**, at their own id and labelled with their name. Another person's state is
  theirs: an org's admins reach it only through the audited support view. A person's state of an app is at
  `<their owner number>/apps/<app id>` (`personApps`, from `namespace_head`; person-state.md).
  A part the app does not use is drawn without what it holds; its editor shows that.
- **A branch shows** every part the app uses and the first six others (`UNUSED_SHOWN`), then a pill "N more" that shows
  the rest, and "Show fewer" after. An owner with many apps and themes would otherwise draw a board too tall to read.
- **The layout:** a tidy tree going out from `$` on both sides. The branches of `$` are shared between them: the first
  ones go right and the rest left, split where the two sides' heights come closest, so each side reads down in the
  branches' order. The left side mirrors the right: its cards stand right-aligned in their columns, and a leaf block wraps
  from the right. The branches and the parts in them stand in columns; what a part holds sits just beside it, further
  out, its leaves wrapped in one block (`leafBlock`, 420px) rather than a row each. Each
  subtree is stacked down and a parent sits across from the middle of its children.
- **Edges:** the tree's links always show, from a card's outer side to its children's inner side. The edges the tree does not hold (the app's use of a theme, module or
  component, a binding's dataset, a dataset's model, an endpoint the app calls) are drawn only while one of their ends
  is chosen, dashed in the accent.
- The graph's words are written by the page (`views.kind.*`, `views.note.*`); the route sends paths, kinds and names.

**The +** on a branch or a part makes what it holds, through the person's tools, and puts it to use in the app. It is
a small round button with an accent `plus` at the card's end, named "Add to <path>". Its form opens in the side panel; after Create the panel closes and the tree shows the new node.
- `$.apps`: a new app (`POST /new`), which opens in the editor.
- The app's `screens`: a blank screen (`POST /edit/<id>/screens`, `ui_screen_create`).
- The app's `uses.data`: binds a dataset of the owner the app does not bind, under a name made from the dataset's (or
  one given).
- `$.themes`: a theme from a preset, added to the app.
- `$.data`: a dataset of a model, with its first record typed in a field per field, bound in the app. With no model
  the form says to make one first.
- `$.models`: a model with its first field and type.
- `$.logic`: a module working on one of the app's dataset bindings, used by the app. The binding's name is the
  module's need, with the dataset's model. With no binding the form says to bind a dataset first.
- A dataset's +: its editor with the new-record row focused. A model's +: its editor with the field name focused.
- A module's +: a unit (rule, machine or table) with a name and its JSON, which starts from a template on the
  module's first need and its model's fields (`moduleTemplate`); a refused write shows the tool's message.
- `$.connections` (for those who manage connections): a link to the Connections page, where a connection is made with
  its keys. `$.components` and `$.patterns` have no +: the agent makes them from screens.

**What an effect calls** is the request value its logic or handlers write at the effect's `request` path, or the value
the app starts with there. An effect's own definition holds only the path, so `callsOf` looks for `set` commands that
target that path with a value naming a connection and an endpoint.

**Pressing a card** opens its editor in the side panel, and the canvas moves so the panel does not cover the card
(the viewport's `lookAt` in the area its `inset` leaves free: the panel is at the right at 760px and wider, along the
bottom below that).
The panel scrolls down only; a record table scrolls sideways in its own box. The chosen card is let go, and the panel
closed, by the panel's × (Close), by pressing the card again, by Escape, and by a press on the empty canvas; a drag that
pans the canvas keeps it.
- **The app:** its note, its screens as buttons, each showing that screen in the Screens view
  (`magneticScreens.choose`), and how many parts of each kind it uses.
- **A dataset:** its records as a table with an input per field. You can change a cell, remove a record and add one
  (`ui_data_write`). A new record is typed in the table's last row and added with Add or Enter; an empty row is
  refused.
- **A model:** its fields with their types. You can change a type, remove a field and add one (`ui_model_write`).
  A field needs a name.
- **Removing** a record, a field or an endpoint asks first, naming what goes. Each × is a 28px round target. The × of the round buttons is drawn as strokes, not
  typed, so it sits at the centre of the circle in any font.
- **A per-person binding or a state key:** its running value as JSON, saved with `ui_state_set`, which refuses a
  shared dataset.
- **A connection or an endpoint:** shows the base URL, the sign-in kind and whether a secret is set ("secret kept",
  never the value). For those who manage the workspace's connections it can:
  - save the base URL and set a new secret;
  - Connect for OAuth;
  - try or remove an endpoint, and add one.

  Others read it with a note saying who can change it.
- **A theme:** whether it is the default, Make it the default, Remove from the app (after a confirm), and Edit in
  the Theme view.
- **A component:** the screens that place it, as buttons to them, or that it is not placed yet.
- **A logic module:** a note and Open in the Logic view.
- **A unit of a module:** its JSON, with Save and Remove (asks first), written to the module with its revision.
- **A screen:** shows that screen in the Screens view.
- **A binding:** its dataset's editor.
- **Another app:** Open this app.
- **The person:** what their state holds. **An app's instance under it:** what it is, when it was last used, and Open this app
  for another app.
- **A part the app does not use** (a theme, a dataset, a module) has Use in this app.

Theme and Logic reached from a card show "← Statenet" first in their head, back to the graph. A view picked with the
selector does not. The selector echoes a view set by the page; an emit for the view already shown is ignored.

The graph follows the app: a new revision (`body.dataset.revision`) reloads it while Statenet shows, as it does the
other views, so the head has no Refresh (owner, 2026-11-18: "normally you wouldn't need to refresh the statenet since
it emits changes").

### Theme view
**Tools in the head:**
- a chip per theme of the app, the default first;
- Make it the default, Clone for this app (when other apps use it) and Remove from the app (asks first);
- an Add a theme menu of the workspace's other themes;
- a Preset menu with New theme.

**The sheet:**
- **Specimens:** one card per mode (light, dark, high contrast, and any mode the theme adds), drawn in that mode's
  surface, text, border and accent, with a sample sentence and a button.
- **The token table:** one row per token, grouped (color, space, type…). It has an All modes column (the base tokens)
  and a column per mode with the plain value (references followed) and a swatch for colors. A value the theme writes
  is marked.

**Editing is in place:** pressing a cell turns it into a field. Enter saves and Escape or leaving the field cancels.
- **The All modes column** writes a base token. Emptying it removes the token.
- **A mode column** writes that mode's overlay, adding the overlay when the theme lacks it.
- **The base wins over a mode's overlay**, as the runtime merges them. So a per-mode value for a token the base sets
  moves the base value into every other mode's overlay, then removes it from the base. The other modes keep showing
  what they showed.
- A write that leaves text and surface below AA names the failing pairs in the status line.

**A theme other apps use** says so in an ask bar at the top: "Other apps use this theme too: Orders. Edit it for all of
them, or clone it for this app?" Clone makes a copy with `ui_theme_create` and puts it in the original's place in
`uses.themes` (`ui_app_configure`), so the default stays the default.

### Logic view
**Tools in the head:** a Kind menu (machine, rule, table, compute, effect) and New, which asks for a name and opens
the new unit's editor with a template.

**The sheet** has two lanes:
- **Server:** kept, trusted and shared by everyone.
- **Browser:** runs at once, in each person's browser.

Each unit is a card with:
- its kind, name and place in the run order;
- what it does: a machine's states (the initial one marked) and its transitions as "from → to when trigger"; a rule's
  "when → do"; an effect's request and run; a table's or compute's inputs → outputs;
- the paths it reads and writes.

Below the lanes, the handlers on the screens, listed by screen, each with its event and commands. They always run in
the browser.

**Pressing a unit** opens its JSON in the side panel, with:
- Save;
- Move to the browser or Move to the server (writes `runs`). Move to the browser is disabled, with the reason, for a
  unit that must stay on the server;
- Delete (asks first).

A logic module's units are read only, with the module's name. Writes are `ui_logic_write`, one whole unit, with the
revision. A refused write shows the tool's message.

### Where a unit runs (stateui-app, stateui-mcp)
- Every logic unit (machine, rule, table, compute, effect) takes `runs: "server" | "browser"`. Without it, a unit of a
  Full-mode app runs on the server. Outside Full mode every unit runs in the browser and `runs` is ignored.
- `logicFor(logic, side)` (`@punyts/stateui-app/core`) is the part of a logic document one side runs:
  - In a Full-mode app the authority (`AppLogic`) runs the server units.
  - `mountApp` runs the browser units on the person's own changes.
  - A browser unit's writes go to the server as the person's do, so the server's units and guards run on them.
- **What must stay on the server:** a guard (a rule that only `reject`s: a browser can be bypassed), an effect (its
  connection's secrets are on the server), a `call` command, and any `$.server` path. `readLogic` refuses each of these
  in a browser unit with `SUI-LOGIC-RUNS`.
- `ui_logic_write` answers each unit with its `runs`.

### Routes
All are under `/edit/<id>/views/`, behind the editor's sign-in, reach and edit checks, and each goes through the
person's own tools (`src/server/viewRoutes.ts`):

| Route | Does | Through |
|---|---|---|
| `GET screen?screen=` | A screen's layout tree, the paths it reads and writes, its handlers, its navigates, and the units touching its paths | the document |
| `GET graph` | The owner's tree: nodes by path with their parents, the edges across, the app's name, whether the person manages connections | the document, `uses`, parts, connections, grants |
| `POST add` | A `dataset`, `model`, `module` (with the binding it works on) or `binding` from a +, or `useModule`, and the app's use of it | `ui_data_write`, `ui_model_write`, `ui_logic_write`, `ui_app_configure` |
| `GET part?kind=data\|models\|logic\|connections&name=` | One dataset with its records and model's fields, one model, one logic module with its revision, or one connection without secrets | parts, connections |
| `GET state?path=` | A `$.data` or `$.external` path of the running state | `ui_state_get` |
| `POST state` | Set or remove a `$.data` path | `ui_state_set` |
| `POST data` | A dataset's records or a model's fields | `ui_data_write`, `ui_model_write` |
| `POST connections` | A connection's or an endpoint's change, for managers | the Connections page's `change` |
| `GET theme?theme=` | The app's themes, one theme's modes, tokens and overlays, the apps that share it, the workspace's themes, the presets | parts, `themeTokensOf` |
| `POST theme` | `write`, `clone`, `create`, `add`, `default`, `remove` | `ui_theme_write`, `ui_theme_create`, `ui_app_configure` |
| `GET logic` | The units with run order, reads, writes, where they run and whether they are the app's own; the handlers by screen | the document |
| `POST logic` | Set or remove one unit of the app, or of a module (`module`, `revision`) | `ui_logic_write` |

## Decisions
- Four views, chosen in the top-right corner beside the preferences (owner, 2026-11-18).
- Layout, Data and Logic are layers of the screen tiles. Theme, Statenet and Logic are app-level views that replace
  the canvas (owner, 2026-11-18).
- The graph is the owner's tree by state path (`$.apps`, `$.themes`, `$.data`, …), with every part of the owner and
  what the app does not use dimmed, one level below a part, and a + on each branch that makes the part and puts it to
  use in the app (owner, 2026-11-18).
- A branch shows six parts the app does not use, then a pill for the rest: an owner's hundreds of apps drew a board
  too tall to read.
- The branches of `$` are split between its right and left sides, in order, by height (owner, 2026-11-18): one side
  ran about twice as tall as wide.
- `$.people` shows the person editing only (owner, 2026-11-18: "Only my own"). The owner then had it named by a
  persona, never the person; personas went (person-state.md, owner 2026-11-23), so the node is the person's own id.
- A logic module is made working on one of the app's bindings: its units may only use `$.data.<need>` paths, so a
  module with no need could hold no rule.
- Statenet is drawn on the board, in the world that pans and zooms, not on a sheet of its own (owner, 2026-11-18).
  Theme and Logic stay sheets over the board: a table and lanes read better at one scale. Each view's tools sit in its
  head and its editors in its side panel. The rail is the Screens view's; the zoom shows wherever the board does.
- The agent is sent the chosen view and its layers, in place of the context toggles.
- Layout on a rendered tile uses the frame's real boxes; otherwise a schematic from the document.
- A screen's logic is its parts' handlers, its navigates, and the app units that touch its paths.
- The graph's words are written by the page in the person's language; the route sends data only.
- A dataset card edits the dataset (every bound app); a state card edits the running state.
- Connections are edited from the graph through a JSON route running the Connections page's code, for the same people.
- A unit's editor is its JSON for now. Forms per kind are later work.

## The owner's answers
Asked on 2026-11-18, answered the same day:
1. **Server or browser:** "Let builder move." A unit of a Full-mode app can run in the browser (see "Where a unit
   runs").
2. **A theme several apps use:** "Notify the user and allow them to choose clone or edit." The ask bar offers Edit for
   all and Clone for this app.
3. **How much statenet:** "Anything the app uses to start. We'll eventually have a statenet search that will allow
   users to find other state to include in the app." The graph shows every part the app is assembled from, its outside
   reads and the connections it calls. Finding state to add is a later statenet search.
4. **Order of building:** "together." The four views ship as one piece.

## Rules and Constraints
- **Every write goes through the agent's own tools** (or the Connections page's code for connections), with the
  revision the view read. A refusal shows its message, and the view reloads. No route writes a part's JSON directly.
- **The canvas stays code; the panels stay the editor app's.** The selector and the layers are driven through
  `$.data.editor` and emits (`view`, `layerLayout`, `layerData`, `layerLogic`), never node paths, so a person's edited
  editor keeps the views working (`magnetic-editable.md`).
- **stateui never reads layout:** the boxes come from the runtime's `inspect` answer.
- **Secrets are set, never read back:** `GET graph` and `GET part` return hosts, endpoint paths and whether a secret
  is set, never a key or a token.
- **Only those who manage the workspace's connections change them** (owner or admin of the org, or the person's own
  workspace).
- **Shared datasets and another app's state are read only;** `POST state` takes `$.data` paths only, and
  `ui_state_set` refuses a shared dataset.
- **A guard, an effect, a `call` and `$.server` stay on the server** (`SUI-LOGIC-RUNS`).
- **`$.server` values are never sent to the browser:** the graph and the logic view show its paths only.
- **Never log a state value, a token value or a secret.** A view change logs "Editor view changed" with the route and
  app.
- **Texts in all four languages** (`text.ts`, `views.*` and `shell.view*`/`shell.layer*`).
- **The views are the editor's.** With the editor hidden (`/apps/<id>`) the sheet and the graph do not show and the
  board is not hidden, whatever view is kept for the app (`body.editing` in `VIEWS_CSS`).
- **Nothing is removed without a confirm** that names it.

## As built
- **Selector and layers in the editor app:** `magnetic/src/editor/EditorApp.ts`:
  - `EDITOR_VIEWS`, the `views` segmented control in `shareCorner` and the `viewMenu` on the narrow rail;
  - the rail's `layers`;
  - the fields `view`, `layers`, `layerLook`, `layerTone`, `notScreensView` and `isNarrow`.
- **The canvas script:** `magnetic/src/http/views.ts` (`VIEWS_JS`, served as `/assets/views.js`, and `VIEWS_CSS` as
  `/assets/views.css`: the page's policy refuses an inline style). It holds the
  selector state, the three app views and their editors, and the tile layers, and exposes
  `window.magneticViews = { setView, view, drawLayers }`.
- **Changes to the other canvas files:**
  - `shell.ts`: `appView`, `contextOf`, the narrow and wide fields, loading `views.js`, `canvas.pan`, and the
    blank app's hint hidden in the app views (`hintHidden`);
  - `screens.ts`: `artboard.dataset.screen`, `magneticScreens.panelOf` and `choose`, and redrawing the layers
    after a mount.
- **The builders:** `magnetic/src/inspector/viewInfo.ts`: `layoutOf`, `screenInfoOf`, `unitsOf`, `callsOf`,
  `ownerTreeOf` (`TreeNode`, `TreeEdge`, `TREE_RECORDS`) and `themeTokensOf`. `TreeNode.screens` lists the app's screens on its node and, on a component's, the screens
  whose tree places it.
- **The routes:** `magnetic/src/server/viewRoutes.ts`, wired in `startMagnetic.ts` (`/edit/<id>/views/<name>`).
  `connectionRoutes.ts` exposes `change` for the JSON connections route.
- **The theme-fact fix:** `magnetic/src/agent/AgentTurns.ts` reads `uses.themes` and answers the list and the default
  theme.
- **Texts:** `magnetic/src/http/text.ts` (EN, DE, FR, ES).
- **Where a unit runs:**
  - stateui-app: `src/core/logic/side.ts` (`logicFor`, `LOGIC_SIDES`), `read.ts` and `types.ts` (`runs`),
    `SUI-LOGIC-RUNS` in `src/core/errors/catalog.ts`, and `src/dom/mount/logic.ts` and `mountApp.ts`;
  - stateui-mcp: `AppLogic.ts` (server units), `WriteLogic.ts` and `logicTools.ts` (`runs` in the answer).
- **Tests:**
  - `magnetic/src/inspector/viewInfo.test.ts`: the builders;
  - `magnetic/src/server/viewRoutes.test.ts`, against Postgres: every route, a shared theme, `SUI-LOGIC-RUNS`, a
    connection without its secret, signed-out refusal, the owner's tree by path, and each `POST add` with a module's
    rule, machine and table templates;
  - `magnetic/src/server/editor.browser.test.ts`: the corner and rail sizes with the selector and the layers;
  - `magnetic/e2e/views.spec.ts` (desktop and phone): switching views and keeping the view on reload, the owner's
    tree by path on both sides of `$` with nothing covering anything, a branch's + for a screen, a binding, a module and a rule in it, the app's and a theme's cards (a screen button, a dismissed remove, the Theme
    view and back), a logic module's card to the Logic view and back (the module made by the e2e server's
    `POST /module` with the agent's tools), the app alone with the editor hidden, a new theme and a dark-mode token, a rule moved to the
    browser, the layers on a tile;
  - `magnetic/e2e/editor.spec.ts`: the selector in the top bar;
  - stateui-app: `src/core/logic/runs.test.ts`, `logic.test.ts` and `src/dom/mount/logic.browser.test.ts`;
  - stateui-mcp: `AppLogic.test.ts` and `test/logicTools.test.ts`.
