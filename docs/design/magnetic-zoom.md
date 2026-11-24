# Magnetic: zooming between orgs, apps, screens and the running app

Status: designed, not built. Its first stage, the URL, stands on its own. Asked for on 2026-11-23:

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
Today the URL names the app only: moving between screens, panning the board and opening a sheet or modal leave it
as it is, so Back leaves the app instead of undoing the last move. With zooming, every place you can go is in the URL,
and Back and Forward move between them:
- **The level and the tile**: the org, the app (as in the table below).
- **The screen**: the running app's screen as its path (`/apps/<app>/<screen>`), and in the editor the screen in view
  (`/edit/<app>/<screen>`). Changing screen pushes a history entry.
- **The position**: the board's pan and zoom in the hash (`#x,y,zoom`), replaced as it moves (`replaceState`, no entry
  per frame), so a reload or a shared link opens at the same place.
- **What is open**: a sheet or modal (Share, the inspector, the library, a dialog of the app) as a query
  (`?open=share`). Opening it pushes an entry; Back closes it before it leaves the screen.
- The running app is in the runtime frame, on another origin: it tells the page its screen and what it opened by
  message, and the page owns the history. A link from outside opens the app on that screen with that sheet open.

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
- **Ctrl+Shift+= zooms in, Ctrl+Shift+- zooms out** (Cmd on a Mac). Ctrl+Shift+E is removed.
- **Zooming in picks a tile**: the selected one, or else the one with the most in view (the board already tracks it).
- **Plain zoom stays inside a level**: Ctrl+wheel, pinch and the zoom buttons scale the board as now.
- The page must take the chord before the browser does. Ctrl+Shift+= is Ctrl++ on most keyboards, the browser's own page
  zoom, so the handler calls `preventDefault` on keydown. A chord pressed inside the running app comes through the
  runtime as `stateui:key`, as Ctrl+Shift+E does now (`data-host-keys`, `src/http/shell.ts`).
- On a phone there are no keys: a level bar at the top names the levels (Orgs › Acme › Field notes › Home) and each
  name zooms out to it. The bar also shows desktop users the levels exist.

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
1. The URL follows the screen, the position and what is open, in the editor and the running app, so Back works. It
   needs no zooming and comes first.
2. The chords replace Ctrl+Shift+E between the editor and the running app, with the level bar.
3. An org's apps as a board (`/orgs/<org>`), zoomed out to from the editor.
4. The Orgs level, with the person's own space.
5. The scale transitions.

## Decisions
None yet.
