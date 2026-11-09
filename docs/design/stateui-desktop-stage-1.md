# A Desktop in the Browser, Stage 1

## Summary
A desktop-style app built with StateUI: a wallpaper with app icons, windows that open, close, minimize, maximize, snap
and come to the front, a taskbar with the open apps and a clock, and a file system kept in the browser. It is the
second app of the example repo (`example/desktop.html`), hand-built like Northwind Ops, so it may use host code. Stage 1
uses what exists plus one small library change; the gaps it shows feed stages 2 and 3.

The desktop has its own look (name **Lumen**): it borrows the common conventions (windows, a taskbar, a launcher) and
copies no product's design.

---

## Decisions
- **Where.** `example/desktop.html` and `example/src/desktop/` (document, host code, rules), a second Vite page; the
  tests in `example/test/desktop*.browser.test.ts`. Northwind Ops is unchanged.
- **Windows are panels in an `adhoc` layout.** Each window is a node of one composed component, `window` (a bordered
  `panel` with a title and a toolbar of minimize, maximize and close buttons in its `actions` slot), placed on the
  desktop surface by `x`, `y`, `width` and `height`.
- **Stacking needs `z` (library change, stateui-app).** `adhoc` placement gains `z` (an integer 0 to 999), drawn as
  `z-index`. Without it the last window in the document always covers the others.
- **Window state is data, the placement follows.** `$.data.desk.windows.<app>` holds `open`, `minimized`, `snap`
  (`free`, `left`, `right`, `max`), the free geometry and `z`. Each window links its `hidden` and its whole
  `placement` (`"<-placement"`, a library change in stateui-app made while fixing the gaps below) to the derived state.
- **Window actions are rules.** A press writes an input (`$.data.desk.input.open`, `.close`, `.focus`, `.minimize`,
  `.snap`); a rule sets `$.data.desk` to the result of an expression function (`deskOpen`, `deskClose`, ...) and clears
  the input, as Ridgeline does. Focusing a window gives it the highest `z` and renumbers the others, so `z` stays small.
- **The file system.** Item records in `$.data.fs.items` (`id`, `name`, `parent`, `kind` folder, note, picture or file,
  `text` for a note, `file` for a stored file's reference, `modified`). File bytes live in the Origin Private File
  System (OPFS) behind the existing `transferFile` and `readFile` hooks, so `fileField` uploads and `paintField`
  drawings land there. The item records are saved to `fs.json` in OPFS on every change (debounced) and read back
  before the app mounts. Without OPFS the store is in memory. `localStorage` is not used for files: about 5 MB,
  strings only, and it blocks the page.
- **Folder views are derived by rules.** A change of the items or of the current folder sets the listing and the folder
  tree from expression functions (`fsListing`, `fsFolders`). File actions (new folder, new note, rename, delete, open)
  are rules over inputs, like the window actions.

## The apps
| App | What it does | Built from |
|---|---|---|
| Files | Folder tree, the items of the folder, new folder, new note, upload, rename, delete, open | `tree`, `list`, `fileField`, `textField`, `button`, `confirmDialog` |
| Notes | Edit a note in Markdown with a live preview, save it to its file | `textarea`, `markdown`, `button` |
| Paint | Draw a picture and save it as a PNG file in Pictures | `paintField`, `textField`, `button` |
| Viewer | Show an opened picture | `drawing` with `drawImage` of the stored file |
| Ridgeline | The board game, reused from Northwind Ops | the same scene, rules and status table |
| Settings | Wallpaper and light or dark mode | `segmented`, `switch` |

The taskbar has a launcher menu, one button per open app (pressing it focuses or restores the window) and a clock
(a minute timer in the host writes `$.data.desk.clock`).

## Stages after this one
2. Drag and resize windows (title bar drag, edge resize; written on release like 2D drag).
3. `cameraView` and `audioRecorder` components feeding files into the file system; the runtime frame's
   `allow="camera; microphone"`.
4. Several visible screens, if apps as composed components in one screen turn out to limit it.

## Checks
- Browser tests: open, focus (z order), minimize and restore from the taskbar, snap and maximize, close; new folder,
  new note, rename, delete; a note saved and an upload survive a restart (OPFS); Paint saves a picture the Viewer opens.
- `npm run validate` covers both documents; screenshots of the desktop at 1400 px.

## Found while building it
These are the gaps in the libraries that building the desktop showed. Each has a fix or a workaround in place. The
first three under "Fixed after stage 1" were closed in a second pass.

- **A panel's content did not fill a fixed-height panel.** A `drawing` with a theme `height` of `100%` was drawn 0 px
  high. This is fixed in stateui-components: the panel's `.content` is now a flex column.
- **No stacking order in placement.** This is fixed in stateui-app: `adhoc` takes `z` (an integer from 0 to 999), which
  sets `z-index`.
- **A panel has no press event.** So focus on press is host code, a pointer down listener on each window.
- **`on` values are literal.** A `{{ }}` in an `on` value is not evaluated. So the Open button writes `selected`, and
  the rule turns it into an id with `fsPick($trigger, $.data.fs.selected)`.
- **Rule inputs coalesce.** When one input is written several times in the same task, only the last write runs the
  rule. Tests wait between writes. A user cannot press fast enough to hit this.
- **A field's `width` is in characters (`ch`), not pixels.** A width of 200 made a field 200 characters wide.
- **A drawing gets its height from its theme** (`theme: { drawing: { height: '100%' } }`), not from a property.
- **A `tree` needs a `row` template.** Without one, it draws no rows and reports no error.

### Fixed after stage 1
- **A placement could not be linked.** It can now (stateui-app). A node sets `"<-placement": "<path>"` and is placed
  by the object at that path. Only where it sits is checked. A link to one field (`<-x`) is still `SUI-LAYOUT-FIELD`,
  because the node reads its placement as one object. The host bridge is gone.
- **A snapped or maximized window kept the size of its content.** The Files browser and the Notes split now take
  `grow: 1` in the window's column, and the host no longer sets the lists to 260 px, so they fill the window.
- **Deleting an item left its file in OPFS.** The file store has `prune(keep, graceMs)`. After each save, the host
  removes the files that no item, unsaved Paint picture or upload in progress uses, and it does this once at start.
  Files stored in the last 30 seconds are kept.
