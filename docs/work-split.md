# Who builds what

Two machines build in this workspace: this one (the UI machine) and the tower (statenet networking). This file says what
each is working on, so neither starts the other's work. Update it when work starts or lands, and pull before starting
anything.

Updated 2026-11-22.

## This machine

In progress:

1. **The agent sees the page.** Magnetic's agent gets `ui_preview`, `ui_screenshot` and `ui_interact` back: one shared
   headless Chromium per server, a browser context per workspace, and a short-lived agent session so the headless page
   can sign in to its own workspace's view. Design: [design/magnetic-agent-browser.md](design/magnetic-agent-browser.md).
   Touches `magnetic/src/agent`, `magnetic/src/server`, `magnetic/src/auth`, stateui-mcp's
   `src/infrastructure/preview/BrowserPreview.ts` and `docker/Dockerfile` (Chromium in the image).
After the tower's `/paths` route lands:

2. **The clients of `/paths`** ([design/statenet-paths-route.md](design/statenet-paths-route.md)): a file reference to
   its `/paths` URL for `mediaPlayer`, the read grant in the runtime frame and its image and media policy, real tiles in
   the example and the showcase.

## The tower

Built 2026-11-22: what sharing leaves behind ([design/magnetic-sharing-leftovers.md](design/magnetic-sharing-leftovers.md));
the limit of held changes on a node with no link and the notice of a refused change
([design/statenet-network.md](design/statenet-network.md)); relays in the directory, S13
([design/statenet-relay-directory.md](design/statenet-relay-directory.md)).

1. **The `/paths` route** ([design/statenet-paths-route.md](design/statenet-paths-route.md)): the sources table, the
   MapTiler tile cache, files with byte ranges, the read grants.
2. **The statenet's open items** ([design/statenet-network.md](design/statenet-network.md), "As built" and its notes):
   - a restarted aggregate forgets what landed, so a save sent again is written again;
   - only one relay between a node and the aggregate is routed.
3. **The direction's later items** ([design/statenet-direction.md](design/statenet-direction.md)): the permission
   schema, sharing and revocation; requests that wait for an offline owner; the binary wire format; WebRTC, then
   WebTransport.

The tower owns `statenet`, `state-sync`, the mesh and Magnetic's `src/statenet`. Work here that needs a change there
asks first, in this file.

## The owner

- Deploys (`node infra/aws/deploy.mjs`, with Docker Desktop running), stack changes and SSO.
- The MapTiler template and key: `/magnetic/map-tiles-url` and `/magnetic/map-tiles-key` in SSM (us-east-1), and
  `MAP_TILES_URL` and `MAP_TILES_KEY` in `.env`. Whether MapTiler's terms allow our proxy and disk cache.
- The manual checks on Safari and an Android keyboard (the rich-text editor, the composer, the map's touch drag):
  blocked and deferred.

## Not scheduled

These wait until users ask for them or the load needs them:

- More than one Magnetic server: sessions, live views and authorities still assume one process.
- Object storage for file bytes, and ADR-0017's open questions (malware scanning, a workspace quota, backing up the
  files folder).
- The rich-text editor's later items: images as app files (after `/paths`), comments anchored to text, character-level
  merging.
- Vector map tiles (a WebGL chunk), resizing a window from its left or top edge and snapping to edges, and SCIM's
  extras (roles from the provider, more attributes, bulk requests).
