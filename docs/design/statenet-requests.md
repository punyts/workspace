# Requests that wait for the owner

Status: R1 built 2026-11-23 in state-sync and statenet, not deployed; R2's runtime half built 2026-11-23 in
stateui-app, stateui-components and stateui-mcp, not deployed; R2's storage half and R3 not built. Follows S14 ([statenet-permissions.md](statenet-permissions.md)); the
direction's later item "requests that wait for an offline owner" ([statenet-direction.md](statenet-direction.md)).

Asked for on 2026-11-23: "Design it", to the recommendation to design requests that wait for an offline owner next.

## Why

The direction names three rights: read, request and write. A request "proposes a change without write permission; it
waits for the owner", and "stays pending on the owner's edge (`requested → approved | rejected | expired`)" while the
owner is offline. It leaves for later "what the requester sees meanwhile, expiry, and approving a request whose value
has since changed (decided by the owner's logic, like a stale change today)".

S14 made `request` a right of the permission table, but nothing sends a request: a change from someone without
`write` is rejected with `access`. So a form someone else fills in, a booking that needs the owner's yes, or a
suggested edit to a shared document needs either full `write` or a workaround in the app. This design answers the
three open questions and builds the right.

"Offline" is the person, not the node. The owner's node (the edge: a Magnetic server, which holds the namespace's
authority) is always on; the person who owns the namespace, and who decides, may not be.

## The design

### A change becomes a request
- A change from a session whose access holds `request` but not `write` on the change's path becomes a **request**.
  The app sends an ordinary change; nothing in the app or the sync client chooses between the two. A change the
  sender holds `write` for is applied as today, and one it holds neither for is rejected with `access`.
- The authority does not apply it. It keeps it as a **pending request** and answers the change's ack with a new
  result, `requested`, naming the request's id.
- A pending request holds: `id` (uuid), the change (`path`, `op`, `value`), the `base` revision the sender saw, `by`
  (the access subject), `at`, `until`, and `status`.

### What the requester sees meanwhile
- The requester's client takes the change out of its optimistic state, as it does a rejected one: the shared state
  shows only what the owner applied. It keeps the request in the client's own list, which the runtime writes to
  `$.runtime.requests.<id>`: `{ path, op, value, at, until, status, mine: true }`. An app shows it beside the data
  ("waiting for approval") by binding that path; one that does not still shows a runtime notice, `syncRequested`
  ("Sent for approval."), as a refused change shows `syncRejected` today.
- When the request is decided, the requester's session gets `decided { id, status, decidedAt, code?, note? }` and the
  runtime updates the entry. An approved change then arrives as any change does, in the next `changes`. A requester who is offline gets
  the decisions of their requests in the `welcome` of their next session, so a request is never decided unseen.
- The requester may withdraw a pending request (`withdraw { id }`): its status becomes `withdrawn`.

### Who decides
- The owner, and anyone who holds both `read` and `write` on the request's path (an org's admins, through their
  `admins` entry), with a read that covers the path rather than one cut to parts of it. `write` alone does not see
  values, so it does not let a person approve one.
- A decider's session gets the pending requests it may decide in its `welcome` and each new one as `requested { … }`;
  the runtime writes them to `$.runtime.requests.<id>` with `mine: false` and `by`. The commands `request.approve`,
  `request.reject` (with an optional note) and `request.withdraw` act on them; the vocabulary of commands is a closed
  list, so these are added to it.
- **Approving applies the change as the requester's**, through the authority's normal path: the owner's logic (rules,
  gates, machines) sees it with `stale` worked out from the request's `base`, as a change that arrived late, plus
  `request: { by, at, approvedBy }` in its context. So "the value has since changed" is decided as a stale change is
  today: the logic adjusts or rejects it, and without logic it is applied. If the logic rejects it, the request ends
  `rejected` with the logic's code.
- The decision is the authority's. A decider's `approve` is a message to the authority, never a change it writes
  itself, so a person with `read` and `write` cannot use it to apply something else.

### Expiry
- A request lives seven days by default (`until`), an option of the authority (`requests.lifeMs`). An entry may say
  less: `requestDays` on a permission entry with `request` (1 to 30), which Magnetic turns into the grant's expiry
  (R3). It never lives longer than the grant that allowed it; revoking an entry its grant rests on ends it as `revoked`.
- Expiry and revocation are checked by the authority when it loads the namespace, at each hello and decision, and
  once a minute while it runs. An expired request ends `expired` and the requester is told as with any decision.
- A decided request is kept for 30 days after its decision, so a requester who comes back late still learns it, then
  dropped. Its change id stays in `applied` if it was applied.

### Limits
- At most 50 pending requests per requester per namespace, and 1,000 per namespace. A request past either is
  rejected with `unsaved`, as the limit of held changes is.
- A request's value is under the same size limit as a change.

### Where requests are kept
- In the namespace's stored state, beside `applied`: `StoredNamespace.requests`. They are saved with the namespace,
  through the aggregate, and fenced by the epoch with it, so a request survives a restart, a handoff to another node
  and a move. They are never in `state`, so no reader of the namespace sees them, and never in the change log.
- Postgres: `namespace_head.requests` (`json`), written by `PgEpochStorage.save` with `applied`. An index of pending
  requests without values, `pending_request (address, id, owner, subject, until)`, is kept in the same transaction, so
  Magnetic can list a person's waiting requests across namespaces without loading them.
- Files and memory: in the stored namespace as it is.

### The protocol
- **Sync protocol 3** (state-sync): the ack result `requested` (the request's id is the change's, so the ack names
  it); `requested { request }` and `decided { id, status, decidedAt, code?, note? }` from the authority; `approve
  { id }`, `reject { id, note? }` and `withdraw { id }` from a client, answered by `decided`, or by an `error`
  (`no-request`, `not-allowed`, `unsaved`) when the authority does not make the decision; `welcome.requests`.
  Protocol 2 clients keep working: they are never sent a request, and a change that would become one is rejected with
  `access`, as today.
- **Grants**: `GrantRight` gains `request`, so a token signed from an entry with `request` lets a relay pass the
  change on. The relay does not decide anything: the authority does.
- **The mesh**: a write carries the writer's access to the owner node, between owner nodes and in a handoff's queue,
  and its `WriteOutcome` gains `{ result: 'requested', epoch }`. Mesh protocol 4. A decider at another node decides
  over a sync session the mesh tunnels to the owner's authority (`OwnerMesh.connect`), so the mesh needs no message
  of its own for decisions.
- **Saves**: a request changes what is saved without taking a revision, as a `$.server` write does. The stored
  namespace counts every saved change (`serial`), and storages and the aggregate skip a save as one sent again only
  when its revision, then its serial, is no higher than what landed.

### The runtime (R2's half on the UI machine)
Asked for on 2026-11-23: "let's continue", then "Requests R2, runtime" as this machine's next work.
- **`$.runtime.requests`.** The view host writes the client's requests there on every `onRequests`, keyed by id:
  `{ id, path, op, value?, at, until, status, mine, by, decidedAt?, code?, note? }` (`base` stays in the client). The
  runtime takes the write as it takes `$.runtime.sync`; `$.runtime` never syncs, so the values stay in the session that
  was sent them.
- **The notice.** When the host first sees one of its own requests pending, it raises the app event `sync.requested`
  with `{ id, path }`. The root node's `on` entry for it runs; without one, an app with toasts shows the built-in
  notice `syncRequested` (`SYNC_NOTICES.requested`), an info toast whose text is the `toastRegion`'s
  `_requestedText` ("Sent for approval.").
- **The commands.** `request.approve`, `request.reject` and `request.withdraw` are system commands of `on` entries.
  Their argument is the request's id, in `value` (`"$row.id"` reads it in a row over `$.runtime.requests`) or `from`;
  `request.reject` also takes `{ id, note }`, the note at most 500 characters. The dispatcher hands the decision to
  the host (`DispatchHooks.decide`); the runtime posts `decide { action, id, note? }`, and the view host calls the
  client's `approve`, `reject` or `withdraw`. A mount with no `decide` hook (an app mounted outside a runtime frame)
  fails the command; a frame always posts it, and a host without a sync client ignores it. Nothing visible changes
  until the authority answers: its `decided`, not the command, changes `$.runtime.requests`. The runtime's `command`
  message refuses the three commands, as it refuses `set`, `toggle` and `emit`: the minion does not decide requests.

### Magnetic
- The share dialog and the Data page offer "can suggest changes" (`request`) beside read and write.
- A **Requests** page (`/requests`) lists what waits for the person to decide, from `pending_request`, with the app,
  the path's label, who asked and when; opening one opens the app at the request. The values are shown only in the
  app, by the session that may decide.
- The person is told of a new request the way Magnetic tells of a share today (the home page's notice); e-mail is
  not part of this design.

## Rules and Constraints
- A request is never applied without a decision by someone who may decide, and is applied only through the
  authority's normal path, with the owner's logic.
- A change becomes a request only when the sender holds `request` and not `write` for its path; nothing else changes
  how a change with `write` is handled.
- Requests are kept in the namespace's stored state, never in `state` or the log; their values are never logged, and
  `pending_request` holds none.
- The authority decides expiry, withdrawal and approval; relays pass messages on and decide nothing.
- Every decision reaches the requester, online or at their next session, until 30 days after it was made.
- Request ids are uuids, never integer-like (they are keys of `$.runtime.requests`).

## As built
R1 (2026-11-23):
- **state-sync** (sync protocol 3):
  - `src/Messages.ts`: `PROTOCOL_VERSION` 3, `REQUEST_STATUSES`, `SyncRequest`, `requested`, `decided`,
    `approve`, `reject`, `withdraw`, the ack result `requested`, `welcome.requests`, `REQUEST_ERROR_CODES`;
    `src/Validate.ts` checks them.
  - `src/authority/NamespaceStorage.ts`: `StoredRequest`, `StoredNamespace.requests` and `serial`, `serialOf`,
    `isResave`.
  - `src/authority/Authority.ts`: `AuthorityOptions.requests` (`RequestOptions`), pending requests, `decide`,
    `requests`, `submit`, `ChangeContext.request`, the sweep, `serial`.
  - `src/authority/Grants.ts`: `GrantRight` `request`.
  - `src/authority/Ownership.ts`: `WriteOutcome` `requested`, `QueuedWrite`, `OwnerNode.write` and `NodePeer.write`
    with access, `OwnerNodeOptions.access`, ordering through `submit`; `createMemoryEpochStorage` by `isResave`.
  - `src/Client.ts`: `onRequests`, `requests()`, `approve`, `reject`, `withdraw`; a `requested` ack leaves the
    outbox.
- **statenet** (mesh protocol 4): `src/mesh/protocol.ts` (access in a handoff's queue), `OwnerMesh.ts` (access on
  forwarded writes), `serving.ts`, `MeshUpstream.ts`, `linkClient.ts`, `ClientServer.ts` (acks `requested`),
  `Aggregate.ts` and `src/FileEpochStorage.ts` (by `isResave`, `epoch.json` with `serial`).
- Tests: state-sync `src/authority/Requests.test.ts` (a request told to its requester and the owner; protocol 2 and
  a reader rejected; approval through the owner's logic with `stale` and the request context, and a resend after it;
  a logic refusal on approval; who may decide and withdraw; expiry, revocation and forgetting; the limit per
  requester; a request across a restart in both welcomes; a sync client's list approved by the owner's client; the
  serial in memory storage; an owner node answering `requested`); statenet `src/mesh/groups.test.ts` ("requests
  across groups": a write from a node of another group kept as a request and approved by the owner) and
  `src/mesh/aggregate.test.ts` (a save that takes no revision written by its serial, in memory and in files).

R2's runtime half (2026-11-23):
- **stateui-app**: `src/core/types.ts` (`APP_EVENTS` with `sync.requested`, `SYNC_NOTICES.requested`);
  `src/core/on/types.ts` (`REQUEST_COMMANDS`, `MAX_REQUEST_NOTE`, `MAX_REQUEST_ID`, `RequestDecision`, in
  `SYSTEM_COMMANDS`); `src/core/on/validateOn.ts` (a request command with a target or no id is `SUI-ON-SHAPE`);
  `src/dom/on/commands.ts` (`requestDecision`, `CommandContext.decide`); `src/dom/on/types.ts`
  (`DispatchHooks.decide`); `src/dom/on/dispatcher.ts` (the `syncRequested` notice); `src/runtime/messages.ts`,
  `validate.ts` and `limits.ts` (the outbound `decide`, writes to `$.runtime.requests`); `src/runtime/createRuntime.ts`
  (the hook posts `decide`); `src/dom/mount/mountApp.ts` (`$.runtime.requests` starts empty);
  `src/core/links/extractLinks.ts` and `runtimePath.ts` (a link to `$.runtime.requests`).
- **stateui-components**: `toastRegion`'s `_requestedText` and its locales; the controller shows `syncRequested` as an
  info toast.
- **stateui-mcp**: `src/browser/requestsView.ts` (`requestEntries`, `newRequests`); `src/browser/host.ts` (writes
  `$.runtime.requests`, raises `sync.requested`, answers `decide`); the guide's `saving` topic.
- Tests: stateui-app `src/core/on/on.test.ts` (the request commands' shapes), `src/runtime/validate.test.ts` (the
  `decide` message, writes to `$.runtime.requests`), `src/runtime/startRuntime.browser.test.ts` (a request command
  posts `decide`, one with no id is a runtime error; a row command reads the id from the requests the host wrote);
  stateui-components `test/composites/toast-region.browser.test.ts` (the built-in notices with `syncRequested`);
  stateui-mcp `src/browser/requestsView.test.ts` (entries without `base`; each own pending request announced once,
  none from a welcome) and `src/infrastructure/mcp/guide.test.ts` (the saving topic).

## Stages
1. **R1, state-sync and statenet**: the pending request in the authority (`StoredNamespace.requests`, limits,
   expiry), sync protocol 3, `GrantRight` `request`, the client's list and its events, `WriteOutcome` `requested`,
   mesh protocol 4 with `decide` and `decided`, `FileEpochStorage`. Tests in state-sync (`Authority.test.ts`,
   `Client.test.ts`) and statenet (`groups.test.ts`: a request from a node of another group decided by the owner).
2. **R2, storage and the runtime**: `PgEpochStorage` with `namespace_head.requests`, the serial and `pending_request` (stateui-pg
   migration, Magnetic's baseline edited and databases reset); stateui-app `$.runtime.requests`, the three commands
   and the `syncRequested` notice; stateui-components' toast for it. stateui-app and stateui-components are the UI
   machine's, so R2's runtime half is asked for in [work-split.md](../work-split.md) first.
3. **R3, Magnetic**: the `request` right in the share dialog and the Data page, `requestDays`, the Requests page and
   the home notice. Checks: a person with `request` on a shared dataset suggests a record, the owner approves it on
   the Requests page, the requester sees it applied; one left alone expires; one approved after the value changed is
   adjusted by the app's logic.

## Decisions
Made with the owner (proposed with the design; the owner said "Yes, build R1", 2026-11-23):
- **A change becomes a request by itself** when the sender holds only `request`, so an app needs no code to support
  suggesting changes. A change marked as a request by an app with `write` can be added later as a flag on the change.
- **Who decides**: the owner and holders of `read` and `write`.
- **Seven days by default, 1 to 30 per entry, decided requests kept 30 days.**
- **No e-mail** for new requests in this design.

Made in this design:
- Requests live in the stored namespace, so they move and fence with it; a separate table would need its own epochs.
- Approval goes through the owner's logic with `stale` from the request's base, so "the value has since changed" has
  one answer, the one stale changes have.
- The requester's optimistic change is taken out and kept as a request in `$.runtime`, not left in the shared state,
  so nobody mistakes a suggestion for what was saved.

Made while building R1:
- The request's id is the change's id. A resend of the change is answered as the first one was (`requested` while it
  waits, `applied` once approved), as a resent change is today.
- The authority, not the permission entry, holds a request's life: it sees a grant, not the entry. `requestDays`
  reaches it as the grant's expiry, which caps the life.
- The mesh carries no `decide` message: a decider at another node already has a tunnelled session with the owner's
  authority, which speaks sync protocol 3.
- Owner nodes order writes through `Authority.submit`, which answers at once with the writer's access, in place of one
  ordering session per authority without access.

## Open items
- A relay's browser server (`ClientServer`) acks a request `requested` but sends no `requested`, `decided` or
  `welcome.requests`: it serves a subscription, not a session with the authority. A requester there learns that a
  request was approved when its change arrives.
- Magnetic's authorities (`AppAuthorities`) and the statenet's (`Statenet.ts`) check no access today (who connects is
  decided before the session); requests need `AuthorityOptions.access`, which R3 wires.
- `PgEpochStorage` keeps no serial until R2: it skips a save at the same revision, a request among them.
