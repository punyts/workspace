# Dragging repeat3d copies

Status: built 2026-11-22.

Asked for on 2026-11-22: "let's continue", after the games analysis
([stateui-games-and-3d-modeling.md](stateui-games-and-3d-modeling.md)) named "dragging `repeat3d` copies" the first of
its next steps. The drag design ([stateui-3d-drag.md](stateui-3d-drag.md)) left it out: "`repeat3d` copies are not
dragged yet: a copy is an instance of one mesh, and its position lives in a record the row links".

## What is dragged

- A node of a `repeat3d` copy with `interactive: true` and `draggable` drags as any 3D node: the copy itself (a mesh
  row, or the `group3d` of a group row), or a node inside a group row ([stateui-3d-group-rows.md](stateui-3d-group-rows.md)).
- Its `position` must link a field of its record (`"<-position": "$row.at"`, the field an `[x, y, z]` array). A drag
  writes that whole array to the record, so the copy is drawn there from the record on the next draw. A draggable node
  of a row whose `position` is a literal or links anything but `$row` is not dragged, and the repeat is reported once
  as `SUI-RUN-DRAW`, as a 2D `drawRepeat` copy is.
- `bounds`, `step` and `snap` apply as for any node; a `$row` link may give each record its own.

## The drag

- The node moves on its parent's x-z plane through its position: the repeat's for the copy, the groups above it in the
  copy for a node inside it. The grab offset, the slop, Escape, the keys and `dragEnd` are those of any 3D node.
- During the drag only the instances of that copy are drawn again (the matrices of its parts), in the renderer only.
  On release `onMove` gets the node's path (`<repeat>.rows.<recordKey>`, or `….children.<key>` below it) and the new
  position, then `dragEnd` is raised; the dispatcher runs the row template's `on.dragEnd` with `$row` at the record.
- Escape puts the copy back as the records have it.

## Decisions

- The write goes to the record field, not to a path of the copy: a copy is not a node and has no alias to write
  through (the 2D rule).
- The whole position array is written, not one axis: a 3D `position` is one property.
- `transition` is not supported on copies, so the release has no tween to end.

## As built

- stateui-3d: `RepeatRows.nodeAt` and `RepeatRows.move` (`src/instances.ts`), `SceneGraph.copyAt` (`src/scene.ts`), and
  the drag in `src/scene3d.ts` through `heldOf` (an object of the graph or a node of a copy). README, "Drag". Tests:
  `src/instances.test.ts` ("dragging copies").
- stateui-components: `expandRepeats3d` gives `targets` and each repeat's `locked`, `Repeat3dFeeder.positionTarget`
  (`src/shared/scene3d/repeat.ts`); `onMove` in `scene3d.controller.ts` writes there. README, "Drag". Tests:
  `src/shared/scene3d/repeat.test.ts` ("dragging copies"), `test/composites/scene3d-events.browser.test.ts` with the
  real chunk (a pointer drag writes the record once and runs the row's `dragEnd`; Escape and an arrow key; a copy with
  an unlinked position does not drag and is reported).
- stateui-mcp: the `scene3d-behavior` guide topic.

## Rules and Constraints

- Nothing is written during a drag; one write per drag, on release, to the record.
- A copy that is not draggable, and every node outside a repeat, behaves as before.
