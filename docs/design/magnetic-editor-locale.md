# An app's languages, by hand in the editor

Status: designed; decisions accepted (owner, 2026-11-27: "Accept all"); nothing is built

Asked for on 2026-11-26: "it would be good for you to articulate the editor like a human would and see if you can do
everything you need to make an app. Screens, Theme, Statenet, Logic, and even Locale"

Asked for on 2026-11-27: "Ok, let's get through L7 quickly, and then do these 6 items". Item 3 of the six was the
Locale view.

The walk of 2026-11-26 is recorded in [magnetic-editor-by-hand.md](magnetic-editor-by-hand.md); its Locale row reads
"no control at all". [magnetic-editor-links-and-presses.md](magnetic-editor-links-and-presses.md) left the by-hand
spec's Locale step as `test.fixme` and named `SUI-LOCALE-LINKED` as the rule this feature inherits.

## Summary
A person, without the agent, gives their app more than one language. A fifth editor view, **Locale**, beside Screens,
Statenet, Theme and Logic, holds it:

- the app's **languages**, each with how many of its texts are translated and how many are missing, with **Add a
  language** and **Remove**;
- the app's **default language**: the language its own texts are written in;
- every **text** of the app (each unlinked `_` property of the app node and of every screen that holds a string), with
  its translation in the language chosen, filtered by screen and by "only missing", each translation a field that
  saves as it is left;
- **Show the app in**: the language the board shows the app in, and a button that opens the run page in it.

The inspector gains a **Translations** section under each unlinked text field: one field per language of the app.

Every write goes through the person's own tools with the revision the page holds: `ui_locale_write` for translations,
`ui_app_configure` for the default language. The validator stays the judge.

Two library stages come first. stateui-app has no base language for an assembled app, stateui-mcp cannot set one, no
check refuses an overlay in the base language, and a base language other than `en` loses the components' built-in
texts (LC0). stateui-mcp does not carry the app node's translations when a part of the app node moves or goes, one
stale overlay path refuses every write of the app, and its board view cannot switch language (LC1).

The by-hand spec's last `test.fixme`, "Locale: a second language is added, a label translated, and the app shown in
it", is turned on at LC5.

## Where things stood
Checked in the code on 2026-11-27.

- **Content is unkeyed.** A text is any property whose name starts with one `_` (`isContentKey`, stateui-app
  `src/core/locale/extractBaseOverlay.ts`). A node holds its text in the base language; there are no message keys.
- **A translation is a sparse overlay of one tree.** An app part holds `locales.<code>` for the app node and
  `screens.<name>.locales.<code>` for each screen, paths relative to the tree (`root.children.title._text`). Switching
  language applies the overlay of each root (`switchLocale`) and sets `$.locale`. Its writes carry origin `locale`, so
  they are never sent as changes and logic never runs for them.
- **A linked text is data.** An overlay may not set a linked property (`SUI-LOCALE-LINKED`). `extractBaseOverlay`
  skips linked paths, `on` and arrays.
- **The library's components bring their own texts** in `de`, `es` and `fr` (113 of 131 components). The language set
  of a mounted app is the union of the app's codes and the component overlay codes, minus the base
  (`registerLocaleStep`, `src/dom/locale/localeStep.ts`). So every app already switches to `de`, `es` and `fr`, with
  the components' built-in texts translated and the app's own texts in the base language.
- **The base language gets no component overlay.** `overlaysOf` (`localeStep.ts`) builds the base language's overlay
  from `extractBaseOverlay` of the tree only and gives `buildAppOverlay` (the component overlays) only to the other
  codes. With a base of `de`, the components' own texts (placeholders, empty states, button texts) stay in their
  English defaults, and English is offered only when the app has an `en` overlay.
- **An assembled app has no base language.** `AppDocument.locale` exists, but `BLUEPRINT_KEYS` in
  `src/core/blueprint/read.ts` has no `locale` and `assembleApp` copies only `locales`, so every app runs with
  `DEFAULT_LOCALE = 'en'` (`src/dom/mount/mountApp.ts`). No tool sets it; `ui_app_configure` (`ConfigureApp.ts`) takes
  `title`, `uses`, `start`, `ephemeral` and `screens`.
- **`ui_locale_write` writes one language of one tree** (`screen: "app"` or a screen name), 1 to 50 `set` or `remove`
  operations on paths that start with `root`. An overlay left empty is removed, and `locales` with it. The whole app
  is checked; `SUI-LOCALE-CONTENT`, `-PATH` and `-LINKED` refuse the write, and `SUI-LOCALE-MISSING` and `-MORE` come
  back as warnings (`WriteLocale.ts`). It checks the code with `LANGUAGE.test` only and knows no base language, so
  nothing refuses an overlay in the default language; `registerLocaleStep` drops it silently
  (`codes.delete(baseLocale)`). There is no "add a language": a language exists once one text is translated.
- **`ui_app_configure` answers** `configured`, `not-found`, `conflict`, `nothing-to-change`, `missing-parts` or
  `invalid` with catalog codes; its nothing-to-change guard lists its five fields.
- **Four patterns match a language code.** stateui-mcp `/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/`, the runtime protocol
  `/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/`, `scanLibrary`'s `LOCALE_CODE` (`/^[a-z]{2,3}(?:-[A-Za-z0-9]+)*$/`, for the
  code in a component's locale file name) and the runtime bundle's `OVERLAY_FILE` (lowercase subtags only).
- **`splitDocument` drops the base language.** stateui-app `src/core/convert/splitDocument.ts` (used by stateui-mcp
  `config/convertDataDir.ts`) carries `document.locales` into the blueprint, not `document.locale`.
- **A screen node write carries its translations; an app node write does not.** `carryOverlays` runs for screen
  writes in `WriteNodes.ts`. The document validator checks every overlay path (`validateDocumentLocales`), so removing
  a translated part of the app node is refused with `SUI-LOCALE-PATH` until the translation goes.
- **One stale overlay path blocks every write of the app.** Every app write, `ui_locale_write` included, runs
  `checkPartApp` over the whole app, and `validateDocumentLocales` checks every overlay of every tree and language. The
  tools cannot store a stale path (the write that would make one is refused, and a screen's overlays go with the
  screen), so one arises only when the tree resolved from parts changes under stored overlays: a library component's
  property renamed or removed, or a part with its own revision (a composed component, a pattern) changing. Then every
  write of the app is refused, node writes included, and a removal of one stale path is refused for the others.
- **The board shows the app in the editor's own language.** `LiveView` (stateui-mcp `src/browser/host.ts`) takes the
  language from `?locale=` or `body[data-locale]`, which the shell sets from the person's "Appearance and language".
  `LiveView` has no public way to switch language; `PageView.view({ locale })` exists only for in-page panels.
- **The run page shows Magnetic's languages only.** `GET /apps/<id>` is served by `ownAppPage` → `appShellPage` →
  `shellPage` (`src/http/shell.ts`, `data-locale="${options.look.language}"`). Its `look` is `lookOf`:
  `preferences.read(userId, accept-language)`, the signed-in person's saved language or `languageOf` of the header,
  which answers only a language Magnetic speaks (`en`, `de`, `fr`, `es`). A `pt-BR` visitor gets `en` even when the
  app has `pt-BR`; another language is reached only through `?locale=`. (`src/http/appPage.ts` draws Magnetic's own
  pages, not the run page.)
- **Missing translations are known only to the tools.** `validateDocumentLocales` never reports `SUI-LOCALE-MISSING`;
  stateui-mcp's validator does, with the component overlays.
- **Editor views are wired in eight places** (`EditorApp.ts` `EDITOR_VIEWS`, `EDITOR_PANES`, `canvasPages`; `shell.ts`
  `PLACED_PAGES`; `startMagnetic.ts` `EDITOR_PAGES` and `SitePages`; `views.ts`; `viewRoutes.ts`; `text.ts`;
  `AgentTurns.ts` `CONTEXT_TOGGLES` and its `reads`). `views.ts` lists views by name in `VIEWS`, `PAGE_APPS`,
  `PAGE_HIDDEN`, `THEME_OWN`/`LOGIC_OWN`, `showSelector`'s `noBoard`, `setView`'s `leavePage` and `fromGraph` tests,
  `load()`, `pageWrite`, `viewHeard` and `takeViewPages`, written for Theme and Logic.
- **A text may be a content map.** `extractBaseOverlay` takes a content property whole, so `_errors` (an object of
  texts) comes back as one object, beside string leaves such as `options.<key>._label` and `placement._tab`.
- **The inspector edits the base text only.** `fieldsOf` (`src/http/inspect.ts`) draws a content property as a
  `textField` `prop<i>`; a linked one as `linkedLine`. The key `inspect.notTranslated` exists.
- **Magnetic's own pages use the same mechanism** (`src/stateui/localize.ts` `writeLocales`, 50 operations per call).

## The design

### Where the controls sit
The Locale view is a canvas page like Theme and Logic, placed with `VIEW_PLACEMENT`. Top to bottom:

1. The status line and the refusal alert, and Back to Statenet when the view was opened from it (as Theme).
2. **Languages.** A list, one row per language: its name (from `Intl.DisplayNames` in the editor's language), its
   code, "{count} of {total} translated", and for the default language "Default" in place of the count. Each row that
   is not the default has **Translate** (picks it in step 4) and **Remove**. Under the list, **Add a language**: a
   choice of the Decision 9 list minus the default and the languages the app or the page already holds, an "Another
   code" field when that is chosen, and Add. A typed code equal to the default is refused in words before sending
   (`views.locale.isDefault`).
   When the app has stale paths (see Where things stood), a line "{count} translations name texts that are gone" with
   **Remove them** sits above the list.
3. **Default language.** One choice: "The app's texts are written in". It offers the current default (with "(not set)"
   while the app has none), the page-held added languages, and the Decision 9 list, minus every language that holds
   translations (see Decisions 3). A language chosen here that was page-held leaves the languages list and becomes
   the Default row; the old default, which holds no overlay, leaves the list.
4. **Texts.** Three choices on one line each: the language to translate into (the app's and the page-held languages,
   never the default), Where (All, The app node, each screen by title), and "Only missing". Then a list of the texts:
   each row is a small line "{where} · {part}", the text in the default language, and a field with its translation,
   labelled "{part} in {language}". An empty field shows the component's own translation as its placeholder when the
   library has one. Such a row counts as translated in the counts and is hidden by Only missing, since a visitor sees
   it translated. A line under the list says how many linked texts follow their data (`inspect.notTranslated`'s
   wording). Past 100 rows, **Show more**. An empty list says which of three things holds: the app has no texts, every
   text is translated (Only missing on), or no language besides the default exists yet.
5. **Show the app in.** One choice: the default, the app's languages and the library's (`de`, `es`, `fr`), a library
   language the app lacks named "{name} (built-in texts only)". **Show on the board** switches to the Screens view with
   the board in that language. **Open the run page** opens `/apps/<id>?locale=<code>` in a new tab.

A translation saves when its field is left or after a pause in typing (`TEXT_SAVE_MS`, as the inspector). Clearing a
field removes the translation.

Adding a language writes nothing. The language is held by the page, shown with "Saved with its first translation",
and becomes part of the app when its first text is saved (see Decisions 4).

### The page (`src/locale/LocalePage.ts`)
`LOCALE_APP = 'magnetic-locale'`, one record `$.data.locale` (model `magnetic-locale`, scope `person`), themed, with
`de`, `es` and `fr` overlays from `writeLocales`, as `ThemePage.ts`. The record's fields:

`status`, `refusal`, `noRefusal`, `refusalOpen`, `noBack`, `languages` (rows `{ id, code, name, count, isDefault,
notDefault, saved }`), `stale` (the count line), `noStale`, `addOptions`, `newLanguage`, `otherLanguage`, `noOther`,
`defaultLanguage`, `defaultOptions`, `language`, `languageOptions`, `where`, `whereOptions`, `onlyMissing`, `rows`
(rows `{ id, where, part, base, value, label, placeholder, shown }`), `noRows`, `empty` (the one empty-list text the
page script picks: `views.locale.noTexts`, `allDone` or `noLanguages`), `more`, `noMore`, `linked`, `preview`,
`previewOptions`.

`addOptions` and `languageOptions` never hold the default.

Rows are arrays with an `id` (`<tree>:<path>`, never integer-like), as the Theme view's `tokens`.

`LOCALE_HEARING` (static ids, all required by the page contract):

| Id | Control | Event | Heard as |
|---|---|---|---|
| `back` | Back to Statenet | press | `back` |
| `refused` | the refusal alert | close | `dismiss` |
| `newLanguage` | Add a language: the choice | change | `keep: $.data.locale.newLanguage` |
| `otherLanguage` | Another code | change | `keep: $.data.locale.otherLanguage` |
| `addLanguage` | Add | press | `addLanguage` |
| `languageTranslate` | Translate (row) | press | `translate`, from `row` |
| `languageRemove` | Remove (row) | press | `removeLanguage`, from `row` |
| `removeStale` | Remove them | press | `removeStale` |
| `defaultLanguage` | Default language | change | `setDefault` |
| `language` | Translate into | change | `pickLanguage` |
| `where` | Where | change | `pickWhere` |
| `onlyMissing` | Only missing | change | `pickMissing` |
| `translationValue` | a translation (row) | change | `translation`, from `row`, merge `value` |
| `moreRows` | Show more | press | `more` |
| `previewLanguage` | Show the app in | change | `keep: $.data.locale.preview` |
| `previewBoard` | Show on the board | press | `previewBoard` |
| `previewRun` | Open the run page | press | `previewRun` |

No URL is in the page. `previewRun` is heard by the page script, which opens the address.

### The inspector's Translations
Under each unlinked string content field of the selected part, when the app, the page or the board has a language
besides the default: a heading "Translations" and one `textField` per language, labelled with the language's name,
holding the translation or empty, with the component's translation as placeholder. The languages are the app's (from
`/node`) merged with those the shell holds: the Locale page's added languages (the shell holds them beside
`previewLocale`, so a language added in the view has a field before its first translation) and the board's
`previewLocale` when it is a library language the app lacks. Saving such a field creates the language. Ids `tr<i>_<n>` (property `i`, language `n`), dynamic and matched in
`onRaised` as `prop<i>` is; they are not part of the page contract. A change saves through `POST views/locale` with the
debounce of `saveProperty`. A linked text shows `inspect.notTranslated` and no fields. When the board shows another
language than the default, that language's field comes first and the base field's label says it holds the default
language ("Title (English)").

The inspector's Undo does not cover translations (see Not built).

### Showing another language
- **The board.** The shell holds `previewLocale` (initially none, meaning the editor's language as today). Show on the
  board sets it, calls `LiveView.view({ locale })` on the board's live app (stage LC1) and shows the Screens view. A
  line on the board's top bar, "Shown in {language}" with **Back to {default}**, says it while it differs from the
  default. It is not kept across a reload.
- **The run page.** `/apps/<id>?locale=<code>`: the host reads the address before `data-locale`. Without `?locale=`,
  `shellPage` sets `data-locale` from `lookOf`, so a visitor sees the app in their Magnetic language (`en`, `de`,
  `fr` or `es`) when the app or the library has it, else in the default. A visitor whose browser asks for another
  language the app has (`pt-BR`) still gets their Magnetic language (see Not built and Decision 11).

### Phone and width
- The view is drawn in the narrow layout `VIEW_PLACEMENT` gives below 760px. Every row of every list is stacked: one
  field per line, labelled buttons, touch targets of at least 44px.
- The texts are a list, not a table, so a row reads the same at 320px and at full width.
- The language, Where and Only missing choices are full width on a phone.
- The inspector's Translations are one field per row in the 320px panel and in the phone sheet.
- Show on the board works on a phone; the board's top-bar line wraps to two lines.

### Routes
All under `/edit/<id>/views`. Answers hold data, never words. Every POST takes `revision`, answers 400 without one and
409 on a mismatch, and answers `appRevision`. It is reported as `'Editor view changed'` with `{ app, view }`; no text
is logged.

- **`GET locale`** (new): reads `documentOf(place)` and the app part's body (`appNow(place)`). Rows come from
  `extractBaseOverlay` of each tree with its linked paths, string leaves only: a content map (`_errors`) is left out
  (see Not built). Values come from the body's overlays. `library` is the catalog's `locales`. `stale` lists overlay
  paths, of every tree and language, whose base text is gone (so the person can remove them).

  ```json
  { "revision": 41, "locale": "en", "localeSet": false,
    "languages": [ "de" ], "library": [ "de", "es", "fr" ],
    "trees": [ { "tree": "app", "title": "" }, { "tree": "home", "title": "Home" } ],
    "rows": [ { "tree": "home", "path": "root.children.title._text", "node": "$.screens.home.children.title",
                "part": "title", "component": "heading", "property": "_text", "base": "Orders",
                "values": { "de": "Bestellungen" }, "library": { } } ],
    "linked": 2,
    "stale": [ { "tree": "app", "language": "de", "path": "root.toasts.old._text" } ] }
  ```

  `locale` is the app's default, `en` with `localeSet: false` when the part has none. `part` is the node's `@id` or
  key. `library` per row is the component's own translation of that property by language, when the node's text still
  equals the component default (what `buildAppOverlay` would apply). A row with a `library` text for a language
  counts as translated in that language.
- **`POST locale`** (new), one of four bodies:
  - `{ revision, language, writes: [ { tree, op: "set" | "remove", path, value? } ] }`: 1 to 50 writes of one tree,
    one `ui_locale_write` with `expectedRevision: revision`. The grid and the inspector send one write at a time. A
    `language` equal to the app's default answers 400 before any tool call.
  - `{ revision, language, remove: true }`: removes the language. The route reads the overlays and calls
    `ui_locale_write` once per tree that holds the language, with a `remove` of each path it holds (stale paths
    included), in chunks of 50, each at the revision the previous call answered. It answers the last `appRevision`.
  - `{ revision, removeStale: true }`: the route reads the stale paths and sends their `remove` writes per tree and
    language, in chunks of 50, chained by revision as removing a language is. It relies on LC1's rule that stale paths
    a write does not add do not refuse it.
  - `{ revision, default: "de" }`: `ui_app_configure` with `locale` (stage LC0). `SUI-LOCALE-BASE` maps to
    `views.locale.refused.default`.
- **`GET /node`** (changed, `inspectRoute`): adds `languages` (the app's, default first) and `translations`
  (`{ <property>: { <code>: text } }` for the selected node's content properties).

The page's one revision holds: `views.ts` adds `locale` to `writesApp()`, so every write goes through `change()` and
`shell.write`; the inspector's translation writes go through `shell.write` too.

### Validation
The tools are the only judge. `ui_locale_write` refuses `SUI-LOCALE-CONTENT`, `SUI-LOCALE-PATH` (a path the write
adds; LC1), `SUI-LOCALE-LINKED`, `SUI-LOCALE-BASE` and a bad code (`invalid-language`). `ui_app_configure` refuses a
bad default with `SUI-BLUEPRINT-SHAPE` (the blueprint reader, path `$.locale`) and a default that holds translations
with `SUI-LOCALE-BASE`, both as `invalid` (LC0). `SUI-LOCALE-BASE` is the one new catalog code: the document
validator judges it, so both tools refuse it through one check. No choice the editor offers is one of those: it lists
only unlinked content paths, never offers the default as a language to translate into or a translated language as
the default, and checks a typed code against the one pattern before sending.

`SUI-LOCALE-MISSING` and `SUI-LOCALE-MORE` come back on every translation write; the view does not show them as status,
since its own counts say what is left. A refusal (400) shows the first blocking error in the status line, in words for
`SUI-LOCALE-PATH` (`views.locale.refused.path`, naming the path) and `SUI-LOCALE-LINKED`
(`views.locale.refused.linked`); any other shows the catalog message. A conflict (409) reads again and shows
`views.changedElsewhere`. Error messages name paths and codes, never texts.

Removing a language asks `confirm` with its name and how many translations go (`views.locale.removeConfirm`).

### Changes by file (when built)
- stateui-app (LC0): `src/core/blueprint/read.ts` takes `locale` (`SUI-BLUEPRINT-SHAPE` for a bad code);
  `src/core/blueprint/types.ts` (`AppBlueprint.locale`); `src/core/assemble/assembleApp.ts` copies it to
  `document.locale`; `src/core/convert/splitDocument.ts` copies `document.locale` to the blueprint; one exported
  `LANGUAGE_CODE` in `src/core/locale/` used by the blueprint reader, the document check, `runtime/validate.ts` and
  `scanLibrary` (its `LOCALE_CODE` goes: a component's locale file names a language like any other, and a looser
  pattern there would let the library ship a code no app can use). `src/core/locale/documentValidator.ts` refuses an
  overlay whose code equals `document.locale`, at `$.locales.<code>` or `$.screens.<name>.locales.<code>`, with
  `SUI-LOCALE-BASE` ('Overlay "{locale}" is in the app\'s default language at {path}'), added to
  `src/core/errors/catalog.ts`. `src/dom/locale/localeStep.ts` `overlaysOf` builds the base language's overlay as
  the components' overlay of that code (`buildAppOverlay`, which applies only where a node's text still equals the
  component default) under the tree's own texts (`extractBaseOverlay`), so a `de` app shows the components' German
  texts. README, CHANGELOG, tests.
- stateui-mcp (LC0): `WriteLocale.ts` and the `LOCALE_WRITE` schema use `LANGUAGE_CODE`; `ConfigureApp.ts` and
  `ui_app_configure` take `locale`, and `locale` alone passes the nothing-to-change guard. The check after the write
  refuses a default that holds translations (`SUI-LOCALE-BASE`, `invalid`). `test/toolSet.test.ts` size cap checked.
- stateui-mcp (LC1): `WriteNodes.ts` runs `carryOverlays` for app node writes. `WriteLocale.ts` compares the
  `SUI-LOCALE-PATH` errors after the write with those before: one the write does not add comes back as a warning, not
  a refusal, so a translation saves and stale paths are removed one tree and language at a time while others remain.
  `src/browser/host.ts` `LiveView` gains `view({ locale })`, which posts `{ type: 'locale' }` to its frame as a server
  message does. README, CHANGELOG.
- magnetic `src/locale/LocalePage.ts` (new) and its test; `src/editor/EditorApp.ts` (`EDITOR_VIEWS`, `EDITOR_PANES`,
  `canvasPages`); `src/http/shell.ts` (`PLACED_PAGES`, `previewLocale`, the page-held languages, the board line);
  `src/server/startMagnetic.ts` (`EDITOR_PAGES`, `SitePages`, `/node` additions); `src/server/viewRoutes.ts`
  (`GET locale`, `POST locale`).
- magnetic `src/http/views.ts`: `VIEWS`, `PAGE_APPS` and `PAGE_HIDDEN` gain `locale`; a `LOCALE_OWN` beside
  `THEME_OWN`/`LOGIC_OWN`; `noBoard`, `setView`'s `leavePage` and `fromGraph` tests, `load()`, `pageWrite`,
  `viewHeard` and `takeViewPages` become a set or map by view name (Theme, Logic, Locale); `loadLocale`,
  `localeHeard`; `contextOf` answers `['locale']`.
- magnetic `src/http/inspect.ts`: the Translations section, `tr<i>_<n>` in `onRaised`, `saveTranslation`.
- magnetic `src/agent/AgentTurns.ts`: `'locale'` in `CONTEXT_TOGGLES` and a `reads.locale` reader, with a line telling
  the agent the person is in the Locale view and which language they translate.
- magnetic `src/http/text.ts`: the keys below in `EN`, `DE`, `FR`, `ES`.
- Docs: `magnetic-show-views.md` gains a Locale section; `magnetic-editor-by-hand.md`'s Locale row and Gaps bullet
  follow each stage; the spec's Locale gap comment goes when LC5 turns it on.

### Texts (`src/http/text.ts`)
The translations are a draft for the owner to read. Language names are not keys: `Intl.DisplayNames` gives them in the
editor's language.

| Key | EN | DE | FR | ES |
|---|---|---|---|---|
| shell.view.locale | Locale | Sprachen | Langues | Idiomas |
| views.locale.languages | Languages | Sprachen | Langues | Idiomas |
| views.locale.translated | {count} of {total} translated | {count} von {total} übersetzt | {count} sur {total} traduits | {count} de {total} traducidos |
| views.locale.default | Default | Standard | Par défaut | Predeterminado |
| views.locale.unsaved | Saved with its first translation | Wird mit der ersten Übersetzung gespeichert | Enregistrée avec sa première traduction | Se guarda con su primera traducción |
| views.locale.translate | Translate | Übersetzen | Traduire | Traducir |
| views.locale.remove | Remove | Entfernen | Retirer | Quitar |
| views.locale.removeConfirm | Remove {name} and its {count} translations? | {name} und seine {count} Übersetzungen entfernen? | Retirer {name} et ses {count} traductions ? | ¿Quitar {name} y sus {count} traducciones? |
| views.locale.add | Add a language | Sprache hinzufügen | Ajouter une langue | Añadir un idioma |
| views.locale.other | Another code | Anderer Code | Autre code | Otro código |
| views.locale.otherHint | A code such as pt-BR | Ein Code wie pt-BR | Un code comme pt-BR | Un código como pt-BR |
| views.locale.codeShape | A language code has 2 or 3 letters, then parts such as -BR | Ein Sprachcode hat 2 oder 3 Buchstaben, dann Teile wie -BR | Un code de langue a 2 ou 3 lettres, puis des parties comme -BR | Un código de idioma tiene 2 o 3 letras y luego partes como -BR |
| views.locale.addButton | Add | Hinzufügen | Ajouter | Añadir |
| views.locale.writtenIn | The app's texts are written in | Die Texte der App sind geschrieben auf | Les textes de l'app sont écrits en | Los textos de la app están escritos en |
| views.locale.notSet | {name} (not set) | {name} (nicht festgelegt) | {name} (non défini) | {name} (sin definir) |
| views.locale.texts | Texts | Texte | Textes | Textos |
| views.locale.into | Translate into | Übersetzen nach | Traduire en | Traducir a |
| views.locale.where | Where | Wo | Où | Dónde |
| views.locale.all | All | Alle | Tout | Todo |
| views.locale.appNode | Every screen (the app) | Jeder Bildschirm (die App) | Chaque écran (l'app) | Cada pantalla (la app) |
| views.locale.onlyMissing | Only missing | Nur fehlende | Seulement les manquants | Solo los que faltan |
| views.locale.row | {where} · {part} | {where} · {part} | {where} · {part} | {where} · {part} |
| views.locale.translationOf | {part} in {language} | {part} auf {language} | {part} en {language} | {part} en {language} |
| views.locale.noTexts | This app has no texts to translate yet | Diese App hat noch keine Texte zum Übersetzen | Cette app n'a pas encore de textes à traduire | Esta app aún no tiene textos que traducir |
| views.locale.allDone | Every text is translated | Jeder Text ist übersetzt | Tous les textes sont traduits | Todos los textos están traducidos |
| views.locale.noLanguages | Add a language to translate the app's texts | Füge eine Sprache hinzu, um die Texte der App zu übersetzen | Ajoutez une langue pour traduire les textes de l'app | Añade un idioma para traducir los textos de la app |
| views.locale.linked | {count} linked texts follow their data and are not translated here | {count} verknüpfte Texte folgen ihren Daten und werden hier nicht übersetzt | {count} textes liés suivent leurs données et ne sont pas traduits ici | {count} textos vinculados siguen sus datos y no se traducen aquí |
| views.locale.stale | {count} translations name texts that are gone | {count} Übersetzungen nennen Texte, die es nicht mehr gibt | {count} traductions nomment des textes disparus | {count} traducciones nombran textos que ya no existen |
| views.locale.removeStale | Remove them | Entfernen | Les retirer | Quitarlas |
| views.locale.libraryOnly | {name} (built-in texts only) | {name} (nur eingebaute Texte) | {name} (textes intégrés seulement) | {name} (solo textos integrados) |
| views.locale.isDefault | {name} is the default language | {name} ist die Standardsprache | {name} est la langue par défaut | {name} es el idioma predeterminado |
| views.locale.more | Show more | Mehr zeigen | Afficher plus | Mostrar más |
| views.locale.showIn | Show the app in | App zeigen auf | Afficher l'app en | Mostrar la app en |
| views.locale.showBoard | Show on the board | Auf der Fläche zeigen | Afficher sur le plan | Mostrar en el tablero |
| views.locale.openRun | Open the run page | Laufende App öffnen | Ouvrir la page de l'app | Abrir la página de la app |
| views.locale.saved | Saved | Gespeichert | Enregistré | Guardado |
| views.locale.refused.path | A translation names a text that is gone: {path} | Eine Übersetzung nennt einen Text, den es nicht mehr gibt: {path} | Une traduction nomme un texte disparu : {path} | Una traducción nombra un texto que ya no existe: {path} |
| views.locale.refused.linked | A linked text is not translated: {path} | Ein verknüpfter Text wird nicht übersetzt: {path} | Un texte lié n'est pas traduit : {path} | Un texto vinculado no se traduce: {path} |
| views.locale.refused.default | {name} has translations; remove them before making it the default | {name} hat Übersetzungen; entferne sie, bevor sie Standard wird | {name} a des traductions ; retirez-les avant d'en faire la langue par défaut | {name} tiene traducciones; quítalas antes de hacerlo predeterminado |
| shell.shownIn | Shown in {language} | Gezeigt auf {language} | Affiché en {language} | Mostrado en {language} |
| shell.backToDefault | Back to {language} | Zurück zu {language} | Revenir à {language} | Volver a {language} |
| inspect.translations | Translations | Übersetzungen | Traductions | Traducciones |
| inspect.inDefault | {label} ({language}) | {label} ({language}) | {label} ({language}) | {label} ({language}) |

The word for the board follows the existing `shell.*` key for it when built.

### Tests
stateui-app (LC0):
- `src/core/blueprint/blueprint.test.ts`: `locale` is read; a code that fails `LANGUAGE_CODE` is refused with
  `SUI-BLUEPRINT-SHAPE` at `$.locale`.
- `src/core/assemble/assemble.test.ts`: `locale` reaches `document.locale`; without it the document has none.
- `src/core/convert/` test of `splitDocument`: a document's `locale` reaches the blueprint.
- `src/core/locale/` document validator test: an overlay in the default language, of the app node and of a screen, is
  refused with `SUI-LOCALE-BASE` at its path; the catalog test holds the new code.
- `src/dom/mount/` browser test: an app with `locale: "de"` and an `en` overlay mounts with `$.locale === 'de'` and
  switches to `en`; a `locale` message for a code it lacks posts `SUI-LOCALE-UNKNOWN` and changes nothing; a
  component left at its default text (a placeholder) shows its German text under base `de`.
- One test of `LANGUAGE_CODE` that the blueprint reader, the document check, the runtime and `scanLibrary` accept
  the same codes.

stateui-mcp (LC0, LC1):
- `test/` for `ui_app_configure`: `locale` is written and read back; `locale` alone is a change (not
  nothing-to-change); refused as `invalid` with `SUI-LOCALE-BASE` with translations in that language; refused with
  `SUI-BLUEPRINT-SHAPE` for a bad code.
- `test/` for `ui_locale_write`: an overlay in the default language is refused with `SUI-LOCALE-BASE`; with stale
  paths in two trees and two languages (made by changing a library property under a stored app), a translation in a
  third tree is written with the stale paths as warnings, a write that removes one tree's stale paths is written, and
  a write that adds a stale path is refused.
- `test/` for `ui_nodes_write` on the app node: moving and removing a translated part carries and drops its
  translation, as the screen test does; removing it is no longer refused with `SUI-LOCALE-PATH`.
- `src/browser/host` test: `LiveView.view({ locale: 'de' })` posts one `locale` message and the frame shows the
  overlay; before the frame is ready it is held and sent once.
- `test/expectedTools.ts` unchanged; `test/toolSet.test.ts` within its cap.

magnetic unit and route:
- `src/locale/LocalePage.test.ts`: `/assets/locale.json` answers 401 signed out; the screen has `de`, `es`, `fr`
  locales; `contractGaps(LOCALE, doc)` is empty; every `LOCALE_HEARING` id is in the definition.
- `src/server/viewRoutes.test.ts`: `GET locale` lists the rows of the app node and two screens, leaves out linked
  texts (counted in `linked`), `on`, arrays and a content map (`_errors`), gives values per language, `library` texts
  counted as translated, `stale` paths of two trees and languages, and `locale` with `localeSet: false`;
  `POST locale` sets a translation (a new language with it), removes one, refuses a linked path, a bad code and a
  language equal to the default (400), refuses an old revision (409), removes a language across three trees and more
  than 50 paths, removes stale paths across two trees and two languages and then saves a translation, and sets the
  default (and maps `SUI-LOCALE-BASE`); no text appears in the report.
- The page script's `addOptions` and `languageOptions` leave out the default, and `empty` holds each of its three
  texts in its state (`LocalePage.test.ts` or the view's script test).
- `src/server/inspectRoutes.test.ts`: `/node` answers `languages` and `translations`.
- `src/editor/EditorApp.test.ts`: `locale` is a view and a pane; the existing contract ids are unchanged.
- `src/server/editor.browser.test.ts`: the Locale view opens from the views control and from the narrow menu.
- `src/agent/AgentTurns.test.ts`: the `locale` toggle reaches the agent's context.

e2e (`e2e/build-by-hand.spec.ts`):
- LC5, the fixme made real, "Locale: a second language is added, a label translated, and the app shown in it": the
  Locale view's languages list shows the English row marked Default; German is added and shows "Saved with its first translation"; the
  label "Add book" (left unlinked by the links feature) is translated as "Buch hinzufügen" and the count says 1 of
  {n}; Only missing hides it; Show the app in › German › Show on the board shows "Buch hinzufügen" on the board and
  the top-bar line; Back to English shows "Add book"; Open the run page shows the German label at
  `/apps/<id>?locale=de`. `pickView` takes `'Locale'`; `localePage = () => canvasPage(page, 'Locale')`.
- LC6, in the same test: in the inspector, the label's German field holds "Buch hinzufügen"; changing it there shows
  in the Locale view. French is added in the Locale view and, before any French translation, the label's French field
  in the inspector saves "Ajouter un livre", after which French is in the languages list.
- The last test ("the app runs as it was built") still sees English at `/apps/<id>`.

e2e (`e2e/locale.spec.ts`, new, on an app made through the tools):
- LC3: a language with translations on two screens and the app node is removed after the confirm, and the app's
  languages list no longer holds it; a removed part of the app node no longer blocks a translation (LC1). With stale
  paths made by a library change under the stored app, the stale line shows, Remove them clears it, and a translation
  in that tree then saves.
- LC4: on an app with no translations, the Default language choice shows "English (not set)"; German is chosen in it
  (no Add first) and the German row becomes "Default"; German leaves Add a language and Translate into; the run page
  in an English-preferring visitor's browser shows the app's German texts and a component's built-in placeholder in
  German.
- The `phone` project walks the whole flow: Add a language with Another code (`pt-BR`), a translation typed in the
  list and one in the inspector's phone sheet, Only missing and Where, Show more, the default set on a fresh app, the
  language removed after the confirm, Show on the board, and Open the run page with `?locale=`.

## Stages
Each stage ships alone, ends in something a person can do, and updates the CHANGELOGs, this doc's As built and the
by-hand doc's table and Gaps.

| Stage | Delivers | Depends on | Turns on |
|---|---|---|---|
| LC0 | stateui-app: a blueprint's `locale`, copied to the document and kept by `splitDocument`; one `LANGUAGE_CODE`; `SUI-LOCALE-BASE`; the base language's component texts. stateui-mcp: `ui_app_configure` takes `locale`; `ui_locale_write` uses the one pattern | none | nothing in the editor; the agent may set an app's language |
| LC1 | stateui-mcp: app node writes carry translations; stale paths a write does not add only warn; `LiveView.view({ locale })` | none | app node writes that are refused today now carry translations; a stale path no longer blocks translating |
| LC2 | The Locale view, read only: `GET locale`, `LocalePage`, the wiring in eight places, languages with counts, the texts list with its filters, stale and linked lines; the agent's `locale` toggle | none | a person sees every text and what is missing |
| LC3 | Translating in the list, Add a language, Remove a language, Remove them (stale); `POST locale` sets, removes, removes a language and removes stale paths | LC1, LC2 | a person translates their app |
| LC4 | The default language choice | LC0, LC2 | a person says which language the app is written in |
| LC5 | Show the app in: the board (`previewLocale`, the top-bar line) and the run page | LC1, LC3 | the by-hand Locale fixme |
| LC6 | The inspector's Translations section; `/node` additions | LC3 | translating from the part itself |

LC0 and LC1 start with their library tests. LC2 to LC6 are Magnetic only. If a stage's test fails, the fallback is
named under Risks.

## Not built
- Placeholders and plurals in overlays (stateui-ui-builder.md §7); a translation is plain text.
- Content maps (`_errors`, an object of texts): the view lists string texts only; such a map is translated by the
  agent.
- The run page in a visitor's browser language that Magnetic does not speak: without `?locale=`, `/apps/<id>` uses the
  visitor's Magnetic language (`en`, `de`, `fr`, `es`). Passing the raw `Accept-Language`, matched against the app's
  codes, is a later stage (Decision 11).
- Stale paths blocking writes other than translations: a node or screen write stays refused while a stale path
  remains; Remove them in the Locale view is the way out.
- Translating data: option labels and cell values from `$.data`. Translated data is linked.
- Texts inside composed components (translated in the component), in arrays, and the components' built-in texts the
  app does not set. The view lists the texts the app's trees hold.
- Swapping the default with another language (writing the other language's texts into the nodes and the default's
  into an overlay).
- Marking a translation whose default text changed since it was written.
- Translating by machine or by the agent from the view; the agent is asked in chat, as for any other change.
- Undo of a translation write; a translation is changed back by typing.
- Locales in Statenet's tree (`graph`).

## Decisions
All twelve are the owner's, each with its recommendation where it gives a choice (owner, 2026-11-27: "Accept all").

1. **A view of its own, not a column in the inspector only.** "Every text and what is missing" is a list over the
   whole app, which the inspector, scoped to one part, cannot show. The inspector gets per-part fields as well (LC6).
   Recommendation: both, the view first.
2. **One language at a time in the texts list, not a column per language.** A `PageSpec` has static columns and
   hearing ids, and the page contract forbids dynamic ids. A choice of language with one translation field per row
   keeps the hearing static and reads the same on a phone. The languages list above it shows every language's count
   at once. Recommendation: as designed.
3. **The default language only names the language the texts are written in.** Changing it moves no text. A language
   that already has translations cannot become the default (the library ignores an overlay in the base language;
   LC0 refuses it with `SUI-LOCALE-BASE`). The choice offers the Decision 9 list and page-held languages, so German
   can be chosen without adding it first. Making `de`, `es` or `fr` the default would today turn off the components'
   built-in texts in that language (`overlaysOf`); LC0 lays the components' overlay of the base code under the app's
   own texts, so a `de` app shows German placeholders and empty states. The alternative is to leave `overlaysOf` and
   list it under Not built. Recommendation: fix it in LC0; a swap is a later feature if people ask.
4. **A language exists with its first translation.** `ui_locale_write` removes empty overlays, so an added language
   is held by the page until a text is saved, and is gone after a reload if none was. The alternative is a stateui-mcp
   change that keeps an empty overlay. Recommendation: hold it in the page.
5. **Removing a language is one write per tree, not one atomic write.** The route chains the calls with each answer's
   revision. An agent write between them gives a 409 with the language partly removed, which the view shows and
   Remove finishes. The alternative is a stateui-mcp tool or operation that removes a language from every tree in one
   checked write; the tool list is pinned. Recommendation: per tree now.
6. **The board's language is a preview held by the shell**, not the editor's own language and not saved. The editor's
   language stays in "Appearance and language". Recommendation: as designed, with `LiveView.view({ locale })` in LC1
   rather than reloading the board with `?locale=`, which would drop the selection and the inspector.
7. **Show the app in offers the library's languages too.** Every app already switches to `de`, `es` and `fr` for the
   components' texts. Showing them lets a person see what a visitor with that language sees. Recommendation: offer
   them, marked as having no translations of the app's own.
8. **One language code pattern** across stateui-app and stateui-mcp: primary subtag 2 or 3 lowercase letters, further
   subtags 2 to 8 letters or digits. The runtime bundle's component file pattern stays as it is (component overlays
   are lowercase files); `scanLibrary`'s `LOCALE_CODE` moves to `LANGUAGE_CODE`, since a code the library ships must
   be one an app can name. Recommendation: in LC0.
9. **Fixed list of languages to add, plus another code.** The choice lists about thirty common codes with their
   names; any other is typed and checked against the pattern. Recommendation: as designed.
10. **The agent's context toggle `locale`.** When the person asks the agent while in the Locale view, the agent is told
    the view and the language chosen, as for Theme and Logic. Recommendation: as designed.
11. **The run page's language without `?locale=`** stays the visitor's Magnetic language (`en`, `de`, `fr`, `es`). A
    stage that passes the visitor's `Accept-Language` matched against the app's codes would let a `pt-BR` visitor see
    `pt-BR`. Recommendation: Not built now; a later stage if apps ship languages Magnetic does not speak.
12. **Stale paths a write does not add only warn** (LC1). One stale path refuses every write of the app today, and no
    single `ui_locale_write` can clear stale paths in two trees or languages. LC1 changes `WriteLocale` to refuse only
    `SUI-LOCALE-PATH` errors the write adds. The alternative is a new operation that removes every stale path in one
    checked write; the tool list is pinned. Recommendation: the warning rule in `ui_locale_write` only; other tools
    keep refusing.

## Risks
Not settled by reading; each is settled by the test named, at the start of the stage that relies on it.

1. **Many texts** (LC2). A large app may hold several hundred texts; a list of that many rows with fields may draw
   slowly. Fallback: 100 rows per filter with Show more (designed in); if that is still slow, Where defaults to the
   screen shown on the board.
2. **Stale paths blocking writes** (LC1, LC3). A stale path arises only from a library or part change under a stored
   app, and then blocks every write of the app. That such a change leaves a stale path, and that LC1's rule lets
   `ui_locale_write` save past it and remove it per tree and language, is settled by the LC1 test that makes stale
   paths in two trees and two languages. Fallback: a stateui-mcp change that removes every stale path of the app in
   one checked write (a `removeStale` flag on `ui_locale_write`, the tool list unchanged).
3. **Run page `?locale=`** (LC5). The host reads the address first; that `/apps/<id>` keeps the query through
   Magnetic's routing is not run yet. Fallback: the route reads `locale` from the query into `data-locale`.
4. **`LiveView.view({ locale })` and the instance** (LC1, LC5). Locale writes carry origin `locale` and are not sent;
   that the editor's test-run instance keeps no translated labels after switching back is not run with the board.
   Fallback: Back to the default reloads the board.
5. **A visitor's language the app lacks** (LC4). With default `de` and an English-preferring visitor, `shellPage`
   sets `data-locale="en"`, the runtime posts `SUI-LOCALE-UNKNOWN` and stays in German. That this shows nothing to
   the visitor is not checked. Fallback: `appShellPage` sets `data-locale` only when the app or the library has the
   language, else the app's default.
6. **The base field and the board disagree** (LC6). With the board in German, the inspector's base field holds
   English. The label "(English)" and the German field first are the answer; an e2e step holds it.
7. **Redraw while typing** (LC3). The view reloads on a new revision; `editing()` and `reloadLeft` wait until the field
   is left, as in the Theme view. A translation saved by its own debounce must not redraw the field under the cursor.
8. **The tool's warnings on every write** (LC3). Each translation write returns up to 51 `SUI-LOCALE-MISSING` and
   `-MORE` warnings. The view ignores them; the route passes only blocking errors and other warnings on.
9. **The page plumbing made general** (LC2). `pageWrite`, `viewHeard` and `takeViewPages` move from two names to a map;
   the Theme and Logic e2e tests guard the change.

## Rules and Constraints
- People write JSON through the tools only: translations through `ui_locale_write`, the default through
  `ui_app_configure`, each with the revision the page holds. No route writes an app part directly.
- Every write of the page goes through `shell.write` with the one revision the shell holds.
- A translation is content only: never a linked property, never data. `$.data` and `$.theme` are not translated.
- Language codes match the one `LANGUAGE_CODE` pattern. Vocabularies, commands and error codes stay closed lists;
  this feature adds one error code, `SUI-LOCALE-BASE`, in the one catalog, and no command. Error messages name paths
  and codes, never texts.
- An overlay never holds the default language: the document validator refuses it, the editor never offers it.
- No text, translation or state value is logged; a POST is reported with the app and the view only.
- The Locale page is driven only through `$.data.locale` and the reports of nodes with an `@id`, heard through
  `raised.ts`; its ids are static and required. The inspector's `tr<i>_<n>` ids are dynamic fields of its panel and
  not part of the page contract. No URL, script, `on*` attribute or `innerHTML` in a page; texts are set as text.
- Rows are arrays keyed by `id`; no generated key is integer-like.
- Removing a language is confirmed with its name and count. A single translation is removed by clearing its field.
- Every control works in the 320px panel, the narrow view and the phone sheet: one field per row, labelled buttons.
- Every text exists in English, German, French and Spanish; server answers hold data, never words.
- No backwards compatibility: the language patterns are replaced by one, not kept beside it.
- Each stage carries CHANGELOG entries with the covering test, and the docs describe the code as it then is.

## As built
Nothing is built.
