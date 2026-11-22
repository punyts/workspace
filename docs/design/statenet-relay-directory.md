# Relays in the directory

Status: designed 2026-11-22, not built; to be built in this workspace. Stage S13 of [statenet-network.md](statenet-network.md).

Asked for on 2026-11-22: "Yes, design it", to the open item of S9 as built: "Relays are still not in the directory by
themselves: the tests list them by hand. An aggregate with the database is the one to register the relays linked to
it; not built."

## What is missing today

A relay routes an ask for a node of another group by the directory (`startRelayNode`, `RelayNode.ts`): it looks up
the node's `parent`, then that relay's `endpoint`, and dials it. In a running Magnetic neither is there:

- **No relay has a row.** `statenet_node` gets rows only from Magnetic's servers (`startStatenetNode` registers itself
  as `owner` and heartbeats). Relays have no database. The S9 tests write relay rows by hand.
- **No server names its relay.** A server registers with no `parent`, though it knows which relay its uplink reached.
- **No relay knows its own endpoint.** `statenet-relay` takes `--host` and `--mesh-port` to listen on, not the address
  other relays reach it at (behind Docker or a load balancer they differ).

So routing between groups works in tests and nowhere else. Today Magnetic runs one group, so nothing is lost yet;
a second group (another server, a customer's statenet linking in) needs it.

## The design

### The aggregate registers the relays linked to it
- When a relay's link opens, the aggregate writes the relay's row: `id`, `role` `relay`, `region` and `group` from
  its certificate, `public_key` from its certificate, `endpoint` from its certificate, `parent` the aggregate's id,
  `protocol` from its hello.
- While the link is up the aggregate heartbeats the row with its own directory read (every 2 seconds today). When the
  link closes it deletes the row at once rather than waiting for the sweep, since a closed link means the relay is
  not reachable through it.
- The servers' existing sweep (`heartbeatMs * 5`) still removes a row the aggregate left behind when it died.
- The aggregate already reads the directory every 2 seconds and calls `directoryChanged`, so the new row reaches every
  relay and server within one read.

The facts come from the relay's certificate, which Magnetic's authority signed, not from anything the relay says
about itself. A relay cannot list itself under another id, group or key.

### A relay's endpoint is in its certificate
- `NodeCertificateClaims` gains `endpoint?`: the URL other relays dial to reach this one (`wss://relay-1.example:4310`).
  Only a relay has one. A renewal keeps it, as it keeps `group`.
- `magnetic relay-certificate` takes `--endpoint`; `statenet-relay` does not take one, since the certificate holds it.
- No mesh message changes and the mesh protocol stays 2. A relay certificate without `endpoint` is listed with `''`,
  which `RelayNode` already reports as "has no endpoint".

### A server names its relay
- `startStatenetNode` registers `parent` as the node id of the relay its uplink is linked to (from `link-welcome`), and
  registers again when the uplink moves to another relay. With no relays, `parent` stays empty.
- `PgDirectory.register` already takes `parent`; `MeshUpstream` gains a way to say which parent it is linked to
  (`linkedTo(): string | undefined` and an `onLinked` callback).

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
