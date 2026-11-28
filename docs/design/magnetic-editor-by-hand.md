# Building an app by hand in the editor

Status: recorded (a check of what exists, with the small bugs it found fixed; the gaps are not built)

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
| Theme | Make a theme from a preset, set a token for all modes and for one, make it the default | yes |
| Statenet | Make a model with fields of several types, remove a field | yes |
| Statenet | Make a dataset with a first record, add and edit records | yes |
| Statenet | Bind the dataset to the app | done when the dataset is made from the + of `$.data`; the name cannot be chosen |
| Statenet | Link a list, table or field to the dataset | no |
| Logic | Make a rule, move it to the browser, delete it | yes; its body is typed as JSON |
| Logic | Have a press run logic | no |
| Locale | Add a language, translate a label, switch | no control at all |

## Gaps
- **What a press does.** Go to a screen, Undo and Redo are built (links-and-presses L2); setting a value, telling a
  part to do something and saving a record are not (L5, L6).
- **Links to state.** No control writes a link (`<-`); a linked property shows read-only; a list's `items` and `row`
  and a table's `columns` are not fields. The State tab (`stateTab`) only offers to ask the agent.
- **Logic a visitor reaches.** Follows from the two above. A unit's body is JSON (`unitEditor`, `src/http/views.ts`).
- **Locale.** "Appearance and language" sets the editor's language. An app's locales are written only by the agent
  (`ui_locale_write`) and are not in Statenet (`graph`, `src/server/viewRoutes.ts`). It needs a view beside the other
  four.
- **Smaller.** A taken theme name is refused in the agent's words (`changeTheme`, `src/server/viewRoutes.ts`); the
  inspector lists runtime properties (Touched, Dirty) as editable and keeps showing a part of the screen just left; a
  `link`'s Screen is free text; the dataset panel labels records by generated keys; a new person's Statenet lists
  Magnetic's own page models beside theirs; a rule that fails says so only in `/edit/<id>/trace`.
- **Library.** stateui-app `src/dom/theme/tokenStep.ts` puts base tokens over the mode overlay at mount and the
  overlay over them on a live mode switch.

## Decisions
- The gaps are listed, not built: each is a feature with its own design.
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
