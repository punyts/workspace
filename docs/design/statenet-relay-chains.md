# Relays under relays

Status: built 2026-11-22, deployed by 2026-11-24. Follows S13 ([statenet-relay-directory.md](statenet-relay-directory.md)) in
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
  `relay-linked { certificate, via }` with the certificate the child proved in its hello and itself as `via`, and
  `relay-unlinked { id, via }` when the child's last link closes. Links are counted per child, as the aggregate
  counts them (S13).
- A relay that dials another relay to reach the nodes below it (routing) says so in its hello (`routing`); that
  link does not make it a child, at a relay or at the aggregate.
- A relay passes on what its children send up unchanged: the message goes up link by link until it reaches the
  aggregate, with `via` the relay the named relay is linked to.
- When a relay's link up opens again (a reconnect, another parent), it sends `relay-linked` for every relay below
  it, each after its parent, so the aggregate lists them again. A child that goes takes the relays under it out of
  what is sent again.

### The aggregate lists them under their parent
- The aggregate checks the certificate itself (signed by the statenet's authority, a relay's, not expired) and lists
  the relay as S13 lists one linked to it: everything from the certificate, `parent` the relay it came through first
  (`via` of the first hop), `protocol` the mesh protocol.
- It lists a relay only when `via` is in the branch of the relay on the link the message came over: a relay vouches
  for its own branch only. A relay linked to the aggregate directly stays listed under the aggregate.
- It keeps which relays it listed under which: when a relay is unlisted (its link to the aggregate closed, or
  `relay-unlinked`), every relay listed under it goes at once. They come back when that relay links again and passes
  them up.
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
- No proof of key at the aggregate for a relay passed up: the relay it is linked to checked the proof in the hello,
  and a relay is trusted with what it passes on today (saves, `node` of a save). Proposed with the design; the owner
  said "Yes, build it" (2026-11-22).
- A routing link is marked in the hello rather than told apart by the directory, so a relay dialled for routing never
  lists the dialler under itself.

## Checks
- `src/mesh/groups.test.ts`: an aggregate, a relay under it and a relay under that relay, a node under each, of two
  groups: the nested relay listed with its parent; a forwarded write, a subscription and a claim between the two
  nodes; the nested relay and its children unlisted when the middle relay's link closes, and listed again when it
  comes back.

## As built
- **statenet** (mesh protocol 3):
  - `src/mesh/protocol.ts`: `relay-linked`, `relay-unlinked`, `LinkHello.routing`.
  - `src/mesh/relayTree.ts`: `createRelayTree`, the relays below a node under their parents (link, unlink with
    its branch, the branch a relay is in, a walk with parents first).
  - `src/mesh/MeshServer.ts`: `OpenedLink` (`certificate`, `routing`) passed to `onLinkOpened` and `onLinkClosed`;
    `relayLinked` and `relayUnlinked` hear the messages, only on a child relay's link.
  - `src/mesh/MeshUpstream.ts`: `routing`; `relayLinked` and `relayUnlinked` keep the tree below and send it up
    again when the link opens.
  - `src/mesh/RelayNode.ts`: counts child links and passes children, and what they send up, to its link up; its
    routing links say `routing`.
  - `src/mesh/Aggregate.ts`: `startAggregateNode` checks a passed-up certificate, lists it under `via`, unlists
    branches; `relays()` lists the tree.
- **Magnetic**: no change; `MagneticAggregate` heartbeats `relays()`, now every relay of the tree.
- Tests: `src/mesh/groups.test.ts`, "relays under relays": the nested relay listed with its parent, a write, a
  subscription and a claim between a node under each relay; both relays unlisted when the aggregate stops and listed
  again under the same parents when a new one starts on its address; a passed-up certificate the authority did not
  sign is not listed.
