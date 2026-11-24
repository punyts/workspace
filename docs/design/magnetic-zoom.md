# Magnetic: zooming between orgs, apps, screens and the running app

Status: stages 1 (the URL) and 2 (the chords and the level bar) built 2026-11-23, not deployed; stages 3 to 5
designed, not built. Asked for on 2026-11-23:

> Let's say a ctrl + shift + zoom-in on a screen then the browser "jumps" into the app in runtime mode. A ctrl + shift
> + zoom-out will take you out of the app, replacing ctrl + shift + E. Then if you are in the app editor, ctrl + shift
> + zoom-out takes you to the list of apps under the org, showing only the ones you have access to. Another ctrl +
> shift + zoom-out takes you to a diagram of orgs. You can telescope out and back in using the key combination and zoom
> in/out. Each is a diagram, with tiles, like the screens in the editor.

Then:

> If we think about it, a user has their own <ownerid> and that's where we could say is their "personal" org. That is
> where their state lives, and their changes to state at some level (data state might not be their data so changes
> might live on another <ownerid>)

And:

> The navigation, currently, doesn't change the url for screens, nor does it anchor positions or modals. We can't use
> the browser back button easily

## Where you are is in the URL
Built 2026-11-23 (stage 1). The URL names where the person is, and Back and Forward move between those places:
- **The editor or the app alone**: `/edit/<app>` or `/apps/<app>`. Zooming between them pushes an entry, so Back
  returns to where the zoom started; zooming in from the editor names the screen in the same entry.
- **The screen**: `/screens/<name>` after either (`/edit/<app>/screens/<name>`, `/apps/<app>/screens/<name>`). Choosing
  a screen pushes an entry: a card pressed, a screen picked in the Screens panel or a card's menu, or the app moving to
  another screen after the person pressed or typed. When the board picks the screen most in view as it pans, the entry
  is replaced. The page opens on the screen the URL names, before the one the app was left on. A bare `/edit/<app>` is
  the screen the app is on, and the page leaves it bare until the screen changes. A screen that is not there gives way
  to the one worked on, replacing the entry.
- **The position**: the board's pan and zoom in the hash (`#x,y,zoom`), replaced as the view rests (no entry per frame),
  only while the view is the person's: the board's fit has no hash, and an entry without one opens on the fit. The view
  the hash names wins over the one kept on the server.
- **What is open**: `?open=` names the panel beside the rail (`screens`, `connections`, `shared`) and the sheet
  (`share`, `prefs`, `feedback`), comma-separated. Opening one pushes an entry. Closing it while nothing else has
  changed goes back to the entry before, so Back after closing does not open it again. A link with `?open=` opens them
  once the editor is shown.
- Not in the URL: the library (a layout kept in this browser, open by default on a wide window), the inspector (it
  follows the selection), the Statenet, Theme and Logic views (kept per app), and an app's own dialogs (the runtime
  keeps no record of what is open).
- The running app runs in the page, so the page reads its screen from the host (`navigated`, `$.route`) and owns the
  history; nothing crosses an origin.
- Someone without edit rights who opens `/apps/<app>/screens/<name>` is redirected to `/apps/<app>?screen=<name>`, the
  host's app page, which navigates there once the app is ready.

## The four levels
Each level is a board of tiles, drawn like the editor's screens board, and each has its own URL, so Back, reload and
links work the same as zooming.

| Level | URL | Tiles | Zoom in on a tile |
|---|---|---|---|
| Orgs | `/orgs` | the person's own space and each org they are in | that org's apps |
| An org's apps | `/orgs/<org>` (`/orgs/me` for their own) | the apps there they may open | that app's editor |
| An app's screens | `/edit/<app>` (the editor, as now) | the app's screens | the running app, on that screen |
| The running app | `/apps/<app>` | the app fills the window | nothing further |

- **Their own space is a tile like an org**: the person's owner number holds their state, their own apps and the apps
  shared with them, and it sits among their orgs on the Orgs level.
- **An org's apps are the ones they may open**: `AppAccess.visibleApps` for the org's workspace, the same list the org's
  page shows. Owners and admins see every app.
- **The running app opens on the screen zoomed in on**, at the screen's URL path.

## The keys
Built 2026-11-23 (stage 2) between the editor and the running app.
- **Ctrl+Shift+= zooms in, Ctrl+Shift+- zooms out** (Cmd on a Mac; Ctrl+Shift++ and Ctrl+Shift+- on the keypad too).
  Ctrl+Shift+E is removed.
- **Zooming in picks a tile**: the selected one, or else the one with the most in view (the board already tracks it),
  or else the one worked on. Zooming into the running app goes no further.
- **Zooming out of the editor goes to Your apps (`/`)** until stage 3 gives an org's apps a board.
- **Plain zoom stays inside a level**: Ctrl+wheel, pinch and the zoom buttons scale the board as now.
- The page takes the chord before the browser does: Ctrl+Shift+= is Ctrl++ on most keyboards, the browser's own page
  zoom, so the handler calls `preventDefault` on keydown. A chord pressed inside an app in the page (the running app, or
  the live app on the board) comes through the runtime as `stateui:key`: the page names `mod+shift+=` and
  `mod+shift+-` in `data-host-keys`, and stateui-app's runtime names Shift with `+` and `_` by the keys they are on.
- **The level bar** names the levels over the running app: the workspace (Yours, or the org), the app and the screen
  showing (Acme › Field notes › Home). The app zooms out to the editor in the page; the workspace goes to `/` until
  stage 3. On a phone, with no keys, it is the way out; it also shows desktop users the levels exist. The editor has
  no bar of its own: its corner already names the app and the workspace, and its logo goes to Your apps.

## Moving between levels
- A zoom is a scale transition from the tile to the full window (or back), then the next level's page. It is
  navigation, not one giant board: each level loads only its own tiles.
- Zooming out from the running app returns to the editor on the screen that was showing.

## Open questions
- **Where a person's state for an app lives.** The owner's direction: a person's changes live under their own owner
  number, laid over the app owner's paths, possibly replacing personas for app data. That is a state and statenet
  decision (docs/design/statenet-direction.md) and does not block the levels above; it changes what a tile on the
  person's own space shows.
- **Starter apps per org.** The owner suggested every new org gets the component showcase and the example apps,
  which its members may delete. Which examples, and whether a person's own space keeps the showcase, is decided with
  that work, not here.
- Whether Your apps (`/`) becomes the Orgs level or stays as it is with the level bar.

## Stages
1. The URL follows the screen, the position and what is open, in the editor and the running app, so Back works. Built
   2026-11-23.
2. The chords replace Ctrl+Shift+E between the editor and the running app, with the level bar. Built 2026-11-23.
3. An org's apps as a board (`/orgs/<org>`), zoomed out to from the editor.
4. The Orgs level, with the person's own space.
5. The scale transitions.

## Decisions
- The screen is `/screens/<name>` after the app, not `/<name>`: `/edit/<app>/<x>` already serves the editor's routes
  (`screens`, `events`, `state` and others) and `/apps/<app>/<x>` the host's (`sync`, `files`, `report`, `export`),
  which a screen name could match. Made while building stage 1.
- The level bar is drawn by the page over the running app only, a strip the app sits under, not part of the editor
  app: the bar must show while the editor is hidden, and the editor's corner already names the levels. Made while
  building stage 2.
- Zooming out of the editor and the bar's workspace go to Your apps (`/`) until stage 3, so the chord does something
  at every level that exists. Made while building stage 2.
- The page never rewrites the URL on load: `/edit/<app>` stays bare until the screen changes, so links of the bare form
  keep working.

## As built
Stage 1, in Magnetic:
- `src/http/shell.ts` (`/assets/shell.js`): the address (`addressNow`, `addressOf`, `go`), what is open (`openStart`,
  `openEnd`, `applyOpen`), `popstate`, and `magneticShell.address` for screens.js.
- `src/http/screens.ts` (`/assets/screens.js`): the screen and the view in the address, and Back and Forward
  (`addressMoved`).
- `src/server/startMagnetic.ts`: `/apps/<app>/screens/<name>` and `/edit/<app>/screens/<name>` serve the page; anyone
  else's app is redirected to the host's `?screen=`.
- Tests: `e2e/address.spec.ts` (a screen chosen and Back, a sheet in the URL and Back); `e2e/screens.spec.ts` expects
  the Screens panel kept open across a reload.

Stage 2:
- stateui-app `src/runtime/createRuntime.ts`: with Shift, `+` and `_` are named `shift+=` and `shift+-` (`SHIFTED`), so
  a host can name the chords. Test: `src/runtime/startRuntime.browser.test.ts`.
- Magnetic `src/http/shell.ts`: `ZOOM_KEYS` in `data-host-keys`, `zoomChord`, `zoomIn`, `zoomOut`, `setEditing` taking
  the screen into the same entry, the level bar (`levelBar`, `.levels`, `magneticShell.levelScreen`) and the bar's app
  zooming out in the page; `shell.levels` in `src/http/text.ts`.
- Magnetic `src/http/screens.ts`: `zoomPick` (the shell's `onZoomIn`) and the screen's title in the bar.
- Tests: `e2e/address.spec.ts` (zooming in and out, each an entry Back undoes; zooming out of the editor to `/`),
  `e2e/levels.spec.ts` (the bar, its app zooming out, Back), `e2e/editor.spec.ts` (the chords),
  `src/server/agentRoutes.test.ts` (the chords named on the page).
