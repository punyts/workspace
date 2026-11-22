# Relays in the directory

Status: built 2026-11-22. Stage S13 of [statenet-network.md](statenet-network.md).

Asked for on 2026-11-22: "Yes, design it", to the open item of S9 as built: "Relays are still not in the directory by
themselves: the tests list them by hand. An aggregate with the database is the one to register the relays linked to
it; not built."

## Why

A relay routes an ask for a node of another group by the directory (`startRelayNode`, `RelayNode.ts`): it looks up
the node's `parent`, then that relay's `endpoint`, and dials it. Relays have no database, so something else must list
them; a server must name the relay it is under; and a relay listens on a host and port that are not always the address
other relays reach it at (behind Docker or a load balancer they differ). Without these, routing between groups worked
only in tests that wrote the rows by hand. Magnetic runs one group today; a second group (another server, a customer's
statenet linking in) needs it.

## The design

### The aggregate registers the relays linked to it
- When a relay's link opens, the aggregate writes the relay's row: `id`, `role` `relay`, `region` and `group` from
  its certificate, `public_key` from its certificate, `endpoint` from its certificate, `parent` the aggregate's id,
  `protocol` the mesh protocol (every node of a statenet speaks the same one).
- While the link is up the aggregate heartbeats the row with its own directory read (every 2 seconds), writing it again
  if a sweep took it out. When the relay's last link closes it deletes the row at once rather than waiting for the
  sweep, since a closed link means the relay is not reachable through it. A relay that dials again may open its new
  link before the old one closes, so links are counted per relay.
- The servers' existing sweep (`heartbeatMs * 5`) still removes a row the aggregate left behind when it died.
- After listing or unlisting the aggregate reads the directory at once and calls `directoryChanged`, so the change
  reaches every relay without waiting for the next read.

The facts come from the relay's certificate, which Magnetic's authority signed, not from anything the relay says
about itself. A relay cannot list itself under another id, group or key.

### A relay's endpoint is in its certificate
- `NodeCertificateClaims` gains `endpoint?`: the URL other relays dial to reach this one (`wss://relay-1.example:4310`).
  Only a relay has one. A renewal keeps it, as it keeps `group`.
- `magnetic relay-certificate` writes it from `--mesh-url` (the option that names a server's own mesh address), with
  `--region` and `--group`; `statenet-relay` takes none of them, since the certificate holds them.
- No mesh message changes and the mesh protocol stays 2. A relay certificate without `endpoint` is listed with `''`,
  which `RelayNode` already reports as "has no endpoint".

### A server names its relay
- `startStatenetNode` registers `parent` as the node id of the relay its uplink is linked to (from `link-welcome`), and
  registers again each time the uplink links, so a move to another relay is listed. With no relays, `parent` stays
  empty.
- `MeshUpstreamOptions.onLinked` and `OwnerMeshOptions.onUplinked` say which parent a link reached.

### The aggregate's database role
The aggregate's role (`magnetic_aggregate`) may write only the state tables today: S11 made the database the guard
that a server cannot write people's state and the aggregate cannot write anything else. Registering relays needs it
to write `statenet_node`, and only its relay rows (Decisions).

## Rules and Constraints
- A directory row of a relay states only what its certificate says, plus `parent` and `protocol`. Nothing the relay
  sends outside the certificate is written.
- Only the aggregate a relay is linked to writes that relay's row. A server never writes a relay row, and the
  aggregate never writes an `owner` or `aggregate` row.
- The aggregate stays out of the directory itself (S11): relays find it by the URL they are given.
- No new mesh message and no mesh protocol change.
- Nothing is logged but node ids, roles and groups.

## Decisions
- **The aggregate role writes relay rows only** (owner, 2026-11-22). `grantAggregateRole` grants `INSERT`, `UPDATE`
  and `DELETE` on `statenet_node`, and the table gets row-level security: the aggregate role sees every row but may
  insert, change and delete only rows of `role = 'relay'`. The roles that already write the table (the servers' app
  role, the owner of the schema) keep writing every row. The database, not only the code, keeps the aggregate from
  listing an owner node.
- **Built in this workspace** (owner, 2026-11-22), in statenet (`certificates.ts`, `MeshUpstream`, `Aggregate`),
  stateui-pg (`PgDirectory`, the role grant and the policy) and Magnetic (`MagneticAggregate`, `StatenetNode`,
  `cli.ts`).

## Checks
- statenet: an aggregate with a directory writer lists a relay when its link opens, from its certificate, and removes
  it when the link closes; a renewal keeps `endpoint`.
- stateui-pg: the aggregate role can write a relay row and is refused an owner row (`db/roles.test.ts`).
- Magnetic `statenet.test.ts`: two groups, each server under its own relay, both relays under one aggregate, and a
  session of a namespace owned in the other group reaches it through the directory, with no row written by hand.

## As built
- **statenet**: `src/mesh/certificates.ts` (`NodeCertificateClaims.endpoint`, kept by `renewNodeCertificate`);
  `src/mesh/MeshServer.ts` (`onLinkOpened`, `onLinkClosed`); `src/mesh/Aggregate.ts` (`ListedRelay`, `RelayListing`,
  `AggregateNodeOptions.relays`, `AggregateNode.relays()`: links counted per relay, each relay's listing and unlisting
  run in order, a failure reported as a warning); `src/mesh/MeshUpstream.ts` (`onLinked`); `src/mesh/OwnerMesh.ts`
  (`onUplinked`). Tests: `src/mesh/aggregate.test.ts` ("an aggregate that lists its relays"),
  `src/mesh/network.test.ts` ("should keep the group and endpoint of a relay in its renewed certificate"),
  `src/mesh/groups.test.ts` ("should carry a write to a node of another group with a directory the aggregate and the
  nodes wrote themselves").
- **stateui-pg**: `migrations/0009_node_rows.sql` (row-level security on `statenet_node`, policy `every_node`);
  `grantAggregateRole` (`src/db/migrate.ts`) grants writes on `statenet_node` with restrictive policies
  `<role>_relays_insert`, `_update` and `_delete`; `PgDirectory.remove`. Tests: `src/db/roles.test.ts` ("should let
  the aggregate list, heartbeat and remove relays in the directory and no other node, while the server still writes
  every row"), `src/state/directory.test.ts` ("should take a node out at once with remove, and leave the others").
- **Magnetic**: `src/statenet/MagneticAggregate.ts` lists, heartbeats and removes relays through `PgDirectory`;
  `src/statenet/StatenetNode.ts` registers its relay as `parent` and passes `endpoint` to `issue`;
  `src/server/options.ts` (`Options.relay` from `--region`, `--group` and `--mesh-url`) and `src/cli.ts`. Tests:
  `src/server/statenet.test.ts` ("Magnetic servers in two groups": the rows, and a view at a server of one group of an
  instance a server of the other runs, through the relays), `src/server/options.test.ts` ("should put a relay's region,
  group and mesh URL into its certificate, with no mesh port").
- **Workspace**: `docker/magnetic.compose.yml` and `docker/statenet.compose.yml` give `relay-certificate` the relay's
  group and `ws://relay-1:4310`. A hosted database takes the policies at its next `migrate` with the aggregate role.
