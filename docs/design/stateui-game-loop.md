# The game loop: bodies that move on their own

Status: built 2026-11-23. F1 (the step, one body per node, held keys, contacts, writes at rest, contact and stop) and
F2 (`repeat3d` copies as bodies, spheres, the grid) in stateui-components; F3 (the guide topic, `ui_interact`'s held
key, the example game) in stateui-mcp and the example.

Asked for on 2026-11-23: "Design the frame loop", to the choice between the two gaps the games analysis
([stateui-games-and-3d-modeling.md](stateui-games-and-3d-modeling.md)) leaves open. That analysis names the gap:
"No frame loop. Logic runs on state changes, not per frame; a chain stops at depth 8 and every move is a store (and
sync) write", and two ways to close it: "A per-frame logic timer kept in the browser, or a game-loop component that
owns its own motion and writes state only at rest". Then, the same day: "Yes, build F1", "Yes, build F2" and "Yes, build F3".

## Why

Real-time games (a paddle and a ball, catching what falls, steering past obstacles, a platform to jump on) need things
that move every frame while a key is held or under their own speed, and need to know when two of them meet. StateUI
moved a node only when state changed: a `transition` eases to a new value and `animate` plays a fixed cycle, but
nothing moved by velocity, nothing read a held key, and nothing told logic that two nodes touched.

A per-frame logic timer would run rules 60 times a second. Each run writes the store, each write is a change the
sync client sends, and every frame's chain counts against `MAX_CHAIN_DEPTH`. It would also put the motion in
expressions an agent writes by hand. This design takes the other way: the scene moves its bodies itself, from
declared speeds, keys and collisions, and tells state and logic only what matters to the game: where a body came to
rest, and which bodies met.

## The design

### A scene plays
- `scene3d` has `play`: `{ running, gravity }`. `running` (default false) starts and stops the loop; `gravity` is a
  vector in units per second squared (default `[0, -9.8, 0]`), applied to bodies that `fall`.
- While `running` is true and any body moves, the scene steps its bodies at a fixed 60 steps a second (an accumulator
  over the animation frame, at most 5 steps a frame, so a slow frame or a tab that comes back does not tunnel bodies
  through walls) and draws them. When nothing moves, it asks for no frame.
- When `running` turns false, every body's `position` and `velocity` are written where they differ from state, so the
  state holds where the game stopped. A paused game is `running: false`; resuming starts from what state holds.
- Reduced motion does not stop a game: motion is its content. `transition` and `animate` keep their reduced-motion
  behaviour; a body's `transition` is not applied while the game moves it.

### Bodies
- Every 3D node has `velocity` (units per second, default `[0, 0, 0]`) and `body`, both in the `interaction3d`
  partial. A `mesh`, `group3d` or `model` with a `body` is a body, and so is each copy of a `repeat3d` whose row has a
  `body` (Copies below). `velocity` is state: logic sets it (a jump, a serve,
  a reversal) and the loop writes it back at a contact, at rest and when the game stops. `body` holds:
  - `control`: key names (from `keys`' closed list, `SCENE_KEYS`) to a velocity each adds while held:
    `{ "ArrowLeft": [-6, 0, 0], "ArrowRight": [6, 0, 0] }`. A name outside the list is reported once as `SUI-RUN-3D`.
  - `falls`: true to take the scene's `gravity`. A falling solid that rests on another solid's top is held up.
  - `solid`: true to collide. Its shape is a box: a mesh's from its geometry (the renderer's defaults), scale and
    rotation (degrees); a group's or model's as the scene draws it (`boundsOf`). A sphere mesh scaled the same on every
    axis is a sphere of its radius times its scale, and meets a box where its surface reaches the box's nearest point.
  - `onContact`: what the body does when it meets a solid or its `bounds`: `stop` (default; its velocity toward what
    it met becomes zero), `bounce` (that velocity turns), or `pass` (it keeps going, and the contact is still told).
- Solids collide with the solids of the same parent (a `group3d`'s children with each other), in the parent's space.
- The drag's `bounds` (`{ x, z, width, depth }`, the range of the position) holds a moving body too: reaching a side is
  a contact with `with: "bounds"` and `side` one of `left`, `right`, `back`, `front`.
- A body with no `velocity`, no held `control` and no `falls` does not move: walls, floors and targets are `solid`
  bodies that stand still.
- A body moves one axis at a time in sub-steps no longer than its smallest half size (at most 32), so a fast body
  meets a thin wall.

### Copies
- A copy of a `repeat3d` whose row has a `body` is a body keyed by its record key. The loop writes its `position` and
  `velocity` to the record fields its `"<-position": "$row.<field>"` and `<-velocity` links name, as a drag writes a
  copy. An unlinked `velocity` is not written (the game keeps its value until it stops). A copy that may move (a
  `velocity` other than zero, `falls` or a `control`) with no `$row` link for its `position` has nowhere to keep where it
  went: it is drawn without `body`, and the repeat is reported once as `SUI-RUN-DRAW`. A copy that stands still needs no
  link.
- Only the copy itself is a body, not the nodes of a `group3d` row below it.
- Copies collide with the bodies beside the repeat while the repeat is not moved, turned or scaled (their positions are
  then in the same space); otherwise only with each other.
- The row's `on.contact` runs with `$row` at the record, as its `on.press` does.

### What the loop tells state and logic
- **Contacts.** When two solids begin to touch, or a body reaches a side of its bounds, each body raises `contact` with
  `{ shape, key, with, repeat?, side }`: its path, its node key (a copy's record key), the other's key (or `bounds`),
  `repeat`, the key of the other's `repeat3d` when it is a copy (`{ with: "coin-7", repeat: "coins" }`), and the side of
  the body that touched (`left`, `right`, `bottom`, `top`, `back`, `front`). The dispatcher writes the payload to
  `$.raised.<node path>.contact` as for every event, so a rule there adds to a score, removes a node, or ends the game.
  A pair raises one contact when it begins to touch, not again while it touches, and what touches when the game
  starts raises none.
- **Contacts write first.** Before `contact` is raised, both bodies' `position` and `velocity` are written, so logic
  that reads them sees where it happened.
- **Rest.** A body that stops moving (its speed falls to zero at a `stop`, its key comes up, logic sets its velocity to
  zero) writes its `position` and `velocity` once.
- Writes go through the node's links (`repeats.writeTarget`), as a drag's do; a copy's go to its record.
- Between those moments, positions live only in the scene. A synced app sends a change at a rest, a contact or a stop,
  never per frame.

### Logic that changes a running game
- A write to a body's `velocity` while it runs replaces its speed (a serve, a jump: `set` `velocity` to `[0, 6, 0]`
  on `key` Space). A write to its `position` moves it there. The loop keeps the value it last wrote or read for each
  body; a state value that differs from it is logic's, and the game takes it up. These are ordinary writes, so rules
  and machines need nothing new.
- Timed events (spawning, a countdown) stay with `after`, whose repeating transition is the slow tick.

### Keys
- The keys a running game's `control` names are taken as `keys` are: the scene box is focusable, names them in
  `aria-keyshortcuts`, and stops them on the way down. They are held while down and let go on release or when focus
  leaves the scene. They raise `key` only when `keys` lists them too.

### Where it runs
- The step is pure code in stateui-components (`src/shared/play/play.ts`, `PlayWorld`): bodies, held keys and a time
  step in, positions, speeds, contacts and rests out. No rotation from collisions, no friction, no rolling, no stacking
  beyond resting on a top: bodies move, stop, bounce or pass. Only the bodies that may move are stepped; the solids that
  stand still sit in a uniform grid per parent (cells about the median size of those solids), so a moving body checks
  only those near it and pairs of still solids are never checked.
- `SceneLoop` (`src/shared/play/loop.ts`) runs it for the `scene3d` controller: it reads the bodies from the node tree
  on every draw, steps on the animation frame, and gives the renderer each frame's tree through the renderer's own
  `update`, with each body at its position in the game. stateui-3d and its runtime chunk are unchanged.
- The step is not tied to 3D: a later `drawing` can run the same code.

### Limits
- At most 256 moving bodies and 5,000 solids in a scene; past that the loop does not run and the scene reports
  `SUI-RUN-3D` with the count.
- Speeds are capped at 1,000 units per second on each axis.

### The tools
- stateui-mcp: a guide topic of its own, `scene3d-play` (the `scene3d-behavior` topic is near its cap).
- `ui_interact`'s `key` and `press` take `hold` (ms, at most 5,000): the key goes down, stays down and comes up, so an
  agent can try a game. `hold` on another action is refused before the page opens.
- While a scene's loop asks for frames, the `scene3d` element has `data-play="moving"`. After its actions
  `ui_interact` waits up to 5 s for no scene to carry it, and lists in `moving` the scene paths still moving then (a
  game whose bodies never stop).
- The example app has a short real-time game, the Orchard section: a basket the arrow keys move, falling apples that
  are `repeat3d` copies, rules on the basket's and the grass's `contact` that score or count a miss and delete the
  apple's record, and a machine whose `after` transition back to its own state drops the next apple.

## Stages
1. **F1, the step and one body** (built): `src/shared/play/` with its tests; `play` on `scene3d`, `velocity` and `body`
   on the 3D nodes; held keys; contacts with node keys; writes at rest, contact and stop.
2. **F2, copies** (built): `repeat3d` copies as bodies, through their `<-position` and `<-velocity` links, and contacts
   that name the record and the repeat; sphere shapes; a uniform grid, so a board of many standing copies costs little.
3. **F3, the tools and the example** (built): the guide topic, `ui_interact`'s held key and the wait for rest, the
   example game.

## Decisions
- **The scene moves its bodies; logic hears contacts and rests**, rather than a per-frame logic timer (owner,
  2026-11-23, asking for F1).
- **Simple collisions** (boxes, stop, bounce or pass) written here, rather than a physics engine (a WASM physics library
  would be several hundred KB, and its results are harder for an agent to predict).
- **One player's browser runs the game.** In Full mode the authority sees the writes at rest and contact, so a shared
  board and a high-score table work; two people steering the same bodies in real time is not part of this design.
- **No new renderer call.** The proposal had stateui-3d gain `place(positions)`; the renderer's `update` already diffs
  the tree it is given, so the loop hands it the tree with the game's positions, and the runtime chunk keeps its room.
- **`velocity` is a node property**, beside `position`, rather than a field of `body`, so a `<-velocity` link and a
  logic `set` address it as they address `position`.
- **Spheres only when scaled evenly.** A sphere mesh scaled unevenly is an ellipsoid; it collides as its box rather
  than as a shape the step does not have.
- **A moving copy needs a `$row` position.** Without one the game could move it but never keep where it went, so it is
  not a body, and the repeat says so; a still copy (a wall, a coin) needs no link.
- **Copies of a placed repeat collide only with each other**, rather than converting between the repeat's space and its
  parent's at every step.
- **The wait for rest reads a mark on the element** (`data-play="moving"`), as the wait for drawing reads
  `data-render="pending"`, rather than asking the store whether positions still change: between contacts and rests
  the store does not change while bodies move.
- **Limits report `SUI-RUN-3D`**, the 3D runtime's code, rather than `SUI-STATE-INVALID`: the document is valid, the
  scene cannot play it.

## Rules and Constraints
- Nothing is written to the store per frame: only at a contact, at rest and when the game stops.
- The key, contact-side and response vocabularies are closed lists.
- The runtime chunk stays under its size gate; the step lives outside it.
- A scene that is not `running` behaves exactly as before: its tree goes to the renderer unchanged.

## As built
- stateui-components:
  - `src/shared/play/play.ts`: `PlayWorld` (`step`, `settle`, `anyMoves`), its `Grid` and `reach` (box and sphere
    shapes), `readBody`, `readBounds`, `geometryHalf`, `turnedHalf`, `sphereRadius`, the limits and vocabularies.
  - `src/shared/scene3d/repeat.ts`: copies with a `body` (`bodyCopy`), their record targets, `stuck`,
    `Repeat3dFeeder.writesNowhere`; `velocity` and `body` in `INSTANCE_PROPERTIES`.
  - `src/shared/play/loop.ts`: `SceneLoop`.
  - `src/shared/shape/interaction3d.json`: `velocity`, `body`, the event `contact`; `src/shared/scene3d/tree.ts` lists
    them in `SHARED_PROPERTIES`.
  - `components/composites/scene3d/scene3d.state.json`: `play`; `scene3d.controller.ts` runs the loop, takes the
    control keys, raises `contact`.
- Tests: `src/shared/play/play.test.ts` (the step, landing, bounce and pass, bounds, a thin wall at speed, parents,
  settling; spheres, copies and the grid), `src/shared/scene3d/repeat.test.ts` ("copies as bodies of the game loop"),
  `test/composites/scene3d-play.browser.test.ts` (with the real chunk: a fall that lands and raises `contact` for an
  `on` entry, a held key, a velocity logic sets and a stop, copies that land and write their records, a bad control
  key),
  `test/graphics3d.test.ts`; stateui-mcp's `test/tools.test.ts` pins the nodes' events.
- F3, stateui-components: `SceneLoop`'s `moving` option; the controller sets `data-play="moving"`. Test: the held key in
  `test/composites/scene3d-play.browser.test.ts`.
- F3, stateui-mcp: `src/infrastructure/preview/BrowserPreview.ts` (`MAX_HOLD_MS`, `pressKey`, `waitResting`, `moving`),
  `src/infrastructure/mcp/liveTools.ts` (`hold` and its refusal), `src/infrastructure/mcp/guide.ts` (`SCENE3D_PLAY`,
  the topic `scene3d-play`). Tests: `test/tools.test.ts`, `test/chunk3d.integration.test.ts` ("F3": a held key moves a
  body in the real page; a scene that never rests is named in `moving`), `src/infrastructure/mcp/instructions.test.ts`,
  `test/toolSet.test.ts`.
- F3, stateui-app: browser logic now watches `$.raised`, so a rule on a `contact` (or any event) runs outside Full
  mode. Test: `src/dom/mount/logic.browser.test.ts`.
- F3, example: the Orchard section in `src/document/main.json` (with its German overlay, `data.json` and the
  `orchardDrop` machine and `orchardCatch`, `orchardMiss`, `orchardOver` and `orchardReset` rules in `logic.json`).
  Tests: `test/app.browser.test.ts` ("Northwind Ops Orchard": a catch and a miss, a dropped apple and the held key,
  the end of a round and New round).
