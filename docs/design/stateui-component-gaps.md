# Component gaps against the major UI libraries

Status: proposed (2026-11-21). Nothing built.

Asked for on 2026-11-21: "Let's do some deep research on components. Could you look at all the major players like MUI
and see if there are any components we should add." Then: "Write the doc".

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
- **CSV export** of the visible rows, as a file the user saves.
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

## Not proposed

- **Rich-text editor.** A WYSIWYG editor needs `contenteditable` and HTML. That conflicts with the rule against
  `innerHTML` for text, and it is the heaviest component in every library that has one. `markdown` with a
  `textarea-field` covers notes and descriptions.
- **Transfer list, cascader, tree select and mentions.** Two or three libraries ship each, and multi-select and
  combobox cover most cases. Tree select can be reconsidered if apps ask for hierarchical pickers.
- **Masonry, marquee, watermark, number ticker, speed dial, affix, kbd and formatting components.** These have low
  value. Formatting belongs to expressions and to the `format` properties that `stat`, `number-field` and `chart`
  already have.

## Open questions

- **Map.** Only MUI X Premium has one, as a chart type. Apps with store locators or deliveries will want one. Tiles
  come from an outside server, so a map needs a decision on which tile hosts a document may use and what is sent to
  them before it can be designed.
- **Grid export.** It is not yet decided whether CSV export is a file the browser saves or a command that the
  authority runs, so that it can include rows that are not loaded.

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

None yet. The order C1 to C6 is a proposal for the owner.
