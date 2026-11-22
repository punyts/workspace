# Component gaps against the major UI libraries

Status: C1 built (2026-11-21). Column resize, pinned columns, inline cell editing, `actionBar`, filters, grouping
and CSV export on the authority are built; C2 to C6 are next.

Asked for on 2026-11-21: "Let's do some deep research on components. Could you look at all the major players like MUI
and see if there are any components we should add." Then: "Write the doc". Then, for all six stages: "Build it all".

## The survey

On 2026-11-21 we compared the stateui-components catalog with the component indexes of 12 libraries, read from each
library's own pages:
- MUI Material with MUI X
- Ant Design v6 with Ant Design X
- Mantine 9
- Chakra UI v3 with Ark UI
- shadcn/ui
- React Aria with Spectrum 2 and `@react-spectrum/ai`
- Fluent UI v9
- IBM Carbon
- Shopify Polaris web components
- Atlassian Design System
- PrimeReact 11
- Web Awesome

Fluent's index page was incomplete. Its data grid, pickers and colour picker are from earlier knowledge and were not
confirmed on the page.

### Where the catalog stands

The catalog has about 110 components in `atoms`, `molecules`, `composites` and `composed`. It covers every component
that 5 or more of the libraries share. That includes combobox, multi-select with tag mode, PIN/OTP, splitter, segmented
control, rating, timeline, stepper, command palette, date range, colour field, file drop, carousel, empty state, stat,
description list, code block and tree.

Some of our components have no counterpart, or one counterpart, among these libraries:
- No library ships a kanban `board`.
- `tree-diagram` is matched only by PrimeReact's OrganizationChart.
- No library ships `viewport`, `scene3d`, `drawing` or `embedded-app`.
- `window` is roughly matched by Mantine's FloatingWindow and Ark's FloatingPanel.
- `paint-field` is roughly matched by Ark's SignaturePad.

The gaps are mostly in depth: the data grid, charts, AI conversation and dates. Few are missing components outright.

### Trends in 2025 and 2026

- **AI conversation kits** are the strongest trend: MUI X Chat, Ant Design X, shadcn's Message, Bubble, Attachment,
  Questionnaire and Trace, `@react-spectrum/ai` and Carbon's AI label. The recurring parts are these:
  - a message bubble
  - a composer with attachments
  - streaming and typing indicators
  - suggested prompts
  - sources and citations
  - a reasoning or steps block
  - an inline confirmation
- **Event schedulers** with day, week, month, agenda and resource views are new in MUI X and Mantine. No library ships
  a Gantt chart.
- **Splitters**, **tours**, **tag inputs**, **OTP inputs** and **bulk-action bars** spread to more libraries.
- **Advanced charts** (Sankey, funnel, heatmap, treemap, candlestick) moved into MUI X Pro and Mantine charts.

## The design

The additions come in six stages, in order of value to Magnetic's apps. Each stage is its own change, with a CHANGELOG
entry, a browser test and a placement in the example document, as the component checklist in `CLAUDE.md` requires.

### C1. Data grid depth (`table`)

Eight libraries have an advanced grid. Our `table` has keyed columns, a fixed header, a virtual body, sortable columns
and row selection. C1 adds the following to `table`, not a second grid component:
- **Column resize**, a width per column that is written on release, and **pinned columns** that stay at the start or
  end while the body scrolls sideways.
- **Inline cell editing**: a column names an editor (text, number, select, date or check), and an edit writes the
  record path through the same validation as a form field.
- **Filters**: a quick filter over all columns and a filter per column, kept as state so that a data provider can
  serve them.
- **Grouping** by a field, with totals per group.
- **CSV export**, built on the authority (owner, 2026-11-21) from the grid's current filters, sort and visible columns,
  so that rows not loaded into the browser are included and no rows are sent to the browser to be exported. The grid
  sends the authority a request with these settings, not the rows. The authority runs it as a data query under the
  requesting persona's access, so the file never holds a row that the persona could not read. The result is a file the
  user saves. The export logs the dataset name and the row count, never a
  value.
- **`actionBar`**, a new molecule that appears while records are selected. It shows the count, the bulk actions and a
  way to clear the selection. Mantine, Chakra and Spectrum 2 each ship one. It also serves `list`, `board` and
  `record-grid`.

### C2. AI conversation (`chat-view`, `message-list`)

`chat-view` is a composed component: a `messageList`, a `textareaField` and a send button. C2 adds the parts that the
AI kits share:
- **`composer`**, a molecule that replaces the textarea and button in `chat-view`. It takes text, attaches files (as
  `file-field` does), shows suggested prompts as chips and has a stop button while a reply streams.
- A **streaming state** for a message in `message-list`, with a typing indicator, in which text grows in place
  without moving the column.
- **`sources`**, a molecule that shows numbered citations, each a link with a title, a host and an excerpt.
- **`steps`**, a disclosure of an agent's reasoning or tool calls, each step with a status. It is closed by default.
- **`actionConfirm`**, an inline card that asks the user to approve or reject an action before it runs, with what it
  will do.

These serve Magnetic's own builder chat as well as the apps it makes.

### C3. Charts and meter (`chart`)

`chart` draws bar, line, area and donut charts. C3 adds the following:
- **Chart types** `scatter`, `radar` and `heatmap`. Scatter, sparkline and gauge each appear in 3 or more libraries.
  Heatmap, funnel and radar come next.
- **`sparkline`**, a compact line or bar with no axes or legend, for `stat` and table cells.
- **`meter`**, a new atom with `role="meter"` for a measured value within a known range, such as disk use or a score.
  It draws a bar or a gauge and has optional thresholds that set its tone. `progress` stays for a task that is moving
  towards done.

### C4. Dates and time

- **`dateTimeField`**: one field that writes an ISO date-time in a named time zone. MUI X, Mantine, Atlassian and Ant
  Design each ship one. Today an app joins a `date-field` and a `time-field` itself.
- **`calendar` views** `agenda` and `timeline`. The timeline view has one row per resource, such as a room or a person,
  and time running across. It is the scheduler view that MUI X and Mantine shipped, and the nearest thing to Gantt any
  library offers.
- **Month and year pickers** for `date-field`, as a `precision` property (`day`, `month`, `year`).

### C5. Smaller gaps

Most of these are options on existing components:
- **`text-field`**: a reveal toggle and an optional strength hint for passwords. Five libraries have a password input.
- **`infoTip`**: a new atom. It is an info icon beside a label that opens a short note on press and on focus, not on
  hover. Carbon, Chakra, Spectrum and Fluent each ship a toggletip.
- **`menu`**: an `anchor` that opens the menu at the pointer on right-click and long-press. Ant Design, shadcn and
  PrimeReact each ship a context menu.
- **`buttonGroup`**: joined buttons, and a split button whose second half opens a menu. Seven libraries ship one.
- **`tour`**: a composite that walks through steps, each anchored to a node by path, with next, back and skip. Its
  progress is state. Ant Design, Mantine, Ark and Atlassian each ship one.
- **`editableText`**: text that becomes an input on press and writes its value on Enter or blur. It is for titles,
  such as board columns. Chakra, Atlassian and PrimeReact each ship one.
- **Choice cards**: an `appearance: card` for `radio-field` and `check-field`, as in Chakra's RadioCard and Spectrum 2's
  SelectBoxGroup. They are common on plan pickers and onboarding screens.

### C6. Media

- **`lightbox`**: a full-screen viewer over a set of images, with previous, next and zoom. Ant Design, Mantine,
  PrimeReact and Web Awesome each ship one.
- **`qrCode`**: an atom that encodes its value as a QR code, drawn as SVG paths. It needs no network access and serves
  tickets and bookings. Ant Design, Chakra and Web Awesome each ship one.
- **`mediaPlayer`**: video or audio from an uploaded file or an https URL, with themed controls and captions.
- **`imageField` cropping**: a crop step for an uploaded picture, with a fixed ratio for avatars.

### A rich-text editor

The rich-text editor has its own design, in [stateui-text-editor.md](stateui-text-editor.md). It needs no HTML
insertion, and its value is block JSON (owner, 2026-11-21).

## Not proposed

- **Transfer list, cascader, tree select and mentions.** Two or three libraries ship each, and multi-select and
  combobox cover most cases. Tree select can be reconsidered if apps ask for hierarchical pickers.
- **Masonry, marquee, watermark, number ticker, speed dial, affix, kbd and formatting components.** These have low
  value. Formatting belongs to expressions and to the `format` properties that `stat`, `number-field` and `chart`
  already have.

## A map

Only MUI X Premium has a map, as a chart type. Apps with store locators or deliveries will want one.

Asked on 2026-11-21: "For maps, can we route the communication through our web socket and have the node contact the
server?"

The browser contacts only our server, and our server fetches the tiles (owner, 2026-11-21). The tile host then sees our
server, not the user: it gets no user's address, and the document names no outside host. Our server can also cache
tiles, so each tile is fetched from the tile host once and then served to every user.

The tiles should travel over HTTP on our own origin, not over the sync WebSocket. The sync protocol (`state-sync`) is
JSON changes to state. It has no binary messages, and tiles do not belong in state. A view needs 15 to 30 tiles of 10
to 50 KB each, and a pan loads more. Over the socket, those tiles would queue in front of state changes and need a new
binary message kind with its own request tracking. Over HTTP the browser fetches them in parallel, its cache keeps
them, and the socket carries only state. A `/tiles/{z}/{x}/{y}` route on the Magnetic host, behind Caddy, fetches each
tile from the tile host and caches it.

What remains open:
- **Transport.** It is not yet confirmed whether the owner meant the socket itself or only that the server makes the
  outside contact. The design above assumes the second.
- **Tile source.** One option is a commercial raster provider under its terms, with a key held on the server. The other
  is our own Protomaps file of the region served from S3, in which case no outside party is involved. OpenStreetMap's
  public tile servers forbid heavy and proxied use, so they are out.
- **Drawing.** Raster tiles are images placed in a `viewport`, with pins drawn by `draw-repeat`. They need no new
  runtime. Vector tiles need a WebGL renderer, a lazy chunk like stateui-3d.

## Rules and Constraints

- Every new component follows the checklist in `CLAUDE.md`. Its summary, category and 3 to 8 purposes are unique
  across the catalog, its CSS uses theme tokens only and its controller imports no siblings.
- Additions extend an existing component where the libraries' component is a variant of one of ours (`table`, `chart`,
  `calendar`, `menu`, `text-field`, `radio-field`). A new component is added only for a new role.
- No component inserts markup. Charts, QR codes and gauges are drawn from checked path data, as `drawing` is.
- Nothing reads layout during a write. Column resize and pinning keep widths as state, as `split-pane` and `window`
  do.
- Every new search purpose is checked against the catalog test, because components search for each other by purpose.
- C2's streaming state never logs message text.

## Decisions

- CSV export is built on the authority, not in the browser (owner, 2026-11-21).
- A map's tiles are fetched by our server, and the browser never contacts a tile host (owner, 2026-11-21).
- The stages are built in the order C1 to C6 (owner, 2026-11-21: "Build it all").
- Inline editing reuses the form-field rules (`src/shared/field/rules.ts`) through `src/shared/records/cellEdit.ts`, so a
  cell and a form field fail the same rules with the same `_errors` keys.
- The editor of a cell is one overlay in the table, over the cell, not an input in every row: the virtual body recycles
  rows, and one overlay keeps the edit when its row scrolls out.
- The export reads the requesting persona's own running instance, not storage. Postgres row-level security is per
  workspace and a dataset is one JSON value, so there is no per-row rule to apply; the instance already holds exactly
  what the persona can read (a shared dataset whole, a persona binding's own records, another owner's share). Per-row
  rules for personas would be new design. A source served in pages by an effect exports the records the instance holds.
- Filtering, sorting and the CSV are one implementation in `@punyts/stateui-app/core` (`src/core/records/`), used by
  the table in the browser and by the export on the authority, so the file holds the rows the grid shows.
- The export is a request from the host page, not a logic effect or a stored app file: an effect's answer lands in
  state, and an app file would be readable by every tenant of the app and count against its quota. Nothing is stored.
- The frame cannot download (no `allow-downloads`), so the host page fetches the file and saves it with a link.
- A persona with view access may export: the file holds only what that persona already sees.
- An export holds at most 100,000 rows; past that it is refused, not cut short. Text a spreadsheet would read as a
  formula gets a leading `'`.
- A table with an end-pinned column always shows its vertical scrollbar: with a stable scrollbar gutter, Chromium places
  an end-pinned sticky cell under the scrollbar.

## As built

### C1a. Column resize, pinned columns, `actionBar`
- `stateui-components/components/composites/table/`: `pin` per column (sticky header and cells at
  `--table-pin-<index>`), `resizable` with a `role=separator` handle per header (drag and arrow keys, 48 px least
  width, `columnResize`), sideways scroll with the header following the body; tokens `pin.fill`, `pin.width`,
  `column.min`. `table-row` draws pinned cells; `record-list` reads `--sui-list-overflow-x`, `--sui-list-overflow-y`,
  `--sui-list-gutter` and `--sui-rows-min`.
- `stateui-components/components/molecules/action-bar/`: the new molecule.
- Tests: `test/composites/table-columns.browser.test.ts`, `test/molecules/action-bar.browser.test.ts`,
  `test/catalog.test.ts`.
- Example: the dashboard's top-customers table is resizable, multi-select, with the customer column pinned, and an
  `actionBar` above it. Showcase: an `actionBar` example in `stateui-mcp/showcase/examples/data.json`.

### C1b. Inline cell editing
- `stateui-components/src/shared/records/cellEdit.ts`: reads a column's editor and checks a draft against the form-field
  rules. Test: `cellEdit.test.ts`.
- `table`: column `edit` (`text`, `number`, `date`, `select`, `check`), `options` and the rules `required`,
  `minLength`, `maxLength`, `min`, `max`, `step`, `pattern`; `_errors`; runtime `editing`; event `edit`; token
  `error`. `table-row` shows a select column's label and marks editable cells.
- Test: `test/composites/table-edit.browser.test.ts`.
- Example: the products' stock table edits the product name (text), lifecycle (select) and reorder (check) in place.

### C1c. Filters and grouping
- `stateui-components/src/shared/records/tableView.ts`: the view columns, the group rows and their totals
  (`arrangeView`). `placeholder.ts` names group keys; `recordIndex.ts` resolves them to `groups`; `sortOrder.ts` takes
  an `arrange` step after the sort. Test: `tableView.test.ts`.
- `table`: `filter`, `filters`, column `filter` (`text`, `select`) with a filter row, `clearFilters`, event `filter`;
  `groupBy`, column `total` (`sum`, `average`, `min`, `max`, `count`), `collapsedGroups`, event `groupToggle`; token
  `group.fill`. `table-row` draws group rows; `record-list` takes `groups`.
- Test: `test/composites/table-filter-group.browser.test.ts`.
- Example: the products' stock table is grouped by lifecycle, with a text filter on the name and a select filter on
  the lifecycle.

### C1d. CSV export on the authority
- `stateui-app/src/core/records/`: `recordView.ts` (the filter and sort the table uses) and `recordExport.ts`
  (`readExportRequest`, `exportRecords`, `toCsv`, the patterns and caps). Test: `recordExport.test.ts`.
- `stateui-app/src/runtime/fileExport.ts`, messages `fileExport` and `fileExported`, the dispatcher hook `exportFile`
  for `ui-file-export`. Tests: `src/runtime/fileExport.browser.test.ts`, `src/runtime/validate.test.ts`.
- `stateui-mcp/src/application/recordsCsv.ts`: builds the file from the persona's instance; `POST /apps/:appId/export`
  in `HttpServer.ts` and the same request over the statenet relay in `StatenetViews.ts`; the host page side in
  `src/browser/fileExport.ts`. Tests: `test/http.test.ts`, `test/hostFileExport.test.ts`,
  `test/statenetBridge.test.ts`.
- `table`: command `export`, runtime `exporting`, event `export`, content `_exportName`. Test:
  `test/composites/table-export.browser.test.ts`.
- Magnetic serves the route through `startHttpServer` unchanged. The example has no host, so it places no export.
