# A rich-text editor for StateUI

Status: T1 built (2026-11-21): the model, the Markdown converters and the `richText` atom. T2 built (2026-11-21): the
`richTextField` editor, tested in Chromium; the manual check on Safari and an Android keyboard is not done. T3 built (2026-11-21): paste and drop of Markdown and
HTML, and the link panel. T4 built (2026-11-21): the `/` command menu, mentions and tables. T6 built (2026-11-22): comments
anchored to text, tested in Chromium.

Asked for on 2026-11-21: "Then let's talk about text editor". Then, on the value format: "Block JSON for the text
editor". On 2026-11-21: "Build T4", with T4 chosen as "/ command menu, Mentions, Tables".

## The problem

StateUI can show formatted text with `markdown`, and it can take plain text with `textarea-field`. It cannot take
formatted text. Notes, descriptions, messages, articles and comments in the apps Magnetic builds need headings, lists,
emphasis and links written by the user, not typed as Markdown source.

[stateui-component-gaps.md](stateui-component-gaps.md) left a rich-text editor out, on the grounds that it needs HTML.
That was wrong. Lexical, ProseMirror and Slate all treat the document as data and the DOM as a view of it:
- They build the DOM with element calls and never insert markup.
- They catch the browser's `beforeinput` events and apply each edit to the model, then redraw.
- They convert pasted HTML into the model and never insert it.

None of that uses `innerHTML`, which is what `stateui/src/guarantees.test.ts` bans.

## The design

### The value: block JSON (owner, 2026-11-21)

The value is a keyed map of blocks. Each block holds its own text as an array of runs:

```json
{
    "blocks": {
        "bK3f9": { "order": "a0", "type": "heading", "level": 2, "runs": [{ "text": "Opening hours" }] },
        "bQ7m2": { "order": "a1", "type": "paragraph", "runs": [
            { "text": "Open " },
            { "text": "every day", "marks": ["bold"] },
            { "text": " except holidays; see " },
            { "text": "the calendar", "link": "https://example.com/calendar" }
        ] },
        "bW1p8": { "order": "a2", "type": "check", "indent": 0, "checked": true, "runs": [{ "text": "Post the hours" }] }
    }
}
```

- **Keys** are random ids that start with a letter, so none is integer-like.
- **Order comes from `order`, not from key order.** `order` is a fractional index: a string that sorts between its
  neighbours, so inserting a block writes only that block. Two people inserting at different places never write the
  same path.
- **Block types:**
  - `paragraph`
  - `heading`, with `level` 1 to 3
  - `bullet`, `numbered` and `check`, with `indent` 0 to 4, and `checked` on a check
  - `quote`
  - `code`, with an optional `language`
  - `divider`, which has no runs
  - `table`, which has no runs of its own: `rows` (the first is the header), each `{ cells }` with every cell
    `{ runs }`, and an optional `align` with `left`, `center`, `right` or `""` per column
- **Lists are flat blocks with an indent, not nested trees.** Every block is then one path. Numbering is worked out
  from the run of `numbered` blocks around it.
- **Runs** are `{ text, marks?, link?, mention? }`.
  - The marks are `bold`, `italic`, `strike` and `code`.
  - A `link` is an `https:` URL, a relative in-app target or a `#` fragment. These are the three kinds that
    `markdown`'s link check (`src/shared/markdown/links.ts`) already keeps.
  - A `mention` is the id of the person or record a run names (1 to 128 characters); the run's text is what it shows,
    `@Ada Lovelace`. A mention carries no link and is never merged with its neighbours.
  - Adjacent runs with the same marks and link are merged when written, so equal content always has one form.
- **A table** has 1 to 20 columns, as many as its header row has, and 1 to 500 rows; every row is padded or cut to the
  header. A cell is one line: a line break in a stored cell reads as a space. Its characters count toward `maxLength`.
  A table is one block, so an edit in any cell writes the whole table.

A block is the unit of a write and of a conflict. Every edit writes the blocks it changed, whole.

### The components

- **`richText`**, an atom in `content`. It draws a value read-only, with the theme's typography, as `markdown` does.
- **`richTextField`**, a molecule in `forms`. It edits a value inside the field frame shared with every other field:
  label, help, error, `required`, `disabled`, `readonly`, `touched`, `dirty` and `locked`, so `form` finds, validates
  and resets it like the rest. It adds:
  - `maxLength`, counted in characters across all runs
  - `toolbar`: `full`, `compact` or `none`
  - `blocks`: the block types allowed, so a comment box can allow only paragraphs and marks
  - `_placeholder`
- **Shared code** in `src/shared/richtext/`: the model, normalising, fractional order, edit operations, the DOM view,
  paste conversion and the Markdown converters.
- **Two compute functions** in `src/functions.ts`, `fromMarkdown` and `toMarkdown`, at
  `$.components.richText.functions.*`, so they exist before the editor. Logic and agents can then convert between
  Markdown and the block value. An agent writes either form.

### Editing

- **The view.** The field's body is one `contenteditable` element. Each block is an element keyed by its block key, and
  each run is a span. All of them are built with `createElement` and `textContent`. A change of the value redraws only
  the blocks whose content changed.
- **Input.** The controller handles `beforeinput` and cancels it. It turns the input type into an edit of the model,
  writes the changed blocks and redraws them. The input types it handles:
  - `insertText` and `insertReplacementText` (spelling fixes)
  - `insertParagraph` and `insertLineBreak`
  - the delete family
  - `insertFromPaste` and `insertFromDrop`
  - `formatBold`, `formatItalic` and `formatStrikeThrough`
  - `historyUndo` and `historyRedo`
- **Composition.** IME composition (Chinese, Japanese, Korean, and Android keyboards) cannot be cancelled. During
  composition the browser edits the block's DOM. At `compositionend` the controller reads that one block's text back,
  rebuilds its runs and redraws it. This is the only place the DOM is read for content.
- **Selection** is kept as `{ block, offset }` anchor and focus points in the field's runtime property `selection`,
  which is never synced or saved. It is mapped to and from the DOM selection on each edit, and the toolbar's active
  marks and block kind (the runtime `active`) come from it.
- **Markdown shortcuts** at the start of a block turn it into another type: `#`, `##`, `###`, `-`, `1.`, `[]`, `>`,
  three backticks and `---`. Inline shortcuts add marks: `**`, `_`, `~~` and backticks. Ctrl+B, Ctrl+I, Ctrl+E (code),
  Ctrl+Shift+X (strike) and Ctrl+K (link) work, along with Tab and Shift+Tab to indent and outdent list items.
- **Undo** keeps a history of the user's own edits in the field's controller, never in the store: each entry holds the
  changed blocks before and after. Typing is grouped until a pause of a second or a caret move. A block someone else
  changed since an edit is skipped, so undo never takes back another person's edit.
- **Links** are added and edited in a panel, a popover anchored under the block that holds the selection (CSS anchor
  positioning, so the editor reads no layout). It opens with the link at the caret or selection. A caret in a link
  edits the whole link; a caret elsewhere puts the address in as linked text. An address that starts like a domain
  (`example.com/a`) gets `https://`, since it would otherwise be a relative target; the result must pass `safeHref`, or
  the panel stays open with an error.

### Commands, mentions and tables (T4)

- **One picker.** Typing `/` or `@` at the start of a block's text or after a space opens a listbox popover anchored
  under the block, like the link panel. The text typed after the trigger is its query; the picker closes when the caret
  leaves that text, the trigger is deleted, the query passes 64 characters or holds a line break, or on Escape or a
  press outside. ArrowUp and ArrowDown move through the options (`aria-activedescendant` on the editor names the active
  one), Enter or Tab picks, and a press on an option picks it without taking the focus. Picking takes the trigger and
  query out and runs the option, as one undo step. The runtime property `picker` is `slash` or `mention` while it shows.
- **The `/` menu** offers the block kinds the field allows (headings, lists, check, quote, code block, divider and
  table), labelled from `_tools`. It filters by label, and closes on a space or when nothing matches. It does not open in
  a code block or a table cell.
- **Mentions.** `@` offers the field's `mentions` records: each record's `mentionValue` field (default `value`) is
  the id and its `mentionLabel` field (default `label`) the label, filtered by label with the search collator the
  combobox uses, at most eight. The field raises `mentionQuery` with the query once typing pauses for 300 ms, so an app
  can load matching records into `mentions`; the options follow as they are written. A picked mention goes in as the run
  `@label` with its id, then a space. The editor draws it as `span.mention`, not editable; the caret never sits inside
  it, Backspace and Delete take it whole, and a selection that cuts into it is widened to cover it. Mentions work in
  table cells, never in code.
- **Tables.** The toolbar and the `/` menu insert a table of three columns and three rows in place of an empty block,
  or after the caret's block, with a paragraph after it. A cell takes typing, marks, links and mentions like a
  paragraph, but no block shortcut and no line break. Tab moves to the next cell and adds a row from the last;
  Shift+Tab goes back; Enter goes to the cell below and adds a row from the last. In a table the toolbar shows add row
  (below), add column (right), remove row, remove column and remove table; removing the last row or column removes the
  table. Backspace after a table and Delete before one move the caret into it instead of joining. A selection that
  reaches out of a cell takes the whole table as one block.
- **Display and Markdown.** `richText` draws a table as `table` with the header row in `thead`, alignment as
  `data-align`, and a mention as `span.mention`. `fromMarkdown` reads a GFM table as a table block and `toMarkdown`
  writes one (a pipe in a cell is escaped); a mention is written as its text.

### Comments anchored to text (T6)

Asked for on 2026-11-22, as the next item on this machine: "let's continue". The owner chose that the field writes the
threads into a map the app links, and that resolving keeps the anchor and hides it.

- **An anchor is on the runs.** A run gains `comments`: the ids of the threads on its text, sorted, at most 8. A thread
  id starts with a letter and is at most 32 characters. Comments may overlap, so a run can carry several. Adjacent runs
  join only when their comments are the same, and a mention can carry comments too. An anchor moves with its text, is
  split and joined with it, and conflicts per block like every other edit.
- **Typing inside a commented range carries its comments; typing at either end does not.** This is the rule a link
  follows (`styleAt`): the style of the text before and after the caret must share the id.
- **The threads live in `comments`**, a keyed map property the app links to its data
  (`"<-comments": "$.data.notes.comments"`). Each thread is
  `{ author: { id, label }, text, at, resolved?, replies? }`, where `at` is an ISO time and `replies` is a keyed map of
  `{ author, text, at }` shown in time order. Comment text is plain, at most 2000 characters; a thread keeps at most
  100 replies, and a field at most 500 threads. Each thread and each reply is its own path, so two people replying, or
  commenting on different text, never write the same path.
- **`commentAuthor`** (`{ id, label }`, the app binds it to the person) is who writes. Without it the field shows no
  comment tool and no highlights. A `comments` map that is not linked keeps its threads in the node only.
- **Adding.** The `comment` tool (full and compact toolbars) and Ctrl+Alt+M on a selection open the comment panel, a
  popover anchored under the block like the link panel, with a text box. Saving writes the thread, then puts its id on
  the selected runs as one undo step. Undoing takes the anchor off and leaves the thread, which then shows nowhere. A
  selection that reaches into a table takes the whole table, as a mark does. A `readonly` field cannot add a
  comment, since an anchor is a write of the value; it can still reply and resolve. A `disabled` or locked field does
  neither.
- **Reading.** Text under an open (not resolved) thread is drawn as `span.commented`, with the tokens
  `comment.background` and `comment.active` for the thread the panel shows. Pressing commented text, or the tool or
  Ctrl+Alt+M with the caret in it, opens the panel on the threads there: each with its author, time, text and replies,
  a reply box, Resolve, and Delete on the author's own thread or reply. Resolved threads at the caret are listed under
  "Resolved" with Reopen.
- **Resolving** sets `resolved: true`. The ids stay on the runs and the highlight goes; Reopen brings it back.
  **Deleting** a thread removes it from the map and takes its id off every block that carries it.
- **Events.** After each write the field raises `comment` with `{ thread, kind }`, `kind` one of `add`, `reply`,
  `resolve`, `reopen` and `delete` (deleting a reply adds its key as `reply`), so an app can notify people. It never
  carries the text.
- **Elsewhere.** `richText` draws no comments. `toMarkdown` drops them and `fromMarkdown` makes none. A paste never
  carries comment ids. A thread whose text was deleted stays in the map; the app may list or remove it.

### Paste and drop

- **Plain text** becomes one paragraph per line. If it reads as Markdown (headings, list markers, fences), it goes
  through `fromMarkdown` instead.
- **HTML** is parsed by `DOMParser` into an inert document, where scripts do not run and nothing loads. The converter
  walks it and keeps only these elements, turning each into a block or a mark:
  - `p`, `h1` to `h6` (a heading level above 3 is drawn as 3), `ul`, `ol`, `li`, `blockquote`, `pre`, `code` and `hr`
  - `b`, `strong`, `i`, `em`, `s`, `del`, `strike` and `a`
  - An element's inline `font-weight` (bold or 600 and above), `font-style: italic` and `line-through` count as marks,
    since Google Docs marks text that way; the `b` it wraps a whole copy in is not bold. Nothing else of `style` is
    read.
  - A `li` with a checkbox is a check item; a nested list indents its items; a `table` is a table block, each cell's
    blocks joined into one line.
  - Every other element contributes its text only.
  - No attribute is kept except a link's checked `href`.
- **Paste respects `blocks`.** A block type the field does not allow becomes a paragraph, a divider is dropped, and a
  table becomes a paragraph per row with its cells joined by ` | `. Pasted text with a table's delimiter row reads as
  Markdown. A paste into a table cell goes in as one line.
- **Where it lands.** One pasted block goes in at the caret. With more, the block at the caret is split: the first
  pasted block joins its start, the last its end. A pasted paragraph takes the kind of the block it lands in, so lines
  pasted into a list become items; an empty block takes the first pasted block's kind. In a code block the plain text
  goes in as it is. `maxLength` cuts the paste. A drop lands at the drop point the browser gives.

### Collaboration

state-sync merges by path. Two people editing different blocks never conflict. Two people typing in the same block
resolve to the last write of that block, and the other person's keystrokes since their last write are lost. A remote
change to a block someone is editing redraws it and keeps their selection, by block key and an offset clamped to the
new text. Merging characters within one block needs a sequence CRDT. That belongs to the statenet direction
([statenet-direction.md](statenet-direction.md)), not to this component.

## Stages

1. **T1, model and display.** Build the model, normalising, fractional order and the Markdown converters with the two
   compute functions. Add the `richText` atom.
2. **T2, the editor.** Build `richTextField` with the block types and marks, typing, deleting, splitting and joining
   blocks, composition, undo and redo, Markdown shortcuts, keyboard commands and the toolbar.
3. **T3, paste and links.** Add paste and drop of plain text, Markdown and HTML, and the link popover.
4. **T4, commands, mentions and tables** (owner, 2026-11-21). The `/` menu, mentions with `mentionQuery`, and the
   `table` block with its editing, display and Markdown.
5. **Later:**
   - images as app files
   - character-level merging (T5, with the statenet direction)
6. **T6, comments anchored to text** (2026-11-22): anchors on runs, threads in a linked map the field writes, the
   comment tool and panel.

Each stage follows the component checklist in `CLAUDE.md`. T2 is the largest. Its browser tests drive real key
presses, paste and composition events in Chromium. Safari and Android keyboards differ in their `beforeinput` events,
so T2 also includes a manual check on both before it is called done.

## Decisions

- The value is block JSON: a keyed map of blocks with fractional `order` and runs of marked text, not a Markdown string
  (owner, 2026-11-21).
- We build the editor ourselves. Lexical (about 22 KB gzipped) and ProseMirror (about 80 KB) would each bring their own
  document model, which would have to be translated to and from state on every edit.
- Lists are flat blocks with an indent, so every block is one path and one unit of conflict.
- Pasted HTML reads marks from inline styles as well as from elements, so a copy from Google Docs keeps its bold and
  italic. Only the three style properties above are read.
- The link panel is anchored to the block, not to the selected characters: anchoring to a text range needs its layout,
  which the editor does not read.

- One picker serves `/` and `@`, anchored to the block like the link panel, for the same reason: the editor reads no
  layout.
- A mention is a run, not a block or an inline node, so it costs the value one optional field and every run function
  keeps working. Its label is stored as its text, so a value reads without the records; a renamed person keeps their
  old label until the mention is put in again.
- A table is one block with its cells inside, not a block per cell, so it moves, copies and undoes as one; two people
  typing in two cells of one table conflict, as two people typing in one paragraph do.
- A comment anchor is a list of thread ids on a run, as a mention is a field of a run: it moves with its text and
  every run function keeps working. The threads are a separate map, so a reply never rewrites a block (2026-11-22).
- The field writes the threads itself into the map the app links, so comments work with no app logic (owner,
  2026-11-22).
- Resolving keeps the anchor and hides it, so a thread can be reopened where it was (owner, 2026-11-22).
- An edit in a cell runs the paragraph edit on the cell as a one-block document and writes the result back, so cells
  share every rule of typing, marks, links and limits with paragraphs.

## Rules and Constraints

- No `innerHTML`, `outerHTML` or `insertAdjacentHTML`. The DOM is built with element calls and `textContent`, and pasted
  HTML is read from an inert `DOMParser` document, never inserted.
- No attribute other than a checked link `href` survives paste. Links are only `https:`, relative in-app targets or `#`
  fragments.
- Block keys and every other key in the value are never integer-like. The value is stored as `json`, never `jsonb`.
- Selection and the toolbar's state are runtime properties of the field, and the history stays in its controller;
  none of them syncs.
- The editor never logs text, runs or links. Errors name the field's path and the block key only, and their codes are in
  the catalog in `stateui-app/src/core/errors/catalog.ts`.
- CSS uses theme tokens only. The editor reads the DOM only for the selection, and for a block's text at the end of
  composition.

## As built
T1, in stateui-components:
- `src/shared/richtext/order.ts`: `orderBetween`, `orderKeys` and `isOrderKey`, base-62 fractional order. Test:
  `order.test.ts`.
- `src/shared/richtext/model.ts`: block types, marks and limits, `newBlockKey`, `readRichText` (sorted and checked),
  `normalizeRuns`, `plainText`, `textLength` and `valueOf`. Test: `model.test.ts`.
- `src/shared/richtext/markdown.ts`: `fromMarkdown` over `parseMarkdown`, and `toMarkdown`. Test: `markdown.test.ts`
  (round trips and escapes).
- `src/shared/richtext/render.ts`: `renderRichText` and `renderRuns`, the DOM built by `createElement` and text nodes.
- `src/functions.ts`: `$.components.richText.functions.fromMarkdown` and `toMarkdown`, computes on server and browser.
  Test: `src/functions.test.ts`.
- `components/atoms/rich-text/`: the `richText` atom (`value`, `headingOffset`, `_empty`, event `press`, tokens `gap`,
  `code.background` and `check.fill`). Test: `test/atoms/rich-text.browser.test.ts`.
- The example places a `richText` in the support desk's "Escalate and note" card, and stateui-mcp's showcase has an
  example of it.

T2, in stateui-components:
- `src/shared/richtext/runs.ts`: ranges over runs in UTF-16 offsets, `styleAt` and delete boundaries by grapheme, word
  and line. Test: `runs.test.ts`.
- `src/shared/richtext/edit.ts`: every edit as a pure function from the blocks and a selection to the blocks it wrote
  and removed, the Markdown shortcuts among them. Test: `edit.test.ts`.
- `src/shared/richtext/history.ts`: undo and redo by block, typing grouped. Test: `history.test.ts`.
- `src/shared/richtext/editorView.ts`: the editor's DOM, one element per block, and the mapping of points between the
  model and the DOM. Test: `editorView.test.ts` (numbering).
- `src/shared/field/field.ts`: the `deep` option, so a field hears writes under its value.
- `components/molecules/rich-text-field/`: the `richTextField` molecule (`toolbar`, `blocks`, `rows`, `maxLength`,
  `minLength`, `required` and the field frame; tokens `gap`, `code.background`, `check.fill`, `toolbar.background` and
  `toolbar.active`), with fifteen toolbar icons added to the core set. Test:
  `test/molecules/rich-text-field.browser.test.ts`, which drives real keys in Chromium and dispatches paste and
  composition events.
- The example places a compact `richTextField` ("Handover") in the support desk's "Escalate and note" card, and
  stateui-mcp's showcase has an example of it.
- Not done: the manual check on Safari and an Android keyboard.

T3, in stateui-components:
- `src/shared/richtext/paste.ts`: `looksLikeMarkdown`, `textToShapes`, `htmlToShapes` (from an inert document) and
  `allowedShapes`. Test: `paste.test.ts`.
- `src/shared/richtext/edit.ts`: `insertBlocks`, `linkAt`, `setLink` and `linkTarget`; `runs.ts`: `linkRuns` and
  `linkExtent`. Test: `edit.test.ts` ("insertBlocks", "links", "linkTarget").
- `components/molecules/rich-text-field/`: paste and drop through them, the `link` tool (in the compact toolbar too)
  and Ctrl+K, the link panel (`createPopover`, anchor `--richtext-link` on `.block.anchored`), runtime `link` and
  `linkInvalid`, five `_tools` names in every locale, token `link.width`, and the `link` icon in the core set. Test:
  `test/molecules/rich-text-field.browser.test.ts` (HTML and Markdown paste, a paste splitting a block, a drop, and
  the panel: Ctrl+K and Enter, an unsafe address, edit, remove and Escape).

T4, in stateui-components:
- `src/shared/richtext/model.ts`: the `table` block (`rows`, `align`, `MAX_COLUMNS` 20, `MAX_ROWS` 500), the run's
  `mention`, `blockLength` and `joinRunsOf`. Test: `model.test.ts` ("tables and mentions").
- `src/shared/richtext/runs.ts`: `atomAround`; marks and links keep a mention and never link it.
- `src/shared/richtext/edit.ts`: points with a `cell`, cell edits through `viaCell`, `insertTable`, `tableCommand`,
  `insertMention`, `opensPicker`, `pickerQuery` and `chainEdits`; mention snapping in `rangeOf`. Test: `edit.test.ts`
  ("tables", "mentions", "pickers").
- `src/shared/richtext/editorView.ts` and `render.ts`: tables and mention chips, points in cells.
- `src/shared/richtext/markdown.ts`: GFM tables both ways. Test: `markdown.test.ts` ("tables in Markdown").
- `src/shared/richtext/paste.ts`: HTML tables, Markdown tables in text, tables the field does not allow. Test:
  `paste.test.ts` ("pasted tables").
- `components/molecules/rich-text-field/`: the picker (`#picker`, runtime `picker`), properties `mentions`,
  `mentionValue` and `mentionLabel`, event `mentionQuery`, the `table` tool and five table tools, eight `_tools` names in
  every locale, tokens `mention.color`, `mention.background`, `table.header`, `picker.active` and `picker.on`, and six
  icons added to the core set. Test: `test/molecules/rich-text-field.browser.test.ts` (the `/` menu, arrows and Escape,
  no menu inside a word, typing and Tab and Enter in cells, the table tools, mentions from records and from
  `mentionQuery`).
- `components/atoms/rich-text/`: table and mention styles, tokens `mention.color`, `mention.background` and
  `table.header`.

T6, in stateui-components:
- `src/shared/richtext/model.ts`: the run's `comments` (`MAX_RUN_COMMENTS` 8, `MAX_THREAD_ID` 32, `isThreadId`,
  `readComments`, `sameComments`); runs join only when their threads match, and a code block keeps comments.
- `src/shared/richtext/runs.ts`: `styleAt` returns the threads shared by both sides (`Style`, `styledRun`),
  `commentRuns`, `uncommentRuns` and `commentsIn`; marks and links keep comments.
- `src/shared/richtext/edit.ts`: `commentSelection` (a table reached into takes every cell), `removeComment` and
  `commentsAt`; typed and composed text takes its threads from `styleAt`.
- `src/shared/richtext/editorView.ts`: `span.commented` (`.active`) for the threads `shownComments` gives, part of a
  block's signature so a resolve redraws it.
- `components/molecules/rich-text-field/`: properties `comments` and `commentAuthor`, runtime `comment`, event
  `comment`, the `comment` tool and Ctrl+Alt+M, the comment panel (`#commentPanel`, built with `createElement`),
  eleven `_tools` names in every locale, tokens `comment.background` and `comment.active`, and the `message-plus` icon
  in the core set.
- Tests: `src/shared/richtext/comments.test.ts`; `test/molecules/rich-text-field.browser.test.ts` ("richTextField
  comments in Chromium": adding through linked maps and undoing the anchor, reply, resolve and reopen from pressed
  text, deleting only one's own, no tool without an author, a readonly field replying).
- The example's "Handover" field has a thread on "partial". In Northwind Ops a press on it opened the panel under the
  block, a reply was written, and Ctrl+Alt+M on a selected word added a second thread. stateui-mcp's showcase, rebuilt,
  did not change.
