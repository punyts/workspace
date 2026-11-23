# Who builds what

Two machines build in this workspace: this one (the UI machine) and the tower (statenet networking). This file says what
each is working on, so neither starts the other's work. Update it when work starts or lands, and pull before starting
anything.

Updated 2026-11-22.

## This machine

Built 2026-11-22, not deployed: the agent sees the page ([design/magnetic-agent-browser.md](design/magnetic-agent-browser.md)).
Magnetic's agent has `ui_preview`, `ui_screenshot` and `ui_interact` through one shared headless Chromium per server.

Built 2026-11-22: `window` resizes from every edge and snaps when dragged to an edge
([design/stateui-desktop-stage-2.md](design/stateui-desktop-stage-2.md)).

Built 2026-11-22: comments anchored to text in `richTextField` (T6 of
[design/stateui-text-editor.md](design/stateui-text-editor.md)).

Built 2026-11-22: the frame's side of `/paths` ([design/statenet-paths-route.md](design/statenet-paths-route.md)). The
host gives the runtime frame the files URL and the grant and forwards each new grant; `mediaPlayer` plays a stored
`file`.

Built 2026-11-22: images as app files in `richTextField` and `richText` (T7 of
[design/stateui-text-editor.md](design/stateui-text-editor.md)). Uploads by tool, `/image`, paste and drop; an image
panel for alt text, caption and width; drawn from the `/paths` URL.

Built 2026-11-22: the small game gaps, a seeded `random(seed, n)` and keys on `scene3d`
([design/stateui-game-input.md](design/stateui-game-input.md)).

Built 2026-11-22: dragging a 3D node on its ground, written once on release
([design/stateui-3d-drag.md](design/stateui-3d-drag.md)).

Built 2026-11-22: repeats of a `group3d` row, each mesh of a piece drawn as one instanced mesh
([design/stateui-3d-group-rows.md](design/stateui-3d-group-rows.md)).

Built 2026-11-22: dragging `repeat3d` copies, each drop written to the record
([design/stateui-3d-drag-copies.md](design/stateui-3d-drag-copies.md)).

Built 2026-11-22: a `scene3d` saves what it draws as a GLB file when `exportRequest` changes
([design/stateui-3d-glb-export.md](design/stateui-3d-glb-export.md)).

Built 2026-11-23: move, rotate and scale gizmos on 3D nodes, written once on release
([design/stateui-3d-gizmo.md](design/stateui-3d-gizmo.md)).

Built 2026-11-23: R2's runtime half of requests that wait for the owner
([design/statenet-requests.md](design/statenet-requests.md)): stateui-app's `$.runtime.requests`, the three
`request.*` commands and the `sync.requested` notice, the toast's text, and the view host in stateui-mcp. The tower's
half of R2 (`PgEpochStorage`, the stateui-pg migration) stays the tower's.

Real tiles in the example and the showcase wait for the tower's tiles.

## The tower

Built 2026-11-22: what sharing leaves behind ([design/magnetic-sharing-leftovers.md](design/magnetic-sharing-leftovers.md));
the limit of held changes on a node with no link and the notice of a refused change
([design/statenet-network.md](design/statenet-network.md)); relays in the directory, S13
([design/statenet-relay-directory.md](design/statenet-relay-directory.md)); the files of the `/paths` route, with byte
ranges and read grants ([design/statenet-paths-route.md](design/statenet-paths-route.md)).

1. **The `/paths` tiles** ([design/statenet-paths-route.md](design/statenet-paths-route.md)): the MapTiler tile cache, a
   row of the sources table. On hold (owner, 2026-11-22).
2. **The statenet's open items** ([design/statenet-network.md](design/statenet-network.md), "As built" and its notes):
   - built 2026-11-22: what landed is kept by the storage, so a save sent again after an aggregate restarted writes
     nothing;
   - built 2026-11-22, deployed 2026-11-23: relays under relays
     ([design/statenet-relay-chains.md](design/statenet-relay-chains.md)). Every relay of the tree is listed with its
     parent, so routing reaches the nodes below a nested relay. Mesh protocol 3.
3. **Permissions, S14** ([design/statenet-permissions.md](design/statenet-permissions.md)): built 2026-11-22
   (S14a to S14c). One table of path patterns per owner replaces app access, links, state grants, dataset
   shares and the `/paths` grant. The matcher is in `@punyts/state`, Magnetic keeps every right in
   `permission`, and `/paths` reads with signed tokens. The `request` right waits for "requests that wait for an
   offline owner" below.
4. **Requests that wait for the owner** ([design/statenet-requests.md](design/statenet-requests.md)): R1 built
   2026-11-23 in state-sync and statenet (sync protocol 3, mesh protocol 4), not deployed. A change from someone with
   `request` and not `write` waits on the owner's node until the owner or a holder of read and write decides it. R2
   adds Postgres (`PgEpochStorage` with the serial and requests), still to build here; its runtime half
   (`$.runtime.requests`, three commands, a notice, the toast, the view host) was built on the UI machine 2026-11-23.
5. **The direction's later items** ([design/statenet-direction.md](design/statenet-direction.md)): the binary wire
   format; WebRTC, then WebTransport.

The tower owns `statenet`, `state-sync`, the mesh and Magnetic's `src/statenet`. Work here that needs a change there
asks first, in this file.

## The owner

- Deploys (`node infra/aws/deploy.mjs`, with Docker Desktop running), stack changes and SSO. The next deploy carries
  Chromium (about 920 MB more image): check the t3.small's memory with an agent turn running.
- The MapTiler template and key: `/magnetic/map-tiles-url` and `/magnetic/map-tiles-key` in SSM (us-east-1), and
  `MAP_TILES_URL` and `MAP_TILES_KEY` in `.env`. Whether MapTiler's terms allow our proxy and disk cache.
- The manual checks on Safari and an Android keyboard (the rich-text editor, the composer, the map's touch drag):
  blocked and deferred.

## Not scheduled

These wait until users ask for them or the load needs them:

- More than one Magnetic server: sessions, live views and authorities still assume one process.
- Object storage for file bytes, and ADR-0017's open questions (malware scanning, a workspace quota, backing up the
  files folder).
- The rich-text editor's later item: character-level merging (with the
  statenet direction).
- Vector map tiles (a WebGL chunk), and SCIM's extras (roles from the provider, more attributes, bulk requests).
