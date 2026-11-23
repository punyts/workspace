# Dragging in 3D

Status: built 2026-11-22.

Asked for on 2026-11-22: "Dragging in 3D", the gap the games analysis
([stateui-games-and-3d-modeling.md](stateui-games-and-3d-modeling.md)) sized Medium: "Drag on a ground plane for an
interactive mesh or group, written once on release like 2D". It is also the first half of the 3D modeling gap "No gizmos
or 3D dragging".

## The properties

The `interaction3d` partial, which every 3D node merges, gains:

- `draggable`: `x`, `z` or `ground` (both). Only a node with `interactive: true` that is drawn is dragged, as in 2D.
- `bounds`: `{ x, z, width, depth }` in the parent's space. The node's `position` is kept inside the rectangle.
- `step` (default 1): what an arrow key moves the node by, ten times that with Shift.
- `snap` (default false): a drag lands the position on a multiple of `step`, while it moves and on release.
- The event `dragEnd` joins `press` and `hover`.

## The drag

- A primary pointer pressed on a draggable node (the first interactive node the ray finds, as for `press`) holds the
  gesture: the camera controls do not see it, so a drag that starts on a draggable node moves the node, never the
  camera. A pointer that moves no farther than `PRESS_SLOP` before its release is still a `press`.
- The node moves on its parent's x-z plane through the node's position (the ground of a level group; a tilted group
  tilts it), where the ray meets that plane, keeping the point it was grabbed by under the pointer. Only the axes
  `draggable` names change; `bounds` and `snap` apply.
- The node moves in the renderer only, and the scene is `pending` until each frame is drawn. On release the scene tells
  `onMove` the path and the new `position` once (in the parent's space, as the camera's `onCamera`), ends any
  `transition` of the node there, and tells `dragEnd` with the point. Escape or a pointer cancel puts the node back and
  writes nothing.
- A ray parallel to the plane keeps the last position.
- `hover` is not told during a drag. While a node is draggable the canvas has `touch-action: none`.

## Keys

A focused proxy button of a draggable node moves it with the arrow keys: Left and Right along x, Up and Down along z (Up
is -z, away from a camera in front). Each press is a finished move: `onMove` and then `dragEnd` at once. Keys the scene's
`keys` lists are taken before the proxy sees them.

## The component

The `scene3d` controller writes `onMove`'s `position` to `<path>.position` (a `<-position` link lands on its target, as
a 2D drag writes) and raises `dragEnd` with `{ shape, key, point }`, so the dispatcher runs the node's `on.dragEnd` and
records it at `$.raised`.

The agent tools drag a 3D node as a 2D shape: `ui_interact` `drag` with an offset `+dx,+dy` on the node's path. It refuses
a node whose cursor is neither `grab` (a draggable 3D node) nor `move` (a 2D shape, or a scene with controls, where the
drag turns the camera).

## Decisions

- `repeat3d` copies are not dragged yet: a copy is an instance of one mesh, and its position lives in a record the row
  links. `draggable` on a row template is ignored. Dragging copies is the next step when a builder needs it.
- A key the scene used on a proxy button stops there, so an arrow that moves a node does not also pan the camera.
- No vertical drag and no rotation; both belong to the gizmo the modeling gap names.
- `bounds` holds the position, not the node's box: a 3D box depends on rotation and scale, and boards place pieces by
  their centre.
- The drag code is in the runtime chunk (`@punyts/stateui-3d`), which had about 4.8 KB left under its gzip gate.

## Rules and Constraints

- Nothing is written during a drag; one write per drag, on release.
- A node that is not draggable behaves as before, and a scene with no draggable node handles the pointer as before.

## As built

- stateui-3d: `src/drag.ts` (`dragAxes3d`, `positionOf3d`, `keepPosition3d`, `stepMove3d`, `DEFAULT_STEP_3D`); the option
  `onMove` (`NodeMove`), the event `dragEnd`, the pointer drag, Escape, cursors and `touch-action` in `src/scene3d.ts`;
  `ProxyHooks.key` in `src/proxies.ts`. The chunk is 189,392 bytes gzipped (gate 193,004). README, "Drag". Tests:
  `src/drag.test.ts`.
- stateui-components: `draggable`, `bounds`, `step`, `snap` and `dragEnd` in `src/shared/shape/interaction3d.json` and
  `NODE3D_PROPERTIES` (`src/shared/scene3d/tree.ts`, with the mirror types `NodeMove` and `onMove`); `onMove` in
  `scene3d.controller.ts`. README, "Drag". Tests: `test/composites/scene3d-events.browser.test.ts` with the real chunk (a
  pointer drag writes once on release, runs `on.dragEnd` and writes no camera; a move within the slop is a press; Escape
  puts the node back; bounds and snap; arrow keys with Shift and no camera pan), `test/graphics3d.test.ts`.
- stateui-mcp: the `scene3d-behavior` guide topic; `ui_interact` `drag` takes the `grab` cursor
  (`src/infrastructure/preview/BrowserPreview.ts`) and its refusal names the 3D axes (`shapeTargets.ts`). Test:
  `test/browser.integration.test.ts` ("should drag a draggable mesh by an offset with ui_interact…").
