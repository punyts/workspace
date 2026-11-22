# Statenet Direction – Owners, Blueprints, Models and Relays

## Identity
Where the statenet is going after the proof of concept: one global tree of state addressed by registered owners, apps published as versioned blueprints that each persona overlays with its own state, data structured by models, and a web of edges, relays and persistence that keeps live state close to whoever listens to it. Nothing here is built; the decisions below were reached in design discussion and are the direction new work should not contradict. Items marked **Later** need their own design before any ticket.

Today's system is in `knowledge-base/design/stateui-state-sync.md` in AI Minion (one namespace per app, an authority per namespace, the statenet as a logic-free store). The logic layer, which comes first, is in `knowledge-base/design/stateui-logic.md` in AI Minion. The proposed owner tree for authoring (apps, themes, logic, models, data and components under the owner, and personas under their own root) is in `knowledge-base/design/stateui-owner-tree-and-tools.md` in AI Minion.

---

## Design

### Owners and paths
- **`$` is an owner.** The root of a state tree is an owner id: an unsigned 64-bit integer, registered globally. Only owners are registered; everything below an owner is that owner's business, like a domain name.
- **Owner kinds.** An owner is a person, a group or a business. Ids are collated so ranges carry meaning; the first 999,999,999 are reserved.
- **Ids are integers, not strings.** 64 bits to store, index and route on. In code they are `BigInt`; in JSON, the transport and persistence format, they are text that is hydrated to `BigInt`, by the model of the field where there is one.
- **Personas are scopes.** Every user path has a persona segment that the user names (`work`, `personal`), with a reserved default. A persona is organisation inside the user's own tree, not a separate identity, and it is how one person has the same app twice.
- **Path shape.**

```
[business].apps.[app]@2.3.0                         blueprint, published, immutable
[user].[persona].apps.[business].[app]              that persona's state: the delta over the blueprint
[user].[persona].data.…                             the persona's own data
[business].data.marketing.contacts                  the business's data (a dataset, following a model)
[business].data.marketing.contacts.c12@2.3.0+2      one record at one version
```

- **Blueprints stay relative.** Inside a blueprint, `$.data.contacts` stays relative and is bound to a real data path at install; global paths appear only in registration and bindings, so one blueprint works over any owner's data.

### Blueprints and persona state
- **The blueprint** is the screens, the logic, the default values and the data sources the app needs. The publisher is a business; people who work there use its apps under their own ids, so a blueprint path is never anyone's state.
- **The persona's copy** holds only what differs from the blueprint's defaults (the split `snapshotState` already makes between document values and articulation), the blueprint version it extends, and the data each declared source is bound to. It is persisted and follows the person across devices; this needs sign-in (OAuth and JWT), which is secondary for the proof of concept.
- **Reads overlay, writes go to the delta, reset deletes the delta entry.**
- **Shared app state is data.** Something several people see together (Ana's cursor) is a value at a path that its owner shares and others listen to. Live updates for it travel as described in [Transport and encoding](#transport-and-encoding).

### Models
- State is data with a structure: a plain object or array, or a typed model.
- **A model** defines the structure of state: data types, defaults, validation rules and extensions. Component shapes (`*.state.json`) are already this for nodes; models are the same for data.
- **Extension is an overlay.** An owner can extend another owner's model: their model points at the base and the system lays it over the base. It is the same overlay mechanism as blueprint and delta, theme overlays and locale overlays, and should be one mechanism.
- **Migrations carry their details.** A model change that needs data to move says how: a new required field carries its initial value, so an upgrade can be checked before it runs.
- **Later:** machines on models (an invoice's lifecycle runs on the data owner's edge for every app that touches it); who runs a data migration when a blueprint needs a newer model than an owner's data follows.

### Versions and history
- Versioning is history. A record follows a model version, and each change of its values is an iteration of that version, written as build metadata: `2.3.0+2` is the second iteration under model `2.3.0`. Changing a value gives the value and its row a new iteration.
- **Order is model version, then iteration as an integer.** Semver ignores build metadata when ordering, so the order is ours.
- **Owners choose the scheme** per path pattern and per kind of state (app, data, logic): none, all, last *n*, and so on. App state such as a scroll position usually has none.
- The authority assigns versions; a change made offline has none until it is accepted. One commit is one iteration per record.

### Path patterns are the core
Four parts of the system are the same thing, a table from path patterns to something:

| Table | Pattern → |
|-------|-----------|
| Permissions | who may read, request or write |
| Versioning | which scheme applies |
| Relays | which downstream nodes listen |
| Logic | which transitions fire |

One fast matcher on integer paths (with wildcards and captures) serves all four.

### Permissions
- Permissions are on paths and may use wildcards. **Later:** the schema, sharing and revocation.
- **Three levels.** Read (listen to the value), request (propose a change without write permission; it waits for the owner) and write (relayed to the owner's authority, which can still reject it).
- **Requests wait.** A request that needs the owner's approval while the owner is offline stays pending on the owner's edge (`requested → approved | rejected | expired`). **Later:** what the requester sees meanwhile, expiry, and approving a request whose value has since changed (decided by the owner's logic, like a stale change today).
- Read access is a key: granting read on a path pattern hands out that pattern's key, and revoking it rotates the key, so a revoked reader gets nothing new. What a reader already saw cannot be taken back.

### Edges, relays and persistence
| Role | What it does | Sees |
|------|--------------|------|
| **Edge** | The user's statenet provider node: the owner's authority, logic and keys; turns content into tokens and back; always on, so it holds requests while the owner is offline | Content, for its own users |
| **Relay** | Listening and routing: the paths being listened to and the downstream nodes to update; caches often used values | Path tags and encrypted packets |
| **Persistence** | Where relays split data into packets across storage providers | Encrypted fragments |

- Changes carry full global paths, so the socket between a browser and its edge only carries changes; listening to a path outside the app's scope adds a listener at the edge, and relays fan changes out to listening nodes. The live state is kept in relays; the parts of the statenet people use become listened to and cached.
- **Every path has one authority**, its owner's edge. Relays route, check permission and cache; they never decide.
- **Relays see tags, not paths.** A tag is a keyed hash chained per level (`tag₁ = HMAC(k, owner)`, `tagₙ = HMAC(k, tagₙ₋₁ + segment)`) with the path's read key, so only readers can compute it, a plain dictionary of owner ids and common names does not reverse it, and a listener can subscribe at any level. Relays match only leading parts of a path; finer patterns are filtered at the edge. Rotating a key changes the tags under it.
- **What relays still learn:** path depth, which tags share a leading part, and who listens to whom and when. Hiding the last needs mix-network routing and is out of scope.
- **Later:** how packets are split across providers (erasure coding, how many fragments, how many rebuild a value).

### Transport and encoding
Recorded on 2026-11-21 from the owner's question: "I was thinking more of RTC for UDP connections to the node. If we don't want the overhead of JSON".

Transport and encoding are separate choices, and they come in this order:

1. **Binary encoding on the WebSocket.** The encoding replaces JSON on the browser-to-edge socket and between nodes. Paths are integer ids or tags, and models give each field's type, so a change is encoded as its path id, its version and its value, with no field names and no text parsing. A value with no model uses a general binary form (CBOR or MessagePack). This removes JSON's size and parsing cost for all traffic and needs no new infrastructure.
2. **A no-history path class.** A path pattern can be marked as never persisted, unversioned and latest value wins. Cursors, presence and live positions are examples. Relays forward these paths and never store them, and the browser coalesces them to at most 20–30 sends a second. Versioning scheme `none` already allows this. The class adds the rule that nothing is persisted. It runs on the WebSocket first.
3. **An unreliable lane, only if measured delay requires it.** If no-history paths still lag under packet loss, add a WebRTC data channel from the browser to its edge. It is set to unordered with no retransmits and carries only no-history paths.

Constraints on these transports:
- **The WebSocket stays.** It sets up the data channel and is the fallback, because some networks block UDP. Reliable, ordered state changes stay on it. A reliable, ordered data channel would stall behind a lost packet just as TCP does, so UDP helps only lossy, latest-wins data.
- **Every transport ends at a node.** There are no peer-to-peer links for state. A peer link would bypass the edge's authority and the relays' permission checks, a revoked grant would not cut off a connected peer, and peers would learn each other's addresses.
- **Live media is the exception.** Voice, video and screen sharing go through a WebRTC SFU (selective forwarding unit), not through state, with call setup carried over the socket.
- **Not on this transport.** Static or cacheable bytes go over HTTP from our own origin, where browser and server caches apply. These include map tiles, recorded video and uploaded files.

Browsers cannot open raw UDP sockets. Their only UDP options are WebRTC data channels and WebTransport. WebTransport (HTTP/3 datagrams and streams) is the better fit for client-to-server traffic, but Node's QUIC support and Safari's WebTransport support are not yet dependable. A data channel needs a WebRTC stack on the node (node-datachannel or werift). It also needs a public UDP port, while statenet binds loopback only today behind Caddy, which proxies only the WebSocket.

**Later:** the binary encoding's wire format and how a model version selects it; which WebRTC stack to use, and how its port and the AWS security group are set up; moving from WebRTC to WebTransport once both are dependable.

### Tokens
- Everything is broken into a finite set of tokens with numeric ids, and tokens are assembled into the next level by their ids, forming a graph. Tokens, and common assemblies of them, are shared by the world: "I like dogs." written by two people is the same id.
- **Ids are assigned by a registry, not hashed.** A 64-bit hash collides at around 2³² distinct items; a registry interns each token once.
- **Token ids never reach a client.** Compositions (the actual data) travel in packets only the edge can decrypt; clients send and receive content. This keeps anyone from testing whether some content exists by its id. It holds only if relays carry content they cannot read and no API or error message exposes token ids.
- **Deleting a value removes the owner's reference**, never the token; a token goes when nothing references it.

---

## User Experience
- A person signs in once and finds every app with their own state on any device, per persona.
- An app built by one business works over another owner's data once its sources are bound.
- Sharing a value (a cursor, a document, a dataset) is granting a path; others see it live, and the owner can approve, reject or revoke.

---

## Rules and Constraints
- Owner ids are unsigned 64-bit integers, `BigInt` in code and text in JSON; only owners are registered globally.
- Every user path has a persona segment; personas are scopes, not identities.
- Published blueprints are immutable and versioned; a persona's state stores only its delta and the version it extends.
- Blueprints use relative paths; global paths appear only in registration and bindings.
- Every path has exactly one authority, the owner's edge; relays never decide.
- Token ids are internal and never reach clients; tokens are assigned by a registry.
- Version order is model version, then iteration; the authority assigns versions.
- Every transport for state ends at a node; there are no peer-to-peer links for state. Reliable, ordered state changes go over the WebSocket, and an unreliable lane carries only no-history paths.
- Static and cacheable bytes (tiles, recorded media, files) go over HTTP from our own origin, not over the state transport.

---

## Interactions with Other Systems
- **The logic engine** (logic epic 1, in `@punyts/stateui-app` for now) provides the path pattern matcher this direction reuses for permissions, versioning and relay routing.
- **`@punyts/state-sync`**: changes move from namespace-relative paths to global paths, and `hello` with one namespace gives way to listening by path pattern.
- **`@punyts/statenet`**: grows into the edge, relay and persistence roles.
- **`@punyts/stateui-app`**: documents become blueprints with declared data sources; the snapshot becomes the persona delta.

---

## Open Questions
- The permission schema, sharing and revocation.
- Who runs data migrations, and when.
- Machines on models, and how they combine with app machines.
- Splitting packets across storage providers.
- The token registry: how it is distributed and how token ids are allocated.
- Clocks for `wait` and `debounce` in a browser that is offline.
- The binary wire format, and when WebTransport is dependable enough to replace WebRTC data channels.
