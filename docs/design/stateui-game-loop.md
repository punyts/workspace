# The game loop: bodies that move on their own

Status: proposed 2026-11-23; not built.

Asked for on 2026-11-23: "Design the frame loop", to the choice between the two gaps the games analysis
([stateui-games-and-3d-modeling.md](stateui-games-and-3d-modeling.md)) leaves open. That analysis names the gap:
"No frame loop. Logic runs on state changes, not per frame; a chain stops at depth 8 and every move is a store (and
sync) write", and two ways to close it: "A per-frame logic timer kept in the browser, or a game-loop component that
owns its own motion and writes state only at rest".

## Why

Real-time games (a paddle and a ball, catching what falls, steering past obstacles, a platform to jump on) need things
that move every frame while a key is held or under their own speed, and need to know when two of them meet. StateUI
moves a node only when state changes: a `transition` eases to a new value and `animate` plays a fixed cycle, but
nothing moves by velocity, nothing reads a held key, and nothing tells logic that two nodes touched.

A per-frame logic timer would run rules 60 times a second. Each run writes the store, each write is a change the
sync client sends, and every frame's chain counts against `MAX_CHAIN_DEPTH`. It would also put the motion in
expressions an agent writes by hand. This design takes the other way: the scene moves its bodies itself, from
declared speeds, keys and collisions, and tells state and logic only what matters to the game: where a body came to
rest, and which bodies met.

## The design

### A scene plays
- `scene3d` gains `play`: `{ running, gravity? }`. `running` (default false) starts and stops the loop; `gravity` is a
  vector in units per second squared (default `[0, -9.8, 0]`), applied to bodies that `fall`.
- While `running` is true and any body moves, the scene steps its bodies at a fixed 60 steps a second (an accumulator
  over the animation frame, at most 5 steps a frame, so a slow frame or a tab that comes back does not tunnel bodies
  through walls) and draws them. When nothing moves, it asks for no frame.
- When `running` turns false, every body's `position` and `velocity` are written once, so the state holds where the game
  stopped. A paused game is `running: false`; resuming starts from what state holds.
- Reduced motion does not stop a game: motion is its content. `transition` and `animate` keep their reduced-motion
  behaviour.

### Bodies
- A 3D node (`mesh`, `group3d`, `model`, and each `repeat3d` copy) gains `body`, a new part of the `interaction3d`
  partial:
  - `velocity`: units per second, the body's speed now. It is state: logic sets it (a jump, a serve, a reversal) and
    the loop writes it back when the body rests or the game stops.
  - `control`: key names (from `keys`' closed list) to a velocity each adds while held:
    `{ "ArrowLeft": [-6, 0, 0], "ArrowRight": [6, 0, 0] }`. Held keys add to `velocity` and stop adding on release.
  - `falls`: true to take the scene's `gravity`.
  - `solid`: true to collide. Its shape is its box: the bounds the scene already computes for a node (`boundsOf`), or
    a sphere for a sphere mesh.
  - `onContact`: what the body does when it meets a solid or its `bounds`: `stop` (default), `bounce`, or `pass` (it
    keeps going, and the contact is still told).
- The drag's `bounds` (a box the node stays in) holds a moving body too: reaching a side is a contact with
  `{ with: "bounds", side }`, with `side` one of `left`, `right`, `bottom`, `top`, `back`, `front`.
- A body with no `velocity`, no held `control` and no `falls` does not move: walls, floors and targets are `solid`
  bodies that stand still.

### What the loop tells state and logic
- **Contacts.** When two solid bodies meet (one of them moving), each raises `contact` with
  `{ with, side }`, where `with` is the other's node key, or for a `repeat3d` copy its record key and the repeat
  (`{ with: "coin-7", repeat: "coins" }`). The dispatcher writes the payload to `$.raised.<node path>.contact` as every
  event, so a rule there adds to a score, removes a record, or ends the game. A pair raises one contact when they meet,
  not again while they touch.
- **Rest.** A body that stops (its speed falls to zero by `stop`, or logic sets its velocity to zero) writes its
  `position` and `velocity` once, through the path its `<-position` link names for a copy, as a drag does.
- **Contacts write too.** At a contact the moving body's `position` and `velocity` are written, so logic that reads
  them sees where it happened.
- Between those moments, positions live only in the scene. A synced app sends a change at a rest, a contact or a stop,
  never per frame.

### Logic that changes a running game
- A write to a body's `velocity` while it runs replaces its speed (a serve, a jump: `set` `velocity` to `[0, 6, 0]`
  on `key` Space). A write to its `position` moves it there. These are ordinary writes, so rules and machines need
  nothing new.
- Timed events (spawning, a countdown) stay with `after`, whose repeating transition is the slow tick.

### Where it runs
- The step is pure code in stateui-components (`src/shared/play/`): bodies, held keys and a time step in, positions,
  speeds and contacts out. Collisions are box against box and sphere against box or sphere, over a uniform grid, so a
  board of many standing copies costs little. No rotation from collisions, no friction, no stacking: bodies move,
  stop, bounce or pass.
- The `scene3d` controller runs the loop, already holds the key listener (it learns which keys are held), and hands
  each frame's positions to the renderer through one new call, `place(positions)`, which draws them as the motion
  layer draws a tween, without the store. The runtime chunk gains only that call, inside its size gate.
- The step is not tied to 3D: a later `drawing` can run the same code.

### Limits
- At most 256 moving bodies and 5,000 solids in a scene; past that the loop does not start and the scene reports
  `SUI-STATE-INVALID` with the count.
- Speeds are capped at 1,000 units per second.

### The tools
- stateui-mcp: a new guide topic, `scene3d-play` (the `scene3d-behavior` topic is near its cap). `ui_interact` gains
  holding a key for a time (`key` with `hold` in ms), so an agent can try a game; the check waits for the scene to
  come to rest.
- The example app gains a short real-time game that uses each part (a basket the arrow keys move, falling fruit that
  `fall`s, a `contact` rule that scores and removes the fruit, `after` spawning the next).

## Stages
1. **F1, the step and one body**: `src/shared/play/` with its tests; `play` and `body` on `scene3d` and the 3D nodes;
   held keys; `place` in stateui-3d; contacts with node keys; writes at rest, contact and stop.
2. **F2, copies**: `repeat3d` copies as bodies, through their `<-position` and `<-velocity` links, and contacts that name
   the record; the grid.
3. **F3, the tools and the example**: the guide topic, `ui_interact`'s held key, the example game.

## Decisions
To put to the owner:
- **The scene moves its bodies; logic hears contacts and rests**, rather than a per-frame logic timer.
- **Simple collisions** (boxes and spheres, stop, bounce or pass) written here, rather than a physics engine (a WASM
  physics library would be several hundred KB, and its results are harder for an agent to predict).
- **One player's browser runs the game.** In Full mode the authority sees the writes at rest and contact, so a shared
  board and a high-score table work; two people steering the same bodies in real time is not part of this design.

## Rules and Constraints
- Nothing is written to the store per frame: only at rest, at a contact and when the game stops.
- The key, contact-side and response vocabularies are closed lists.
- The runtime chunk stays under its size gate; the step lives outside it.
- A scene that is not `running` behaves exactly as today.

## As built
Not built.
