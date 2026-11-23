# Exporting a 3D scene as GLB

Status: built 2026-11-22.

Asked for on 2026-11-22: "let's continue", after the games analysis
([stateui-games-and-3d-modeling.md](stateui-games-and-3d-modeling.md)) named "a GLB export effect" its last next step
(its gap "No export": "A scene is JSON state | An effect function that builds a GLB (or STL) file from the scene state
and stores it as a file"). Asked where it should run, the owner chose the scene itself: "In the scene3d" (owner,
2026-11-22), over a server effect and over three's `GLTFExporter` with a raised size gate.

## The properties

A `scene3d` gains two properties and an event:

- `exportRequest`: any JSON value. While it is set (not `null`, `""` or absent) and differs from `exported.request`,
  the scene exports what it draws once, after the frame that has every model and texture. Logic asks for an export with
  `set` (`"value": "$.data.game.turn"`, or a counter).
- `exported`: written by the scene, never by the app: `{ request, file }` after an export, the `file` the reference
  `{ id, name, size, type }` of the saved GLB, or `{ request, error }` with a transfer code (`too_large`,
  `unsupported_type`, `quota`, `offline`, `internal`) when the save failed. Because `request` is kept, an export is not
  made again for the same request after a reload, and a failed one is not retried until the request changes.
- The event `exported` (`{ file }`) after a save, so `on.exported` can copy the reference where the app keeps it.

## The file

- A binary glTF 2.0 file named `<_title>.glb` (`scene.glb` for a blank title; `_title` defaults to "3D scene"), type `model/gltf-binary`, handed to the host
  with the bubbling, composed `ui-file-transfer` event as a `paintField` hands its PNG. A file over 10 MiB is
  `too_large` before it is sent; no host hook is `offline`.
- It holds what the scene draws at that moment, in scene units (metres, y up, as glTF): every mesh that is shown (its
  geometry's positions, normals and indices, with its world matrix as the node's), each shown instance of a `repeat3d`
  as a node of its own, and the meshes of the imported models.
- Each mesh's material: its colour (an instance's own colour for a copy) with its opacity (`BLEND` below 1), metalness,
  roughness and emissive colour.
- Not in the file: image maps, lights, cameras, labels, the environment, fog, skinning, morph targets and clips.

## Decisions

- In the scene, not a logic effect: an effect has no page and cannot reach the file hook, and the scene has the
  geometry already built (owner, 2026-11-22).
- A writer of its own in the runtime chunk (`glbWriter.ts`), not three's `GLTFExporter`: the chunk had about 2.6 KB
  gzipped left under its gate, and the exporter is several times that. It writes only what the list above names.
- Nodes carry world matrices and no hierarchy: the file is a snapshot to view or print, not a scene to edit back.
- The old file is not given back when a new export replaces it: the app may have copied its reference. The host's sweep
  frees an unreferenced file.

## As built

- stateui-3d: `writeGlb` (`src/glbWriter.ts`), `Scene3d.exportGlb` (`src/scene3d.ts`). README, "GLB export". Tests:
  `src/glbWriter.test.ts` (a moved box read back with `parseModel`, a repeat's instances, opacity and an empty scene).
- stateui-components: `SceneExport`, `exportFileName`, `requestToken` (`src/shared/scene3d/glbExport.ts`), wired in
  `scene3d.controller.ts`; `exportRequest`, `exported` and the event `exported` in `scene3d.state.json`. README,
  "GLB export". Tests: `src/shared/scene3d/glbExport.test.ts`, `test/composites/scene3d-export.browser.test.ts` with
  the real chunk (the file read back as a GLB, `exported` and `on.exported`; a request set before the first frame and
  not repeated; no host hook is `offline`).
- stateui-mcp: the `scene3d-models` guide topic.

## Rules and Constraints

- No store write but `exported`, once per export. The export does not change what the scene draws.
- A scene with no `exportRequest` behaves as before.
