# Links to state and what a press does, by hand in the editor

Status: L0 to L7 built (owner, 2026-11-27: "Build L0 and L1", "Continue with L2 when the tests pass", "Keep going
through L7 when L2 passes")

Asked for on 2026-11-26: "it would be good for you to articulate the editor like a human would and see if you can do
everything you need to make an app. Screens, Theme, Statenet, Logic, and even Locale"

That walk is recorded in [magnetic-editor-by-hand.md](magnetic-editor-by-hand.md). On 2026-11-27 the owner chose the
first gap to design: "Links and on-press".

## Summary
A person, without the agent, links a part's property to state and says what a press does. Both are done in the
inspector's Properties tab, with choices instead of typed paths, JSON or command names:

- every property field has a **Link** button; a linked property shows where it reads from, with Change and Unlink;
- a list or table has a **Data** section: the dataset it shows, what each row shows, which columns;
- a button has a **When pressed** section, and every other event can be given one: an ordered list of actions as
  sentences ("Go to About", "Save a record into Books"), with Add, Move up and Remove;
- a part gets a **name** (its `@id`) when a control needs one, made from its label; the name is shown once it exists;
- the last setting change can be taken back with **Undo**.

"Save a record" is the one sentence that writes logic instead of an `on` entry: a rule that listens to the button's
`pressed` state. Everything is written through the person's own `ui_nodes_write` and `ui_logic_write`, checked by the
validator, with the revision the page holds.

A text that shows a computed value (a count, a sum) is the last case (stage L7): a choice on the text's Text that
writes a rule setting the text.

The feature changed four libraries. stateui-app: a rule's trigger path may be a node reference (`#name.pressed`,
stage L0), the validator reports a loop of links between stored properties (`SUI-LINK-CYCLE`, L3), and a shape may
mark what a command needs (`commandNeeds`, L5), and a written node's link refused for a missing target is applied
once the target appears (d1b8d9e, after L7). stateui-components marks those commands. stateui-mcp's
`ui_nodes_write` drops the translations of a property it links (L3). The state library's `Store.set` replaces an
object with a list and a list with an object instead of merging them (L5).

Three of the four `test.fixme` steps of magnetic `e2e/build-by-hand.spec.ts` are turned on. What each needs:

| Fixme | Stage | Holds only when |
|---|---|---|
| "a button leads to another screen" | L2 | the step ends back on Home; test 2 of the file uses the Screen choice |
| "the list's items and what each row shows are chosen in its Data section, and a row pressed fills the field linked to it" | L4 | the link to the selected row also sets the list's `selectable` to `single`; the last test of the file stops expecting "No books yet" |
| "pressing Add book saves the title typed as a record of the dataset" | L6 | L0 is built (`#name` triggers) |
| "a text shows the count of the records and another the sum of their pages" (the Logic step) | L7 | the count and the sum are chosen on each text's Text instead of typed as rules |
| "a second language…" | none | stays `test.fixme`; Locale is its own feature. The label it translates must be one this feature left literal |

## Where things stood
Checked in the code on 2026-11-27.

- **There is one kind of link.** `<-` is the only link prefix (stateui-app `src/core/types.ts`, `PREFIXES`). A link is
  a store alias: reads, writes and change events follow the target, so it is already two way. Whether a linked
  property writes back is the component's: a `textField` writes its `value`, a `text` never writes its `_text`.
  `<->` exists in no library. It appears only in Magnetic, in branches that can never match (`fieldsOf` in
  `src/http/inspect.ts`, `bindingsOf` and `StateBinding.twoWay` in `src/inspector/editInfo.ts`, `screenInfoOf` in
  `src/inspector/viewInfo.ts`, a fixture in `src/inspector/viewInfo.test.ts`, an assertion in
  `src/server/inspectRoutes.test.ts`), in `magnetic-show-views.md`, in `magnetic-editor-by-hand.md` and in the spec's
  gap comments. A key `<->value` would be refused by the validator.
- **A node does not evaluate `{{ }}`.** Expressions run only in logic values (stateui-app `src/core/logic/values.ts`).
  A text shows a changing value through a link on `_text`, or through a rule that sets the node's property. A value
  that is one whole template keeps its type: `{{ size(x) }}` writes a number.
- **`on` cannot save a record.** `on` maps an event of the component to one command or a list:
  `{ command, target?, value?, from? }` (`COMMAND_KEYS`). The system commands are a closed list (`SYSTEM_COMMANDS`:
  `set`, `toggle`, `navigate`, `request.approve`, `request.reject`, `request.withdraw`, `undo`, `redo`); any other
  name is a command of the target's component. `save-data` is a logic command. A button writes
  `pressed = { at, device }` on every press (`button.controller.ts`, `@transient`).
- **A rule's trigger path cannot be a node reference.** `trigger()` in stateui-app `src/core/logic/read.ts` requires
  the first step of `when.path` to be one of `LOGIC_ROOTS` (`app`, `data`, `server`, `screens`, `route`, `raised`,
  `external`) and answers `SUI-LOGIC-PATH` for `#addBook.pressed`. Only command targets, values and the inputs of
  tables and computes resolve `#name` (`statePath`; `declaredPlan` in `engine.ts`, at engine start). `buildUnits`
  compiles `when.path` as written. The absolute path `$.screens.home.children.button.pressed` works as a trigger.
- **A `$.data` link target must exist in the definition.** `SUI-LINK-MISSING` reads the assembled document's data
  (`dataPathExists`, stateui-app `src/core/validate/document.ts`): `$.data.<name>` must be bound in `uses.data`, and a
  record path must name a record the dataset holds. `ui_state_set` (behind `POST views/state`) writes the instance, not
  the definition, so a path only a rule writes at run time (the spec's `$.data.bookCount`) is not a legal link target.
- **`$.runtime.requests` is refused as a link target** although `isLinkTarget` accepts it: `record()` in
  `links/extractLinks.ts` passes only `$.data`, `$row` and `$.runtime.sync` and sends the rest to `reference()`.
- **A list selects nothing by default.** `list` and `table` have `selectable` default `none`. `createSelection`
  (stateui-components `src/shared/selection/selection.ts`) points `current` at a record only in `single` mode with a
  row chosen; otherwise `current` is the protected empty record `$.runtime.empty`: reads are empty and a write is
  refused without a sign. In `single` mode with a row chosen, `current` is a store link to the record, so a field
  linked to `#list.current.title` writes the record.
- **Logic finds a node by name across screens only when the name is unique.** `createLogicIndex` (stateui-app
  `src/core/logic/documentIndex.ts`) looks a name up in the current screen, then the app node; while validating, in
  the app node, then among all screens. A node's name is its `@id`, otherwise its key (`nodeId`): once a node has an
  `@id`, its key no longer resolves. `SUI-NODE-ID-TWICE` is per tree (`TreeChecker.ids`), not per app.
- **`{ form: '#name' }` keys the record by the form's child keys**, not by model fields, and takes every `*Field`
  child (`fields()` in `documentIndex.ts`). An empty `numberField` holds `""`.
- **The assembled document holds neither `uses` nor models.** `assembleApp` writes `document.data[binding]` (the
  dataset's records, or a model's defaults) and nothing that says which model or dataset a binding has.
- **The inspector cannot write a link or an id.** `treeOf` (`editInfo.ts`) tests every operation path against
  `NODE_PATH`, whose segments start with a letter or `_`, so a path ending in `<-value` or `@id` is refused with 400
  before the tool runs. stateui-mcp's own path parsing (`parseDocumentPath`, `treePath`) takes any non-empty segment.
- **`POST /nodes` takes operations of one tree** (`inspectRoute` answers 400 when `trees.size !== 1`).
- **The inspector hears only `change`.** `onRaised` (`inspect.ts`) drops every other report, so a button drawn into
  the fields panel is not heard.
- **`fieldsOf` draws string, number, integer, boolean and icon properties** (`FIELD_TYPES`), runtime ones included,
  and nothing for `items`, `row`, `columns` or `on`. A linked property is a read-only field with no `@id`. Layout and
  placement are drawn first "where they are found without scrolling past the component's own properties".
- **`/node` answers the shape's `properties`, `events` and `layout`**, not its `commands`, and `ownSettings` drops
  node-valued slots (`row`, `empty`).
- **The breadcrumb is `crumbsOf` in `inspect.ts`**: a crumb for every path step except `children`. The client's
  `parentOf` (children only) drives Delete, Alt+Arrow and `cannotRemove`. `parentPath` (`editInfo.ts`) feeds only
  `parentLayout`.
- **The inspector sends no revision** with `POST /nodes`, so the server uses the current one: last write wins. The
  page has other writers of the same app revision: the Screens panel (`POST /screens`), the Logic view
  (`POST views/logic`) and Statenet's binding of a dataset, from `shell.ts` and `views.ts`.
- **A person has no undo.** The inspector, the shell and the editor page have no undo control; stateui-mcp has no
  undo tool. The only undo is asking the agent.
- **Below 760px the inspector is a sheet** across the bottom, 45% of the height (`INSPECTOR` in
  `src/editor/EditorApp.ts`). Playwright has a `phone` project (390×844); `build-by-hand.spec.ts` skips below 760px.

## The design

### Where the controls sit
All of it is in the Properties tab, drawn by `fieldsOf` as literal nodes written into the `propertyFields` panel
(`writeFields`), as the fields are today. The order, top to bottom:

1. Undo, while there is something to take back.
2. Data (lists and tables).
3. When pressed, for a part with a `press` event; then one section per other event that has an action.
4. Layout, Place in its parent.
5. Properties, each with its Link button.
6. "Add something that happens when…" (`evAdd`): one choice of the part's other events, in words. Choosing one opens
   its section at place 3.
7. The name line, once the part has a name.

A button's main setting is therefore the first thing under its heading, and a table with eight events gets no
section until one is used.

Nothing static is added to the editor page: no new record field, no new `EDITOR_HEARING` name, no new required id. A
person's changed copy of the editor gets the controls without a reset. Every control is a `textField`, `selectField`,
`switchField`, `numberField`, `button` or `text` with literal values, which the panel already draws; none holds a link
or a row template.

The State tab, Statenet and the side panel are unchanged. The Logic view gains one line of wording (see "Save a
record").

Heard ids (dynamic, matched by pattern in `onRaised`, which now accepts `change` and `press`):

| Id | Control | Event |
|---|---|---|
| `undoLast` | Undo | press |
| `prop<i>` | a property's literal field (as today) | change |
| `link<i>` | Link / Change button of property `i` | press |
| `unlink<i>` | Unlink button of property `i` | press |
| `linkFrom`, `linkField`, `linkCancel` | the open link chooser: where from, which field, cancel | change, change, press |
| `dataItems`, `dataRow`, `dataRowEdit`, `dataOpen` | Data: the dataset, what each row shows, Edit the row, Open Statenet | change, change, press, press |
| `col<i>`, `colTitle<i>` | Data: a table column on or off, and its title | change |
| `evAdd` | "Add something that happens when…" | change |
| `actAdd<e>` | "Add…" choice of event `e` | change |
| `actA<e>_<n>`, `actB<e>_<n>`, `actC<e>_<n>` | the fields of action `n` of event `e` | change |
| `actUp<e>_<n>`, `actRemove<e>_<n>` | Move up, Remove | press |
| `saveInto`, `saveFrom<i>`, `saveClear`, `saveThen`, `saveName<i>`, `saveApply`, `saveCancel` | the Save a record form | change, press |
| `saveEdit<n>`, `unitOpen<n>`, `unitRemove<n>` | a save's sentence (reopens the form); Open in Logic and Remove of a unit line | press |
| `nameEdit`, `nameField`, `nameApply`, `nameCancel`, `namePlace<i>` | the name line: Rename, the field, Save, Cancel, a place that names the part | press, change, press, press, press |

Also in the same loop, because the same code draws them: runtime properties (`runtime: true`) are no longer drawn, and
the `link` component's Screen property becomes a choice of the app's screens (two of the "Smaller" gaps).

### Phone and width
The inspector is 320px wide on a desktop and a sheet 45% of the height below 760px. The rules for both:

- A row never holds more than one field. A linked property is two lines: the target in words, then Change and Unlink
  as labelled buttons. An action is its sentence, then its fields one under the other, then Move up and Remove as
  labelled buttons.
- The Link button of an unlinked property is an icon button beside the field with a touch target of at least 44px
  and the label `inspect.link` for a screen reader.
- The chooser replaces the property's field in place and scrolls into view; its two choices are full width.
- A table's column switches are listed collapsed past twelve.
- A part cannot be placed from the library on a phone today (the by-hand spec's skip). Linking and actions do not
  need placing, so both are tested in the `phone` project on an app built through the tools (see Tests).

### Names
A part is named when a control first needs to name it (a link to it, an action on it, a save that reads it). The
person does not fill in a name beforehand, and no empty Name field is shown.

The name written for a part that has no `@id`:

1. When a link, an `on` target or a logic path already names the part by its key (`namedBy` is above 0), the name is
   the key and `@id` is written equal to it. The references keep resolving.
2. Otherwise the name is made from what the person sees: the part's `_label`, `_title` or `_text`, or for a list or
   table the dataset it shows, camel-cased to letters and digits, at most 24 characters, starting with a letter
   ("Add book" gives `addBook`, the Title field `title`, a list of Books `books`). With none of these, the key.
3. A name in `takenNames` (every `@id` and key of the app) gets a number after it. Names are unique across the whole
   app, not only the tree, because logic looks a name up among all screens and `SUI-NODE-ID-TWICE` checks one tree.

A name for a part of the selected node's own tree goes in the same write as the link or action that needs it. A part
of the other tree (the app node, from a control on a screen) is named by a first write of its own, with the revision
chained; `POST /nodes` takes one tree.

Once a part has a name, the Properties tab ends with the name line: "Named addBook", and "used in 2 places" when
something names it, with the places listed under it (a part or a logic unit each; pressing one selects the part or
opens the unit in the Logic view). **Rename** (`nameEdit`) opens a field with Save and Cancel; nothing is written
while typing. Before writing, the inspector checks the name itself and answers in the person's words: the pattern
`^[A-Za-z_][A-Za-z0-9_-]*$` ("A name has letters, digits, - and _ and no spaces") and `takenNames` ("Another part is
already named title").

Rename rewrites the references when all of them are in the part's own tree: one `POST /nodes` with the `@id`, each
link target and each `on` target. When a logic unit or the other tree names the part, Rename is disabled and says
why ("A rule names this part"); a node and a logic unit cannot be written in one checked step with today's tools. To
keep that case rare, the Save a record form shows the names it is about to write and lets the person change them
first. An emptied name removes the `@id`, offered only while nothing names the part.

### Link to state
Each drawn property has a Link button (`link<i>`, icon `link`), titled "Link {label} to state". Properties that take
no literal field (`selected`, `params`, `href`: union, object, array and url types) are drawn as a line "{label}: not
linked" with the same button. A list's or table's `items` is not drawn among its properties: the Data section's Shows
sets it.

Pressing Link replaces that property's field with the chooser: From, then Field, then Cancel. Field is drawn from the
start, disabled until a group is chosen. The focus moves to From (or to Open Statenet), then to Field, and back to
Change or Link when the chooser closes. Escape closes it from From or Field and keeps the selection. The chooser does
not scroll itself into view.

1. **From** (`linkFrom`): the groups that hold at least one target of a type the property accepts, in this order:
   - *This row*, when the part is inside a row template;
   - *Selected in {list}*, one per list or table of the same tree as the node whose `selectable` is `none` or
     `single`;
   - one entry per binding of the app (`uses.data`), shown by the dataset's own name (a select option has only a
     label, so there is no tooltip naming the binding);
   - *Parts of this screen*, the stored or exposed properties of the other parts (`#title.value`); a part of the app
     node's tree is offered only when it is named;
   - *The connection* (`$.runtime.sync`): "Whether the app is connected" (`status`), "How the app syncs" (`mode`),
     "Changes waiting to be sent" (`waiting`).
   - *Shows a computed value*, on an unlinked `_text` of type string outside a row template, while the app has a
     dataset (L7, see case 3).
2. **Field** (`linkField`): what the group holds. For a row or a selected record: the model's fields. For a dataset:
   "All records", offered to properties that take a list or a map (such as `items`). For a binding to a model (one
   record, not a dataset): the fields the assembled document holds, which are those with a default. For parts:
   "Title › Value".

Choosing a field writes at once, with Undo. A linked property then shows its target in words ("Value: Selected in
list › title", "This row › title") with Change and Unlink.

*Selected in {list}* needs the list to select one row. When the list's `selectable` is `none`, the same write sets
it to `single`, and names the list (`@id`) when it has no name. A list set to `multi` has no current record and is
not offered. With no row chosen the linked field is empty and typing into it is dropped, so the linked line says
"Empty until a row is chosen".

Unlink (`unlinkWrites` in `src/http/linkChoices.ts`) removes the link and writes a value back to the property when
it is required, or when its `requiredWhen` requires it on the node as unlinked: the literal the link replaced this
session, else the shape's default, else `""` for content. It also fills a sibling whose `requiredWhen` names the
unlinked property (an image's `_alt` once `decorative` is unlinked). When a value is needed and there is none to
write (a currency the format requires), the line offers Change only. A second press while the Unlink is queued is
ignored.

What is left out of the choices, so that a valid choice is all that is offered:
- a target whose type does not fit the property (a number property is not offered a text field);
- `$.data` targets for `hidden`, `open` and shared look properties, which would raise the `SUI-LINK-OWN` warning; they
  are offered *Parts of this screen* only;
- `$row` outside a row template (`SUI-LINK-ROW`);
- content (`_x`) and runtime properties that are not exposed, which a `#name` link may not name;
- `$.runtime.requests` (`SUI-LINK-MISSING` today) and anything under `$.server`;
- one fixed record of a dataset (`$.data.books.r1.title`). An existing link of that form, written by the agent, is
  shown ("Books › r1 › title") with Change and Unlink;
- a part's property whose own links lead back to the property being linked (`/scope` gives each part's `links` and
  the node's own `links` and `name`). The validator reports such a loop as `SUI-LINK-CYCLE`.

Under a linked content property (`_text`, `_label`) the section says "A linked text is not translated", because a
locale overlay may not set a linked property (`SUI-LOCALE-LINKED`). `ui_nodes_write` drops the locale entries of a
property the write links, on screens and on the app node (stateui-mcp `overlayCarry`), so linking a translated text
is not refused.

**Nothing to link to.** A group with no target is not listed. When no group is left and the app has no dataset, the
chooser shows a line instead of an empty choice: "This app has no data yet. Make a dataset in Statenet." with **Open
Statenet** (`dataOpen`, which asks the shell for the Statenet view, `magneticShell.showView`), and under it, when
the screen has no list or table, "Place a list to link to the row chosen in it". When the app has data and nothing
fits, it says "Nothing in this app fits {label}". Data's Shows and the Save form's Into show the no-data line and
button when the app has no dataset.

### Data: lists and tables
A part whose shape has an `items` property and a `row: true` slot or a `columns` map gets a **Data** section.

The choices and the writes that undo them are pure functions in `src/http/dataChoices.ts`, which the page script
includes (`DATA_CHOICES_JS`). Each choice is one node write with Undo, queued behind a write still running.

- **Shows** (`dataItems`): "Nothing" or one of the app's datasets (not a binding to a model). A link the editor did
  not make is kept as its own choice, described in words.
- A list: **Each row shows** (`dataRow`): one of the dataset model's fields.
  - A list with no `row` gets a one-text row in the same write as the dataset.
  - A row that is one linked text is changed in place.
  - Any other row (the agent built a card) is never replaced: the section says "A row made of parts" with **Edit the
    row** (`dataRowEdit`), which selects the row template node (`<list>.row`). The template is then an ordinary
    selection: its properties, its Link chooser with *This row*, its "When …" sections.
  - When the dataset is changed and a `$row.<field>` link of the row names a field the new model lacks, the row is
    kept and the section says "This row shows fields {dataset} does not have", with Edit the row.
  - The row's fields are the `$row.<field>` links of the template; the search does not go into a nested list's `row`
    or a nested table's `columns`, where `$row` is the inner record (`rowFieldsIn`, `holdsRow`).
- A table: one switch per model field (`col<i>`) and, when on, its title (`colTitle<i>`, saved once typing pauses).
  Linking a table with no columns turns on up to six fields. The column key is the field name; a name that is
  integer-like or does not start with a letter gets the prefix `c_`. Columns keep the order they were turned on in.
  Turning a column off is undone by writing back the whole previous `columns` map, so the column returns to its
  place. Switches past twelve fold into a collapsed panel ("{count} more fields").
  - Every column the first pass does not match to a model field by key gets its own switch: a second column of the
    same field, a dotted field (`meta.x`), a column drawn only by its `cell`. A column with no field is named by its
    key.
  - A column is a misfit only when it has a non-empty `field` whose first step is not a model field; it is listed
    with "{dataset} has no field {field}" and its switch, so it can be turned off.
- A dataset whose fields are unknown (the person does not hold its body or model, `owned: false`, or the model gives
  no fields; `knownFields` is null) reports no misfit, lists its columns as plain switches, and has no "Each row
  shows".

Slot nodes (`<list>.row`, `<list>.empty`, `<table>.columns.<key>.cell`) in the client: `crumbsOf`
(`src/http/crumbs.ts`, included in the page as `CRUMBS_JS`) skips `columns` and the column key as it skips
`children`, and labels a slot step in words ("Row", "Empty", "Cell of title"). `parentOf` stays children-only, so Move
stays disabled and Delete is hidden for a slot node. A template has no rectangle on the canvas; the overlay shows
none. `parentPath` does not change: a slot node has no Placement section. The row is reached with Edit the row; no
control selects a table cell (a rendered cell carries a runtime path, which `/node` does not answer, and a click falls
back to the table), so the "Cell of {column}" crumb exists but is not reached from the editor.

### When pressed
A section is titled "When pressed" for `press` and "When {event in words}" otherwise. It lists the event's actions
in order, each a sentence with its fields under it, Move up and Remove, and ends with **Add…** (`actAdd<e>`). The
sentences:

| Sentence | Fields | Written |
|---|---|---|
| Go to a screen | one choice, "Go to {screen}": the screens that need no params | `on`: `navigate` |
| Set a value | Where: writable targets (below); Value: a switch, a choice of a text's closed `values`, a number or a text by the target's type | `on`: `set` |
| Switch a value on or off | Where: writable boolean targets | `on`: `toggle` |
| Show or hide a part | Part; Show it / Hide it / Show it or hide it in turn | `on`: `set` or `toggle` of `#name.hidden` |
| Tell a part to… | Part: "This part", "The {component} around it", "This row", then the other parts whose component has commands; What: that component's commands in words; Value when the command takes a key of a map | `on`: a component command |
| Undo / Redo | none | `on`: `undo`, `redo` |
| Save a record | Into, one source per field, Then clear the fields, Then go to | rules; see below |

The choices are built by `actionChoices` in `src/http/pressActions.ts`, which reads each sentence back
(`actionKind`), picks a starting value that fits the place (`placeValue`) and names an unnamed part in the same write
(`withName`; Undo takes the name away again).

Rules of the section:
- An action is written when its required fields are set; nothing half-made is written. A typed text or number is
  written once typing pauses, to the action with the target it was typed for.
- Each action field's visible title is hidden; a sentence line sits above the fields and each field's accessible name
  says which action of which event it is ("Where, action 1 of When pressed").
- "Add…" lists only the sentences that have something to act on.
- "Where" is one flat choice of the Link chooser's targets, labelled with the group's and the target's words
  ("Name › Value"), without what the app does not own: the connection group, and *Selected in {list}* of a list whose
  `selectable` is not `single`. A part's `hidden` is left out of Where for Set and Switch, since Show or hide writes
  it.
- For `change` and `input`, a `set` or `toggle` is not offered the part's own link targets (`SUI-ON-LINKED`).
- A part is named `#name` only when that name reaches it alone from the node (`/scope` part `unique`); any other part,
  and every part of the app node offered on a screen, is targeted by its path. `spelled()` turns a path target back
  into `#name` once the name is unique, so the action reads as the same sentence.
- "Tell a part to…" offers `$parent` as "The {component} around it" when an ancestor's component has commands (a
  button in a form's `actions` slot), and "This row" inside a row template. It never offers a command named like a
  system command (`toggle`, `undo`, `redo`).
- What a command needs comes from the shape's `commandNeeds` (stateui-app, set on eleven stateui-components
  components): a `value` command is offered only when `commandValues` gives keys to choose from (so tabs' and
  carousel's `select`, whose keys are children, are not offered), and a `row` command (table `delete`) only through
  This row. `commandNeeds` is metadata: the validator does not refuse a command written without what it needs.
- When `commandValues` names a map property for a command, Value is a choice of that map's keys, starting at the
  first; there is no "Nothing".
- An existing action the sentences do not cover (`from`, `request.*`, route params, `$row` values, a target the scope
  does not list) is shown as one read-only line in the Logic view's wording (`commandsText` in `src/http/pressActions.ts`,
  which both page scripts include), with Move up and Remove. The form never rewrites it.
- "Save a record" is offered where the component has a `pressed` property (a button). It is listed in the section but
  lives in logic. It is always listed last, has no Move up, and while a save is listed the other actions carry the
  note "Runs at once, before the save".

**Words for events and commands.** Event and command names are engine identifiers. `text.ts` gets a table of words
for the library's common ones; any other name is shown through `labelFor()` ("column resize"), never raw.

| Name | EN | DE | FR | ES |
|---|---|---|---|---|
| event `change` | it changes | es sich ändert | il change | cambia |
| event `input` | something is typed | etwas getippt wird | on y écrit | se escribe |
| event `select` | a row is chosen | eine Zeile gewählt wird | une ligne est choisie | se elige una fila |
| event `activate` | a row is opened | eine Zeile geöffnet wird | une ligne est ouverte | se abre una fila |
| event `submit` (form `submitted`) | it is sent | es gesendet wird | il est envoyé | se envía |
| event `invalid` | a field is wrong | ein Feld falsch ist | un champ est incorrect | un campo es incorrecto |
| command `submit` | send it | absenden | l'envoyer | enviarlo |
| command `reset` | put it back as it was | zurücksetzen | le remettre comme avant | dejarlo como estaba |
| command `validate` | check its fields | seine Felder prüfen | vérifier ses champs | comprobar sus campos |
| command `clear` | empty it | leeren | le vider | vaciarlo |
| command `focus` | put the cursor in it | den Cursor hineinsetzen | y placer le curseur | poner el cursor en ella |
| command `open` / `close` | open it / close it | öffnen / schließen | l'ouvrir / le fermer | abrirla / cerrarla |

### Save a record
Add… › Save a record opens a small form in the section:

- **Into** (`saveInto`): the app's datasets, by name.
- one choice per field of the dataset's model (`saveFrom<i>`), required fields marked "{field} from (a source is
  needed)": "Nothing", or a field part of the screen (a part whose component name ends in `Field`, the library's own
  rule) whose value type can hold the model field's type (`partFits`: a number or integer field needs a number, a
  string or url field a string, a boolean a boolean; an `any` field takes any part), preselected when its key or label
  equals the field's name without case.
- Left out, each with a muted note (`leftOut`): an optional number field (Risk 4, below) and an array or object
  field. Save this stays disabled when the model requires an array or object field ("this dataset cannot be saved
  into here").
- "The form's fields" replaces the per-field choices only when the button sits in a `form`, every `*Field` child of
  that form is a model field it fits even when empty (so no optional number), and every required model field has a
  child. `{ form }` keys the record by child keys, so any other form keeps the per-field choices.
- **Then clear the fields** (`saveClear`, on).
- **Then go to** (`saveThen`): "Stay here" or one of the app's screens.
- The names the save will write for the button and each source that has none (`saveName<i>`), each a field the person
  may change before saving.
- **Save this** (`saveApply`), disabled until one field has a source and every required field has one, and Cancel.

The form's functions are in `src/http/saveRecord.ts`, which the page script includes.

It writes the missing names, then the rules: `<name>Pressed` saves, and `<name>Saved` runs once the save is accepted:
it clears the fields, then navigates. The second rule waits for the result because a guard or a shared dataset may
reject the record; a field must not empty and the screen must not change when nothing was saved. The save waits until
the record is applied (`await: 'applied'`), not until it is durable: in Magnetic a save into a shared dataset made the
view reconnect with a new document revision, and a durable result rule never ran. With neither a clear nor a screen,
only the first rule is written, without `as`.

The rule names are made free against every unit of the app (`/scope` `unitNames`; `saveUnits`, `freeUnit`): when
`rules.addBookPressed` exists, a new save writes `rules.addBookPressed2`, and `as` follows the result rule's name. A
rewrite keeps its own names; a rewrite that had no result rule takes the first free result name. Save a record is
offered beside a rule of another shape on the press and never replaces it.

A source's value is the part's value path: `"#title.value"`, and for a number `"#pages.value"`. An expression cannot
name a node (`coalesce(#pages.value, null)` is refused as `SUI-LOGIC-EXPRESSION`), so Risk 4's fallback is built: a
number source is offered only for a required number field, and an optional number field is left out of the record.
An empty required text field is saved as `""`: the model treats `""` as a value.

Go to a screen and Save a record on one press: a "Go to" in `on` runs in the browser at once, before the save reaches
the server. The save still reads the fields, because a part's state stays when its screen is left, but the person
leaves before knowing the save was accepted. "Then go to" is the way to leave after the save. Both orders are pinned
by a test (see Tests).

Reading back: the section finds the rules by their trigger (`#<name>.pressed`).
- A pair of the generated shape shows "Save a record into Books". Pressing it (`saveEdit<n>`) reopens the form filled
  from `/scope` `units[].save`; Save this rewrites both rules in one `units` write. A model field added since shows
  as "Nothing"; a source read back that no longer fits its field, or whose field is gone, is dropped
  (`chosenSources`). A save that names a field or a dataset the app no longer has carries a note on its line ("open
  it and press Save this"); for a form save only the dataset and named fields are checked.
- A rule with that trigger and any other shape (the agent or the person changed it in the Logic view) shows "Runs
  {unit}", the unit named without its group, with **Open in Logic** (`unitOpen<n>`, which opens the Logic view at
  the unit, `magneticShell.openUnit`) and **Remove** (`unitRemove<n>`, a trash icon named "Remove {unit}", with the
  confirm).
- Unit lines also show on a part whose component has no press event, when units name it.

In the Logic view the unit's card says "Runs when {part} is pressed", and the Screens view badges the screen that
holds the part (`ScreenInfo.pressed`). No `on` entry and no `runs` are written: the units run where units run by
default (Risk 3 held: the transient press reaches the authority and the server's clear and `navigate` reach the page)
and are moved with the Logic view's own button.

### Undo
The inspector keeps the inverse of its last setting write and shows **Undo** (`undoLast`) at the top of the
Properties tab, with what it takes back ("Undo: unlink Value").

- Covered: a link made, changed or removed (with the literal it replaced), an action added, changed, moved or
  removed, a name written or changed, a column switched, a default row written, a list's `selectable` set by a link.
- The inverse is built before the write from what was read: `settings` of `/node` for the selected node, `/scope`
  for another part touched in the same write (its `@id`, its `selectable`).
- Undo is one step. It is one `POST /nodes` with the page's revision; a 409 says the app changed elsewhere and drops
  the step. Any other write of the page replaces or drops it; it does not survive a reload.
- Not covered: logic. Removing rules asks first with a confirm that names them. Adding, moving and deleting parts
  keep today's behaviour.

### The six cases and the JSON written
`P` is the selected node's path. Every node write is one `POST /edit/<id>/nodes` with the page's revision. A `remove`
is sent only when `settings` holds the key.

**1. A text field's value linked to a field of a record.** Select the field, press Link beside Value, From: "Selected
in Books", Field: "title".

```json
{ "revision": 41, "operations": [
  { "op": "set", "path": "$.screens.home.children.list.@id", "value": "books" },
  { "op": "set", "path": "$.screens.home.children.list.selectable", "value": "single" },
  { "op": "remove", "path": "$.screens.home.children.edit.value" },
  { "op": "set", "path": "$.screens.home.children.edit.<-value", "value": "#books.current.title" } ] }
```

The first operation is sent only when the list has no `@id` (the list shows Books, so the name is `books`; had
something named it `#list` already, the name would be `list`). The second is sent only when `selectable` is `none`.
The node afterwards: `{ "component": "textField", "_label": "Title", "<-value": "#books.current.title" }`. Until a
row is chosen the field is empty and does not take typing. A value only the screen uses needs no link: it stays the
part's own state and other parts and logic name it `#title.value`.

**2. A list or a table linked to a dataset.** Select the list, Data › Shows: Books; Each row shows: title. One write:

```json
{ "revision": 42, "operations": [
  { "op": "set", "path": "$.screens.home.children.list.<-items", "value": "$.data.books" },
  { "op": "set", "path": "$.screens.home.children.list.row",
    "value": { "component": "text", "<-_text": "$row.title" } } ] }
```

The second operation is sent only when the list has no `row`. Changing "Each row shows" to pages:
`{ "op": "set", "path": "P.row.<-_text", "value": "$row.pages" }`. A table:

```json
{ "revision": 42, "operations": [
  { "op": "set", "path": "$.screens.home.children.table.<-items", "value": "$.data.books" },
  { "op": "set", "path": "$.screens.home.children.table.columns", "value": {
      "title": { "_title": "Title", "field": "title" },
      "pages": { "_title": "Pages", "field": "pages", "align": "end" } } } ] }
```

A column switched on later: `{ "op": "set", "path": "P.columns.author", "value": { "_title": "Author", "field":
"author" } }`; off: `{ "op": "remove", "path": "P.columns.author" }`; its title: `set P.columns.author._title`.

**3. A text that shows a value.** Select the text, press Link beside Text, choose the target:

```json
{ "revision": 43, "operations": [
  { "op": "remove", "path": "$.screens.home.children.heading._text" },
  { "op": "set", "path": "$.screens.home.children.heading.<-_text", "value": "#books.current.title" } ] }
```

A computed value (a count, a sum) is not a link, because its path would not exist in the definition. The text gets a
name and a rule sets its property. The Link chooser of an unlinked `_text` offers the group "Shows a computed value":
"Count of {dataset}" for each dataset, "Sum of {field} in {dataset}", "Smallest {field} in {dataset}" and "Largest
{field} in {dataset}" for each number field, and last "An expression…" with an Expression field and **Show this**.
The pure functions are in `src/http/computedValue.ts`, which the page script includes (`COMPUTED_VALUE_JS`). A
choice first names an unnamed part with a node write of `@id`, as Save a record does, then writes one rule,
`<name>Text` (made free with `freeUnit` when taken), through `POST views/logic`. Choosing "Count of Books" on a text
named `count`:

```json
{ "unit": "rules.countText", "value": {
  "when": { "path": "$.data.books" },
  "do": [ { "command": "set", "target": "#count._text", "value": "{{ string(size($.data.books)) }}" } ] } }
```

Every generated value is wrapped in `string()`: `_text` is a string and a whole template keeps its type. The sums are
`{{ string(sum($.data.books, 'pages')) }}`. Smallest and Largest write `{{ string(coalesce(min($.data.books,
'pages'), '-')) }}` (and `max`), so a dataset with no record shows "-".

An expression's trigger is the steps every `$.` path in it shares, at least two, under `data`, `app`, `screens` or
`route`. The inspector refuses, in words under the field: an expression typed with `{{` or `}}`, one that reads no
`$.` path or paths under two roots, brackets that do not pair up outside quotes, a function outside stateui-app's
`LOGIC_FUNCTIONS` plus `lookup`, and a read of a `$.data.<name>` the app does not bind. A `SUI-LOGIC-EXPRESSION`
refusal from the server reads "This expression cannot be read".

The line reads "Text: Count of books" with Change, which offers only computed values, and Remove, which deletes the
rule after "Delete the rule {unit}?" and puts the focus back on Link. The node keeps its literal `_text`, so after
Remove the Text field shows it again. A computed value is read back (`/scope` `computed`) only from a rule whose
`when` is exactly a `$.` path and whose `do` holds only sets of `#name.*`; a rule of another shape that sets the part
shows "set by the rule {unit}" with Open in Logic. A linked property always shows its link line. A text inside a row
template is offered no computed value, because stateui-app's logic index does not resolve `#name` for row-template
nodes.

**4. A button that goes to a screen.** Select the button, When pressed › Add… › Go to a screen, Screen: About.

```json
{ "revision": 44, "operations": [
  { "op": "merge", "path": "$.screens.home.children.go", "value":
    { "on": { "press": { "command": "navigate", "target": "about" } } } } ] }
```

When the node already has `on`: `{ "op": "set", "path": "P.on.press", "value": { "command": "navigate", "target":
"about" } }`. A second action makes the value a list:
`"press": [ { "command": "set", "target": "$.data.settings.seen", "value": true }, { "command": "navigate",
"target": "about" } ]`. The other sentences write `{ "command": "toggle", "target": "#editor.hidden" }`,
`{ "command": "set", "target": "#editor.hidden", "value": false }`, `{ "command": "submit", "target": "#entry" }`,
`{ "command": "submit", "target": "$parent" }`, `{ "command": "undo" }`.

**5. A button that saves the form's record and clears the form.** Select Add book, Add… › Save a record, Into:
Books, title from: Title, Then clear the fields: on, Then go to: Stay here, Save this. Two writes, in order.

Write 1, `POST /edit/<id>/nodes` (only the names that are missing):

```json
{ "revision": 45, "operations": [
  { "op": "set", "path": "$.screens.home.children.button.@id", "value": "addBook" },
  { "op": "set", "path": "$.screens.home.children.textField.@id", "value": "title" } ] }
```

Write 2, `POST /edit/<id>/views/logic` with the revision write 1 answered:

```json
{ "revision": 46, "units": [
  { "unit": "rules.addBookPressed", "value": {
      "when": { "path": "#addBook.pressed" },
      "do": [ { "command": "save-data", "into": "$.data.books", "value": { "title": "#title.value" },
                "as": "addBookSaved", "await": "applied" } ] } },
  { "unit": "rules.addBookSaved", "value": {
      "when": { "result": "addBookSaved", "is": "accepted" },
      "do": [ { "command": "set", "target": "#title.value", "value": "" } ] } } ] }
```

The trigger `#addBook.pressed` needs stage L0. A cleared field takes its shape's default (`""`, `false`, `null`).
With a required number field the save's value is `{ "title": "#title.value", "pages": "#pages.value" }`; an optional
number field is left out. When `rules.addBookPressed` or `rules.addBookSaved` exists, a number is added to the name
(`rules.addBookPressed2`). With "Then go to: About" the second rule's `do` ends with `{ "command": "navigate", "target": "about" }`. With a
`form` named `entry` whose field keys are all model fields, the save's value is `{ "form": "#entry" }` and the clear
is `{ "command": "reset", "target": "#entry" }`. If write 2 is refused the names stay (they change nothing), the form
stays open and shows the refusal.

**6. Removing.**
- A link (Unlink): `[{ "op": "remove", "path": "P.<-value" }]`, with `{ "op": "set", "path": "P.value", "value":
  <the literal kept for the session, else the shape default, else ""> }` in the same write when the property is
  required or `requiredWhen` requires it, and a `set` of a sibling whose `requiredWhen` names it. Undo is offered.
- A computed value (Remove): a confirm that names the rule ("Delete the rule countText?"), then
  `{ "units": [ { "unit": "rules.countText", "remove": true } ] }`. The name and the literal `_text` stay.
- A list's dataset (Shows: Nothing): `[{ "op": "remove", "path": "P.<-items" }]`. The row stays. Undo is offered.
- An action (Remove): `[{ "op": "remove", "path": "P.on.press" }]` for the only action; `set P.on.press` to what is
  left otherwise; `remove P.on` when no event is left. Undo is offered.
- Save a record or a unit line (Remove): a confirm that names the rules ("Delete the rules addBookPressed and
  addBookSaved?"), then `{ "revision": 47, "units": [ { "unit": "rules.addBookPressed", "remove": true },
  { "unit": "rules.addBookSaved", "remove": true } ] }`. The names stay.
- A name: `[{ "op": "remove", "path": "P.@id" }]`, offered only while nothing names the part.

### Routes
All under `/edit/<id>`. Answers hold data, never words.

- **`GET /node`** (changed): adds `id` (the `@id` or null), `component.commands`, `component.commandValues` and
  `slots` (`{ row: { component, text, fields } | null, … }` for the shape's node-typed properties, which
  `ownSettings` drops: the slot's component, the `$row` field a one-text row shows, and the `$row` fields the template
  reads; `slotsOf` in `editInfo.ts`). A
  slot path (`<node>.row`, `<node>.columns.<key>.cell`) already answers, because `nodeAt` walks any key.
- **`GET /scope?path=<node path>`** (new, added to `INSPECT_ROUTES`): what the selected node may name. Built by a new
  pure `scopeOf(document, path, shapes, parts)` in `src/inspector/editInfo.ts`. `document` is the assembled document
  the route already loads, so every `$.data` path offered is one `SUI-LINK-MISSING` accepts. `parts` is
  `{ uses, datasets, models }`: the app part's `uses.data` and the bodies of the datasets and models it names that
  the person holds, read by the route through the person's parts (`scopePartsOf` in `src/server/startMagnetic.ts`).
  Whether a binding is the person's own is whether its dataset or model was found there. The assembled document holds
  none of that.

  ```json
  { "revision": 41,
    "screens": [ { "name": "home", "title": "Home", "params": [], "needs": [] },
                 { "name": "about", "title": "About", "params": [], "needs": [] } ],
    "datasets": [ { "binding": "books", "name": "Books", "path": "$.data.books", "kind": "dataset", "owned": true,
                    "fields": [ { "name": "title", "type": "string", "required": true },
                                { "name": "pages", "type": "number", "required": false } ] } ],
    "parts": [ { "name": "textField", "named": false, "suggested": "title", "unique": true,
                 "path": "$.screens.home.children.textField",
                 "component": "textField", "label": "Title", "field": true,
                 "properties": [ { "name": "value", "type": "string" } ],
                 "records": [], "inRow": false, "commands": [ "validate", "reset", "focus", "clear" ],
                 "commandValues": {}, "commandNeeds": {}, "links": {} },
               { "name": "list", "named": false, "suggested": "books", "unique": true,
                 "path": "$.screens.home.children.list", "component": "list", "label": "",
                 "field": false, "properties": [], "selectable": "none",
                 "records": [ { "name": "current", "binding": "books" } ], "inRow": false, "commands": [],
                 "commandValues": {}, "commandNeeds": {}, "links": { "items": "$.data.books" } } ],
    "row": null,
    "parent": { "path": "$.screens.home.children.entry", "component": "form", "commands": [ "submit", "reset" ],
                "commandValues": {}, "commandNeeds": {}, "fields": [ "title", "pages" ] },
    "component": "button", "commands": [], "commandValues": {}, "commandNeeds": {},
    "own": [ "hidden", "tone", "size" ],
    "links": {},
    "name": "button",
    "suggested": "addBook",
    "takenNames": [ "textField", "list" ],
    "namedBy": [],
    "units": [ { "unit": "rules.addBookPressed", "trigger": "#addBook.pressed",
                 "save": { "into": "$.data.books", "fields": { "title": "title" }, "form": null, "clear": true,
                           "then": null, "result": "rules.addBookSaved" } } ],
    "unitNames": [ "rules.addBookPressed", "rules.addBookSaved" ],
    "computed": [] }
  ```

  `datasets` come from `parts.uses`; `kind` is `dataset` or `model` (a binding to a model: one record, whose `fields`
  are only those the document holds); `fields` come from the model, so an empty dataset still offers fields. No
  records are sent. `parts` are the nodes of the same tree and the app node: `name` is the `@id` or else the key,
  `suggested` the name the Names rule would write, `unique` whether `#suggested` reaches the part alone from the
  node, `properties` the stored or exposed ones a `#name` link accepts (with a text's closed `values`), `records` the
  exposed record properties (`current`) with the binding their fields come from, `selectable` the list's mode,
  `inRow` whether it lies in a row template, `commandValues` and `commandNeeds` what its commands take and need, and
  `links` what each of its `<-x` reads. `row` is set when the path lies under a `row: true` slot. `parent.fields` are
  the form's `*Field` child keys. `own` lists the properties `SUI-LINK-OWN` watches. `links` and `name` are the node's
  own links and the name a `#name` reaches it by; `suggested` the name the editor would write for it. `takenNames` is
  every `@id` and key of the app's other nodes. `namedBy` lists what names the node: `{ kind: "link" | "on" |
  "logic", path | unit, tree }`. `units` are the logic units whose trigger is `#<name>.<property>` of the node; `save`
  is filled only for the generated shape. `unitNames` is every logic unit of the app as `<group>.<name>`. `computed`
  lists the rules that set a property of the node by its name: `{ unit, property, choice, expression }`, with
  `choice` or `expression` filled for the shape "Shows a computed value" writes. `$.server` never appears.
- **`POST /nodes`** (changed): `treeOf` accepts a last segment `<-<name>` or `@id` (a new `WRITE_PATH`: `NODE_PATH`
  plus `(\.(<-[A-Za-z_][\w-]*|@id))?`). A link key or `@id` in the middle of a path is still refused. `nodeAt` keeps
  `NODE_PATH`. Operations of one tree, as today.
- **`POST views/logic`** (changed, `changeLogic` in `src/server/viewRoutes.ts`): besides one `unit`, it takes
  `units`, 1 to 4 entries (`MAX_LOGIC_UNITS`) of `{ unit, value }` or `{ unit, remove: true }`, written as one
  `ui_logic_write` (the tool already takes a list of operations).
- `GET /screens`, `GET /state`, `GET views/logic`, `POST views/state` are unchanged.

**One revision for the page.** The shell object holds the app's revision (`magneticShell.revision`, `revised`,
`onRevision`, `write`). It is read at load and set from the answer of every write the page makes (`/nodes`,
`/screens`, `views/logic`, and the `views/add` and `views/theme` actions that write the app, which answer
`appRevision`), from `GET /node` and `GET /scope`, and from the Screens panel each time it reloads its list for a new
document. It never moves back. Every write of the app carries it and goes through `magneticShell.write`, one at a
time; a write without a whole-number revision is a 400. So the page follows the app: after an agent turn the page
has read the new revision and the inspector reads its selected part again. A 409 remains only when the app changed
and the page has not read it yet; it reads again and says `views.changedElsewhere`.

### Validation
The tools are the only judge. `ui_nodes_write` applies the operations to a copy, checks the whole app and writes once
or not at all: `SUI-LINK-TARGET`, `SUI-LINK-MISSING`, `SUI-LINK-ROW`, `SUI-LINK-SERVER`, `SUI-LINK-CYCLE`,
`SUI-STATE-UNKNOWN`, `SUI-STATE-RUNTIME`, `SUI-ON-SHAPE`, `SUI-ON-EVENT`, `SUI-ON-COMMAND`, `SUI-ON-VALUE`,
`SUI-ON-TARGET`, `SUI-ON-LINKED`, `SUI-ROUTE-SCREEN`, `SUI-ROUTE-PARAMS`, `SUI-NODE-ID-TWICE`. `ui_logic_write`
checks the units (`SUI-LOGIC-*`). No new error code is added.

The editor filters the choices so that what it offers passes, and no choice adds a link or an action that warns
(`SUI-LINK-OWN`). A test sweeps the catalog to hold it to that (see Tests). Unlink can leave a warning the app did not
have (the remaining link to a `$.data` target is on `hidden`); the write goes through and the status line shows the
warning.

What the validator does not stop, the inspector checks first: a name's pattern, and a name taken on another screen
(`SUI-NODE-ID-TWICE` is per tree).

A refusal (400) shows the first error that is not a warning in the status line. The codes this feature can raise are
shown in the person's words from `text.ts` (`SUI-NODE-ID-TWICE`, `SUI-LINK-MISSING`, `SUI-ROUTE-SCREEN`,
`SUI-ON-LINKED`, `SUI-LOGIC-PATH`); any other shows the catalog message. A conflict (409) shows
`views.changedElsewhere` ("This changed somewhere else. It was read again; try once more.").

After a 400 or a 409 the part and its scope are read again. An open chooser, an open name field and an open Save a
record form keep what the person chose: the choices are held in the inspector, drawn again against the new `/scope`,
and only a choice that no longer exists is dropped.

### Changes by file (when built)
- stateui-app (stage L0): `src/core/logic/read.ts` `trigger()` takes a `when.path` that starts with `#` and resolves
  it through `options.resolve` (refused with `SUI-LOGIC-PATH` when it does not resolve, names several nodes or holds
  a capture); `src/core/logic/engine.ts` `buildUnits` resolves such a path through `resolve` when the engine starts,
  in the validator's order (the app node, then all screens), as `declaredPlan` does for a table's inputs, so the
  trigger does not depend on the screen shown. README, CHANGELOG, tests.
- stateui-app (L3): `ownState` (`src/core/validate/tree.ts`) is exported from `/core` so `scopeOf` and the validator
  share one rule. Stale `emit` comments in `src/core/on/` go. `checkCycles` in `src/core/validate/tree.ts` reports
  `SUI-LINK-CYCLE` on every link of a loop between stored properties.
- stateui-mcp (L3): `overlayCarry` and `WriteNodes` drop the locale entries of a property a node write links, on
  screens and on the app node.
- stateui-app (L5): the shape key `commandNeeds` (`src/core/shape/types.ts`, `table.ts`), checked by the shape table
  and exported by the catalog. stateui-components (L5): `commandNeeds` on accordion, carousel, map, recordGrid,
  recordList, table, tabs, toastRegion, tree, viewport and stepper.
- state (L5): `Store.set` replaces an object with a list, or a list with an object, instead of merging them. Without
  it an `on` event that went from one action to a list became `{0:…,1:…}` in the live app and the runtime refused it
  (`SUI-RUN-ON-SHAPE`), so a second action never ran in Use mode (latent since L2).
- stateui-app (after L7, d1b8d9e): `MountedApp.writeNode` (`src/dom/mount/mountApp.ts`, `src/core/links/applyLinks.ts`)
  keeps a `<-` link refused for a missing target waiting and applies it once a write makes the target or a branch
  above it, a load that replaces the whole `$.data` included. The original `SUI-LINK-MISSING` still reaches the host.
  Replacing or removing the node, or disposing the app, drops the waiting link. Before it, a list given `<-items`
  right after the Screens view mounted the live app stayed empty until the next load, and the by-hand Statenet e2e
  step failed now and then on the live app's rows. Tests: `src/dom/mount/mountApp.browser.test.ts` ("should apply a
  link refused for a missing target once the target is written", "… once the whole data branch that holds it is
  replaced", "should not apply a waiting link of a node removed before its target appears").
- magnetic `src/http/shell.ts`: the page's revision on the shell object; a way for the inspector to open a view.
- magnetic `src/http/inspect.ts`: `select` fetches `/scope` beside `/node`; `fieldsOf` draws the sections in the new
  order, the Link buttons, linked lines, the chooser, the name line, Undo, and skips runtime properties; new
  `dataSection`, `eventSections`, `saveForm`; `onRaised` accepts `press`; new `saveLink`, `removeLink`,
  `saveActions`, `saveRecordRules`, `saveName`, `undoLast`; `writeNodes` sends the shell's revision, takes the
  inverse operations and handles 409; `crumbsOf` skips `columns` and column keys and words slot steps. The `<->`
  lookup goes. A redraw happens when a choice changes what is drawn, never while a text is being typed.
- magnetic `src/inspector/editInfo.ts`: `WRITE_PATH`, `scopeOf`; `StateBinding.twoWay` and the `<->` branch go.
- magnetic `src/inspector/viewInfo.ts`: the `<->` branch goes. `screenInfoOf` is given the shapes and counts a link
  as a read always, and as a write too when the linked property is neither content nor runtime (the component may
  write it), so a linked `textField` shows as a writer in the Screens view's state layer and the State tab's
  "Written by".
- magnetic `src/server/startMagnetic.ts`: the `/scope` case and the `/node` additions in `inspectRoute`.
  `src/server/viewRoutes.ts`: `units` in `changeLogic`.
- magnetic `src/http/views.ts`: the unit card's "Runs when {part} is pressed"; opening the Logic view at a unit; the
  Screens view's logic layer (`drawTile`) badges a part a `pressed` rule names, as it does a part with handlers;
  writes read the shell's revision.
- magnetic `src/http/text.ts`: the keys below and the words table, in `EN`, `DE`, `FR`, `ES`.
- magnetic `src/editor/EditorApp.ts`: no change.
- CHANGELOG entries in both repos.
- Docs: `<->` and "one way or two way" leave `magnetic-editor-by-hand.md`, `magnetic-show-views.md` and the spec's
  comments; the by-hand table and Gaps follow each stage; the Locale gap comment says the label translated must be an
  unlinked one.

### Texts (`src/http/text.ts`)
`inspect.linked` is replaced by `inspect.linkedTo`. Existing keys `inspect.value` and `inspect.writtenBy` keep their
meaning; the new keys do not reuse them. The translations are a draft for the owner to read.

| Key | EN | DE | FR | ES |
|---|---|---|---|---|
| inspect.undo | Undo: {what} | Rückgängig: {what} | Annuler : {what} | Deshacer: {what} |
| inspect.named | Named {name} | Heißt {name} | Nommé {name} | Se llama {name} |
| inspect.namedBy | used in {count} places | an {count} Stellen verwendet | utilisé à {count} endroits | usado en {count} lugares |
| inspect.rename | Rename | Umbenennen | Renommer | Renombrar |
| inspect.nameSave | Save | Speichern | Enregistrer | Guardar |
| inspect.nameShape | A name has letters, digits, - and _ and no spaces | Ein Name hat Buchstaben, Ziffern, - und _ und keine Leerzeichen | Un nom contient des lettres, des chiffres, - et _, sans espace | Un nombre tiene letras, cifras, - y _ y ningún espacio |
| inspect.nameTaken | Another part is already named {name} | Ein anderes Teil heißt schon {name} | Un autre élément s'appelle déjà {name} | Otra parte ya se llama {name} |
| inspect.nameFixed | A rule names this part | Eine Regel nennt dieses Teil | Une règle nomme cet élément | Una regla nombra esta parte |
| inspect.link | Link {label} to state | {label} mit dem Zustand verknüpfen | Lier {label} à l'état | Vincular {label} al estado |
| inspect.linkedTo | {label}: {target} | {label}: {target} | {label} : {target} | {label}: {target} |
| inspect.linkChange | Change | Ändern | Changer | Cambiar |
| inspect.unlink | Unlink | Verknüpfung lösen | Délier | Desvincular |
| inspect.notLinked | Not linked | Nicht verknüpft | Non lié | Sin vincular |
| inspect.linkFrom | From | Aus | Depuis | Desde |
| inspect.linkField | Field | Feld | Champ | Campo |
| inspect.fromRow | This row | Diese Zeile | Cette ligne | Esta fila |
| inspect.fromSelected | Selected in {part} | Ausgewählt in {part} | Sélectionné dans {part} | Seleccionado en {part} |
| inspect.emptyUntilChosen | Empty until a row is chosen | Leer, bis eine Zeile gewählt ist | Vide tant qu'aucune ligne n'est choisie | Vacío hasta elegir una fila |
| inspect.fromParts | Parts of this screen | Teile dieses Bildschirms | Éléments de cet écran | Partes de esta pantalla |
| inspect.fromSync | The connection | Die Verbindung | La connexion | La conexión |
| inspect.syncStatus | Whether the app is connected | Ob die App verbunden ist | Si l'app est connectée | Si la app está conectada |
| inspect.syncMode | How the app syncs | Wie die App synchronisiert | Comment l'app se synchronise | Cómo sincroniza la app |
| inspect.syncWaiting | Changes waiting to be sent | Änderungen, die auf das Senden warten | Modifications en attente d'envoi | Cambios pendientes de enviar |
| inspect.allRecords | All records | Alle Datensätze | Tous les enregistrements | Todos los registros |
| inspect.notTranslated | A linked text is not translated | Ein verknüpfter Text wird nicht übersetzt | Un texte lié n'est pas traduit | Un texto vinculado no se traduce |
| inspect.noData | This app has no data yet. Make a dataset in Statenet. | Diese App hat noch keine Daten. Lege in Statenet einen Datenbestand an. | Cette app n'a pas encore de données. Créez un jeu de données dans Statenet. | Esta app aún no tiene datos. Crea un conjunto de datos en Statenet. |
| inspect.openStatenet | Open Statenet | Statenet öffnen | Ouvrir Statenet | Abrir Statenet |
| inspect.noList | Place a list to link to the row chosen in it | Platziere eine Liste, um mit der darin gewählten Zeile zu verknüpfen | Placez une liste pour lier à la ligne qui y est choisie | Coloca una lista para vincular con la fila elegida en ella |
| inspect.data | Data | Daten | Données | Datos |
| inspect.shows | Shows | Zeigt | Affiche | Muestra |
| inspect.rowShows | Each row shows | Jede Zeile zeigt | Chaque ligne affiche | Cada fila muestra |
| inspect.rowParts | A row made of parts | Eine Zeile aus Teilen | Une ligne faite d'éléments | Una fila hecha de partes |
| inspect.rowEdit | Edit the row | Zeile bearbeiten | Modifier la ligne | Editar la fila |
| inspect.rowMisfit | This row shows fields {dataset} does not have | Diese Zeile zeigt Felder, die {dataset} nicht hat | Cette ligne affiche des champs que {dataset} n'a pas | Esta fila muestra campos que {dataset} no tiene |
| inspect.columnMisfit | {dataset} has no field {field} | {dataset} hat kein Feld {field} | {dataset} n'a pas de champ {field} | {dataset} no tiene el campo {field} |
| inspect.columnTitle | Title of {field} | Titel von {field} | Titre de {field} | Título de {field} |
| inspect.slotRow / slotEmpty / slotCell | Row / Empty / Cell of {column} | Zeile / Leer / Zelle von {column} | Ligne / Vide / Cellule de {column} | Fila / Vacío / Celda de {column} |
| inspect.whenPressed | When pressed | Beim Drücken | À l'appui | Al pulsar |
| inspect.whenEvent | When {event} | Wenn {event} | Quand {event} | Cuando {event} |
| inspect.evAdd | Add something that happens when… | Etwas hinzufügen, das passiert, wenn… | Ajouter ce qui se passe quand… | Añadir algo que ocurre cuando… |
| inspect.actAdd | Add… | Hinzufügen… | Ajouter… | Añadir… |
| inspect.actNavigate | Go to a screen | Zu einem Bildschirm gehen | Aller à un écran | Ir a una pantalla |
| inspect.actSet | Set a value | Einen Wert setzen | Définir une valeur | Fijar un valor |
| inspect.actToggle | Switch a value on or off | Einen Wert ein- oder ausschalten | Activer ou désactiver une valeur | Activar o desactivar un valor |
| inspect.actShowHide | Show or hide a part | Ein Teil zeigen oder verbergen | Afficher ou masquer un élément | Mostrar u ocultar una parte |
| inspect.actTell | Tell a part to… | Einem Teil sagen… | Dire à un élément de… | Decir a una parte que… |
| inspect.actUndo | Undo | Rückgängig | Annuler | Deshacer |
| inspect.actRedo | Redo | Wiederholen | Rétablir | Rehacer |
| inspect.actSave | Save a record | Einen Datensatz speichern | Enregistrer une fiche | Guardar un registro |
| inspect.actOther | Does: {commands} | Macht: {commands} | Fait : {commands} | Hace: {commands} |
| inspect.actRuns | Runs {unit} | Führt {unit} aus | Lance {unit} | Ejecuta {unit} |
| inspect.openLogic | Open in Logic | In Logik öffnen | Ouvrir dans Logique | Abrir en Lógica |
| inspect.beforeSave | Runs at once, before the save | Läuft sofort, vor dem Speichern | S'exécute tout de suite, avant l'enregistrement | Se ejecuta enseguida, antes de guardar |
| inspect.actUp | Move up | Nach oben | Monter | Subir |
| inspect.actRemove | Remove | Entfernen | Retirer | Quitar |
| inspect.where | Where | Wo | Où | Dónde |
| inspect.setTo | Set to | Setzen auf | Mettre à | Poner en |
| inspect.part | Part | Teil | Élément | Parte |
| inspect.thisPart | This part | Dieses Teil | Cet élément | Esta parte |
| inspect.around | The {component} around it | {component} darum | Le {component} autour | El {component} que la rodea |
| inspect.what | What | Was | Quoi | Qué |
| inspect.saveInto | Into | In | Dans | En |
| inspect.saveFrom | {field} from | {field} aus | {field} depuis | {field} desde |
| inspect.saveRequired | {field} from (a source is needed) | {field} aus (eine Quelle ist nötig) | {field} depuis (une source est requise) | {field} desde (se necesita una fuente) |
| inspect.saveForm | The form's fields | Die Felder des Formulars | Les champs du formulaire | Los campos del formulario |
| inspect.saveClear | Then clear the fields | Danach die Felder leeren | Puis vider les champs | Después vaciar los campos |
| inspect.saveThen | Then go to | Danach gehen zu | Puis aller à | Después ir a |
| inspect.stayHere | Stay here | Hier bleiben | Rester ici | Quedarse aquí |
| inspect.saveNames | Name of {part} | Name von {part} | Nom de {part} | Nombre de {part} |
| inspect.saveApply | Save this | Dies speichern | Enregistrer ceci | Guardar esto |
| inspect.saveInto.sentence | Save a record into {dataset} | Einen Datensatz in {dataset} speichern | Enregistrer une fiche dans {dataset} | Guardar un registro en {dataset} |
| inspect.rulesRemove | Delete the rules {units}? | Die Regeln {units} löschen? | Supprimer les règles {units} ? | ¿Eliminar las reglas {units}? |
| inspect.refused.link | What this links to is no longer there | Das Ziel dieser Verknüpfung gibt es nicht mehr | La cible de ce lien n'existe plus | Aquello a lo que se vincula ya no existe |
| inspect.refused.screen | That screen is no longer there | Diesen Bildschirm gibt es nicht mehr | Cet écran n'existe plus | Esa pantalla ya no existe |
| inspect.refused.onLinked | A change of this part cannot set what the part itself is linked to | Eine Änderung dieses Teils kann nicht setzen, womit es selbst verknüpft ist | Un changement de cet élément ne peut pas écrire ce à quoi il est lié | Un cambio de esta parte no puede fijar aquello a lo que está vinculada |
| inspect.refused.rule | A part this rule names is no longer there or shares its name | Ein Teil, das diese Regel nennt, fehlt oder teilt seinen Namen | Un élément nommé par cette règle n'existe plus ou partage son nom | Una parte que nombra esta regla ya no existe o comparte su nombre |
| views.runsWhenPressed | Runs when {part} is pressed | Läuft, wenn {part} gedrückt wird | S'exécute à l'appui sur {part} | Se ejecuta al pulsar {part} |

Keys the build added beyond the table, in the four languages: `inspect.nothingFits` (L3); `inspect.showsNothing`,
`inspect.column`, `inspect.moreColumns` (L4); `inspect.saveNoNumber`, `inspect.saveNoKind`, `inspect.saveNoKindNeeded`,
`inspect.saveStale`, `inspect.saveNothing` (L6); `inspect.computed` ("Shows a computed value"), `inspect.countOf`
("Count of {dataset}"), `inspect.sumOf` ("Sum of {field} in {dataset}"), `inspect.smallestOf`, `inspect.largestOf`,
`inspect.expression`, `inspect.expressionField`, `inspect.expressionOf`, `inspect.expressionHint`,
`inspect.computedApply` ("Show this"), `inspect.expressionReads`, `inspect.expressionBraces`,
`inspect.expressionBrackets`, `inspect.expressionFunction`, `inspect.expressionData`, `inspect.expressionInvalid`,
`inspect.setByRule` and `inspect.ruleRemove` ("Delete the rule {unit}?") (L7).

### Tests
stateui-app (pin the library behaviour the generated JSON relies on, before the stage that needs it):
- `src/core/logic/` (L0): `readLogic` accepts `when: { path: '#addBook.pressed' }` when the name resolves and
  answers `SUI-LOGIC-PATH` when it does not or names two nodes; in `createLogicEngine` with the real button shape a
  press runs the rule, on the screen shown and on another.
- `src/core/logic/` (L6): `save-data` with `value: { title: '#title.value' }` reads the node's value; a rule with
  `when: { result, is: 'accepted' }` runs after a rule's `save-data` with `as`, sets the field to `""` and navigates;
  the save waits with `await: 'applied'`; `{ form: '#entry' }` saves a record keyed by the child keys; one press with a `navigate` in `on` and a
  save rule still saves the typed value.
- `src/core/logic/` (L7): a `set` of `#count._text` with `{{ string(size(…)) }}` writes a string, at start and when a
  record is added.
- `src/core/links/` or stateui-components' list browser test (L3): a `textField` linked `<-value` to
  `#list.current.title` is empty and drops typing with `selectable: none` or no row chosen, and fills and writes the
  record in `single` with a row chosen.

stateui-mcp:
- `src/infrastructure/sync/AppLogic.test.ts` (L6): a client change of `$.screens.<s>…button.pressed`, transient by
  the button's shape, runs a server rule triggered by `#name.pressed` that saves and then clears
  `…textField.value`, and the clear is pushed to the view; the same with a `navigate` in the result rule. The file
  already covers node state of a view reaching the authority (`…name.value`, `…saved`), a machine saving and
  resetting fields, and a server rule reading a screen node's value.

magnetic unit:
- `src/inspector/editInfo.test.ts` (new): `treeOf` accepts `….<-value` and `….@id`, refuses `<-` alone and either
  mid-path; `scopeOf` gives the fields of an empty dataset from `parts.models`, a model binding's fields, `owned`,
  `row` under `.row` and `.columns.<key>.cell`, `own`, `links`, `name`, `unitNames`, `takenNames`, `suggested` names (from a label, from
  the dataset, the key when `namedBy` is not empty, a number when taken), `namedBy` entries, a generated save read
  back, and nothing under `$.server`; `bindingsOf` without `twoWay`.
- `src/server/inspectRoutes.test.ts`: `/node` with `id`, commands and `slots`; `/scope`; `/nodes` sets and removes a
  link key and an `@id`, refuses a second equal id in the same screen (`SUI-NODE-ID-TWICE`), a link to `$.server`
  and to a missing record; 409 for an old revision; a screen added through `/screens` followed by a property change
  with the revision that answer gave is not a 409; the `/state` assertion loses `twoWay`.
- `src/server/viewRoutes.test.ts`: `units` writes two rules as one revision step and removes them; five are refused.
- A catalog sweep (magnetic, over stateui-components' catalog): for every component and every drawn property, each
  target the chooser offers validates with no error and no warning; for every event, each sentence with each offered
  target validates.
- `src/editor/EditorApp.test.ts`: the contract ids are unchanged.
- `src/inspector/viewInfo.test.ts`: the `<->` fixture goes; a linked `textField` value counts as read and written, a
  linked `_text` as read only.

e2e (`e2e/build-by-hand.spec.ts`), fixmes made real, and the edits to tests of the same serial file that pass today:
- L2, "Screens: a button leads to another screen when pressed": Go to a screen › About; pressed in Use mode it shows
  About; the step goes back to Home through the Screens panel, removes the action, and the press stays on Home; Undo
  brings the action back and it is removed again. The Theme test that follows finds Home.
- L2, test 2 ("a second screen is added…"): `type('Screen', 'home')` and `type('Screen', 'about')` become
  `choice('Screen').selectOption(…)`, because the link's Screen is now a choice.
- L4, "Statenet: the list's items and the field's value are linked…": Shows › the dataset, Each row shows › title;
  the list shows the dataset's records. A second field, labelled "Selected title" (the last test's Title textbox
  locator is strict), is placed and linked to Selected in the list › title; the linked line says "Empty until a row
  is chosen" and the field is empty; a row press fills it; typing changes the row and is typed back; Unlink makes it
  plain; the field is deleted.
- L4, the last test ("the app runs as it was built"): it asserts the rows the dataset holds by then ("Dune Messiah",
  "Emma", "Middlemarch", and "Persuasion" from L6 on) instead of "No books yet".
- L6, "Logic: pressing Add book saves the title typed…": Save a record; the Logic view shows both rules; on the run
  page `/apps/<id>` typing "Persuasion" and pressing Add book adds the row and empties the field; the sentence
  reopens the form with its choices.
- "Locale: …" stays `test.fixme`.

e2e, phone (`e2e/inspector.spec.ts`, the `phone` project, on an app made through the tools): a button is selected
and "When pressed" is visible in the sheet without scrolling; Go to a screen is added and works in Use mode; a text
is linked to a part of the screen and Unlinked.

## Stages
Each stage ships alone, ends in something a person can do, and updates the CHANGELOGs, this doc's As built and the
by-hand doc's table and Gaps.

| Stage | Delivers | Depends on | Turns on |
|---|---|---|---|
| L0 | stateui-app: a rule or transition trigger path may be `#name.property` | none | nothing in the editor; the agent may write such rules |
| L1 | `WRITE_PATH`; `/node` additions; `/scope` with `screens`, `parts`, `parent`, `takenNames`, `namedBy`; the page's one revision and a worded 409; `onRaised` hears `press`; Undo; runtime properties hidden; `<->` removed everywhere and links counted as writes in `screenInfoOf`; the name line with Rename | none | nothing yet; a named part can be renamed by hand |
| L2 | "When …" sections with Go to a screen, Undo, Redo, Move up, Remove, read-only lines, the section order and the event words; the `link`'s Screen as a choice; the phone test for actions | L1 | the Screens fixme (with the edit to test 2) |
| L3 | Link button, chooser, linked line, Unlink for scalar and content properties, the `selectable` write, the empty lines; `/scope` `datasets`, `row`, `own`, `links`, `name`, part `records`, `inRow` and `links`; the catalog sweep for links; the phone test for links | L1 | half of the Statenet fixme (the field) |
| L4 | Data section: list (dataset, one-text row, Edit the row, misfit lines), table (dataset, columns); slot selection and `crumbsOf` | L3 | the Statenet fixme (with the edit to the last test) |
| L5 | Set a value, Switch, Show or hide, Tell a part to… with the command words; the catalog sweep for actions | L2, L3 | none (completes `on`) |
| L6 | Save a record: the form with names, number sources and Then go to; `units` in `POST views/logic`; read-back, edit and unit lines through `/scope` `units`; the Logic view's wording and badge | L0, L2, L4 | the Logic fixme |
| L7 | "Shows a computed value" on a text: Count, Sum, Smallest, Largest, An expression | L3, L6 | replaces the spec's State tab workaround for the count; the last case is then by hand |

L0, L3 and L6 start with the library tests listed above. If one fails, the stage's fallback is named under Risks.

## Not built
- A one-way link or any new link prefix. `{{ }}` in a node's property. A new command or error code.
- A form for rules and machines in general: conditions (`is`, `was`, `if`, `debounce`), machines, tables, computes
  and effects stay JSON in the Logic view (`unitEditor`).
- Typing or editing `from`, route params, `$row` values and `request.*` commands by hand; they show read-only.
- Building a row or a cell of several parts from the library, column order by dragging, column formats, editing,
  filters and totals. The row template is reachable with Edit the row and its parts are edited once the agent made
  them.
- A link to one fixed record of a dataset, to a path that does not exist yet, to `$.runtime.requests`, and choosing
  a dataset binding's name.
- A link to the selected row of a `multi` list.
- Renaming a part that a logic unit or the other tree names. It needs a write of a node and a logic unit in one
  checked step, which no tool has.
- Undo of more than the last setting write, of logic writes, and across a reload.
- An average as a computed value (the function library has `sum`, `min`, `max`, `count`, `size`); it is typed as an
  expression.
- A tree picker, a "link to this" button in the State tab, any use of the side panel or of Statenet's cards as a
  picker, any static node or new hearing name in the editor page.
- `$peers` targets and the `$.app` events (`sync.rejected`, `notify.<name>`).
- Placing parts on a phone. The Locale fixme.

## Decisions
None of these is the owner's yet, except where cited; they are judgement calls of this design.

- **One link control.** The library has one link and it is two way; `<->` leaves Magnetic (no backwards
  compatibility).
- **A press that saves is a rule on the button's state, not an `on` entry.** It follows "No events, remember that
  since we have server side logic we can't tie things to browser events. The state and statenet provide the events
  through state changes." (owner, 2026-11-25) and components named by id as `#name` (owner, 2026-11-25).
- **The trigger is `#name.pressed`, which stateui-app learns (L0), not the absolute path.** The absolute path
  `$.screens.home.children.button.pressed` works today, but it breaks when the part is moved into another parent,
  the editor would have to rewrite rules on every move, and it is the one place logic could not name a part by
  `#name`. The library change is small and follows what tables' inputs already do.
- **The controls are dynamic nodes of the fields panel.** The editor's page contract does not change, so nobody's
  copy of the editor is reset, and the controls are StateUI nodes as the owner asked of the editor (2026-11-19).
- **The chooser is two choices, not a tree.** A `selectField` written into the panel is proven; a `tree` with
  literal items written at run time is not. Leaving fixed records out keeps both lists short: groups, then a model's
  fields.
- **Names come from the label and are unique across the app; the key is kept when something names the part by it.**
  An `@id` that differs from the key breaks references by key (`nodeId`), so it is written only when there are none.
- **A name is not asked for in advance.** An empty Name field above the label invites the caption to be typed there.
- **The clear and the "go to" after a save wait for the accepted result.** Two rules, written as one logic write.
- **`treeOf` is widened instead of adding a link route.** A name, a link, `selectable` and a default row land in one
  checked write and one revision step.
- **The linked field in the example is the selected record's.** The editor is a test run with scratch copies of
  shared data (owner, 2026-11-24), so a record key seen there is a poor thing to write into a definition; a fixed
  record is not offered at all. Linking to the selected row makes the list select one row.
- **Removals are covered by Undo or by a confirm.** "Nothing is removed without a confirm that names it"
  (`magnetic-show-views.md`) holds for rules. A setting gets Undo instead, because a confirm on every Unlink and
  every action removed makes the common path slow, and the agent's undo is not there by hand.
- **One revision for the page, held by the shell.** The inspector, the Screens panel and the views write the same
  app; each must see the others' answers.
- **A computed value is a rule that sets the part's own property**, in line with "A component's state stays one
  branch" and "Data state should have appropriate namespaces" (owner, 2026-11-25 and 2026-11-26): a count shown by
  one text is that text's state, not app data.
- **`$.runtime.requests` is left out of the chooser** instead of fixing `record()` in stateui-app; no by-hand case
  needs it.

## Open decisions for the owner
1. **The trigger of a press rule.** (a) `#name.pressed`, with stage L0 in stateui-app; (b) the absolute path, no
   library change, the editor rewrites triggers when a part moves and `/scope` matches units by resolved path.
   Recommendation: (a).
2. **One way and two way.** The gap text asked for both. Recommendation: drop the distinction; a read-only link would
   be a stateui-app feature (a prefix, validator rules, codes, README) designed on its own if a component needs it.
3. **Text reading `{{ }}`.** (a) stage L7 as designed: choices that write a rule; (b) a library change so a content
   property holds a template. Recommendation: (a), as a firm stage. (b) is a stateui-app design first.
4. **Undo or confirms.** (a) a one-step Undo for setting writes, confirms for rules; (b) a confirm on every removal
   and no Undo. Recommendation: (a).
5. **Generated names.** (a) from the label, changeable in the Save form before writing, Rename only while all
   references are in the part's tree; (b) add an atomic rename to stateui-mcp (a node and logic in one checked
   write; the tool list is pinned). Recommendation: (a) now, (b) when people ask for it.
6. **Fixed-record links.** Left out. Recommendation: keep them out until a case needs one; then a third chooser step
   with a search, for the person's own datasets only.
7. **Where a saved record's rules run.** Recommendation: leave `runs` out (the server in Full mode), since a save
   into a shared dataset is checked there anyway; the person moves a unit with the Logic view's button.
8. **Gating the clear on the accepted result** costs a second rule the person sees in the Logic view.
   Recommendation: keep it; a field that empties when the save was refused loses the person's typing.
9. **Phone.** Linking and actions are designed and tested at phone size; placing parts stays desktop only.
   Recommendation: as designed.
10. **Static picker later.** If the two-choice chooser proves too long for large apps, a static tree in
    `propertiesTab` over `$.data.inspector` records is the next step; it adds required ids, which is free only while
    Magnetic has no users. Recommendation: not now.
11. **Exporting command tables from stateui-app** (the argument rules of each `on` and logic command as data, read by
    both the validator and the editor). Recommendation: not now; the catalog sweep test holds the editor to the
    validator.
12. **The fourth fixme.** Recommendation: design Locale next, after L6; `SUI-LOCALE-LINKED` (a linked text is not
    translated) is the one rule it inherits from here.

## Risks
Not settled by reading; each is settled by the test or spike named, at the start of the stage that relies on it.

1. **`set` and `remove` of a `<-x` or `@id` key through `ui_nodes_write`** (L1). The tool's path parsing takes any
   segment; that it writes and deletes such a key is not run yet. Fallback for writing: `merge` on the node. There is
   no fallback for removing; a failure here is a stateui-mcp fix.
2. **Resolving a `#name` trigger once at engine start** (L0). In a browser the index looks in the current screen
   first; the trigger must resolve the same on every screen. The editor's names are unique in the app, but the
   agent's may not be. Fallback: the validator refuses a trigger name that is not unique in the whole app.
3. **A transient `pressed` change reaching the authority, and a server `set` or `navigate` reaching the page** (L6).
   Settled: stateui-mcp `AppLogic.test.ts` runs a server rule on `#name.pressed` that saves, clears the field and
   navigates, and the clear reaches the view. The fallback (`runs: 'browser'`) is not needed.
4. **Null for an empty number source** (L6). Settled by the fallback: an expression cannot name a node, so
   `coalesce(#pages.value, null)` is refused (`SUI-LOGIC-EXPRESSION`). A number source is offered only for a required
   number field, written as `#pages.value`, and an optional number field is left out of the record.
5. **Logic `set` of a content property (`#count._text`)** (L7). Settled: stateui-app `computedText.test.ts` shows the
   set is accepted with no error or warning and runs at start and when a record is added.
6. **`/scope` reads parts through the person's tools.** A shared dataset's model must be readable by the person;
   where it is not, the binding offers "All records" and no fields.
7. **Selecting a row template.** `/node` answers a slot path; the overlay must accept a selection with no rectangle.
   Whether a click in the app can select a row copy stays unanswered and is not needed.
8. **Redraws.** Every choice that changes what is drawn rewrites the fields panel; a redraw must not land while a
   text field has focus, and held choices must survive it.
9. **Save a record is two writes with two tools.** An agent write between them gives a 409 on the second with the
   names already written. It is harmless and visible, and the form keeps its choices.
10. **Moving `commandsText`** so `inspect.ts` and `views.ts` both use it: the two scripts are served separately; it
    may have to be passed through the shell object, as the revision is.
11. **Undo's inverse for a write that touched two nodes** (a link that named a list and set its `selectable`). The
    inverse is one write of one tree; a name written on the app node by a write of its own is not taken back.

## Rules and Constraints
- Agents and people write JSON through the tools only: every change here is `ui_nodes_write` or `ui_logic_write` with
  a revision. No route writes a part's JSON directly. A change to a node is one checked write.
- The link prefix, the reserved keys, the system commands, the logic commands and the error codes are closed lists.
  This feature adds to none of them. Error messages name paths and names, never values.
- No choice the editor offers adds a link or an action the validator refuses or warns about; the catalog sweep test
  enforces it.
- No events: what a press must do on the server is a logic unit on state (`#name.pressed`). `on` holds only what runs
  in the browser.
- Logic, links and `on` targets name parts by `#name`. A name the editor writes is unique across the app, and an
  `@id` that differs from the key is written only when nothing names the part by its key.
- A link to the selected row is written only together with `selectable: "single"` on its list.
- Generated logic values keep the type of what they write: `string()` around a value for a text; a source is offered
  only for a field its value type fits, and an optional number is left out of a saved record rather than saved as
  `""`.
- The editor never replaces a row, a column or a rule it did not make.
- Data stays in `$.data` and enters a node only through a link. A value shown by one part and derived by logic is that
  part's own state. `$.server` never reaches a choice list, an answer or a log. No state value is logged.
- The editor page is driven only through `$.data` and the reports of nodes with an `@id`; `inspect.ts` stays code;
  no URL, script, `on*` attribute or `innerHTML` in a page. The dynamic ids of the fields panel are not part of the
  page contract.
- Keys the editor generates (column keys, names) start with a letter and are never integer-like.
- Nothing is removed without a confirm that names it, except a setting the inspector's Undo brings back (a link, an
  action, a name, a column). Logic units are always confirmed.
- Every write of the page sends the one revision the shell holds.
- No engine identifier is shown raw: events, commands and datasets are shown in words, a refusal this feature can
  raise in the person's words.
- Every control works in the 320px panel and in the phone sheet: one field per row, labelled buttons.
- Every text exists in English, German, French and Spanish; server answers hold data, never words.
- No backwards compatibility: `<->` is removed, not kept beside `<-`.
- Each stage carries CHANGELOG entries with the covering test, and the docs describe the code as it then is.

## As built
L0 to L7 are built.

**L0, a trigger on a node's state by its name** (stateui-app `src/core/logic/read.ts`, `engine.ts`, `modules.ts`). A
rule's, a guard's and a machine transition's `when.path` may be `#name.property`. The validator refuses one with
`*`, a capture or a template, one that finds no node or several, and one on a property the node links (it names the
link's target to use), all as `SUI-LOGIC-PATH`; a logic module with one is `SUI-MODULE-NODE`. The engine keeps the
reference and resolves it through its host as a command's reference is (the screen shown, the app node, the other
screens), again whenever `$.route.screen` changes; a changed document gets a new engine. A reference that finds no
node or several listens to nothing and is reported once through `LogicHost.failed`. A rule with such a trigger never
runs in the start pass, so a press rule runs on a press only. Tests: `src/core/logic/triggerReference.test.ts`,
`src/dom/mount/screens.browser.test.ts`.

It differs from the design above in these ways:
- The engine resolves on every screen change, not once at start: the hosts expose only the resolve of the screen
  shown. A name one node of the app has resolves the same on every screen, which is what the editor writes.
- A name held once in the app node and once on a screen validates and means the screen's node while that screen
  shows (Risk 2's fallback is not built).
- A rule at the absolute path of a node's transient state with only `set`, `merge`, `copy` or `query` commands still
  runs in the start pass.

**L1, the groundwork** (magnetic `src/inspector/editInfo.ts`, `src/inspector/viewInfo.ts`, `src/http/inspect.ts`,
`src/http/shell.ts`, `src/server/startMagnetic.ts`, `src/server/viewRoutes.ts`).
- `WRITE_PATH`: a node write may end in `<-<name>` or `@id`. `POST /nodes` takes 50 operations
  (`MAX_NODE_OPERATIONS`), refuses `__proto__` anywhere, and refuses a name another node of the app has
  (`nameClashes`, `SUI-NODE-ID-TWICE`).
- `GET /edit/<id>/scope` (`scopeOf`): `revision`, `screens`, `parts`, `parent`, `takenNames`, `namedBy`. A `namedBy`
  entry also carries `node`, `value` and, for an `on` entry, `at` (the exact places that name the part).
  `takenNames` leaves out the selected node's own key and `@id`. `/node` adds `id`, `slots`, `component.commands`
  and `component.commandValues`.
- One revision for the page, as described above.
- The inspector hears `press`, does not draw runtime properties, and shows the name line ("Named x, used in N
  places") with Rename. Rename rewrites the `@id` and the places of the part's own tree that name it in one write; a
  text that only mentions `#name` is left alone; it is disabled while a logic unit names the part.
- Undo is one step and covered name writes (L2 adds action writes); any other write of the page drops it.
- `<->` is gone from Magnetic. `screenInfoOf` and `bindingsOf` take the shapes and count a link as a write when the
  property is neither content nor runtime.
- Texts: the keys of this stage plus `inspect.nameInUse` and `inspect.nameTooMany`, in four languages.

Tests: `src/inspector/editInfo.test.ts`, `src/inspector/viewInfo.test.ts`, `src/server/inspectRoutes.test.ts`,
`src/server/viewRoutes.test.ts`, `e2e/inspector.spec.ts`.

Known limits of L1:
- Copying a screen copies its `@id`s; the name check is on `POST /nodes` only.
- When the page reads a later revision, the inspector redraws the selected part; text being typed in a property
  field at that moment is lost (Risk 8).
- A logic place on the name line is text, not a link to the Logic view (L6).
- The Rename walker of the page script is covered by e2e only.

**L2, what a press does** (magnetic `src/http/pressActions.ts`, `src/http/inspect.ts`, `src/http/text.ts`,
`src/inspector/editInfo.ts`, `src/http/screens.ts`; stateui-mcp `src/application/use-cases/DeletePart.ts`).
- The Properties tab reads, in order: Undo, the "When …" sections, Layout, Place in its parent, the properties, "Add
  something that happens when…", the name line. A part with a `press` event shows "When pressed" first; another event
  gets a section when chosen from the Add list. Event words are `inspect.event.<name>` (change, input, select,
  activate, submit, invalid); `changed` and `submitted` use the words of `change` and `submit` unless the component
  has both, and an event with no words is named through `labelFor`.
- Actions: Go to a screen, Undo and Redo. Go to a screen is one choice ("Go to {screen}") whose accessible name says
  which action of which event it is; nothing is written until a screen is chosen. Undo and Redo are a line with no
  field. Each action has Remove, and Move up from the second on, as icon buttons named for their action. An action
  the sentences do not cover is one read-only line in the Logic view's wording ("Does: …"); it moves and is removed
  but is never rewritten. Removing the last action removes the event's key, and the last event removes `on`.
- The shared functions `commandsText`, `actionsOf`, `actionKind`, `actionWrites` and `screenFits` are in
  `pressActions.ts`; both page scripts include their text.
- `/scope` screens carry `params` and `needs` (required params with no default). Go to a screen offers only screens
  that need none; a link's Screen offers only screens its params fit (not checked when params is an expression). The
  `link`'s Screen is a choice with "Not set" first; a refused choice is drawn again from what the part holds.
- Action changes made while a write is in progress wait in a queue and run on the part as read again.
- One-step Undo covers actions added, changed, moved and removed.
- Refusals in words: `SUI-ROUTE-SCREEN` and `SUI-ROUTE-PARAMS` caused by the write's own operations are said as the
  screen being gone or needing values; one caused elsewhere names its path ("Another part of the app goes to a screen
  that is not there: {path}").
- Deleting a screen that a press or a link still goes to is refused with the paths (stateui-mcp `DeletePart` checks
  the app without the screen with `checkPartApp`; only `SUI-ROUTE-SCREEN` blocks, so earlier errors do not).
- A click on a button or link of the live app that leaves the screen no longer reaches the screen card behind it.
- The by-hand spec's "a button leads to another screen" step is on; e2e presses wait for the live app to have
  rendered the action (`stateuiHost.snapshot()` and the body's `data-revision`), not on a fixed time.

It differs from the design above in these ways:
- Go to a screen is one choice, not a sentence with a separate Screen field.
- Undo's labels name the action ("Undo: Go to a screen", "Undo: Move up", "Undo: Remove"), not its target in words.
- The command words of "Tell a part to…" (submit, reset, validate, clear, focus, open, close) come with L5.
- A link whose screen no longer exists keeps it listed by its raw name until another is chosen; "Not set" writes an
  empty string.

Tests: `src/http/pressActions.test.ts`, `src/inspector/editInfo.test.ts`, `src/server/inspectRoutes.test.ts`,
`e2e/inspector.spec.ts` (desktop and phone, section order, Redo, event words, refusals), `e2e/address.spec.ts`,
`e2e/build-by-hand.spec.ts`; stateui-mcp `test/partTools.test.ts`.

Known limits of L2:
- The case-4 sequence (merge then set) is checked through `/node` settings, not the exact operations sent.
- Route params of a screen cannot be set from the editor, so a screen that needs them is not offered.

**L3, links to state** (magnetic `src/http/linkChoices.ts`, `src/http/inspect.ts`, `src/http/text.ts`,
`src/inspector/editInfo.ts`, `src/server/startMagnetic.ts`; stateui-app `src/core/validate/tree.ts`,
`src/core/index.ts`; stateui-mcp `src/domain/overlayCarry.ts`, `src/application/use-cases/WriteNodes.ts`).
- The Link button, the chooser, the linked line with Change and Unlink, the empty and not-translated lines, the
  `selectable` and `@id` writes, and the no-data and nothing-fits lines, as described in "Link to state". The choice
  and write logic is `linkChoices.ts`, shared with the page script as `LINK_CHOICES_JS`.
- `/scope` adds `datasets`, `row`, `own`, `links`, `name`, and per part `records`, `selectable`, `inRow` and `links`.
  `scopeOf` takes the app's parts, read through the person's parts with `scopePartsOf`.
- stateui-app exports `ownState` from `/core` and reports `SUI-LINK-CYCLE` for a loop of links between stored
  properties (`checkCycles`). stateui-mcp drops the translations of a property a node write links.
- A refused `SUI-LINK-MISSING` is said in words. The Unlink icon is `x` (`unlink` is not in the icon set). The "not
  linked" line keys its text as `field`, as a linked line does, so a redraw keeps the button after the text.
- A click on what a component draws itself (a list's record view) selects the innermost part the document holds:
  pointerup tries the clicked chain innermost first until `/node` answers, with one `/scope` read per click.

It differs from the design above in these ways:
- `/scope` has `links` (each linked property and what it reads) and `name` in place of `linked`; every part also
  carries `links`, so a loop is not offered.
- Unlink fills what `requiredWhen` requires and is not offered when there is no value to write back.
- The "not linked" lines for properties of any type came with L3, not with L4.
- The chooser does not scroll itself into view; dataset groups have no tooltip; *Parts of this screen* offers parts of
  the app node's tree only when named; *Selected in* lists only lists and tables of the node's tree.

Tests: `src/http/linkChoices.test.ts`, `src/http/linkSweep.test.ts` (every component, placed plainly and in a row,
every drawn property linked to each target offered, validated with `validateDocument` and `libraryFromCatalog`),
`src/inspector/editInfo.test.ts`, `src/server/inspectRoutes.test.ts`, `e2e/inspector.spec.ts` (desktop and phone),
`e2e/build-by-hand.spec.ts`; stateui-app `src/core/validate/validate.test.ts`; stateui-components
`test/composites/list-selection.browser.test.ts` (a field linked to the chosen row is empty and drops typing with
nothing chosen, and fills and writes the record in `single` mode); stateui-mcp `test/nodeTools.test.ts`.

**L4, Data for lists and tables** (magnetic `src/http/dataChoices.ts`, `src/http/crumbs.ts`, `src/http/inspect.ts`,
`src/http/text.ts`, `src/inspector/editInfo.ts`).
- The Data section with Shows, Each row shows, Edit the row, a table's column switches and titles, the misfit lines
  and the fold past twelve, as described in "Data: lists and tables". A list's or table's `items` is no longer drawn
  among its properties.
- `/node` `slots` give `{ component, text, fields }` (`slotsOf`). `crumbsOf` moved to `crumbs.ts` (`CRUMBS_JS`) and
  names slot steps "Row", "Empty" and "Cell of {column}".
- The by-hand Statenet step links through Data › Shows, places a "Selected title" field linked to the chosen row,
  presses a row in Use mode and types into the field; the last test asserts the rows in order.

It differs from the design above in these ways:
- A slot node's Delete is hidden (`own:hidden`), not disabled.
- Turning a column off is undone by writing back the whole previous `columns` map.
- A dataset whose fields are unknown reports no misfit and offers no "Each row shows".
- No control selects a table cell, so the "Cell of {column}" crumb is covered by unit tests only.

Tests: `src/http/dataChoices.test.ts` (with a sweep that writes every row field and column of each list and table in
the catalog and validates with no error or warning), `src/http/crumbs.test.ts`, `src/inspector/editInfo.test.ts`,
`src/server/inspectRoutes.test.ts`, `e2e/inspector.spec.ts` (an app without data, a seeded data app: columns switched,
titled and turned off and back in place, a row made of parts with Edit the row), `e2e/build-by-hand.spec.ts`.

**L5, the other sentences of When pressed** (magnetic `src/http/pressActions.ts`, `src/http/inspect.ts`,
`src/http/text.ts`, `src/inspector/editInfo.ts`; stateui-app `src/core/shape/types.ts`, `table.ts`,
`src/build/catalog.ts`; stateui-components the eleven `*.state.json` with `commandNeeds`; state `src/Store.ts`).
- Set a value, Switch a value on or off, Show or hide a part and Tell a part to…, as described in "When pressed".
- `/scope` gives each part's closed property `values`, and `commandValues`, `commandNeeds` and `unique` for each part,
  the part around the node and the node.
- `Store.set` in the state library replaces an object with a list and a list with an object.
- The fields panel is emptied before a redraw that would break its order (`orderKept` in `inspect.ts`), because the
  store keeps the old key order when it merges.

It differs from the design above in these ways:
- The change in `state` was not foreseen; it also fixed L2's second action in Use mode.
- Where is one flat choice, not From then Field; `hidden` is left out of Where; field titles are hidden and the
  accessible names are long.
- Parts are targeted by path unless their name is unique; parts of the app node are always targeted by path from a
  screen.
- `commandNeeds` (stateui-app, stateui-components) was added so that commands that need a value or a row are offered
  only with one. tabs' and carousel's `select` are not offered.
- The screen's root panel is offered among the parts to tell (as `#home`) beside "The panel around it".
- A number field's `value` (number or text) is never offered as a number place for Set a value.

Tests: `src/http/pressActions.test.ts`, `src/http/actionSweep.test.ts` (every component with events or commands,
placed plainly and in a row, every action each event offers validated and read back as its own sentence; what the
form leaves out would be refused or warned), `src/inspector/editInfo.test.ts`, `e2e/inspector.spec.ts` (desktop and
phone); stateui-app `src/core/shape/shape.test.ts`, `src/build/catalog.test.ts`; stateui-components
`test/catalog.test.ts`; state `src/Store.test.ts`.

**L6, Save a record** (magnetic `src/http/saveRecord.ts`, `src/http/inspect.ts`, `src/http/text.ts`,
`src/http/views.ts`, `src/http/shell.ts`, `src/inspector/editInfo.ts`, `src/inspector/viewInfo.ts`,
`src/server/viewRoutes.ts`).
- The Save a record form, its two writes (names through `POST /nodes`, then the rules through `POST views/logic`
  `units`), the read-back, the unit lines with Open in Logic and Remove, and the Logic view's "Runs when {part} is
  pressed" with the Screens view's badge, as described in "Save a record".
- `/scope` gives `units`, `unitNames` and `suggested`; `ScopeSave` carries `form` and `result`.
- The by-hand Logic step saves "Persuasion" from the run page and checks that the field empties.

It differs from the design above in these ways:
- Risk 4's fallback is built: number sources are plain `#pages.value`, only for required number fields.
- The save waits with `await: 'applied'`, not for a durable result.
- Rule names are numbered when taken (`unitNames`); a save never replaces another rule.
- Sources are offered only where their type fits; array and object fields are left out; the form is the record only
  when its fields fit even when empty and cover every required field.
- A save that no longer fits the app carries a stale note.
- `Scope.suggested`, `ScreenInfo.pressed` and `magneticShell.openUnit` are new.

Tests: `src/http/saveRecord.test.ts`, `src/inspector/editInfo.test.ts`, `src/inspector/viewInfo.test.ts`,
`src/server/inspectRoutes.test.ts`, `src/server/viewRoutes.test.ts` (`units` writes and removes two rules as one
step, five are refused), `e2e/build-by-hand.spec.ts`, `e2e/inspector.spec.ts` (Save a record at phone size);
stateui-app `src/core/logic/saveRecord.test.ts`; stateui-mcp `src/infrastructure/sync/AppLogic.test.ts`.

**L7, a computed value on a text** (magnetic `src/http/computedValue.ts`, `src/http/inspect.ts`, `src/http/text.ts`,
`src/inspector/editInfo.ts`).
- "Shows a computed value" in a text's Link chooser: Count, Sum, Smallest, Largest and An expression…, the line with
  Change and Remove, and "set by the rule {unit}" for a rule of another shape, as described in case 3.
- `/scope` gives `computed`.
- The by-hand Logic step makes the count and the sum of pages by hand, each following when a book is added; the
  visitor test checks the count.

It differs from the design above in these ways:
- An expression's trigger is the steps its `$.` paths share; the inspector refuses an expression it cannot trigger
  on, unpaired brackets, an unknown function and unbound data, in words under the field.
- Sum, Smallest and Largest name the dataset too; Smallest and Largest of no record show "-".
- The unit is `<name>Text` with the part's name (the by-hand text is `text2`, so its unit is `text2Text`), made free
  when taken.
- The group is offered only for an unlinked string `_text` outside a row template while the app has a dataset;
  Change offers only computed values.
- A computed value is read back only from a rule whose `when` is exactly a `$.` path and whose `do` is only sets of
  `#name.*`.
- The node keeps its literal `_text`, which shows again after Remove.

Tests: `src/http/computedValue.test.ts` (with a sweep: every choice, for every component whose `_text` takes one,
validates with no error or warning), `src/server/inspectRoutes.test.ts`, `e2e/inspector.spec.ts`,
`e2e/build-by-hand.spec.ts`; stateui-app `src/core/logic/computedText.test.ts`.

## Known limits
- Undoing a link puts the literal back but not the translation `ui_nodes_write` dropped when the text was linked: the
  translation is lost after link-then-Undo.
- No control selects a table cell; the "Cell of {column}" crumb is not reached from the editor.
- After a computed value's Remove, the text the rule last wrote stays in the running app's instance and survives a
  reload: `diffInstance` keeps content that differs from the definition, and neither `ui_state_set` nor
  `POST views/state` can reset a content path.
- Unknown functions in an expression are checked only in the inspector's page script, not in `readLogic` or
  `POST views/logic`, so a rule typed in the Logic view is not checked for them. A typo inside a bound dataset's path
  (`$.data.menu.r9`) is not caught; only the binding name is.
- An empty required text field is saved as `""`. Decided, not built: the save is refused and the field shows
  "Required", so an empty value never reaches the record (owner, 2026-11-28: "everything else I'll take your
  recommendation").
- Why a durable save result is lost after the view reconnects in Magnetic is not diagnosed; the editor avoids it with
  `await: 'applied'`. Decided, not built: on reconnect the editor asks the server for the latest revision and shows
  "Saved" or "Not saved" from its answer (owner, 2026-11-28).
- The editor page logs 84 select-controller errors ("Cannot use 'in' operator to search for '_label' in undefined") on
  every load, and one "could not write value" error while a Set a value text is typed; the value is written. Neither
  cause is found.
- `commandNeeds` is metadata: the validator does not refuse a command written without what it needs.
- Two saves can pick a result name another rule already uses as `as`; `unitNames` checks unit names only. A form save's
  stale check does not cover the form's child keys.
- A click still makes one `/node` request per candidate path, each attaching the instance.
- Not covered by e2e: a `_text` linked to a `$.data` field checked in the live app and on `/apps/<id>`; Change on a
  linked property (it is pressed only on a computed value); closed-value Set, a stepper's `complete` and a This row command pressed in the
  app; a dataset whose fields are unknown; Sum, Smallest and Largest against the route's real model fields.
