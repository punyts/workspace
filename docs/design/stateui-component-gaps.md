# Component gaps against the major UI libraries

Status: C1 to C6 built (2026-11-21) and C7 built (2026-11-22). The data grid, the AI conversation components, the
chart types, `sparkline`, `meter`, `dateTimeField`, the calendar's agenda and timeline views, `dateField`'s
`precision`, the smaller gaps of C5, the media components of C6, and C7's `map`, `treeSelectField` and audio and
video uploads are built. The server route that C7's tiles and uploaded media are read from is designed in
[statenet-paths-route.md](statenet-paths-route.md) and built on the tower.

Asked for on 2026-11-21: "Let's do some deep research on components. Could you look at all the major players like MUI
and see if there are any components we should add." Then: "Write the doc". Then, for all six stages: "Build it all". On 2026-11-22, of
the map, tree select and uploaded media: "Do it all".

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

`chat-view` is a composed component: a `messageList` and, since C2, a `composer`. C2 adds the parts that the AI kits
share:
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
  It draws a bar, and the thresholds `low`, `high` and `optimum` set its level and colour as the HTML `meter` element
  does. `progress` stays for a task that is moving towards done.

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
- **`mediaPlayer`**: video or audio from an https URL or a file that ships with the app, with themed controls and
  captions.
- **Cropping in `fileField`**: a crop step for an uploaded picture, with a fixed ratio for avatars.

### A rich-text editor

The rich-text editor has its own design, in [stateui-text-editor.md](stateui-text-editor.md). It needs no HTML
insertion, and its value is block JSON (owner, 2026-11-21).

## Not proposed

- **Transfer list, cascader and mentions.** Two or three libraries ship each, and multi-select and combobox cover
  most cases.
- **Masonry, marquee, watermark, number ticker, speed dial, affix, kbd and formatting components.** These have low
  value. Formatting belongs to expressions and to the `format` properties that `stat`, `number-field` and `chart`
  already have.

## C7. Map, tree select and uploaded media

Only MUI X Premium has a map, as a chart type. Apps with store locators or deliveries want one.

Asked on 2026-11-21: "For maps, can we route the communication through our web socket and have the node contact the
server?" The browser contacts only our server, and our server fetches the tiles (owner, 2026-11-21), so the tile host
sees our server, not the user, and can be cached once for every user. The tiles travel over HTTP on our own origin,
not the sync WebSocket: state-sync carries JSON changes and has no binary messages, a view needs 15 to 30 tiles, and
over HTTP the browser fetches them in parallel and caches them. Asked on 2026-11-22: "Is there a way we can use the
same statenet path pattern?" Tiles and files are addressed by statenet path and read at `/paths/<path>`
([statenet-paths-route.md](statenet-paths-route.md)); the route is built on the tower.

- **`map`**: a composite of raster tiles in Web Mercator. `tiles` is an XYZ template that is https with a host or a
  path of the app's own origin (the `/paths` route), with `{z}`, `{x}` and `{y}`. `lat`, `lng` and `zoom` are state,
  moved by drag, wheel, arrow keys and the zoom buttons; markers are a keyed map or a list of records, pressed to
  select. Raster tiles need no new runtime; vector tiles would need a WebGL chunk like stateui-3d and are not built.
- **`treeSelectField`**: a field whose options are a hierarchy, records naming their parent, chosen from an expandable
  `tree` popup behind a select-only combobox button. Hierarchical pickers (regions, departments, categories) were
  asked for with the map.
- **Audio and video uploads**: ADR-0017's list gains MP3, M4A, Ogg, WAV, MP4 and WebM under the 10 MiB limit, so a
  `fileField` can take a short clip for a `mediaPlayer`, whose `file` plays it from the `/paths` route with the frame's
  read grant ([statenet-paths-route.md](statenet-paths-route.md), "The frame's side").

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
- The composer clears itself after a send and sends `{ text, attachments }`; the old composer left clearing to the
  application through a second command. One event with the whole message keeps the attachments with their text.
- A suggestion chip sends its prompt at once rather than filling the composer: a prompt is a whole message.
- The typing indicator is a `spinner` look (`dots`) with `active`, linked from the message row to `$row.streaming`, not
  a new component; the row stays one template an app can replace.
- `actionConfirm` decides once: after approve or reject the buttons give way to the outcome, and the application sets
  `status` back to `pending` to ask again.
- Only `http` and `https` source URLs become links, opened with `noopener noreferrer`.
- The scatter, radar and heatmap charts are types of `chart`, not new components: they share its records, series,
  format, marks, tooltip, keyboard, renderers and data table. A scatter reads `x` as a number; a heatmap's rows are
  the series and its columns the records, so it needs no new data shape.
- `meter` draws a bar only. A gauge would repeat `progress`'s ring; the level rule is the HTML `meter` element's, so
  `low`, `high` and `optimum` mean what they mean there.
- `sparkline` is an atom with its own small svg, not a `chart` without axes: it has no tooltip, legend or table, and a
  table cell holds hundreds of them.
- A table with an end-pinned column always shows its vertical scrollbar: with a stable scrollbar gutter, Chromium places
  an end-pinned sticky cell under the scrollbar.
- `dateTimeField` stores an instant with an offset, never a bare wall time: an empty `timeZone` is the viewer's zone,
  and a change of zone keeps the instant and moves the wall clock. A wall time a clock change skips moves forward by
  the gap and a repeated hour takes the earlier instant, as `Temporal`'s default `compatible` disambiguation does.
  The zone arithmetic uses `Intl.DateTimeFormat` only, with no time zone library.
- The agenda is the focused month, listing only the days that have records. The timeline is one day: a week of
  resource rows at minute resolution is too wide to read, and a Gantt is not proposed.
- The timeline's rows come from `resources`, or, when it is empty, from the resources the day's records name. A
  record whose resource is not a row is not shown, as a record with no readable start is not.
- `dateField`'s month and year precision use the native month input and a number input, so the value stays text
  compared as text, as the day precision's is.
- The password strength is a hint, not a rule: it never sets `error`. The score counts length and kinds of character
  and calls a run or a repeat weak; no word list ships, which would cost more bundle than the hint is worth. Its bar
  takes the `field` group's `selected.fill` and `error.color`, because a token added to `field` must be added to
  every field.
- `infoTip` is an atom of its own, not a `tooltip` option: a tooltip is `aria-hidden` and opens on hover, a toggletip
  is a button whose note is announced (`role="status"`) and opens on press, so touch reaches it.
- The context menu is `menu`'s `anchor: "pointer"`, positioned by a zero-size fixed point at the pointer that the popup
  anchors to, so the anchor positioning and its fallbacks are the menu's own. A long press is 500 ms within 10 px, for
  touch and pen only; Shift+F10 and the ContextMenu key open it at the trigger.
- `buttonGroup` draws its own buttons from keyed `actions` rather than holding `button` children, so the joined corners
  and the split menu need no reach into children; a split group's menu items are the actions after the first.
- `tour` finds a step's node by its state path through the shadow roots, and measures it each frame while it moves
  (the controller reads layout, as `board` and `viewport` do). A node not found within 30 frames leaves the card in
  the middle of the viewport rather than ending the tour. `done` is plain state, so an app links it to data and a
  finished tour stays finished.
- `editableText` keeps the edit in a runtime `draft` and writes `value` once, on Enter or blur, so a link to data hears
  one change per edit.
- Choice cards are an `appearance` of `radioField` and `checkField`, so the native controls, their keyboard and the
  field contract stay; a press anywhere on a card works through the label.
- `qrCode` encodes with its own byte-mode encoder rather than a package: under 400 lines, no network and no
  dependency, checked against a published Reed-Solomon vector and an independent reader. Its colours follow the theme's
  text and surface, so a dark theme draws a light code on dark; a theme that wants dark on light sets `dark` and
  `light`.
- `lightbox` takes a keyed map or a list of records, so it binds to a dataset as well as to literal pictures. Its
  pictures are https or `data:` PNG, JPEG, GIF or WebP; SVG is refused, as the URL rule refuses it for `image`.
- `mediaPlayer` plays https URLs, paths of the app's own origin and stored files only. The URL rule allows `data:`
  only for pictures and the runtime frame allows no `blob:`, so an uploaded file plays from its `/paths` URL (`file`).
  stateui-mcp's runtime frame and app pages allow `media-src https:` and the host's origin, as their `img-src` does.
- The crop step is part of `fileField` (`crop`), not an `imageField` of its own: the transfer, the rules and the
  field contract stay one component's. The picture is decoded with `createImageBitmap` and drawn on a canvas, so no
  URL of it is made and no byte reaches the store; the framed part is re-encoded in its own type (a GIF as a PNG) and
  at most 2048 pixels on its longest edge.

- The tile source is a configured XYZ template and key (env locally, SSM hosted), and the provider is MapTiler
  (owner, 2026-11-22). The browser reads tiles from our origin only; `map` refuses a template that is neither https
  with a host nor a path of the app's own origin, or lacks `{z}`, `{x}` or `{y}`.
- `map` draws the nearest whole zoom's tiles scaled to the fractional view zoom, at most 256 tiles, nearest the middle
  first, wrapping columns around the world. Markers more than 64 pixels outside the view are not drawn. A drag writes
  the centre once a frame; `change` carries `{ lat, lng, zoom }`.
- `treeSelectField` keeps `expanded` as state, so a document can hold it. A missing parent makes a root and a cycle is
  broken at its first option. With `leafOnly` a parent only opens and closes.
- Audio and video uploads stay under 10 MiB (owner, 2026-11-22). The server sniffs the container; QuickTime and
  Matroska other than WebM are refused.

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

### C2. AI conversation
- `stateui-components/components/molecules/composer/`: text, attachments through `ui-file-transfer`, suggestion
  chips, send and stop. `chatView`'s composer is a `composer`; `chat.send` carries `{ text, attachments }`, and
  `chat.stop` is new. Tests: `test/molecules/composer.browser.test.ts`, `test/composed/chat-view.browser.test.ts`.
- `spinner` `look: "dots"` and `active`; `messageList`'s default row shows the dots while `$row.streaming`. Test:
  `test/atoms/spinner-dots.browser.test.ts`.
- `components/molecules/sources/`, `steps/`, `action-confirm/`. Tests: `test/molecules/sources.browser.test.ts`,
  `steps.browser.test.ts`, `action-confirm.browser.test.ts`.
- Core icons `arrow-up`, `circle`, `circle-x`, `paperclip`.
- Example: the support chat links `streaming`, offers two suggestions and stops a reply; an Assistant card runs
  `steps`, cites `sources`, proposes a refund with `actionConfirm` and is asked through a `composer`. Test:
  `example/test/app.browser.test.ts` ("should run the assistant's steps when it is asked and record an approved
  refund").

### C3. Charts, sparkline and meter
- `stateui-components/src/shared/chart/polar.ts`: `buildScatter`, `buildRadar`, `buildHeatmap`, dispatched by
  `buildScene`; `CHART_TYPES` gains the three, `ChartInput.formatX` formats a scatter's x. The drawing tree passes
  `opacity` and paints the `web` rings. Tests: `src/shared/chart/polar.test.ts`,
  `test/composites/chart-types.browser.test.ts`.
- `components/atoms/meter/` with `src/shared/meter/level.ts`. Tests: `src/shared/meter/level.test.ts`,
  `test/atoms/meter.browser.test.ts`.
- `components/atoms/sparkline/` with `src/shared/spark/spark.ts`. Tests: `src/shared/spark/spark.test.ts`,
  `test/atoms/sparkline.browser.test.ts`.
- Example: the dashboard's Warehouse load card holds a `meter` of the open orders and a `sparkline` of orders per
  month, and a heatmap shows orders by weekday and channel (`example/src/seed.ts`: `ordersByWeekday`, `openRatio`).

### C4. Dates and time
- `stateui-components/src/shared/dates/zone.ts`: `isTimeZone`, `offsetAt`, `wallTimeOf`, `instantOf`, `isoInZone`,
  `parseInstant`, `zoneLabel`. Test: `src/shared/dates/zone.test.ts`.
- `components/molecules/date-time-field/`. Test: `test/molecules/date-time-field.browser.test.ts`.
- `calendar` views `agenda` and `timeline`: `src/shared/dates/agendaModel.ts` (`buildAgenda`, `buildTimeline`),
  `calendarModel.ts` (the two views' ranges, steps and keys) and `events.ts` (an event's `resource`). Tests:
  `src/shared/dates/agendaModel.test.ts`, `test/composites/calendar-agenda.browser.test.ts`.
- `dateField`'s `precision`. Test: `test/molecules/date-field.browser.test.ts`.
- Example: the preferences screen's notifications card holds a `dateTimeField` that pauses notifications until a
  time in Los Angeles (`example/src/seed.ts`: `pauseUntil`).

### C5. Smaller gaps
- `text-field`: the password reveal and strength hint; `src/shared/password/strength.ts` (`passwordStrength`). Tests:
  `src/shared/password/strength.test.ts`, `test/molecules/text-field-password.browser.test.ts`.
- `components/atoms/info-tip/`. Test: `test/atoms/info-tip.browser.test.ts`.
- `menu`'s `anchor: "pointer"`. Test: `test/composites/menu-context.browser.test.ts`.
- `components/molecules/button-group/`. Test: `test/molecules/button-group.browser.test.ts`.
- `components/composites/tour/` and `src/shared/tour/tourModel.ts` (`tourSteps`, `tourPosition`, `stepAfter`,
  `nodeElement`). Tests: `src/shared/tour/tourModel.test.ts`, `test/composites/tour.browser.test.ts`.
- `components/molecules/editable-text/`. Test: `test/molecules/editable-text.browser.test.ts`.
- Choice cards: `radioField` and `checkField` `appearance: "card"`. Test: `test/molecules/choice-cards.browser.test.ts`.
- The `eye` and `eye-off` icons join the core set.
- stateui-mcp's showcase shows `buttonGroup` and `editableText` (forms) and `infoTip` and `tour` (overlays).
- Example: the notifications preview card holds an `editableText` sender name with an `infoTip`, a split `buttonGroup`
  that sends a test, and a `tour` over the pause field, the sender and the button group.

### C6. Media
- `components/atoms/qr-code/` and `src/shared/qr/qr.ts` (`encodeQr`, `qrPath`; byte mode, versions 1 to 40, Reed-Solomon
  blocks, mask penalty). Tests: `src/shared/qr/qr.test.ts` (capacities, a published Reed-Solomon vector, format and
  version bits, an independent reader's round trip), `test/atoms/qr-code.browser.test.ts`.
- `components/composites/lightbox/` and `src/shared/lightbox/gallery.ts` (`isSafeImageSrc`, `galleryImages`,
  `galleryStep`, `zoomStep`). Tests: `src/shared/lightbox/gallery.test.ts`, `test/composites/lightbox.browser.test.ts`.
- `components/molecules/media-player/` and `src/shared/media/media.ts` (`isMediaUrl`, `captionTracks`, `formatTime`).
  Tests: `src/shared/media/media.test.ts`, `test/molecules/media-player.browser.test.ts` with the fixtures
  `test/fixtures/silence-4s.wav` and `captions.en.vtt`.
- `fileField`'s `crop` and `src/shared/field/crop.ts` (`cropRatio`, `cropRect`, `croppedSize`, `croppedType`,
  `croppedName`). Tests: `src/shared/field/crop.test.ts`, `test/molecules/file-field-crop.browser.test.ts`.
- The `badge-cc`, `maximize`, `minimize`, `volume`, `volume-off`, `zoom-in`, `zoom-out` and `zoom-reset` icons join the
  core set. The components bundle's gzip measure is 305,532 bytes (`test/bundleSize.test.ts`).
- stateui-mcp: `runtimeCsp` and `APP_PAGE_CSP` allow `media-src https:` (`src/infrastructure/http/security.test.ts`).
  The showcase shows `qrCode` and `mediaPlayer` (content), `lightbox` (overlays) and a cropping `fileField` (forms).
- Example: the general settings hold a profile picture field cropped to a square and a QR code card; the customers'
  About card opens a `lightbox` of two photos; the help screen plays a sample clip in a `mediaPlayer`.

### C7. Map, tree select and uploaded media
- `components/composites/map/` and `src/shared/map/map.ts` (`isTileTemplate`, `tileUrl`, `project`, `unproject`,
  `coverTiles`, `panBy`, `zoomAround`, `placeMarkers`). Tests: `src/shared/map/map.test.ts`,
  `test/composites/map.browser.test.ts`. The `map-pin` icon joins the core set; `viewport`'s last purpose became "bring
  a part of a big diagram into view".
- `components/molecules/tree-select-field/` and `src/shared/field/treeOptions.ts` (`readTreeOptions`, `ancestorsOf`,
  `pathLabel`, `visibleRows`). Tests: `src/shared/field/treeOptions.test.ts`,
  `test/molecules/tree-select-field.browser.test.ts`.
- Audio and video types in `src/shared/field/files.ts` (test `files.test.ts`) and stateui-mcp's `src/domain/UiFile.ts`
  (`detectMediaType`; test `UiFile.test.ts`, "audio and video detection"). ADR-0017 in ai-minion is amended.
- stateui-mcp: the showcase shows `map` (data, no tiles) and `treeSelectField` (forms).
- Example: the Deliveries screen's side card has a `map` of four depots over sample graticule tiles
  (`scripts/map-tiles.ts`, `npm run tiles`, written to `public/map-tiles`); the general settings have a home depot
  `treeSelectField` of regions and cities bound to `$.data.prefs.region`.
- `mediaPlayer`'s `file` and the runtime's `fileUrl` hook, with the `/paths` route's files and read grants
  ([statenet-paths-route.md](statenet-paths-route.md), "As built").
- Not built: the tile cache of `/paths` (on the tower).
