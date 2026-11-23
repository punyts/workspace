# A move, rotate and scale gizmo in 3D

Status: built 2026-11-23.

Asked for on 2026-11-23: "let's continue", then "3D gizmo" as the next work, the gap the games analysis
([stateui-games-and-3d-modeling.md](stateui-games-and-3d-modeling.md)) left: "No gizmos | A part drags on its ground
only; lifting, turning or scaling it needs fields or buttons beside the scene | A move and rotate gizmo for the picked
node | Medium". Asked which modes, the owner chose "Move, rotate, scale" (owner, 2026-11-23); asked how it fits the
runtime chunk's size gate, the owner chose to raise the gate by what it needs (owner, 2026-11-23).

## The property

The `interaction3d` partial, which every 3D node merges, gains `gizmo`: `none` (the default), `move`, `rotate` or
`scale`. A node shows its gizmo while it is `interactive`, drawn, and the scene has a feeder that writes moves
(`onMove`). An app shows the gizmo of the node a person picked by linking it, such as
`"gizmo": "{{ $.data.ui.picked == 'lid' ? 'move' : 'none' }}"`, or `"<-gizmo": "$row.tool"` in a `repeat3d` row.

## The handles

- Drawn at the node's origin, over everything else in the scene (a second pass after the scene, with its own depth),
  at the same size on screen however far the node is (`GIZMO_PIXELS`, 96 CSS pixels for one handle length). They take
  no light and cast no shadow, and are not in the GLB export, the bounds of the scene, `hit` or a press.
- Colours are fixed by axis, as in modeling tools: x red, y green, z blue; the handle a drag holds turns yellow.
- `move`: three arrows along the parent's axes. `rotate`: three rings about the parent's axes. `scale`: three handles
  along the node's own axes with a cube at each end, and a cube at the centre for all three axes at once.

## The drag

- A primary pointer pressed on a handle holds the gesture, as a drag of a node does: the camera controls do not see it,
  and a press on a handle is never a `press` of the node. Handles are tried before the nodes, so a handle in front of
  a node wins.
- `move`: the node moves along the handle's axis, keeping the point it was grabbed by under the pointer (the point of
  the axis nearest the pointer's ray). This is the way to lift a node. `snap` puts the axis value on a multiple of
  `step`; `bounds` keeps x and z inside, as for a ground drag.
- `rotate`: the node turns about the ring's axis by the angle the pointer sweeps around the node's origin, in the
  ring's plane. The turn is about the parent's axis, applied before the node's own rotation, and written back as
  `rotation` in degrees. `snap` turns in steps of 15 degrees.
- `scale`: an axis handle scales that axis by how far the pointer's point on the axis is from the origin, against
  where it was grabbed; the centre cube scales all three by 2 to the power of the pointer's upward travel over
  `GIZMO_PIXELS`. No axis goes below 0.01. `snap` rounds to multiples of 0.1.
- A ray parallel to the axis or the ring's plane keeps the last value.
- The node changes in the renderer only, the scene `pending` until each frame is drawn. On release `onMove` is told the
  one property the handle changes (`position`, `rotation` or `scale`) once, then `onEvent` `dragEnd` with the node's
  world position. Escape or a pointer cancel puts the node back and tells nothing.
- The cursor is `grab` over a handle and `grabbing` while one is held.

## The component

- `onMove` gives `{ path, property, value }` (it gave `{ path, position }`). The `scene3d` controller writes `value` to
  `<path>.<property>`, where a `<-position`, `<-rotation` or `<-scale` link lands on its target.
- A node of a `repeat3d` copy writes to the record field its row links for that property (`"<-rotation": "$row.turn"`),
  as a dragged copy writes its position ([stateui-3d-drag-copies.md](stateui-3d-drag-copies.md)). A copy whose
  property the gizmo changes is not a `$row` link has nowhere to write: it shows no gizmo, and the repeat is reported once as
  `SUI-RUN-DRAW`.

## Decisions

- One property per node, not a scene-level selection: it follows `draggable`, works in a `repeat3d` row, and the app
  already holds which node is picked.
- Handles along the parent's axes for `move` and `rotate`, since `position` and the turn are in the parent's space; the
  node's own axes for `scale`, since `scale` is applied in the node's own space.
- Fixed axis colours, not theme tokens: they name axes, as in every modeling tool, and must differ from the scene.
- Pointer only. A keyboard user moves a node with the arrow keys of `draggable`, or with fields beside the scene; the
  handles have no proxy buttons.
- Handles of its own, not three's `TransformControls`: it is larger than the whole gizmo, and the chunk's gate was
  raised only by what this needs (owner, 2026-11-23): 2,265 gzipped bytes (`GIZMO_GZIP_BYTES`), leaving the chunk
  (193,867 bytes gzipped) 1,402 under the new gate of 195,269.
- `keepPosition3d` takes the axes it keeps, so a move along one arrow reuses the drag's `step`, `snap` and `bounds`.

## Rules and Constraints

- Nothing is written during a gizmo drag; one write per drag, on release, of the property the handle changes.
- A node without `gizmo`, and a scene with none, behaves as before.
- The handles never change what the scene exports, its bounds or what `hit` finds.

## As built

- `stateui-3d/src/gizmo.ts`: `Gizmos` (the handle meshes in a scene of their own, `sync`, `place`, `handleAt`,
  `hold`), `gizmoMode`, `gizmoValue`, `movedPosition`, `turnedRotation`, `scaledScale`, `gizmoScale` and the constants.
  Tests: `src/gizmo.test.ts`.
- `stateui-3d/src/scene3d.ts`: the gizmo pass after the scene, the handle gesture before the node drag, Escape and
  cancel, `info().gizmos`; `NodeMove` is `{ path, property, value }`. `src/instances.ts`: `RepeatRows.move` takes the
  property. `src/drag.ts`: `keepPosition3d` takes the axes. `runtime-chunk/build.test.ts`: `GIZMO_GZIP_BYTES`.
- `stateui-components/src/shared/shape/interaction3d.json`: `gizmo`. `src/shared/scene3d/tree.ts`: the `NodeMove`
  mirror and `gizmo` among the shared properties. `src/shared/scene3d/repeat.ts`: `gizmo` per copy, and
  `Repeat3dFeeder.writeTarget` keyed by `<node path>.<property>`. `components/composites/scene3d/scene3d.controller.ts`:
  writes the property `onMove` names. Tests: `test/composites/scene3d-gizmo.browser.test.ts`,
  `src/shared/scene3d/repeat.test.ts` ("gizmos on copies").
- `stateui-mcp/src/infrastructure/mcp/guide.ts`: the `scene3d-behavior` topic names `gizmo`. Test:
  `src/infrastructure/mcp/instructions.test.ts`.
