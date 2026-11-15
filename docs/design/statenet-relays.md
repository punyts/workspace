# Statenet relays: owned state, moving writers, edge caches and grants

## Summary
Today the statenet is one node: a Node service that keeps state-sync namespaces in files, runs one authority per
namespace, and pushes every change to every client of that namespace. An app server in Full mode runs its own
authority with the app's logic and relays its changes to the statenet.

This design makes the statenet a network:

- **Every piece of state has an owner**, a user or an org, and lives at an address that names the owner and the app.
  Anything at another owner's address, or another app's, is external.
- **One writer at a time.** A namespace has one owner node, the only one that orders its changes and runs its logic.
  Another node can ask to take ownership; a handoff moves it without ever having two writers.
- **Relays cache state at the edge** and pass changes on by interest. A node or browser that wants a path of
  external state asks for it; the relays on the way remember who asked and subscribe upstream once for all of them.
- **Aggregate relays write to the database.** Owners send their changes to an aggregate, which writes them in batches
  and announces how far the namespace is durable. That announcement is the write-complete ack.
- **Grants carry read and write rights**, signed by the owner, checked at the edge for reads and at the owner for
  writes, and revocable. The protocol puts no limits on what an owner may share.

## What already exists
| Need | Already in | Notes |
|---|---|---|
| Changes, revisions, acks | `state-sync` | `set`, `replace`, `merge`, `delete` at a `$.` path; the authority gives each a revision; acks `applied`, `adjusted`, `rejected` |
| Catch-up | `state-sync` `hello` / `welcome` | Changes since the client's revision from the log, or a snapshot |
| Resends applied once | `state-sync` authority | The last applied change ids, so a change resent after a reconnect is not applied again |
| Server logic at the authority | `state-sync` server logic, `stateui-app` logic engine | Rules, machines, decision tables and expressions run where the authority is |
| Secrets in state | `$.server`, relayed sealed as `$.sealed` | The statenet stores ciphertext it cannot read |
| Revocation in the browser | `state-sync` `revoked` scrub | A revoked viewer's local store is emptied, at once or on their next connection |
| One statenet node | `@punyts/statenet` | Persists namespaces through `NamespaceStorage`, loopback only, no authentication |
| Grants and personas | Magnetic `Grants`, stateui-mcp `InstanceKey` | `view`, `use` and `remix` links; an instance per persona |

These pieces are new:
- Addresses with owners and apps.
- Owner nodes with epochs, claims and handoffs.
- Relays with subscription tables, leases and caches.
- Aggregates, the durable watermark, and ephemeral paths.
- Signed capabilities for read and write, with revocation.
- Path-level storage in Postgres.

## Terms
| Term | Meaning |
|---|---|
| Owner | Who state belongs to: a user or an org, by id |
| Namespace | One tree of state, at one address, with one revision sequence |
| Owner node | The node that holds a namespace's authority right now: orders its changes and runs its logic |
| Relay | A node that caches namespaces it has subscribers for and passes changes and subscriptions on |
| Aggregate | A relay that also writes the changes of the owner nodes behind it to the database |
| Listener | Anything subscribed to a path: a browser, an app's logic on a node, another relay |
| Grant | A signed right to read or write paths at an address |

## Decisions

### Addresses: owner, app, path
- A namespace's address is `<ownerId>/<appId>/<scope>`, and a path in it is the usual `$.` path:
  - **The app's state**, owned by whoever owns the app (a user, or an org for an org app): `<ownerId>/<appId>/app`.
    Shared datasets, the records people saved through the app, and anything the app's logic keeps for everyone.
  - **A user's state in an app**, owned by the user: `<userId>/<appId>/user`. Their theme, route, open panels,
    selections and the form they are still filling in. It is theirs, whoever owns the app.
- **Saving is when data is shared.** A form's values are the user's own state while they type. Saving runs the app's
  logic, which writes the record into the app's state. Until then nobody else sees it.
- **External** is anything at another owner's id, and also another app of the same owner. An app is a security
  boundary: every read or write across apps is a grant you can see, audit and revoke.
- Today's namespaces map over: `instances.<persona>.<ownerId>.<appId>` becomes `<personaUserId>/<appId>/user` for the
  user's state, and the owner's datasets move to `<ownerId>/<appId>/app`.

### One writer at a time, and ownership that moves
- Every namespace has exactly one **owner node** at a time. Only it applies changes, gives revisions and runs the
  app's logic. A change sent anywhere else is passed toward the owner node.
- Ownership is a row in the database: `namespace_owner(address, node, epoch, lease_until)`. The owner node renews its
  lease well before it runs out.
- **Epochs fence old owners.** Each change of ownership increases the epoch, and every change carries the epoch it was
  ordered under. Relays and aggregates refuse a change from an older epoch, and the database refuses its writes. An
  owner node that was paused or cut off cannot write after it has lost ownership.
- **Claiming ownership.** A node that wants to write sends a `claim` toward the owner node:
  1. The owner node stops ordering new changes for the namespace and queues what arrives.
  2. It waits until the namespace is durable up to its last revision (the watermark, below).
  3. It answers `handoff` with the revision and the new epoch, and passes the queued changes on.
  4. The new owner node writes the ownership row with a compare-and-swap on the old epoch, and announces `owner` so
     relays send writes to it.
- **An owner node that is gone** loses ownership when its lease runs out. A claimant then takes the row with a
  compare-and-swap, loads the namespace from the database at the durable revision, and starts at the next epoch.
  Changes the old owner ordered but never made durable are lost to everyone alike, and the clients that sent them
  resend them when they reconnect, as they already do after a gap.
- **Forward by default, move when it pays.** Moving ownership on every remote write would bounce it between two busy
  nodes. A node forwards writes, and claims ownership only when it has sent most of a namespace's writes for a while
  (the threshold and window are settings, with hysteresis), or when an app's logic needs to run where its users are.
- The app's logic moves with ownership. Any node that can own an app's namespace loads the app's definition and runs
  its logic engine.

### Ordering, the durable watermark, and the write-complete ack
- The owner node orders a change as soon as it arrives: that single writer is the lock. The change goes out at once to
  relays and listeners as **pending**.
- The aggregate writes changes in batches and announces `durable { address, revision }`: everything up to that
  revision is in the database. The announcement travels the same paths as the changes, and every listener marks the
  changes up to it as **committed**.
- An app that needs certainty waits for the watermark: a payment, an approval, a record someone else will rely on. A
  new data key on a logic step or a client write (`{ await: 'durable' }`) waits for it; everything else updates at
  once. A form save waits for it by default, so the person sees **Saved** only when it is.
- A handoff waits for the watermark to reach the owner's last revision. That is where the write-complete ack works as
  a lock: nothing is in flight while ownership moves.
- One write at a time per namespace would cap each namespace at the database's round trip, tens of milliseconds, so
  writes are pipelined and only the watermark waits.

### Relays and subscriptions
- A relay keeps a **subscription table**: for each address and path prefix, the links below it that asked for it, and
  the grant each one presented.
- A **subscribe** from below names the address, the path prefix, the grant and the revision the listener has.
  - When the relay already holds the namespace, it answers from its cache at once (the changes since that revision, or
    a snapshot of the prefix), then passes on every change under the prefix.
  - When it does not, it subscribes upstream for the prefix itself, once, however many listeners below asked.
- Subscriptions are **leases** that the listener renews. A listener or relay that goes away stops renewing, and its
  entries, and the upstream subscriptions only it needed, lapse on their own.
- A relay caches each namespace it subscribes to with its revision, and serves it while it is subscribed. A gap in
  revisions makes it catch up from upstream, and in the end from the database.
- Writes from below go up through the relays to the owner node, and the ack comes back the same way.
- `$.server` stays sealed through every relay, as it is through the statenet today.

### Aggregates
- Owner nodes send their changes to an aggregate relay. The aggregate writes them in batches, one transaction per
  batch, and sends the owner node `persisted { address, revision }`, which becomes the `durable` announcement.
- The owner node keeps every change until it is persisted, and resends the unpersisted ones to an aggregate after a
  reconnect. The aggregate writes each change id once, so a resend writes nothing twice.
- Each batch writes only when the namespace's epoch in the database still matches, so a late batch from an old owner
  writes nothing.
- An aggregate also answers catch-ups from the database for relays whose caches have a gap the owner's log no longer
  covers.

### Ephemeral paths
- A path can be declared **ephemeral** in the app's definition (a pointer position, presence, typing, a drag in
  progress). Its changes go through the owner node and the relays like any change, but no aggregate writes them, and
  relays keep only the latest value, for a time to live.
- Ephemeral changes get revisions of their own, so they never hold up the durable watermark.
- This is what keeps sharing high-frequency state, such as a mouse, cheap: it never reaches the database.

### Grants: read and write, signed, revocable
- A **grant** names:
  - the **subject**: a user, an app, or a node;
  - the **address** and a **path prefix**;
  - the **rights**: `read`, `write`, or both;
  - the **issuer**, who must be the owner or hold a grant they may pass on;
  - an **expiry**, and an id.
- Grants are signed with the owner's key (Ed25519), so a relay can check one without asking anyone.
- **Reads** are checked at the first relay that serves the subscription, on subscribe and on every renewal.
- **Writes** are always checked at the owner node, so a revoked write grant stops working at once.
- **Revocation:** the issuer sends `revoked { grantId }` toward the owner node. It goes down every subscription tree
  of the address: relays drop the subscriptions that used the grant, close those listeners, and the browser scrub runs
  as it does today. Relays also keep the revoked ids until the grants would have expired, so a renewal with one fails.
- **Short lives:** grants expire after hours, not months, and are renewed while in use. A relay that missed a
  revocation can serve a revoked reader only until the next renewal.
- **Passing on:** a subject can issue a grant for a narrower prefix and fewer rights than it holds, to another subject.
  The chain is checked to the owner. Revoking a grant revokes everything passed on from it.
- **No restrictions in the protocol.** An owner may grant anything to anyone, a pointer position included. Policy is
  the issuer's: before Magnetic signs a grant for an org's state, it checks the org's policy (who may share what, and
  whether outside the org), and an org can require that grants of its members' state in its apps stay in the org.
- **Using an app gives grants.** Opening an app with `use` gives the app's logic `write` on the person's own state in
  it, and gives the person's sessions the reads and writes that the app's permission allows on the app's state.
  Magnetic issues these from its app permissions, so `AppAccess` stays the one place access is decided.
- **The org reads its employees' state in its apps.** An employee's state in an org app is theirs
  (`<userId>/<appId>/user`), but the org can read it without the employee's grant, for support and compliance. Org
  owners and admins get read on it through a standing org grant that Magnetic issues when the employee joins and
  revokes when they leave. It never gives `write`. Every subscription made with it writes an audit event (who read
  whose state in which app, and when), and the employee's Shared by me page shows that the org can read it.
- **Visibility:** every person has a **Shared by me** page: each grant on their state, to whom, the rights, when it was
  last used, and Revoke. Admins have the same page for an org's state. Issuing and revoking are audit events.

### Keys: one per owner, all held by Magnetic
- Every owner, each user and each org, has its own Ed25519 signing key. Magnetic holds them all; nobody manages a key
  by hand.
- **Why one per owner rather than one per org:** a grant's signature then says which owner gave it, so a relay checks
  a grant against the owner in its address and nothing else. One key can be rotated or retired without touching any
  other owner's grants. A leaked key exposes one owner's grants, not a company's. And it leaves the door open to users
  holding their own keys later, without changing the protocol.
- Private keys are stored encrypted (`owner_key`) under a key-encryption key that lives outside the database: an
  environment secret first, a cloud KMS later. Only the grant service decrypts a private key, in memory, to sign.
- Each grant names its key id (`kid`). Relays get the public keys from the directory, below, and cache them.
- **Rotation:** a new key signs new grants at once, and the old one keeps verifying until the grants it signed have
  expired (hours, as grants are short-lived), then retires. An org can rotate its key from its settings; Magnetic
  rotates every key on a schedule.
- Nodes have keys of their own too, for their links (below). Those are not owner keys and sign no grants.

### The directory
- Nodes find each other through a directory, in Postgres:

| Table | Columns | Notes |
|---|---|---|
| `statenet_node` | `id`, `role` (`owner`, `relay`, `aggregate`), `region`, `endpoint`, `public_key`, `parent` null, `capacity`, `started_at`, `heartbeat_at` | A node registers when it starts and heartbeats every few seconds; one that misses its heartbeats is taken out |
| `namespace_owner` | (above) | Which owner node holds each namespace |
| `owner_key` | (above, public part) | For checking grants |

- Only owner nodes and aggregates connect to the database. Relays never do, so a relay at the edge holds no database
  credentials. A relay learns the directory from its parent through the mesh protocol, and is registered by it.
- **Routing.** A relay has one parent: an aggregate, or a relay nearer the core. A subscription or write for an address
  goes to the parent, and on up, until it reaches a node that knows the address's owner node, which is any node with
  the directory. Every address has one path up from any relay, so routes have no loops.
- **Changes in the directory** (an owner moved, a node joined or left, a key rotated) reach the nodes with database
  access by `LISTEN`/`NOTIFY`, and reach relays down their links as `directory` messages. Each relay keeps the parts
  that concern its subscriptions.
- In step 1 of the topology the directory has one row, and the server finds itself.

### The mesh protocol
Nodes speak to each other over the **mesh protocol**, separate from the client protocol that browsers speak:

- **Links.** One WebSocket per pair of nodes, over TLS, with both ends authenticated by their node keys (mutual TLS,
  with certificates issued by Magnetic's own CA and listed in the directory). A link carries every namespace the two
  nodes share, so a relay holds a few links upstream, not one per namespace.
- **Opening a link:** `link-hello { nodeId, role, protocol, region }`, answered by `link-welcome` with the parent's view
  of the directory that the new node needs, then `directory` updates as they happen.
- **Frames** carry the messages above (`subscribe`, `renew`, `unsubscribe`, `changes`, `durable`, `persisted`,
  `owner`, `claim`, `handoff`, `revoked`) with the `address` in each, batched: one frame holds the changes of many
  namespaces from one moment.
- **Flow control.** Each side gives the other credits per link; a sender without credit holds changes back and folds
  them (a later change to the same path replaces an earlier one that has not gone yet, ephemeral paths first). A slow
  relay then lags and catches up, rather than filling the owner's memory.
- **Liveness.** Pings on each link; a link silent past its timeout is closed, and the node reconnects to its parent, or
  to another node of the same role the directory names. Its subscriptions are made again with their revisions, so
  nothing is missed.
- **Encoding.** JSON first, like state-sync, so the messages can be read in logs and tests. A binary encoding of the
  same messages can come later, chosen at `link-hello`.
- **Versions.** `link-hello` names the protocol version; a node refuses a link it cannot speak, and the directory shows
  each node's version, so nodes are upgraded one at a time.
- The client protocol stays state-sync's, version 2 above. A browser or an app's session connects to a relay (or, in
  step 1, to the server) and never sees the mesh.

### A graph of trees
- Each namespace is a tree, as StateUI's paths address it.
- The links between namespaces are the graph: subscriptions, grants, and references from one app's logic to another's
  paths. Relays route along them.
- Nothing needs a graph database. The trees and their changes are rows in Postgres; subscriptions live in the relays'
  tables, and grants and owners in Postgres.

### Storage in Postgres
| Table | Columns | Notes |
|---|---|---|
| `namespace_owner` | `address`, `node`, `epoch`, `lease_until` | The ownership row, changed only by compare-and-swap on `epoch` |
| `state_node` | `address`, `path` ltree, `parent` ltree, `position`, `value` json, `revision`, `epoch` | One row per stored subtree. `position` keeps key order among siblings, which StateUI shows in that order; `value` is `json` for the same reason |
| `state_change` | `address`, `revision`, `epoch`, `id`, `path`, `op`, `value` json, `at` | The log, for catch-up and audit. Kept for a window, then folded into `state_node` |
| `namespace_head` | `address`, `revision`, `durable_revision`, `epoch` | What the watermark says, per namespace |
| `state_grant` | `id`, `issuer`, `subject`, `address`, `prefix`, `rights`, `parent_grant`, `expires_at`, `revoked_at` | Every issued grant, for Shared by me, audit and revocation |
| `owner_key` | `owner_id`, `public_key`, `created_at`, `retired_at` | Owners' signing keys; private keys stay encrypted with the server key |

- A stored subtree is one dataset record under `$.data.<binding>`, or one other top-level key. Small trees are few
  rows, and a change rewrites only the rows under its path.
- Row-level security is by owner id, from the address.

### Topology, in steps
1. **One process.** A Magnetic server is the owner node for every namespace, with an in-process relay and an
   in-process aggregate. The protocol and storage are the full ones, so nothing changes shape later.
2. **Separate relays.** Relay processes in front of the server, with browsers connecting to them. Subscriptions and
   caches move out of the app server.
3. **Several owner nodes.** More than one app server, with ownership spread across them and moved by claims.
4. **The edge.** Relays in regions near their users, aggregates near the database.

## Protocol changes
State-sync's protocol goes to version 2. Version 1 clients keep working against a node that speaks both, for whole
namespaces of their own.

| Message | Sent by | Fields |
|---|---|---|
| `subscribe` | listener, relay | `address`, `prefix`, `grant`, `revision`, `lease` |
| `renew` | listener, relay | `address`, `prefix`, `grant` |
| `unsubscribe` | listener, relay | `address`, `prefix` |
| `changes` | owner node, relay | as now, each change with `epoch`, and `ephemeral` for ephemeral paths |
| `durable` | aggregate, relay | `address`, `revision` |
| `persisted` | aggregate | `address`, `revision` (to the owner node) |
| `owner` | owner node, relay | `address`, `node`, `epoch` |
| `claim` | node | `address`, `epoch` (the one it knows) |
| `handoff` | owner node | `address`, `revision`, `epoch` |
| `revoked` | issuer, relay | `grantId` |

`hello` and `welcome` stay for a connection's own namespace. A `change` names its `address` when it is not the
connection's own, and carries the grant that lets it write.

## Effect on the Postgres design
- The state tables of `magnetic-postgres.md` (`instance`, `persona_dataset`, `dataset_record`) give way to this
  design's `state_node` and `state_change`: the app's state and each user's state are namespaces.
- Magnetic keeps the definitions (parts), people, orgs, access, links, chats, spend, the audit log and the vectors.
  Record embeddings point at `state_node` rows.
- `stateui-mcp`'s `UiInstanceRepository` gets a statenet adapter on Magnetic's side, so `createServices` reads and
  writes instances through the statenet.
- Link grants (`use`, `view`, `remix`) are issued as state grants underneath.

## Not in this design
- Writes from several nodes at once (CRDTs, merging). One writer at a time is the rule.
- Relays run by other parties, and federation between separate statenets.
- Partial ownership of a namespace (an owner node per subtree). The unit of ownership is the namespace.
- Moving a namespace to a different database.

## Stages
| Stage | Delivers | Depends on |
|---|---|---|
| S1 | Addresses and storage: the address scheme, `state_node`, `state_change`, `namespace_head` with key order kept, a Postgres `NamespaceStorage`, the user's state and the app's state as separate namespaces, form saves through logic | Postgres P2 |
| S2 | Durability: the aggregate in process, pending and committed changes, the `durable` watermark, `await: 'durable'`, ephemeral paths | S1 |
| S3 | Subscriptions to external state: `subscribe`, leases, the in-process relay's table and cache, logic that reads another app's paths | S2 |
| S4 | Grants: owner keys held by Magnetic, rotation, signed read and write grants, checks at the relay and the owner, revocation down the tree, passing on, the org's audited read, Shared by me, policy at issue | S3, Postgres P3 |
| S5 | The directory and moving ownership: `statenet_node` with heartbeats, `namespace_owner` with epochs and leases, claims, handoffs, takeover after a lease runs out, more than one app server | S2 |
| S6 | The mesh protocol and separate relays: node keys and mutual TLS, links, batched frames, credits, reconnects; relay processes with the directory from their parents; then regional relays | S4, S5 |

## Checks
- **S1:** a page reloads with its key order as it was; the user's theme and an unsaved form stay theirs; a saved record
  shows for everyone using the app.
- **S2:**
  - A change shows at once as pending and becomes committed when the watermark passes it.
  - A form shows **Saved** only once the record is durable.
  - A pointer path shared at 60 changes a second writes nothing to the database and does not slow the watermark.
- **S3:**
  - A thousand listeners of one path behind one relay make one upstream subscription.
  - A listener that stops renewing is dropped, and so is the upstream subscription only it needed.
  - A listener behind a gap catches up and never misses or repeats a change.
- **S4:**
  - A read without a grant, with an expired one, or with a revoked one is refused at the relay.
  - A write with a revoked grant is refused at the owner node, at once.
  - Revoking a grant closes every listener that used it, and everything passed on from it.
  - A passed-on grant can never be wider than the one it came from.
- **S5:**
  - During a handoff no change is ordered twice or lost, and writes sent meanwhile land after it in order.
  - An old owner that comes back after its lease ran out cannot write, to relays, aggregates or the database.
  - Two nodes writing equally to one namespace do not bounce ownership.
  - A node that misses its heartbeats leaves the directory, and its namespaces are taken over when their leases run
    out.
- **S6:**
  - A browser behind a regional relay sees the same changes, in the same order, as one at the server.
  - A node without a certificate from Magnetic's CA cannot open a link.
  - A slow relay lags and catches up without growing the owner node's memory.
  - A relay whose parent goes away reconnects to another and misses no change.
  - A relay holds no database credentials and still learns the owners, nodes and keys it needs.
- **S4 (keys):** after a rotation, grants signed by the old key verify until they expire, and new ones use the new key.

## Settled
- An org reads its employees' state in its apps, read only, with an audit event for every read.
- Magnetic holds every key: one signing key per owner, users and orgs alike.
- Storage: one row per dataset record and per other top-level key.
- Nodes find each other through a directory in Postgres, and talk over the mesh protocol.

## As built

### S1: addresses and storage (15 November 2026)
- Addresses: `formatAddress`, `parseAddress`, `userStateAddress` and `appStateAddress` in stateui-mcp
  (`src/domain/StateAddress.ts`). A persona's state of an app is at `<persona>/<appId>/user`; the workspace's default
  persona (its builders' preview, and the person in their own workspace) is the workspace's id, so a person's state of
  their own app is at their id and keeps its address when the app moves into an org (only its workspace changes).
- stateui-pg `0004_state.sql`: `state_node`, `state_change` and `namespace_head`. It moves the rows of `instance` and
  `persona_dataset` to their addresses, in key order, keeping when each last changed, and drops both tables.
- `PgStateStore`: one row per top-level key and per record under `data.<binding>`, each with its position among its
  siblings, so a namespace reads back in its key order; a write rewrites and logs only the rows it changed and takes
  the namespace's next revision under a lock on its head. `PgUiInstanceRepository` stores on it: the instance diff
  as top-level rows (its own unbound `data` as `localData`, since `data` holds the persona records), each persona
  binding's records under `data.<binding>` with the binding's model on its row.
- Moved onto it: the persona record embeddings (P7; a persona record's source id is now `<address>/<binding>/<key>`),
  and in Magnetic the support view, the org export (`magnetic-org-export/2`, each address's state), org deletion,
  retention (by `namespace_head.updated_at`), moving an app into an org, and `magnetic import`.
- Deviations:
  - The app's state namespace (`<ownerId>/<appId>/app`) is addressed but holds nothing yet. Shared dataset records stay
    in their data parts: a dataset can be bound by several apps, so it has no one app to live in. They move when S3
    lets an app read another app's paths, so a dataset can belong to one app and be read by the others.
  - Row-level security is by the workspace the app is in, as for every workspace table, not by the owner in the
    address: a person's state of an org's app is theirs but lives in the org's workspace.
  - Paths are text (`data.notes.k1`), not `ltree`: a record key may hold characters an ltree label cannot.
  - The log records the rows each write changed, not the authority's changes: the authority still keeps its own log
    in memory, and S2's aggregate is where its changes reach the database.

### S2: durability (15 November 2026)
- state-sync protocol 2 (version 1 clients keep working): `durable { revision }`, `welcome.durable`, and
  `ephemeral: true` on a pushed change. The in-process aggregate is the authority's save: when a save lands, the
  watermark moves to the revision the save copied, or to the current revision when only ephemeral changes came since.
  `Authority.durable()`, `whenDurable()`, `onDurable()`; the client's `pending` count, `durable()` and `onDurable`.
- Ephemeral paths: `AuthorityOptions.ephemeral`, declared by an app as `ephemeral` (stateui-app; `ui_app_configure`).
  Their changes are pushed like any other but never saved, stripped from the stored state and log, and never move or
  hold the watermark: a pointer at 60 changes a second writes nothing (checked in `Authority.test.ts`).
- `await`: a `save-data` or `delete-data` with `as` waits for durability by default (`await: 'applied'` does not), as
  the design asks for form saves. In stateui-mcp the logic host's `durable` waits for the instance's save and for the
  shared dataset writes it made (`DatasetHub.durable`), and a failed write-through rejects the save with its reason,
  so a form never says Saved for a record that was put back.
- Deviations:
  - Ephemeral changes share the namespace's revision sequence rather than having one of their own. They still never
    hold up the watermark: it skips over them, and `whenDurable` answers at once for a revision only ephemeral changes
    reached. One sequence keeps catch-up and gap detection as they are.
  - The aggregate is not yet a separate role writing batches to `state_change`: in one process the authority's save
    is the write. A separate aggregate comes with the directory (S5) and the mesh (S6).

### S3: subscriptions to external state (15 November 2026)
- state-sync `createRelay`: a subscription table by address and prefix, one upstream subscription for all the
  listeners of a prefix, a cache of the prefix with its revision and recent changes, catch-up from the cache, leases
  swept on a timer, and a new upstream subscription from the cache's revision when a batch skips one (checked: a
  thousand listeners make one upstream subscription; a listener that stops renewing is dropped with the upstream
  subscription only it needed; a listener behind a gap never misses or repeats a change).
- `createAuthorityUpstream`: the owner node's side, which projects each committed change onto the prefix (a change
  above it as the set or delete of the prefix). `Authority.onChanges` and `changesSince` feed it.
- stateui-app `uses.external` (alias to another app's id and a path); logic reads `$.external` and may not write it.
- stateui-mcp: `createServices` runs the in-process relay over the workspace's instances; `ExternalReads` subscribes
  each alias to `<persona>/<appId>/user` and writes what arrives into `$.external.<alias>` through the instance's
  logic. `$.external` is ephemeral and refuses client writes.
- Deviations:
  - Only a person's own state of another app in the same workspace can be read: reading another person's state, or an
    app in another workspace, needs a grant (S4). The app state namespace still holds nothing (S1), so `/app`
    addresses resolve to nothing yet.
  - The subscription messages are function calls in one process; on the wire they come with the mesh protocol (S6).

### S4: grants (15 November 2026)
- state-sync `Grants.ts`: grant tokens (the claims and an Ed25519 signature, base64url), `verifyGrant` (the chain to
  a root the owner of the address signed, each grant passed on by the subject of the one before and no wider, retired
  keys verifying only what they signed before, expiry, revocation anywhere in the chain), `checkAccess` (the owner
  reads and writes freely), `RevocationList`. A relay with `grants` checks reads on subscribe and every renewal and
  passes `revoked` down to the relays below; an authority with `access` checks every client change, so a revoked
  write grant stops at once.
- Magnetic: `owner_key` (one key per owner as addresses name it, a user or a workspace, the private part sealed with
  `MAGNETIC_SECRET_KEY`), rotation, `state_grant` (the standing right; tokens are signed for it, four hours at a time),
  revocation down every grant passed on, Shared by me (`/settings/shared`, `GET /grants`), the org's standing read
  (`org-read`, made when the org first reads, revoked when the member leaves; the support view reads through it and
  audits its id), and the policy `grantsInOrg` at issue.
- Deviations:
  - An org's standing read is one grant per member for all the org's apps, `<userId>/*/user`: a granted address may use
    `*` for the app. One per member and app would need a grant for every app made later.
  - Grants are checked in Magnetic's process; no relay serves browsers or other servers yet, so nothing presents a
    grant over the wire until S6.
  - Share links (`use`, `view`, `remix`) keep their own `link_grant` rows: they open an instance for the visitor,
    which is not yet a read or write of someone's state at an address.

### S5: the directory and moving ownership (15 November 2026)
- state-sync `Ownership.ts`: `OwnerNode` (hosts the namespaces it owns, forwards the rest, `claim`/`handoff` with the
  durable wait and the queue passed on, takeover after a lease runs out, renewals that stop the node at once when it
  has lost ownership), the `OwnershipStore` and `EpochStorage` ports, and `ClaimPolicy` (a share of the writes over a
  window, a minimum count, a cooldown). Relays refuse batches from an older epoch and start over under a newer one.
- stateui-pg `0005_directory.sql`: `statenet_node`, `namespace_owner`, and the applied ids on `namespace_head`.
  `PgOwnershipStore` (one compare-and-swap statement, the database's clock for leases), `PgDirectory` (register,
  heartbeat, sweep) and `PgEpochStorage` (a namespace row by row with the authority's log in `state_change`, refusing
  a save from an older epoch).
- Checked: no change ordered twice or lost during a handoff, and writes sent meanwhile landing after it in order (in
  memory and on Postgres with two owner nodes); an old owner after its lease ran out refused by the storage and the
  relays; two nodes writing equally keep one owner; a lost node's namespaces taken over once their leases run out; and
  two servers that both get a namespace's first write agreeing on one owner.
- Deviations:
  - The owner decides when ownership moves (it sees every write and its source), rather than the node that forwards:
    a forwarder sees only its own share.
  - Magnetic still runs every namespace in one process: its instances move onto owner nodes when the mesh (S6) lets a
    browser connected to one server reach a namespace another server owns.
