# Magnetic: the apps every person's own space starts with

Status: Magnetic's tile built 2026-11-23, not deployed; Northwind and the desktop designed, not built.

Asked for on 2026-11-23, answering which apps every new org gets:

> let's say every user org, aka the user org ids have the showcase, northwind, OS and magnetic

And, on Magnetic as an app in everyone's own space:

> yes, or if we think splitting the editor into it's own app, the editor

## What every person's own space holds
- **The component showcase**, as now: `installShowcaseInto` (stateui-mcp `src/config/showcase.ts`) when the workspace
  is first opened. An org's workspace starts empty.
- **Magnetic**: the person's own copy of the editor (`EditorApps`, `src/editor/EditorApp.ts`), which already lives in
  their workspace, shown as the first tile on their board (`/orgs/me`) with the note "Your own copy of the editor".
  Zooming in opens it in the editor, where changing the editor shows in the editor around it. Your apps still leaves it
  out: its list is the apps a person made or was given.
- **Northwind Ops** and **the Lumen desktop** ("OS"): the example's two apps (`example/src/document`,
  `example/src/desktop`), as starter apps beside the showcase. Not built; see below.

## Northwind and the desktop
Both run in the example with code a starter app cannot carry: `example/src/bootstrap.ts` registers host functions (the
archive, Ridgeline's) and `onEmit` handlers, and the desktop's rules call the functions of `desk.ts` and `files.ts`.
Magnetic's apps have only the logic engine and the host's `http` effect. So a starter version is:
1. **A build script** beside `scripts/buildShowcase.mjs` in stateui-mcp that turns each document into parts with
   stateui-app's `splitDocument` (app, screens, themes, data, logic), with fixed ids and timestamps, written under
   `showcase/parts` so `installShowcaseInto` installs all three. Its staleness test follows the showcase's.
2. **What code did, as logic**: each host function the documents call becomes rules, lookup tables or computes, or the
   part of the app that needs it is left out of the starter (with the example keeping it). Which parts go is decided
   per function when the script is written; the example stays as it is.
3. **The share refusal** for starter apps (their ids are the same in every workspace) covers the new apps too.

## Open questions
- Which of Northwind's sections and the desktop's windows the starter versions keep, once each host function is
  weighed (the archive's file export, Ridgeline's simulation, the desktop's files).
- Whether the editor becomes its own app (a blueprint people install, rather than a copy of Magnetic's page). The tile
  works either way: it opens the person's copy.

## Decisions
- Every person's own space has the showcase, Northwind, the desktop and Magnetic (owner, 2026-11-23).
- Magnetic's tile is the person's existing copy of the editor; no new app is made for it. Made while building it.
- "OS" is read as the Lumen desktop, the example's operating-system-like app. Made while designing; the owner may
  correct it.

## As built
- Magnetic `src/server/startMagnetic.ts` (`appsBoardRoute`): the person's editor copy first on `/orgs/me`; text
  `apps.editorNote` in `src/http/text.ts`.
- Test: `src/apps/AppsPage.test.ts` (Magnetic first on the own space, once).

## Rules and Constraints
- Starter apps have the same ids in every workspace; links to them are refused.
- A starter app is pure StateUI: no host function beyond what Magnetic gives every app.
