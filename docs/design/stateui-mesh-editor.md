# The mesh editor: geometry kept in state, shaped in the scene

Status: designed 2026-11-23; V1 built 2026-11-23; V2 to V4 not built.

Asked for on 2026-11-23: "Design the mesh editor", the gap the games and 3D analysis
([stateui-games-and-3d-modeling.md](stateui-games-and-3d-modeling.md)) leaves: "No mesh editing | Geometry is a
primitive or an imported GLB; there are no vertices, extrusion, booleans or subdivision | A mesh-editor component that
keeps its vertices and faces in state | Large, a project of its own". Asked who edits, the owner chose "both, person
first": a person shapes a mesh in the running app, and an agent can write the same geometry (owner, 2026-11-23). Asked
which operations, the owner chose core box modeling: moving, turning and scaling picked vertices, edges and faces,
extrude, inset, delete, merge and one level of subdivision, without booleans (owner, 2026-11-23). Asked where a mesh
lives, the owner chose state, with the GLB export for a finished model (owner, 2026-11-23).

## Why

A `mesh` is one of seven primitives, and a `model` shows a GLB made elsewhere. A product configurator, a room layout or
a board game builds from primitives, but nothing lets a person or an agent make a shape that is not one: a stool with
tapered legs, a lamp shade, a game piece. Modeling tools start from a box and push its faces out; this design gives a
`mesh` geometry of its own, kept in state like any other value, and the tools to shape it in the scene.

## The design

### Geometry of its own (V1)
- `mesh`'s `geometry.kind` gains `custom`. A custom geometry holds:
  - `vertices`: an array of `[x, y, z]` in the mesh's own space.
  - `faces`: an array of faces, each an array of 3 to 32 vertex indices, counter-clockwise seen from the side the face
    looks to.
  - `shading`: `flat` (the default; each face shows its own normal) or `smooth` (normals averaged at shared vertices).
- Both are arrays, so the order is the index and no key is integer-like. Edges are not stored: they are the sides of the
  faces.
- Limits: at most 4,000 vertices and 4,000 faces (`MAX_EDIT_VERTICES`, `MAX_EDIT_FACES`), about 150 KB of JSON at the
  most, which the document's 512 KB data cap also bounds. Written numbers are rounded to 4 decimals.
- Validation (`SUI-STATE-INVALID`, a new `polyMesh` validator in the shape vocabulary): a vertex that is not three finite
  numbers, a face with fewer than 3 or more than 32 indices, an index out of range or repeated in one face, or a count
  past the limits. The renderer draws what is valid and reports the first bad face once as `SUI-RUN-3D`, so a value a
  link brings at run time never breaks the scene.
- A face is drawn as a fan of triangles from its first vertex: a face should be flat and convex, and a concave one is
  drawn as its fan gives. There are no texture coordinates; a `material.map` on a custom geometry is not drawn and is
  reported once as `SUI-RUN-3D`.
- A custom mesh is a mesh everywhere else: `material`, shadows, `transition`, `animate`, `interactive`, `draggable`,
  `gizmo`, the game loop's `body` (its box is the box about the node's origin that holds every vertex, as the loop's
  boxes are centred on their node), a `repeat3d` row (all copies share the one geometry) and the GLB export.
- An agent shapes a mesh by writing `geometry` (`ui_nodes_write`, or `ui_data_write` when `<-geometry` links it to a
  record). A box is the custom geometry an agent or the example starts from.

### Picking in the scene (V2)
- `mesh` gains `edit`: `{ mode, picked }`. `mode` is `none` (the default), `vertex`, `edge` or `face`; `picked` is the
  list of picked vertex indices, edges as `[a, b]` pairs (a smaller index first), or face indices.
- A custom mesh whose `edit.mode` is not `none`, that is `interactive` in a scene with a feeder (`onMove`), is in edit
  mode. It draws its vertices as dots and its edges as lines over its faces; picked ones are drawn in the pick colour.
  The colours are fixed, as the gizmo's are (`EDIT_COLORS`): they mark the tool, not the theme.
- A press on the mesh picks the nearest element of the mode under the pointer: a vertex within 10 CSS pixels of where it
  is drawn, an edge within 8, or the face hit. Only elements in front can be picked; turning the camera reaches the
  others. A press replaces the pick; Shift and a press add the element or take it out. A press beside the mesh clears
  the pick. Each press writes `edit.picked` once.
- In edit mode a press of the mesh does not raise `press`, and the mesh is not dragged by `draggable`.
- An app shows mode buttons by linking `edit`, such as `"<-edit": "$.data.workshop.edit"`, and a button writes
  `$.data.workshop.edit.mode`.

### Moving the pick (V3)
- In edit mode with a pick, the mesh's `gizmo` (`move`, `rotate`, `scale`) acts on the picked elements instead of the
  node: the handles sit at the centre of the picked vertices, along the mesh's own axes, and move, turn or scale those
  vertices about that centre, with the gizmo's `snap` steps.
- The vertices change in the renderer only while the handle is held. On release the scene writes `geometry` once, with
  the moved vertices; Escape or a pointer cancel puts them back and writes nothing.
- **Undo.** The `scene3d` controller keeps each edit mesh's history (`MESH_HISTORY_LIMIT`, 100 entries): the
  `geometry` before and after every edit the person made in this page. Ctrl+Z and Ctrl+Shift+Z (Cmd on macOS) undo and
  redo while the scene has focus, and `editRequest` `undo` and `redo` (V4) do the same. An undo whose mesh someone else
  changed since (its `geometry` is no longer that entry's after) is skipped, so it never takes back another person's
  work. The history lives in the page and is not written to state.

### Operations (V4)
- `mesh` gains `editRequest`, as `scene3d` has `exportRequest`: a changed value runs one operation on the pick, writes
  `geometry` once, and writes `edit.picked` to what the operation made. `{ op, amount? }`, `op` one of a closed list:
  - `extrude` (faces): moves the picked faces out by `amount` (default 0.2 scene units) along their average normal and
    joins them to where they were with new side faces. The new faces are picked.
  - `inset` (faces): makes a smaller copy of each picked face, `amount` (0 to 1, default 0.2) of the way to its centre,
    with a ring of faces around it. The inner faces are picked.
  - `delete` (any mode): removes the picked faces, the faces that use a picked edge or vertex, and the vertices no face
    uses any more.
  - `merge` (vertices): moves the picked vertices to their centre and makes them one; a face left with fewer than three
    vertices is removed.
  - `fill` (vertices): makes a face of the picked vertices in the order they were picked.
  - `flip` (faces): turns the picked faces to look the other way.
  - `subdivide` (any mode, the whole mesh): one level of Catmull-Clark subdivision, every face becoming quads. It is
    refused when the result would pass the limits.
  - `undo`, `redo`: as the keys.
- An operation that does not fit the mode or the pick (an `extrude` of vertices, a `fill` of two) writes nothing and is
  reported once as `SUI-RUN-3D`, naming the operation and the mode.
- The operations are pure code over `{ vertices, faces }` in stateui-components (`src/shared/model/`), outside the
  runtime chunk, as the game loop's step is. The same code can later run as logic commands, so an agent shapes a mesh
  without a page.

### The tools and the example (V4)
- stateui-mcp: a guide topic `scene3d-modeling` (custom geometry, `edit`, the operations, writing `geometry` from a
  tool, the limits); `ui_interact` already presses, holds keys and drags gizmo handles.
- The example app gains a Workshop section: a stool modeled from a box, mode buttons (vertex, edge, face), operation
  buttons, undo and redo, and a button that saves the model as a GLB file through the scene's `exportRequest`.

### Where it runs
- stateui-3d, in the runtime chunk: building a custom geometry (fan triangles, flat or smooth normals), the edit
  overlay, picking, and the gizmo on a pick. Its renderer `update` diffs `geometry` and `edit` as it diffs every
  property.
- stateui-components: the `mesh` shape (`custom`, `edit`, `editRequest`), the operations and the history in
  `src/shared/model/`, and the `scene3d` controller, which runs an `editRequest`, writes `geometry` and `edit.picked`
  through the node's links, and handles the undo keys.
- stateui-app: the `polyMesh` validator.

## Stages
1. **V1, geometry of its own**: `custom` with `vertices`, `faces` and `shading`; validation and limits; the renderer,
   the export, the game loop's box. Tests in stateui-3d (`geometries.test.ts`, the browser suite), stateui-components
   (the shape, the catalog) and stateui-app (the validator).
2. **V2, picking**: `edit`, the overlay, picking by mode, Shift to add, `edit.picked` written per press.
3. **V3, moving the pick**: the gizmo on the picked vertices, one write on release, the history and the undo keys.
4. **V4, operations, the tools and the example**: `editRequest` and the operations, the guide topic, the Workshop
   section.

## Decisions
- **Geometry in state, not a file** (owner, 2026-11-23): a mesh syncs, links and undoes like any value, and logic can
  read it. A finished model can be saved as a GLB through `exportRequest`.
- **People first, agents too** (owner, 2026-11-23): V1 already lets an agent write geometry; picking and handles come
  next; operations as logic commands come after V4.
- **Core box modeling, no booleans** (owner, 2026-11-23): a robust boolean library would cost tens of KB in the runtime
  chunk, and box modeling makes most props without one.
- **Part of `mesh`, not a new component**: a custom mesh is placed, lit, moved, exported and played like a primitive
  one, and a `repeat3d` row can use it.
- **Arrays of vertices and faces, not keyed maps**: indices are what faces refer to, and keyed maps of integer-like keys
  would reorder.
- **One whole `geometry` write per edit**, not a write per moved vertex: an edit is one change in sync and in undo, and
  it lands through a `<-geometry` link as any value does. At the limits a write is about 150 KB.
- **Operations through `editRequest`**, as the export goes through `exportRequest`: a button, a rule or an agent sets a
  value, and nothing new is needed in `on` or logic.
- **Fan triangulation, flat and convex faces**: what box modeling makes; ear clipping of concave faces would add code to
  the chunk for faces modeling rarely makes.
- **No texture coordinates in the first release**: a mesh is coloured by its material; unwrapping is a tool of its own.
- **The runtime chunk's gate is raised by what V1 to V3 measure**, as it was for the gizmo; the operations stay
  outside the chunk. To confirm with the owner when V1 is built, with the measured size.
- **Pointer picking only**: as with the gizmo, a keyboard user edits through fields beside the scene or the
  operations' buttons; vertices have no proxy buttons.

## As built
V1, 2026-11-23:
- stateui-app: the `polyMesh` validator and `MAX_EDIT_VERTICES`, `MAX_EDIT_FACES` and `MAX_FACE_SIDES` (`src/core/shape/types.ts`,
  `validators.ts`). Tests: `src/core/shape/validators.test.ts` ("polyMesh"), `src/core/shape/shape.test.ts`.
- stateui-3d: `custom` in `src/geometries.ts` (`CustomParams`, the same three limits, `SHADINGS`), drawn by
  `createGeometry`; the `geometry` kind of `Scene3dIssue` (`bad_face: <index>`, `no_uvs`) told by `SceneGraph` for a mesh
  and by `RepeatInstances` for a `repeat3d` (`src/scene.ts`, `src/instances.ts`). A custom mesh's map is not read. Tests:
  `src/geometries.test.ts` ("custom geometry"), `src/scene3d.browser.test.ts` (drawn, hit and bounded; the issues told
  once), `src/glbWriter.test.ts` (exported flat and smooth).
- stateui-components: `mesh.state.json` (`custom`, `vertices`, `faces`, `shading`, `polyMesh`); `geometryHalf` of
  `src/shared/play/play.ts` for the game loop; `Scene3dIssue` in `src/shared/scene3d/tree.ts`, reported as `SUI-RUN-3D` by
  the controller. Tests: `test/graphics3d.test.ts`, `src/shared/play/play.test.ts`,
  `test/composites/scene3d-texture.browser.test.ts` ("custom square").
- stateui-mcp: the 3D guide topic names custom geometry, so an agent can write one before V4's `scene3d-modeling` topic.
- The runtime chunk grew by 648 bytes gzipped (194,515 of the 195,269 the gate allows), so V1 needed no raise; 754 bytes
  are left for V2 and V3.

## Rules and Constraints
- Nothing is written while a handle is held; one `geometry` write per edit, on release or per operation.
- A mesh that is not `custom`, and a custom mesh whose `edit.mode` is `none`, behaves as before.
- The edit overlay is never exported, never in the scene's bounds and never what `hit` finds.
- The operation, mode and shading vocabularies are closed lists.
- The history stays in the page: undo is never written to state and never undoes another person's change.
- The operations are pure, free of DOM and three.js, and outside the runtime chunk.
