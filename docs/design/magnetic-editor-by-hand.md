# Building an app by hand in the editor

Status: recorded (a check of what exists, with the small bugs it found fixed; links, data and presses are built by
[magnetic-editor-links-and-presses.md](magnetic-editor-links-and-presses.md) L0 to L7; Locale is not built)

Asked for on 2026-11-26: "it would be good for you to articulate the editor like a human would and see if you can do
everything you need to make an app. Screens, Theme, Statenet, Logic, and even Locale"

## What was done
A person with no agent builds a "Reading list" app with the editor's own controls, mouse and keyboard only, and opens
it on its run page. The walk is kept as a test: magnetic `e2e/build-by-hand.spec.ts` (desktop; the phone project skips
it). A step the editor cannot do is a `test.fixme` in the spec that names the gap.

## What a person can do

| Area | Step | By hand |
|---|---|---|
| Screens | Make the app; place parts from the library; edit text, labels and looks in the inspector | yes |
| Screens | Move a part (Alt+Arrow), delete it, add and rename a screen, set the home screen | yes |
| Screens | Go from one screen to another | yes: a button's "When pressed" > Go to a screen, or a `link`'s Screen |
| Screens | Say what a press or another event does: set a value, switch it, show or hide a part, tell a part to act | yes: the "When …" sections of the inspector |
| Theme | Make a theme from a preset, set a token for all modes and for one, make it the default | yes |
| Statenet | Make a model with fields of several types, remove a field | yes |
| Statenet | Make a dataset with a first record, add and edit records | yes |
| Statenet | Bind the dataset to the app | done when the dataset is made from the + of `$.data`; the name cannot be chosen |
| Statenet | Link a property to state: a field to the row chosen in a list, a text to another part | yes: Link beside each property |
| Statenet | Show a dataset in a list or a table, choose what each row shows and which columns | yes: the inspector's Data section |
| Logic | Make a rule, move it to the browser, delete it | yes; its body is typed as JSON |
| Logic | Have a press save a record | yes: When pressed > Save a record writes the rules |
| Logic | Show a count, a sum or an expression on a text | yes: Shows a computed value on the text's Text writes the rule |
| Locale | Add a language, translate a label, switch | no control at all |

## Gaps
- **Locale.** "Appearance and language" sets the editor's language. An app's locales are written only by the agent
  (`ui_locale_write`) and are not in Statenet (`graph`, `src/server/viewRoutes.ts`). It needs a view beside the other
  four. The label it translates must be an unlinked one: a linked text is not translated (`SUI-LOCALE-LINKED`).
- **Smaller.** A taken theme name is refused in the agent's words (`changeTheme`, `src/server/viewRoutes.ts`); the
  inspector keeps showing a part of the screen just left; the dataset panel labels records by generated keys; a new
  person's Statenet lists Magnetic's own page models beside theirs; a rule that fails says so only in
  `/edit/<id>/trace`. A rule or machine other than a save or a computed value is typed as JSON (`unitEditor`,
  `src/http/views.ts`).
- **Library.** stateui-app `src/dom/theme/tokenStep.ts` puts base tokens over the mode overlay at mount and the
  overlay over them on a live mode switch.

## Decisions
- The gaps are listed, not built here: each is a feature with its own design. Links and on-press were the first
  chosen (owner, 2026-11-27) and are built by magnetic-editor-links-and-presses.md.
- The spec keeps the unbuilt steps as `test.fixme`, so it shows what the editor can do as it changes.

## As built
Bugs the walk found, fixed in magnetic with CHANGELOG entries:
- A press on the app leaves the inspector's field, so Delete and Alt+Arrow reach the part (`leaveField`,
  `src/http/inspect.ts`).
- A screen just added shows on its card; parts placed land on it (`src/http/screens.ts`).
- A renamed screen is titled from its name (`src/server/startMagnetic.ts`; `src/server/inspectRoutes.test.ts`).
- A model's new field reaches the new-dataset form; a token set for one mode keeps the others; a theme just made
  stays shown (`src/http/views.ts`).
- A model's field type is written only when it changes, one write at a time; a change made elsewhere is said in the
  person's words and read again; the views' notice closes; a new theme's and unit's name comes from a field of the
  page, not a browser prompt; the library's search ranks the name typed first (`src/http/libraryRank.ts`).
