# Statenet on the network: nodes at the edge, relays, aggregates

Status: S7, S8 and S9 built in statenet 2026-11-19 (see "As built"); Magnetic does not use S8 or S9 yet. S10 to S12
are proposed.

Asked for on 2026-11-19: "I want to bring the network stuff back, that's a big part of the statenet. We just need to
make sure relays, nodes and aggregates auth with each other. Nodes should have a persistent connection with relays.
Relays have persistent connections with aggregates. Aggregates write to the DB."

On what a node is: "Nodes are the edge of the statenet, providing the server side of an application instance; server
side logic, statenet push for changes and registers listeners with the relay for external state changes. Yes,
magnetic's server is a node."

On browsers: "When a user logs in, their statenet provider, us right now, opens a web socket to the server / node. The
browser then can run applications that have server side logic and that need other state on the statenet"

On node-to-node links: "A node can have multiple web sockets to multiple users, so it's possible to do intra node
forwarding, writes, etc. We can do node to node for nodes that are on the same server or same group. We do relays to
connect nodes on different groups and to relay state changes to the DB."

On signing in: "For magnetic we're starting with using LinkedIn, but we need to have SSO implemented"

On stateui-mcp: "The stateui-mcp is supposed to be plugged into the statenet so when the agent uses it, it updates the
statenet. Then the application's state will be updated. Magnetic's AI uses the stateui-mcp for interacting with the
state (though I wonder if the agent can just update the state directly)"

Then: "the mcp authenticates using the open id system so it accesses the statenet as the user running the AI"

On SAML: "Yes, SAML please"

This builds on [statenet-relays.md](statenet-relays.md) (S1 to S6, built). It changes where each role sits and who
writes to the database; addresses, one writer per namespace, epochs, grants and the client protocol stay as they are.

## Summary
```
browser ──session──▶ node ══link══▶ relay ══link══▶ aggregate ──▶ database
        (signed in)       (certificates, both ends)                (the only writer)
```
- A **node** is the edge: it runs an instance's authority and server logic, serves the browsers signed in to it,
  pushes its changes up, and registers listeners with its relay for state it does not own.
- A **relay** holds the links of the nodes below it and one link up. It routes, caches and keeps subscriptions.
- An **aggregate** writes changes to the database in batches and says how far each namespace is durable.
- Every link is opened once and kept, and both ends prove who they are with a certificate before anything else is
  said. A browser is not on the mesh: it talks to its node, with its sign-in session.

## What changes from today
| | Today (S6, Magnetic behind the mesh) | Asked for |
|---|---|---|
| Where relays sit | Below the owner nodes, toward browsers | Above the nodes, toward the database |
| Who writes state | The owner node (`PgStateStore`), fenced by epoch | Only an aggregate |
| Aggregate | Before S8 a role name in certificates and `statenet_node`; no code | A process: `startAggregateNode` (built, S8) |
| Node to node (forwarded writes, `claim`, `handoff`, tunnelled views) | Direct peer links between every pair of owner nodes (`OwnerMesh`) | Direct inside a group; through relays between groups |
| Role check on a link | Before S7 any certified role could link to any server | Each end refuses a role it does not serve (built, S7) |
| The plain `statenet` (stateui-mcp's local one) | Loopback only, no authentication (`Statenet.ts`) | Unchanged on loopback; off loopback stateui-mcp connects to a node with a credential |
| Browsers | Magnetic: a socket to the server. stateui-mcp: straight to the statenet on port 4200, no sign-in | Magnetic: unchanged, and reachable from another computer. stateui-mcp: unchanged |

## Decisions

### Roles and who links to whom
| Role (certificate `role`) | Dials | Accepts links from | Database |
|---|---|---|---|
| Node (`owner`) | One relay, kept open; the other nodes of its group | Browsers (client protocol, a session); nodes of its group | No state tables |
| Relay (`relay`) | One aggregate, or a relay nearer the core | `owner`, `relay` | None, as now |
| Aggregate (`aggregate`) | Nothing | `relay` | Reads and writes state |

- The certificate's role stays `owner` for a node: the directory, the tests and `OwnerMesh` already use it. The docs
  say node.
- A node still owns namespaces one at a time, by epoch. Moving the writes to an aggregate does not change who orders.

### Groups (owner, 2026-11-19)
- A **group** is the nodes that run together: on one server, or in one stack behind one relay. A node's
  certificate and its `statenet_node` row name its group.
- Inside one node nothing crosses a link: a node holds the sockets of many people, and a write, a forward or a
  subscription between two instances it runs is a call in the process, as now.
- Nodes of one group link to each other directly, as `OwnerMesh` does today, for forwarded writes, `claim`,
  `handoff` and tunnelled views. A node refuses a peer whose certificate names another group.
- Between groups everything goes through relays: a node sends to its relay, which routes by the directory to the
  relay of the owner's group. State on its way to the database always goes through a relay, whatever the group.

### Links are persistent
- A node opens its link to a relay when it starts, and a relay its link to an aggregate, before either serves
  anything. `createMeshUpstream` already keeps a link: pings, a timeout, a reconnect to the next parent, every
  subscription made again from its revision, and writes sent again and applied once by id. Nodes use the same client.
- A node with no link keeps serving its browsers from memory and holds its changes as pending: nothing is durable,
  so nothing says Saved, until the link is back. Past a limit of held changes it refuses writes rather than grow.
- A relay with no link up answers reads from its cache and refuses writes.

### Authentication between relays, nodes and aggregates (owner, 2026-11-19: keep today's certificates)
- The handshake is S6's: `link-hello` with the dialler's certificate and a nonce, `link-welcome` with the server's
  certificate, its proof and a nonce, `link-proof`. Each end checks the other's certificate against the authority's
  public key and that the other holds the key it names. Nothing but these three messages is read before it passes.
- New: **roles are enforced** by the table above, at both ends. A relay that dials and finds an `owner` certificate
  answering closes the link; an aggregate refuses a hello from an `owner`.
- New: **the node id must be in the directory** with that role and public key, when the server end has a directory
  (an aggregate always does). A certificate alone is no longer enough, so taking a node out of the directory cuts
  it off before its certificate expires.
- New: **certificates are short** (seven days) and a node asks for its next one over its link before the old one
  ends. `magnetic relay-certificate` still writes a relay's first one to a file.
- **Every link is encrypted** (owner, 2026-11-19: seal frames in the handshake), on loopback too, so there is no
  plain mode to forget to turn off. The handshake also agrees a key (X25519, each end's share signed with its node
  key), and every message after `link-proof` is sealed with it (AES-256-GCM, a counter per direction, so a message
  changed, replayed, dropped or reordered closes the link). It needs only `node:crypto`, and holds with or without
  the operator's `tls` underneath.

### Aggregates write to the database
- A node's save becomes: send the batch up its link, keep it until `persisted { address, revision }` comes back.
  That answer is the `durable` watermark the browsers already wait on.
- The aggregate writes one transaction per batch, only while the namespace's epoch in the database still matches
  (the fence `PgStateStore` has now), and writes each change id once, so a batch resent after a reconnect writes
  nothing twice. A batch under an old epoch is answered `fenced`, and the node stops ordering that namespace.
- It also answers a load: a node that takes a namespace asks its relay for the snapshot and head, which the relay
  has cached or gets from the aggregate.
- Storage is a port, as `NamespaceStorage` is: Postgres when hosted, files in the data directory locally.

### Browsers
- A browser connects to a node, never to a relay or an aggregate, and only after it is signed in. The node knows
  who it is from the session, checks access as it does now, runs the app's server logic, and subscribes at its
  relay to whatever the app reads from other owners or apps (`uses.external`), with that person's grant.
- **The node is Magnetic's server.** Magnetic uses stateui-mcp as a library (`createStateUiTools`, `Services`,
  `PreviewBrowser`), so a person signs in to Magnetic and their page's socket goes to that server. Signing in is
  Magnetic's: LinkedIn now. An org's own sign-in over OpenID Connect is built (Postgres P4) and switched off in
  the beta (`/signin/sso` is a 404, magnetic-beta.md); it is turned on again for this (S10). SAML is not built.
- Magnetic already works this way. The relay's `startClientServer` (browsers straight to a relay) is not used by
  this design; it stays for relays whose clients only read, until nothing needs it.
- A page served over plain HTTP sends its session in the clear, so a node off loopback serves its pages over
  HTTPS (Caddy when hosted; the operator's certificate on a local network).

### stateui-mcp is a client of the statenet (owner, 2026-11-19)
- stateui-mcp is how an agent changes an app: each tool call ends as changes in the statenet, and the app's state
  and every open view follow. It is a client, not a node, relay or aggregate, and it listens on nothing.
- Inside Magnetic it is a library in the node's process, so its writes are the node's own, as now.
- Standalone (MCP on stdio) it connects to the statenet `--statenet` names. On loopback that is the plain statenet,
  as now. Off loopback it is a node's client socket, and stateui-mcp is **the person running the AI**: it signs in
  through the node's own sign-in (LinkedIn, the org's OpenID Connect provider), not with a key of its own.
  - The first time, it opens the node's sign-in page in the person's browser (the authorization code flow with PKCE
    and a redirect to a loopback port it listens on for that one answer), and gets a token for that person from the
    node. It keeps the token in its data directory, renews it, and signs in again when it is refused.
  - The node treats its socket as that person's session: the same access checks, the same owner on what it makes,
    the same audit trail, with the session marked as an agent's. It can change what the person can and nothing else.
  - Signing the person out, or removing them from an org, ends the agent's access with theirs.
- **Writing state without the tools.** A change to an app's data is already a plain write at a path
  (`ui_state_set` is that and little more), and the person's session is all it needs. The tools stay for what a bare write does
  not give: the app's parts (screens, components, logic, models) are checked whole before they are written, usage
  and renames are followed, and the agent gets the catalog and the guide. So: data may be written directly, as
  the person; parts go through the tools.

### Sign-in with SAML (owner, 2026-11-19)
- An org may set a SAML 2.0 identity provider beside or instead of its OpenID Connect one: the metadata URL or XML,
  the entity id, and which attribute is the email. `requireSso`, verified domains and the audit log treat both
  kinds alike (magnetic-postgres.md, "SSO per org").
- Service-provider-initiated sign-in with the HTTP-POST binding, signed assertions required, the audience, the
  recipient, the times and `InResponseTo` checked, and each assertion id accepted once.
- Checking XML signatures safely is not something to write by hand: this takes a dependency
  (`@node-saml/node-saml`), Magnetic's first for sign-in beside `openid-client`.
- SCIM (provisioning) is not part of this.

### Locally (owner, 2026-11-19: a local authority key)
- With no `MAGNETIC_SECRET_KEY` holding the statenet's authority, a local stack makes an authority key in its data
  directory on first run and signs its own nodes', relay's and aggregate's certificates. Nothing to set up.
- A local Magnetic (`npm run magnetic`) can run the three roles in one process, linked in memory.

## Stages
| Stage | Delivers | Depends on |
|---|---|---|
| S7 | Role rules and the directory check in the handshake; every link sealed; certificate renewal over the link (built) | S6 |
| S8 | The aggregate: `startAggregateNode`, the storage port (Postgres, files), batches, `persisted`, `fenced`, loads; in process and over the mesh (built) | S7 |
| S9 | Nodes link up: a node dials a relay and a relay an aggregate; groups in certificates and the directory; peer links only inside a group, routing between groups by relays (built in statenet) | S8 |
| S10 | Magnetic on the network: the local authority, a server reachable from another computer over HTTPS, org sign-in (OpenID Connect) on again | S9 |
| S10b | stateui-mcp off loopback: signing in as the person through the node (authorization code, PKCE, a loopback redirect), the kept token, and `--statenet` naming a node | S10 |
| S11 | Magnetic hosted: servers get a group and link up to a relay (`--group`, `group` in `statenet_node`), instances save through the aggregate (see S8's first deviation), servers stop writing state, the compose stack gains an aggregate, relays move above the servers, deployed | S9 |
| S12 | SAML sign-in per org, with its settings page and tests against a test identity provider | Postgres P4 |

## Checks
- **S7:** a certified node of the wrong role is refused at each kind of link; a frame changed or replayed on the
  wire closes the link; a node taken out of the directory is
  cut off within one heartbeat; a node whose certificate ends soon gets its next one over its link.
- **S8:** a batch resent after a dropped link writes nothing twice; a batch under an old epoch writes nothing and
  the node stops ordering; Saved appears only after `persisted`.
- **S9:** a link dropped and reopened loses nothing, at node to relay and at relay to aggregate; a namespace moves
  between two nodes of one group directly, and between two groups through their relays; a node of another group
  is refused as a peer.
- **S10:** from the laptop, signed in to the Magnetic on this machine, an app opens, takes a change made here and
  makes one of its own; the same page with no session gets nothing.
- **S10b:** a standalone stateui-mcp on the laptop signs in once in the browser, changes an app of that person's on
  this machine and its open view follows; it cannot change another person's app; signed out, it changes nothing.
- **S11:** Magnetic's e2e suite and `statenet.test.ts` pass with the servers holding no rights on the state tables.

- **S12:** a person signs in through a test SAML provider into their org; an unsigned, expired, replayed or
  wrong-audience assertion is refused; `requireSso` holds for an org with SAML only.

## As built

### S7: link rules, sealed links and certificate renewal (19 November 2026)
- **statenet** `src/mesh/`, mesh protocol 2 (a node of protocol 1 is refused, so servers and relays are upgraded
  together):
  - `mayLink(dialler, server)` (`certificates.ts`) is the table of who links to whom. The server end refuses a
    hello whose certificate's role may not link to its own, or names another role than the hello; the dialling end
    refuses a parent of a role it does not link to.
  - `sealing.ts`: `newShare`, `transcript` and `sealOf`. `link-hello` and `link-welcome` carry each end's share;
    each proof signs the other end's challenge with both shares and both node ids. After `link-proof` every message
    (frames, pings) is a sealed binary message; one in the clear, or one that does not open, closes the link (4400).
    The directory left `link-welcome`: it is the first message of the server's first sealed frame, and the dialler
    counts itself linked when it has it.
  - `MeshServerOptions.requireListed` names the roles that must be in the directory with the role and key their
    certificate shows (`DirectoryView.nodes[].publicKey`); `reread` reads the directory once more for a node that
    is not listed yet; `directoryChanged` closes the link of a node that is no longer listed (4403).
  - `certify` / `certified` messages: a node asks its parent for its certificate's next one when less than
    `renewWithinMs` (a day) is left, takes it only if it names the same node, role and key and ends later, and
    hands it to `onCertificate`. `renewNodeCertificate` is the authority's part. A node may ask only for itself;
    a relay passes on the ask of a node below it (`startRelayNode` signs nothing). `statenet-relay` writes the
    next certificate over its file.
  - `certificate` may be a function on the server, the upstream and the owner mesh, for a node that signs its own.
  - Tests: `src/mesh/network.test.ts` (16), over real sockets but for the seal's own.
- **Magnetic** `src/statenet/StatenetNode.ts`: a server links another only while the directory lists it with the key
  it shows (`requireListed: ['owner']`, with `reread`); certificates last seven days; a server signs its own again at
  half of that; `StatenetAuthority.renew` answers `certify`, for a server only while it is listed. Checked by
  `src/server/statenet.test.ts`, unchanged.
- Deviations:
  - **A server may bind any address:** every link is sealed, so the rule "no binding off loopback without
    encryption" has nothing left to refuse.
  - **Relays are let in by their certificate alone.** Nothing registers a relay in the directory (it has no
    database, and its parent does not write it), so `requireListed` covers servers only. A relay is cut off by not
    renewing: there is no list of relays to take it out of yet. That comes when relays link to aggregates (S9).
  - **A relay may still dial a node** (`mayLink('relay', 'owner')`): that is today's topology, until S9.
  - **An open link outlives its certificate.** The certificate is checked when the link opens; a link that stays
    open past its end is not closed for it.
  - **A relay stopped for more than seven days** needs `magnetic relay-certificate` again.
  - Not run: the compose stack of two servers and a relay as separate processes (`docker/statenet.compose.yml`).

### S8: the aggregate (19 November 2026)
- **statenet** `src/mesh/Aggregate.ts`:
  - `createAggregate(storage)` is the writer. Its storage port is state-sync's `EpochStorage`, so Postgres is
    stateui-pg's `PgEpochStorage` as it is, and files are the new `createFileEpochStorage`
    (`src/FileEpochStorage.ts`: a namespace's file and, beside it, the newest epoch it was saved under).
  - The saves of a namespace run one at a time. Those that arrive while one runs are folded into the newest, and
    every node waiting on an earlier revision is answered when it lands. A save at or below what landed under its
    epoch writes nothing (a resend). A save under an older epoch is answered `fenced`, by the aggregate's own count
    or by the storage's fence, and a waiting save of the old owner is fenced when the new owner's takes its place.
    `mayPersist` lets an aggregate with the directory refuse a node that does not order the address.
  - `createAggregateStorage(link)` is a node's storage: a save is done when the aggregate answers `saved`, which is
    when the authority calls the change durable; `fenced` throws `FencedError`, so the node stops ordering. The
    link is an aggregate in the same process, or a node's link up the mesh.
  - Mesh messages `persist` / `persisted` and `load` / `loaded`. `MeshUpstream.persist` and `load` keep what is not
    answered across links and send it again; a relay passes both up (`startRelayNode`), naming the node it passes
    them on for; `startAggregateNode` is the mesh server of role `aggregate`, which only relays can link to.
  - Tests: `src/mesh/aggregate.test.ts` (12): the folding, the resend, both fences, a change durable only after the
    aggregate saved it, a save and a load over node, relay and aggregate on real sockets, a save sent again over
    another relay and written once, and the files.
- **state-sync**: `FencedError` carries `address`, `epoch` and `current`, so a fence can cross the mesh and be
  thrown again at the node.
- Deviations:
  - **Magnetic's instances do not save through it yet.** An instance is not saved as an authority's namespace: its
    server writes it through `UiInstanceRepository` (stateui-pg's `PgUiInstanceRepository`) as a diff over the
    app's definition, a row per key, with each persona binding's records written apart and their embeddings queued
    in the same transaction, under the workspace's row-level security. The aggregate's port takes a whole stored
    namespace, so putting it under Magnetic today would save nothing through it. S11 has to settle how an
    instance's writes reach the aggregate: the repository's writes sent up as they are, or instances kept as
    namespaces with the diff and the embeddings made at the aggregate.
  - **A save carries the whole namespace**, as an authority's save does, not only the changes since the last one.
    The batch is the newest of the saves that were waiting. Sending changes alone needs a storage port that applies
    them.
  - **An aggregate serves no subscriptions and no catch-up from the database**: a relay that subscribes at one is
    told so. Relays still get state from the nodes, until S9.
  - **No `statenet-aggregate` command**: statenet has no database driver, so a process with Postgres is Magnetic's
    to start (S11); with files it comes with the local stack (S10).
  - **A restarted aggregate forgets what landed**, so a save sent again after its restart is written once more with
    the same content. The storage's fence still holds.
  - **A node with no link holds its saves without limit**: the limit past which it refuses writes is not built.

### S9: nodes link up, groups, and routing through relays (19 November 2026)
- **statenet** `src/mesh/`:
  - **A link carries asks both ways.** What one end does with the other's asks is `createServing` (`serving.ts`,
    taken out of the mesh server): subscriptions, writes, tunnelled sessions, claims, saves and certificate asks.
    The server end serves the node that dialled, as before. The end that did not open the link asks through a
    `LinkClient` (`linkClient.ts`), its messages and their answers wrapped as `rev`, and a node that dialled a
    relay serves them with `MeshUpstreamOptions.serve`. `MeshServer.peer(nodeId)` is the link down to a node.
  - **Groups.** A node's certificate names its `group` (`NodeCertificateClaims.group`, kept by a renewal), and
    `DirectoryView.nodes[]` has `group` and `parent` (the relay a node is linked to). A node refuses a node of
    another group at both ends of a link: the server in the hello, the dialler in the welcome.
  - **Routing.** `subscribe`, `write`, `open`, `claim` and `take` may name the node they are for (`to`), and
    `write` and `claim` the node they came from (`from`, set by relays, so the owner counts and hands off to the
    right node). A relay (`startRelayNode`) sends such an ask down the node's link when it is linked there, and
    otherwise to the relay the directory says the node is under, over a relay-to-relay link it opens on first use
    (`reachThrough`). An ask another relay passed on is delivered below or not at all, so two relays with
    different directories cannot pass it back and forth. An ask with no way is answered so (`cannot be reached`).
  - **The owner mesh** (`startOwnerMesh`) takes `group` and `relays`: it links up to its relay (`uplink`), serves
    it what it serves its peers, links directly only to nodes of its group, and reaches the others through the
    relay (`PeerLinks.link` now answers a `RouteTarget`). `createAggregateStorage(mesh.uplink)` saves through the
    same link.
  - Tests: `src/mesh/groups.test.ts` (8), an aggregate, a relay per group and nodes on real sockets: a node of
    another group refused directly; nodes of one group linked directly; between groups a forwarded write applied
    once, a tunnelled view with its writes, a subscription, and a claim; a write for a node with no way rejected;
    and a namespace saved through relay and aggregate, then loaded by the node that takes it over.
- Deviations:
  - **Magnetic is unchanged.** Its servers have no group and no relay above them, so they link as before (one
    empty group, direct links). Giving them `--group`, writing `group` and `parent` to `statenet_node` (a
    migration: the table has `parent` and no `group`) and putting relays above them is S11.
  - **A relay may still dial a node** (`mayLink('relay', 'owner')`), for the relays that hang below Magnetic's
    servers today. It goes when Magnetic moves (S11).
  - **Relays are still not in the directory by themselves**: the tests list them by hand. An aggregate with the
    database is the one to register the relays linked to it; not built.
  - **Only one relay between a node and the aggregate is routed.** A relay under another relay does not pass an
    ask it has no way for up to its parent.
  - **What a relay asks of a node ends with the link**: a subscription the relay made down a node's link is
    closed when the link drops, and whoever asked subscribes again; the owner mesh's placed upstream does.

## Settled (owner, 2026-11-19)
- **What nodes keep in the database.** State tables go to the aggregate in S11. `namespace_owner` and
  `statenet_node` follow in a later stage. Magnetic's own tables (people, orgs, parts) stay with its servers.
- **What makes a group.** One name per stack, set by the operator (`--group`, default the host's name), so the two
  servers on the AWS host are one group.
