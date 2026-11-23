# Repeats of a group3d row

Status: built 2026-11-22.

Asked for on 2026-11-22: "Repeats of a group3d row", the gap the games analysis
([stateui-games-and-3d-modeling.md](stateui-games-and-3d-modeling.md)) sized Medium: "`repeat3d` copies are one mesh.
Records may differ only in position, rotation, scale, visibility and colour. A repeat of a `group3d` row (several meshes
per record)". The analysis ranked it first of the next steps.

## The row

A `repeat3d`'s `row` takes a `group3d` as well as a `mesh`. The group holds meshes and further `group3d`s, as a 2D
`drawRepeat` row holds a `drawGroup`:

```json
"pieces": {
  "component": "repeat3d",
  "<-records": "$.data.game.pieces",
  "row": {
    "component": "group3d", "<-position": "$row.at", "interactive": true, "_label": "Piece",
    "children": {
      "base": { "component": "mesh", "geometry": { "kind": "cylinder", "radiusTop": 0.4, "radiusBottom": 0.45, "height": 0.2 },
        "<-material": "$row.paint" },
      "head": { "component": "mesh", "position": [0, 0.5, 0], "geometry": { "kind": "sphere", "radius": 0.25 },
        "material": { "color": "#f5f0e6" } }
    }
  }
}
```

- Each record draws a copy of the whole group at `<repeat>.rows.<recordKey>`. Its parts are at
  `<repeat>.rows.<recordKey>.children.<part>`, as a 2D copy's inner shapes are.
- Every property of every node in the row may be a `$row` link, a link to the store or a literal, as in a mesh row.
- A node in the row that is neither a `mesh` nor a `group3d` (a light, a camera, a model, a label, a repeat) is not
  drawn and is reported once as `SUI-RUN-3D`.
- At most 16 meshes in a row (`MAX_ROW_PARTS`). A mesh past them is not drawn and is reported once as `SUI-RUN-3D`.

## Drawing

- Each mesh of the row (a **part**, named by its place in the row) is one instanced mesh, so a row of three meshes
  over 5,000 records is three draw calls of 5,000 instances each. The cap on records stays 20,000.
- A part's instance matrix is the transforms of the groups above it in the copy, outermost first, then its own
  `position`, `rotation` and `scale`. A group with `visible: false` or `hidden: true` hides every part below it.
- Each part instance has its own `position`, `rotation`, `scale`, visibility and `material.color`, as a mesh row's.
  Each part's geometry, the rest of its material and its shadow flags are shared by its instances: a part whose
  copies differ in one is `SUI-RUN-DRAW` naming it with the part (`children.head.geometry`), and the first copy's is
  drawn.
- A part's `material.map` is read once for all its instances, reported at the template's path of the part
  (`<repeat>.row.children.<part>`).
- A mesh row draws as before: one part, the row itself.

## Pressing

- A hit on a part instance gives the nearest interactive node of the copy: the part, then the groups above it, then the
  copy. So `interactive` on the row's group makes the whole piece one target, and `interactive` on a part makes that
  part its own target.
- Each interactive node of a copy gets a proxy button over its bounds: a group's bounds cover every part below it.
- The dispatcher already runs the row template's `on` entry for a node inside a copy, with `$row` at the record.

## Decisions

- One instanced mesh per part, not per record: a record's group as real objects would make 20,000 records 60,000
  objects, which is what instancing avoids.
- `transition`, `animate` and `draggable` stay unsupported on copies, as for a mesh row.
- The part cap of 16 keeps a repeat at most 16 draw calls.

## As built

- stateui-3d `src/instances.ts`: `Placement3d`, `partOf`, `rowParts`, `MAX_ROW_PARTS`, `RepeatRows` (one
  `RepeatInstances` per part), `InstanceLayout.chainAt`; `src/scene.ts` keeps a `RepeatRows` per repeat;
  `src/scene3d.ts` picks the nearest interactive node of the chain. Tests: `src/instances.test.ts` ("group3d rows":
  parts, the cap, placement under groups, a hidden group, one instanced mesh per part, bounds, a removed part).
- stateui-components: `repeat3d.state.json` (`childComponents` `mesh` and `group3d`, a fourth purpose),
  `src/shared/drawing/rows.ts` (`GROUP_KINDS` compiles a `group3d`'s children), `src/shared/scene3d/repeat.ts`
  (`REPEAT3D_ROW_KINDS`, `REPEAT3D_MAX_PARTS`, `surplusParts`, `mixedProperties` by place). Tests:
  `src/shared/scene3d/repeat.test.ts` ("a group3d row"), `test/graphics3d.test.ts`,
  `test/composites/scene3d-repeat.browser.test.ts` (bases and heads at their pixels, a press on a head gives the copy).
- stateui-mcp: the `scene3d-models` guide topic and the README say what a row may be.

## Rules and Constraints

- A mesh row draws and reports as before.
- No store write: the copies are drawn from the records.
