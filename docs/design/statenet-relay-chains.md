# Relays under relays

Status: designed 2026-11-22, not built. Follows S13 ([statenet-relay-directory.md](statenet-relay-directory.md)) in
[statenet-network.md](statenet-network.md).

Asked for on 2026-11-22: "Let's do it", to the open item of S9 as built: "Only one relay between a node and the
aggregate is routed. A relay under another relay does not pass an ask it has no way for up to its parent."

## Why

A relay may link to a relay (`mayLink('relay', 'relay')`), and what a node sends to be saved already goes up any
number of relays: each passes `persist`, `load` and `remove` to its own parent. What does not work is reaching a node
below a relay that is under another relay. A relay routes an ask for a node it is not linked to by the directory: the
node's `parent`, then that relay's `endpoint`, dialled directly (`RelayNode.ts`, `route`). Only the aggregate lists
relays, and only those whose link reaches it (S13), so a relay one step further down is never listed and the nodes
under it cannot be reached from another group.

Passing an ask with no way up to the parent relay does not help: the parent reads the same directory and has no way
either. The fix is to list every relay of the tree, with its real parent; routing then dials it as it dials any
relay.

## The design

### A relay passes up the relays linked below it
- When a relay's link opens on another relay (not on the aggregate), that relay sends up its own link
  `relay-linked { certificate }` with the certificate the child proved in its hello, and `relay-unlinked { id }` when
  the child's last link closes. Links are counted per child, as the aggregate counts them (S13).
- A relay that passes these on for its children's children does the same: the message goes up link by link until it
  reaches the aggregate, each relay naming itself as the one it came from (`via`).
- When a relay's link up opens again (a reconnect, another parent), it sends `relay-linked` for every relay linked
  below it, so the aggregate lists them again.

### The aggregate lists them under their parent
- The aggregate checks the certificate itself (signed by the statenet's authority, a relay's, not expired) and lists
  the relay as S13 lists one linked to it: everything from the certificate, `parent` the relay it came through first
  (`via` of the first hop), `protocol` the mesh protocol.
- It keeps which relays it listed under which: when a relay's link to the aggregate closes, it unlists that relay and
  every relay listed under it, at once. They come back when that relay links again and passes them up.
- Heartbeats and the sweep work as in S13.

### Routing
No change: a relay routes by `parent` and `endpoint`, and now finds them for every relay of the tree. An ask another
relay passed on is still delivered below or not at all.

## Rules and Constraints
- A directory row of a relay states only what its certificate says, plus `parent` and `protocol`; the aggregate
  checks the certificate itself, so a relay cannot list another relay that does not hold a certificate.
- Only the aggregate writes relay rows (S13).
- One new pair of mesh messages, `relay-linked` and `relay-unlinked`, only up a relay's link. The mesh protocol
  becomes 3; every node of a statenet deploys together.

## Decisions
- To be made with the owner: whether the aggregate should also want proof that the relay below holds its key (the
  relay it is linked to checked the proof in the hello; the aggregate sees only the certificate). Proposed: no, as a
  relay is trusted with what it passes on today (saves, `node` of a save).

## Checks
- `src/mesh/groups.test.ts`: an aggregate, a relay under it and a relay under that relay, a node under each, of two
  groups: the nested relay listed with its parent; a forwarded write, a subscription and a claim between the two
  nodes; the nested relay and its children unlisted when the middle relay's link closes, and listed again when it
  comes back.
