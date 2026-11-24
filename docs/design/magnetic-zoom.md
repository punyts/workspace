# Magnetic: zooming between orgs, apps, screens and the running app

Status: all five stages built 2026-11-23 (the URL, the chords and the level bar, an org's apps, the Orgs level, the
scale transitions), not deployed. Asked for on 2026-11-23:

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

## An org's apps (stage 3)
Built 2026-11-23.
- **The page**: `GET /orgs/<org>` for a member of the org, `GET /orgs/me` for the person's own space. Anyone else gets
  404. The page holds Magnetic's page `magnetic-apps` (a `PageSpec`, served at `/assets/apps.json` like the editor's
  board, editable by admins as the other pages are) and a level bar over it, and `/assets/apps.js` drives it through
  `$.data.apps` and its emits, as `screens.js` drives the screens board.
- **The tiles** are in the page, as JSON the server writes (`#apps-tiles`), so the board needs no second request.
  An org's hold the apps of its workspace the person may open. Their own space holds their own apps and the apps shared
  with them by link, less those they rejected, newest first; Your apps and Magnetic's editor are not tiles. The apps of
  their orgs are on each org's board, not here. Each tile is a card with the app's name and a note (when it changed, or who shared it), in rows of five
  on a canvas that pans and zooms. A tile shows no preview of the app yet.
- **Zooming in on a tile** opens the app where the person may go: the editor for `manage` and `edit` and their own
  apps, the running app for `use` and `view` and shares. A press on a tile zooms in on it; Ctrl+Shift+= zooms in on the
  selected tile, or else the one most in view.
- **Zooming out of the editor** goes to the app's workspace: `/orgs/<org>?app=<id>` for an org's app, else
  `/orgs/me?app=<id>`. `?app=` selects that app's tile and brings it into view, so zooming back in returns to it. The
  level bar's workspace goes to the same place.
- **Zooming out of an org's apps** goes to the Orgs level, `/orgs?org=<org>` (`?org=me` from their own), which
  selects that workspace's tile. The level bar reads Orgs › Acme.

## The Orgs level (stage 4)
Built 2026-11-23.
- **The page**: `GET /orgs`, the same page as a workspace's board (`magnetic-apps`, `/assets/apps.js`) with other tiles.
- **The tiles**: the person's own space first (Yours, to `/orgs/me`), then each org they are in, with their role, to
  `/orgs/<org>`. `?org=<id>` (`?org=me`) selects a tile and brings it into view.
- **Zooming in** on a tile, by a press or Ctrl+Shift+=, opens that workspace's board. Zooming out goes nowhere: it is
  the outermost level. The level bar reads Your apps › Orgs, so Your apps stays one press away.
- `GET /orgs` no longer answers the JSON list of the person's orgs; nothing used it. `POST /orgs` still makes an org.

## The keys
Built 2026-11-23 (stage 2) between the editor and the running app.
- **Ctrl+Shift+= zooms in, Ctrl+Shift+- zooms out** (Cmd on a Mac; Ctrl+Shift++ and Ctrl+Shift+- on the keypad too).
  Ctrl+Shift+E is removed.
- **Zooming in picks a tile**: the selected one, or else the one with the most in view (the board already tracks it),
  or else the one worked on. Zooming into the running app goes no further.
- **Zooming out of the editor goes to the app's workspace**, its board of apps (stage 3).
- **Plain zoom stays inside a level**: Ctrl+wheel, pinch and the zoom buttons scale the board as now.
- The page takes the chord before the browser does: Ctrl+Shift+= is Ctrl++ on most keyboards, the browser's own page
  zoom, so the handler calls `preventDefault` on keydown. A chord pressed inside an app in the page (the running app, or
  the live app on the board) comes through the runtime as `stateui:key`: the page names `mod+shift+=` and
  `mod+shift+-` in `data-host-keys`, and stateui-app's runtime names Shift with `+` and `_` by the keys they are on.
- **The level bar** names the levels over the running app: the workspace (Yours, or the org), the app and the screen
  showing (Acme › Field notes › Home). The app zooms out to the editor in the page; the workspace goes to its board of
  apps, on the app's tile. On a phone, with no keys, it is the way out; it also shows desktop users the levels exist. The editor has
  no bar of its own: its corner already names the app and the workspace, and its logo goes to Your apps.

## Moving between levels
Built 2026-11-23 (stage 5).
- A zoom is a scale transition from the tile to the full window (or back), then the next level's page. It is
  navigation, not one giant board: each level loads only its own tiles.
- **Between pages it is a cross-document view transition.** Every level's page opts in (`@view-transition`), and one
  element on each is named `zoom`: in the shell the whole page, on a board a mark. Zooming into a tile moves the mark
  over the tile first, so the next page grows out of it; zooming out spreads the mark over the whole board, and the
  page zoomed out to draws its mark over its selected tile, which sits in the middle at full size, so the page shrinks
  into it. The server draws that mark, so it is there before the board's script runs.
- **In the page** (the editor and the running app) it is a same-document view transition: the level left scales up and
  fades as the next comes in, or the reverse going out.
- Browsers without view transitions, and people who ask for reduced motion, go straight to the next level.
- Zooming out from the running app returns to the editor on the screen that was showing.

## Answered questions
- **Where a person's state for an app lives**: at the app's path under the person's own owner id, replacing personas as
  they are (owner, 2026-11-23). Designed in [person-state.md](person-state.md); it changes what a tile on the person's
  own space shows only once built.
- **Starter apps**: every person's own space has the showcase, Northwind, the desktop and Magnetic (owner, 2026-11-23).
  Designed in [magnetic-starter-apps.md](magnetic-starter-apps.md); Magnetic's tile is built.
- **Whether Your apps (`/`) becomes the Orgs level**: it stays as it is, with the Orgs level's bar linking to it (the
  owner left it to this design, 2026-11-23).

## Stages
1. The URL follows the screen, the position and what is open, in the editor and the running app, so Back works. Built
   2026-11-23.
2. The chords replace Ctrl+Shift+E between the editor and the running app, with the level bar. Built 2026-11-23.
3. An org's apps as a board (`/orgs/<org>`), zoomed out to from the editor. Built 2026-11-23.
4. The Orgs level, with the person's own space. Built 2026-11-23.
5. The scale transitions. Built 2026-11-23.

## Decisions
- The screen is `/screens/<name>` after the app, not `/<name>`: `/edit/<app>/<x>` already serves the editor's routes
  (`screens`, `events`, `state` and others) and `/apps/<app>/<x>` the host's (`sync`, `files`, `report`, `export`),
  which a screen name could match. Made while building stage 1.
- The level bar is drawn by the page over the running app only, a strip the app sits under, not part of the editor
  app: the bar must show while the editor is hidden, and the editor's corner already names the levels. Made while
  building stage 2.
- The board's tiles are written into its page, not fetched from `GET /orgs/<org>/apps`: one request, and the page
  holds nothing the person could not already open. Made while building stage 3.
- The Orgs level is the same page as a workspace's board, with workspaces for tiles; the page is told which query
  parameter selects (`data-pick`) and where zooming out goes (`data-out`). Made while building stage 4.
- Your apps stays at `/`, outside the levels: the Orgs level is reached by zooming out or at `/orgs`, and its bar links
  back to Your apps. Whether `/` becomes the Orgs level is still open. Made while building stage 4.
- An app in Magnetic's pages workspace zooms out to `/orgs/me`, where it is not a tile; the board then fits every tile.
  Made while building stage 3.
- The transitions are the browser's view transitions, not an animation the pages run before navigating: the next page
  loads while the tile grows, and nothing waits on a timer. Made while building stage 5.
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

Stage 3, in Magnetic:
- `src/apps/AppsPage.ts`: the page `magnetic-apps` (`APPS`), a viewport holding a board of cards, served at
  `/assets/apps.json` and listed among the site's pages. Texts `apps.*` in `src/http/text.ts`.
- `src/http/apps.ts`: the page (`appsPage`, `/assets/apps.css`) and its script (`/assets/apps.js`): rows of five,
  `?app=` selecting and centering a tile, a press or Ctrl+Shift+= zooming in, Ctrl+Shift+- out to `/`.
- `src/server/startMagnetic.ts`: `appsBoardRoute` for `GET /orgs/me` and `GET /orgs/<org>`; the shell is given the org.
- `src/http/shell.ts`: `data-board` (`boardOf`), where zooming out of the editor and the bar's workspace go.
- Tests: `src/apps/AppsPage.test.ts` (the contract, an org's tiles for an editor and a user, 404 for anyone else, the
  own space), `e2e/apps.spec.ts` (zooming out to the board and back in, a press on a tile), `e2e/address.spec.ts` and
  `e2e/levels.spec.ts` (the board as the way out).

Stage 4, in Magnetic:
- `src/server/startMagnetic.ts`: `appsBoardRoute` answers `GET /orgs` with the Orgs level; a workspace's board zooms
  out to `/orgs?org=<id>`. `src/server/orgRoutes.ts` no longer answers `GET /orgs`.
- `src/http/apps.ts`: the bar's levels (`BoardLevel`), `data-pick`, `data-out` and `data-label`. Texts `apps.orgs`,
  `apps.orgsBoard`, `apps.ownSpace`.
- Tests: `src/apps/AppsPage.test.ts` (the Orgs level's tiles, the board's way out), `e2e/apps.spec.ts` (zooming out of a
  workspace to the Orgs level and back in).

Stage 5, in Magnetic:
- `src/http/zoom.ts`: `ZOOM_CSS` (the opt-in, the `zoom` group, the in-page keyframes, reduced motion) and `ZOOM_JS`
  (`zoomInPage`); `APPS_BOARD` moved here.
- `src/http/apps.ts`: `#zoom-mark`, over the selected tile when the query names one (`selected`), moved over a tile
  before zooming in and over the board before zooming out.
- `src/http/shell.ts`: the body named `zoom`; `zoomIn` and `zoomOut` in the page through `zoomInPage`.
- Tests: `e2e/apps.spec.ts` (the editor grows out of a tile as a view transition).
