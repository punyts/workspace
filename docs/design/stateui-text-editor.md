# A rich-text editor for StateUI

Status: T1 built (2026-11-21): the model, the Markdown converters and the `richText` atom. T2 and T3 are not built.

Asked for on 2026-11-21: "Then let's talk about text editor". Then, on the value format: "Block JSON for the text
editor".

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
- **Lists are flat blocks with an indent, not nested trees.** Every block is then one path. Numbering is worked out
  from the run of `numbered` blocks around it.
- **Runs** are `{ text, marks?, link? }`.
  - The marks are `bold`, `italic`, `strike` and `code`.
  - A `link` is an `https:` URL, a relative in-app target or a `#` fragment. These are the three kinds that
    `markdown`'s link check (`src/shared/markdown/links.ts`) already keeps.
  - Adjacent runs with the same marks and link are merged when written, so equal content always has one form.

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
- **Selection** is kept as `{ block, offset }` anchor and focus points in `$.runtime`, which never syncs. It is mapped
  to and from the DOM selection on each edit, and the toolbar's active marks come from it.
- **Markdown shortcuts** at the start of a block turn it into another type: `#`, `##`, `###`, `-`, `1.`, `[]`, `>`,
  three backticks and `---`. Inline shortcuts add marks: `**`, `_`, `~~` and backticks. Ctrl+B, Ctrl+I and Ctrl+K
  (link) work, along with Tab and Shift+Tab to indent and outdent list items.
- **Undo** keeps a history of the user's own edits in `$.runtime`. Typing is grouped by pauses. It never undoes another
  person's edit.
- **Links** are added and edited in a `popover` anchored to the selection, with the URL checked as above.

### Paste and drop

- **Plain text** becomes one paragraph per line. If it reads as Markdown (headings, list markers, fences), it goes
  through `fromMarkdown` instead.
- **HTML** is parsed by `DOMParser` into an inert document, where scripts do not run and nothing loads. The converter
  walks it and keeps only these elements, turning each into a block or a mark:
  - `p`, `h1` to `h6` (a heading level above 3 is drawn as 3), `ul`, `ol`, `li`, `blockquote`, `pre`, `code` and `hr`
  - `b`, `strong`, `i`, `em`, `s`, `del` and `a`
  - Every other element contributes its text only.
  - No attribute is kept except a link's checked `href`.
- **Paste respects `blocks`.** A block type the field does not allow becomes a paragraph.

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
4. **Later:**
   - images as app files
   - mentions of people or records
   - a `/` command menu
   - tables
   - comments anchored to text
   - character-level merging (T5, with the statenet direction)

Each stage follows the component checklist in `CLAUDE.md`. T2 is the largest. Its browser tests drive real key
presses, paste and composition events in Chromium. Safari and Android keyboards differ in their `beforeinput` events,
so T2 also includes a manual check on both before it is called done.

## Decisions

- The value is block JSON: a keyed map of blocks with fractional `order` and runs of marked text, not a Markdown string
  (owner, 2026-11-21).
- We build the editor ourselves. Lexical (about 22 KB gzipped) and ProseMirror (about 80 KB) would each bring their own
  document model, which would have to be translated to and from state on every edit.
- Lists are flat blocks with an indent, so every block is one path and one unit of conflict.

## Rules and Constraints

- No `innerHTML`, `outerHTML` or `insertAdjacentHTML`. The DOM is built with element calls and `textContent`, and pasted
  HTML is read from an inert `DOMParser` document, never inserted.
- No attribute other than a checked link `href` survives paste. Links are only `https:`, relative in-app targets or `#`
  fragments.
- Block keys and every other key in the value are never integer-like. The value is stored as `json`, never `jsonb`.
- Selection, history and the toolbar's state live in `$.runtime` and never sync.
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
