# Games and 3D Modeling with StateUI

## Summary
What the StateUI tool set (documents, logic, `scene3d`, the MCP tools) can build today in two areas, games and 3D
modeling, where it stops, and what would close each gap. The short answer: **turn-based games and 3D scene
composition fit well; real-time games and mesh modeling do not.** The example app's **Ridgeline** section (a 3D board
game) is the worked example.

---

## Games

### What fits
- **Boards and pieces.** A `drawing` gives 2D shapes that can be pressed and dragged; a `scene3d` gives meshes, groups and
  `repeat3d` copies that can be pressed and hovered. A board is records in `$.data`, so a `repeat3d` or `drawRepeat`
  draws one tile or piece per record.
- **Rules.** A machine holds the phase (whose turn, playing, won). Guards refuse illegal moves. Lookup tables cover
  scoring and "who wins this combination", and `SUI-LOGIC-GAP` proves every combination has an answer. Rules turn a
  press into a move.
- **Code where it pays.** A host registers functions (`logicFunctions`): an expression function computes the next board
  from the board and a move, a compute unit checks a winning line, an effect asks a server-side opponent or fetches a
  level (its request token cancels a stale answer when a newer move comes in).
- **Time.** `after` gives turn timers and card flip-backs; an `after` transition that stays in its state repeats, which
  is a slow tick. `debounce` waits for a quiet input.
- **Feel.** `transition` eases a piece to its new tile; `animate` (`spin`, `bob`, `pulse`) marks a selection or a win;
  `emissive` materials glow.
- **Multiplayer.** In Full mode the logic runs on the app server's authority and the state syncs, so two browsers share
  one game, and guards on the server keep it honest.

Good fits: board games (two players, or one against an effect), puzzles (sliding, matching, minesweeper-like), quizzes
with a countdown, card and tile games.

### Where it stops
| Gap | Why | What would close it | Size |
|---|---|---|---|
| No frame loop | Logic runs on state changes, not per frame; a chain stops at depth 8 and every move is a store (and sync) write | A per-frame logic timer kept in the browser, or a game-loop component that owns its own motion and writes state only at rest | Medium |
| No randomness in expressions | The expression library is pure (only `now` and `today` read the world) | A seeded `random(seed, n)` among the built-in functions; today a host registers one as an expression function | Small |
| No dragging in 3D | `draggable` exists for 2D shapes only; 3D nodes press and hover | Drag on a ground plane for an interactive mesh or group, written once on release like 2D | Medium |
| No keyboard game input | `on` entries react to component events, not to raw keys over a scene | A key-binding entry on `scene3d` (`on.key` with the key name) | Small |

An app built only through the MCP has no host code, so it has no registered functions: its rules must fit in
expressions and tables, and anything random or iterative needs an effect the agent answers.

---

## 3D modeling

### What fits
- **Composition.** `mesh` (box, sphere, cylinder, cone, plane, torus, capsule), `group3d` (assemblies that move, turn and
  scale together), `label3d`, `camera`, `light` and the `environment` presets. Materials take a colour, metalness,
  roughness, opacity, `emissive` and an image `map`.
- **Imported models.** `model` shows an uploaded GLB (at most 10 MiB) and plays its clips.
- **Data-driven scenes.** Every value is state: form fields link to positions and materials, and `repeat3d` draws one
  instanced mesh per record (at most 20,000), so a scene can be a list of records a user edits.
- **Interaction.** Interactive nodes raise `press` and `hover`; `orbit` and `pan` controls write the camera back to state.

Good fits: product configurators, room and warehouse layouts, a block (voxel) builder, 3D data views, and pieces built
from primitives, like Ridgeline's.

### Where it stops
| Gap | Why | What would close it | Size |
|---|---|---|---|
| No mesh editing | Geometry is a primitive or an imported GLB; there are no vertices, extrusion, booleans or subdivision | A mesh-editor component that keeps its vertices and faces in state | Large, a project of its own |
| No gizmos or 3D dragging | Moving a part needs fields, buttons or a 2D plan beside the scene | 3D dragging (above) plus a move and rotate gizmo for the picked node | Medium |
| No export | A scene is JSON state | An effect function that builds a GLB (or STL) file from the scene state and stores it as a file | Small to medium |
| `repeat3d` copies are one mesh | Records may differ only in position, rotation, scale, visibility and colour | A repeat of a `group3d` row (several meshes per record) | Medium |

---

## The worked example: Ridgeline
The example app's **Ridgeline** section is a two-player 3D board game built from these parts:
- **Pieces from primitives.** Each piece is a `group3d` of cylinders, cones, tori and spheres in its side's colours,
  interactive, with a `transition` so it glides to its new tile. A Warden carries a glowing lantern.
- **The board** is a `repeat3d` of 25 tiles whose colours show the legal moves of the picked piece; rings on the two
  Beacon tiles and under the picked piece pulse.
- **The rules** are pure functions the host registers as expression functions (`ridgelinePick`, `ridgelineMove`,
  `ridgelineNew`), over one JSON game state at `$.data.game.board`. Three rules call them when a piece or a tile is
  pressed or a new game is asked for, and clear their input so the same press works again.
- **The status** comes from a lookup table over who won, whose turn it is and why, which shows one localized line and
  hides the others.

Its rules are in the example README and in `example/src/ridgeline.ts`.

**Found while building it.**
- A component rule such as `:host([element=span]) { display: inline }` beat the shared `:host([hidden])` rule, so a
  hidden `text` still showed. The shared rule is now `display: none !important` (stateui-app).
- `spin` adds to a node's y rotation in its Euler order, so a ring laid flat with `rotation: [-90, 0, 0]` tumbles
  instead of turning in place. Ridgeline's rings `pulse` instead; a spin about the world's y axis (or a `group3d`
  wrapper that spins while the ring inside it is tilted) would make `spin` work for tilted nodes.
- A `scene3d` takes its height from its `theme` (`{ "scene3d": { "height": "520px" } }`), not from the host element's
  size.

**Next steps, in order of value:** a seeded `random` expression function (dice and shuffles without host code), 3D
dragging on a ground plane, repeats of a `group3d` row, and a GLB export effect. Real-time games and mesh modeling are
separate projects.
