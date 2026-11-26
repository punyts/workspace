# Requests that wait for the owner

Status: R1 (state-sync, statenet), R2 (stateui-pg storage; stateui-app, stateui-components and stateui-mcp runtime)
R3a, R3b and R3c (state-sync, stateui-mcp, stateui-pg, Magnetic) built 2026-11-23, deployed 2026-11-24; the follow-ups
(shared reads by namespace, `bound` entries ending with access, requests through a relay and through statenet
views) built the same day. Follows S14 ([statenet-permissions.md](statenet-permissions.md)); the
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
- Postgres: `namespace_head.requests` (`json`) and `namespace_head.serial`, written by `PgEpochStorage.save` with
  `applied`. An index of pending requests without values, `pending_request (address, id, workspace_id, owner, subject,
  at, until)`, is kept in the same transaction, so Magnetic can list a person's waiting requests across namespaces
  without loading them. `owner` is the address's first segment. It is a state table: the aggregate writes it, an app
  server reads it.
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

### Magnetic: how a change reached the owner's data before R3
Asked for on 2026-11-23: "Design R3's write path".

- A dataset is a data part in its owner's workspace (`WriteData`, the parts tables), not a namespace. An app binds it
  in `uses.data`, and each running instance holds it at `$.data.<binding>`.
- Someone who opens an app with `use` runs an instance of their own, `<person>/apps/<app>`, which they own
  (`userStateAddress`). `view` shares the owner's instance and writes nothing; `edit` opens the owner's.
- A write to `$.data.<binding>` in any instance is checked against the dataset's model by the instance's data gate and
  written through to the data part by `DatasetHub`, which sends it on to every other instance that binds the dataset.
- Sessions carry no access: Magnetic's routes decide who opens which instance, and the instance's authority checks
  nothing more.
- A dataset shared with another workspace is read by that workspace's apps at `$.external`, read only
  ([magnetic-shared-data.md](magnetic-shared-data.md)).

So no change by someone other than the owner reaches an authority the owner owns. The person's change lands in an
authority they own, and crosses to the owner's data inside `DatasetHub`. R1's check sees an owner writing their own
namespace and always allows it, and a request kept there would be decided by its own requester.

### Magnetic: the write path (R3)
**A dataset becomes a namespace, and every writer reaches it with their access.**
- **The dataset's namespace** is `<owner>/data/<dataset>` (`datasetStateAddress`), the owner named by number as
  in every statenet address. An authority on the owner's node holds it like an app instance (claimed, leased, saved
  through the aggregate by `PgEpochStorage`, one row per record). Its state is `$.data.records.<key>`; the data
  part keeps the dataset's name and model and no longer holds records. In R3b the model check that the instance's
  data gate runs becomes the dataset authority's change handler, so it runs once, on the owner's node, whoever
  writes, and shares' `datasetAddress` (now `<workspace id>/data/<dataset>`) takes the namespace's address.
- **Its authority checks access** (`AuthorityOptions.access`). Magnetic gives it a context from the permission table:
  an owner's own writes pass, anyone else's are checked against their entries on `$.data.<dataset>` (or a pattern
  covering it), so `write`, `request` and nothing are told apart there and nowhere else. Requests are R1's, kept in
  the dataset's namespace, decided by the owner or a holder of read and write, and listed in `pending_request` under
  the dataset's owner.
- **Writers reach it over sessions.** `DatasetHub` stops writing through to the part. An instance's binding becomes a
  sync session to the dataset's namespace, opened for the person the instance acts for (the app acts as the person
  using it, as S14 says), with an access Magnetic signs from their entry: subject the person, a token whose rights
  now carry `request` (`StateGrants.tokenFor` drops it today). The session is protocol 3, so a change that becomes a
  request is acked `requested`, and `requested` and `decided` come back on it.
- **What the person sees.** The binding's session belongs to the instance, on the server, so the instance passes its
  requests on to the browser: it writes them to the instance's `$.runtime.requests` (`$.runtime` never syncs, so this
  is the server telling one session, the instance's own sync client), and R2's runtime shows them. The three
  commands go back the same way. This is the one piece R2's runtime did not plan for: its list comes from a session
  the instance holds, not from the browser's own.
- **Logic.** The app's logic runs in the person's instance as now and sees the dataset's changes as changes under
  `$.data.<binding>`; an approved request arrives as any change does. Logic that must run on the owner's side for
  every writer belongs to the dataset (its model's checks), which is where this design puts the model check.
- **Shared datasets** (`$.external`) are the same session opened from another workspace's instance. With `read` it
  stays read only; once the owner gives `request` or `write` on the dataset, the reading app may write it through
  the same path. Writing `$.external` from an app stays refused until a later design names where the app writes it.
- **Who sees what.** `use` keeps writing what it writes today: an app's `use` entry gives `write` on the datasets the
  app binds, made with it, so nothing changes for people who use apps now. The owner lowers it to `request` on the
  Data page ("changes wait for my approval") or per person in the share dialog.

### Magnetic: how R3a is built
- **The namespace's state** is `$.data.records.<key>`. Postgres keeps one row per record, as it does a person
  binding's. The model stays in the stored part, where renames and the usage index already handle it.
- **The data part is served from it.** The stored `data` part keeps the dataset's id, name and model. The part
  repository that Services hands out (`DatasetParts`) serves a `data` part with the namespace's records, and the
  namespace's revision as its revision. A write of a `data` part is written to the namespace: the records that
  changed, as server writes, checked against the revision the caller read, and answered once they are saved. A
  namespace's revision counts paths, so a dataset's revision rises once for each path a write changed. So every reader of a dataset
  (assembly, validation, the tools, Magnetic's pages) reads it as before, and every write is ordered by the dataset's
  authority. Creating, renaming and deleting a dataset makes, moves (one revision up, without its log) and removes
  its namespace. The usage index is built from the stored parts, so building it opens no dataset.
- **Placement.** Production runs two Magnetic servers, and a dataset's authority runs on one of them at a time, like
  an app's instance. A server that reads or writes a dataset claims its namespace first, as the tools claim an
  instance; the owner node starts and releases it by address (`hostInstance`, `releaseInstance` take dataset
  addresses too).
- **The hub follows the namespace.** `DatasetHub` subscribes to each bound dataset through the relay, which follows
  the namespace to the server that holds it, and applies to every instance here that binds it what differs from the
  instance's copy. R3b replaced this with sessions (below).
- **Embeddings.** A record's embedding is queued by the save of its dataset's namespace (`PgEpochStorage`'s
  `onSave`), not by a part change, and its source id is `<address>/<key>`. A model change, or a dataset moved to
  another model, queues every record in the namespace.
- **Imports.** `importPart` (stateui-pg) and Magnetic's `importPeople` put a data part without its records and save
  them as the namespace at revision 1. The file server keeps namespaces in `data/namespaces/`, and the showcase
  installs its records there.

### Magnetic: how R3b is built
- **The model check is the dataset's.** `DatasetNamespaces` gives each dataset's authority a change handler on
  `$.data.records` that checks the records a change touches against the dataset's model (`recordsReason`), whoever
  writes. `DatasetModels` reads each dataset's model from the stored parts once and again when the dataset's part or
  its model changes, so the check is synchronous. Server writes (`WriteData`, the tools) are checked by `WriteData`'s
  validator as before. The authority's sync namespace is its address with dots, `<owner>.data.<dataset>`, as a hello
  must name it; its address stays `<owner>/data/<dataset>`.
- **Access.** Given a context (`ServicesOptions.datasetAccess`), each dataset's authority checks every session's
  access (`AuthorityOptions.access`) and keeps requests (`requests`). Magnetic's context is
  `StateGrants.accessContext()`: the owner keys loaded so far, the clock, and the entries revoked within a token's
  life, which the server reads every 5 seconds (`refreshRevoked`) and adds to at once when it revokes one itself.
  Without `datasetAccess` (the file server, tests) sessions are not checked.
- **A binding is a session.** `DatasetHub` opens one `DatasetSession` per shared binding of a running instance: a sync
  client in the server (protocol 3) over an in-process transport (`sessionTransport`), connected here or tunnelled to
  the server that holds the dataset (`InstancePlacement.connect`), as the person the instance acts for. Magnetic's
  `accessFor` is `StateGrants.boundAccess`: the workspace itself for its own instance (the person is the workspace),
  otherwise a token
  for the person's standing `bound` entry on `$.data.<dataset>`, read and write, made the first time they bind it
  (permission kind `bound`, not listed under Shared by me). So everyone who runs an instance of an app writes the
  datasets it binds, as with `use` today; R3c lets the owner lower an entry to `request`.
- **Renewal.** A session reads its access again on every connection. One made with a grant closes itself 10 minutes
  before the grant expires (`RENEW_BEFORE_MS`, at least a second after connecting), so the sync client reconnects
  with a fresh token and sends its unanswered changes again; an instance that runs longer than a token's 4 hours keeps
  writing. A connection without a grant (the owner) is not renewed.
- **Writes.** The hub still checks an instance's own writes against the model synchronously (a client change through
  the instance's `onChange`, a logic or tool write through the data gate), then sends the records they touched
  through the session; a record the session already shows is not sent. `durable` waits until the session's changes
  are answered and saved, and fails with a refusal, so a `save-data` with `as` is rejected with the authority's
  reason. What the session shows (the namespace's records with its own unanswered changes on top) is laid over the
  binding, only what differs, so a refused change, or one kept as a request, is taken out of the instance again. An
  instance's start waits (up to 5 seconds) for each session's first records, so its logic derives from them.
- **Requests reach the browser.** The hub emits each instance's bindings' requests to the instance's clients as
  `sync.requests`, with paths below the binding (`$.data.<binding>.<key>`). The view host lists them in
  `$.runtime.requests` beside the app's own and raises `sync.requested` for new ones of its own; it asks for them
  with `sync.requests` when it comes online (that list announces nothing), and sends a decision on one it did not get
  from its own client as `sync.decide` `{ action, id, note }`, which the hub passes to the session that holds it.
- **Shares.** `datasetAddress` (`<workspace id>/data/<dataset>`) is turned into the namespace's address at
  `StateGrants`' edge (the owner's id to its number), so shares already name the namespace.

### Magnetic: pages (R3c)
Asked for on 2026-11-23: "Design R3c".

- **A request lives as long as the entry says, not the token.** R1's authority ends a request at
  `min(at + lifeMs, grant expiry)`, and Magnetic's tokens live 4 hours, so a request made in Magnetic would expire
  within 4 hours. `GrantClaims` gains two optional claims (state-sync): `requestMs`, the life of a request made
  with the grant (at most `MAX_REQUEST_MS`, 30 days), and `lasts`, when the entry itself ends. `verifyGrant`
  takes the smallest of each over the chain (`lasts` defaults to the token's expiry), and the authority ends a
  request at `min(at + (requestMs ?? lifeMs), lasts)`, so a token's short life only bounds how long it may be used
  to send. Revocation still ends a request at once (its chain). `StateGrants.tokenFor` writes both for an entry with
  `request`: `lasts` is the entry's end, or 30 days from signing for a standing entry, and `requestMs` its
  `request_days`.
- **The owner chooses per dataset what people using their apps may do.** The Data page shows under each of the
  workspace's datasets "Changes from people using your apps": **Saved at once** (the default, as today) or **Wait
  for your approval**, and with the second, "Requests last" 1 to 30 days (7 by default). It is kept in a new table,
  `dataset_setting (workspace_id, part_id, bound_rights, request_days)`, keyed by the data part's id so a rename
  keeps it (`migrations/0001_baseline.sql`; databases are reset). `StateGrants.boundAccess` makes a person's
  `bound` entry with `read, write` or `read, request` from it, and the entry keeps `request_days` (a new
  column of `permission`, read by `tokenFor`).
- **Changing the setting takes effect at once.** Saving it revokes the dataset's live `bound` entries; each person
  gets a new one with the new rights the next time their session connects. A `DatasetSession` whose change is
  refused for access (code `access`) closes its connection and reconnects with a fresh access, at most once a
  minute (`ACCESS_RETRY_MS`, stateui-mcp), so a running instance moves to the new rights without a restart. Changing
  only the days updates `request_days` on the live entries, which their next token carries. Raising the dataset to
  Saved at once ends the waiting requests of those entries as `revoked` at the authority's next sweep (every minute,
  and on every session's hello); while requests wait, the Data page says how many and that saving at once drops them.
- **The share form** stays read only. A share gives another workspace `$.external`, and writing `$.external` is
  refused until a later design says where an app writes it, so offering "can suggest changes" there would give a
  right nothing can use. It is added with that design.
- **A Requests page** (`/requests`, server HTML like the Data page, linked from the profile menu beside Data) lists
  the pending requests of every workspace the person manages (their own, and an org's they own or administer), read
  from `pending_request` in a transaction scoped to those workspaces: dataset, who asked (their name), when, and
  until when it waits, with the workspace's name when it lists more than one. Who asked is the request's subject (an
  owner number) turned into the person's or org's name, or "someone". Values are not in that table, so the list shows
  none.
- **Opening a request** (`/requests/<workspace>/<dataset>/<id>`) asks the dataset's authority for it: the server
  opens a `DatasetSession` as the decider, waits for its first records and lists its requests (the welcome brings the
  ones the decider may decide), shows the record as it is and as asked (each field that differs, with a `merge`
  laid over the record; a removal as "Remove the record" with its fields; a whole-map write as the keys it adds,
  changes and removes; a deeper path as its one value), and closes the session. A request no longer pending answers
  404 with "That request is no longer waiting". Approve and Reject (with an optional note, at most 500 characters)
  post back; the server opens a session again, sends the decision with `decide`, and waits up to 5 seconds
  (`ANSWER_MS`) for the request to leave `pending`, then shows the list with the outcome: saved, rejected, refused
  with the code when an approval the dataset's logic or model refuses ends `rejected` with one, or "did not answer".
  The values reach only the decider's page; they are not stored or logged outside the namespace.
- **The decider's access** is the workspace itself (`StateGrants.boundAccess('default', workspaceId, dataset)`),
  used only after Magnetic finds that the person manages the workspace (their own, or an org's they own or
  administer); anyone else gets 403. Holders of read and write through other entries may decide in the protocol;
  Magnetic lists requests only to the people who manage the workspace.
- **Services gain `datasetSessions`** (stateui-mcp): `list(dataset, access)` gives the dataset's records and the
  requests the access may decide; `decide(dataset, access, action, id, note?)` sends one decision and resolves with
  its outcome. Both open a session here or through the placement, as the hub does, and close it after. The list
  shown after a decision leaves the decided request out: `pending_request` is written by the save that follows the
  decision's answer.
- **Home tells of waiting requests** as it tells of invites: a warning alert above the apps, "N changes people asked
  for wait for your approval", with Review them (the id `review`, heard as `requests`, to `/requests`), shown while the count from
  `pending_request` over the workspaces the person manages is above zero (`HomeApp`'s `requestsLine`, and `noRequests`,
  the alert's own `hidden`, written when Your apps loads). The profile tab links Requests beside Data. The Data page shows the
  count per dataset beside the setting. E-mail is not part of this design.
- **Text** for the Requests page goes in `src/http/requestsText.ts`, and the Data page's and home's new keys in
  `dataText.ts` and `text.ts`, each in English, German, French and Spanish.

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

R2's storage (2026-11-23):
- **stateui-pg**: `migrations/0010_requests.sql` (`namespace_head.serial` and `requests`, `pending_request` with
  row-level security by workspace); `src/state/PgDirectory.ts` (`PgEpochStorage` loads and saves both, skips a save by
  `isResave`, keeps `pending_request` in the save's transaction and clears it with the namespace);
  `src/db/migrate.ts` (`STATE_TABLES` lists `pending_request`, so an app server only reads it).
- Test: `src/state/directory.test.ts` ("should keep the serial and requests on the head, list the pending ones
  without values, and write a save that takes no revision").

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

R3a (2026-11-23):
- **stateui-mcp**: `src/domain/StateAddress.ts` (`datasetStateAddress`, `datasetOfAddress`);
  `src/infrastructure/sync/DatasetNamespaces.ts` (an authority per dataset, claimed by placement; `RECORDS_PATH`,
  `seededDataset`); `src/infrastructure/storage/DatasetParts.ts` (the part served from the namespace) and
  `FileNamespaceStore.ts`; `src/infrastructure/sync/DatasetHub.ts` (follows each namespace through the relay and
  reconciles bindings); `src/application/IndexedUiPartRepository.ts` (the index from the stored parts);
  `src/infrastructure/sync/AppAuthorities.ts` (`onClosed`); `src/config/createServices.ts`
  (`ServicesStorage.datasets`, dataset addresses in the relay's lookup, `hostInstance` and `releaseInstance`);
  `src/config/showcase.ts` (records installed as namespaces).
- **stateui-pg**: `src/workspace/PgWorkspaceStorage.ts` (`datasets`, `importPart` splits a dataset,
  `txSeedDataset`); `src/workspace/PgPartRepository.ts` (`put` says whether it inserted);
  `src/embeddings/records.ts` and `RecordSimilarity.ts` (record embeddings from the namespace).
- **Magnetic**: `src/storage/importFiles.ts` (a dataset's records imported into its namespace).
- Tests: stateui-mcp `src/infrastructure/storage/DatasetParts.test.ts` (records served from the namespace at its
  revision; a stale write refused; rename and delete), `src/config/datasetHub.test.ts` (bindings over the
  namespace), `test/dataTools.test.ts`; stateui-pg `src/embeddings/records.test.ts` (embeddings from namespace
  saves) and `src/workspace/workspaceStorage.test.ts` (an imported dataset); Magnetic
  `src/storage/importFiles.test.ts`.

R3b (2026-11-23):
- **stateui-mcp**: `src/infrastructure/sync/DatasetModels.ts` (`recordsReason`, models read for synchronous checks);
  `DatasetNamespaces.ts` (the model check as the authority's change handler, `context` and `requests` options,
  `syncNamespaceOf`); `DatasetSession.ts` (`sessionTransport`, a binding's sync client as a person, renewed before its grant expires);
  `DatasetHub.ts` (bindings as sessions, `sync.requests` and `sync.decide`); `AuthorityInstanceStates.ts` (attach as
  the instance's person); `src/config/createServices.ts` (`datasetAccess`, sessions here or through the placement);
  `src/browser/host.ts` and `requestsView.ts` (the bindings' requests in `$.runtime.requests`, decisions sent on).
- **Magnetic**: `migrations/0001_baseline.sql` (permission kind `bound`); `src/grants/StateGrants.ts`
  (`boundAccess`, `accessContext`, `refreshRevoked`, `tokenFor` keeps `request`); `src/server/startMagnetic.ts`
  (`datasetAccess` for each workspace, revocations read every 5 seconds).
- Tests: stateui-mcp `src/infrastructure/sync/DatasetSession.test.ts` (a session reconnects with a fresh grant before
  the first expires and a later write is applied; one without a grant keeps its connection); `src/config/datasetHub.test.ts` (a change without access taken out and reported; one with a
  write grant applied; one with `request` kept, listed to both instances and applied on approval; the list sent
  again on `sync.requests`; a refused shared record gives a `save-data` its reason; the model check, derived
  values and Full mode as before); Magnetic `src/server/grants.test.ts` (one standing `bound` entry per person and
  dataset, the owner without a grant, refused once revoked, here and after `refreshRevoked`). The view host's relay
  of requests has no test of its own.

R3c (2026-11-23):
- **state-sync**: `src/authority/Grants.ts` (`GrantClaims.lasts` and `requestMs`, `MAX_REQUEST_MS`, both
  returned by `verifyGrant` and `checkAccess`); `Authority.ts` (a request's `until` from them); `Relay.ts`.
- **stateui-mcp**: `src/infrastructure/sync/DatasetSession.ts` (access read on every connection; reconnect on an
  `access` refusal, `ACCESS_RETRY_MS`); `DatasetSessions.ts` (`list`, `decide`, `ANSWER_MS`);
  `src/config/createServices.ts` (`Services.datasetSessions`); `src/index.ts`.
- **Magnetic**: `migrations/0001_baseline.sql` (`dataset_setting` with row-level security, `permission.request_days`);
  `src/permissions/Permissions.ts` (`requestDays`); `src/grants/StateGrants.ts` (`DatasetSetting`,
  `DEFAULT_DATASET_SETTING`, `datasetSetting(s)`, `setDatasetSetting`, `boundAccess` from the setting, `tokenFor`
  with `lasts` and `requestMs`); `src/requests/PendingRequests.ts` (`of`, `count`); `src/http/dataPage.ts`,
  `dataText.ts` and `src/server/dataRoutes.ts` (the setting, the waiting count, `managedWorkspaces`);
  `src/http/requestsPage.ts` (`changeOf`), `requestsText.ts` and `src/server/requestsRoutes.ts`;
  `src/home/HomeApp.ts`, `src/http/home.ts` and `text.ts` (the alert and the Requests link);
  `src/server/startMagnetic.ts` (wiring, the count for Your apps).
- Tests: state-sync `src/authority/Requests.test.ts` ("should keep a request past its token's expiry for the grant's
  requestMs, within the entry's lasts"); stateui-mcp `src/infrastructure/sync/DatasetSession.test.ts` (a session
  refused for access reconnects with the new rights; `DatasetSessions` lists and approves a request, a missing
  dataset or request gives undefined); Magnetic `src/server/requests.test.ts` (the setting gives read and request with
  its days and revokes the old entry; a change Bob asks for is listed, shown beside the record and saved on approval;
  a rejection with a note, and 403 for someone who does not manage the workspace; the Data page's count,
  `PendingRequests.count`, and saving at once again revokes the entries and drops the request); Magnetic
  `e2e/requests.spec.ts` (through a real app at desktop and phone sizes: Bob's change is sent for approval, Your apps
  shows the alert, Alice opens the request beside the record and approves it, and Bob's app shows the new value; a
  rejection with a note is not saved and is no longer waiting), with `seedDataApp` in `e2e/server.mjs` and
  `fixtures.ts`.

Follow-ups (2026-11-23):
- **Shared reads follow the namespace.** stateui-mcp's `DatasetSessions.follow(dataset, access, listener)` keeps a
  session open with the dataset's authority, here or through the placement, and passes the records on once it has
  them and after every change, until closed. Magnetic's `SharedData` follows a shared dataset that way as the owner
  workspace (`boundAccess('default', …)`) instead of the owner's part changes, so a write wherever the namespace is
  held reaches the reading apps at once; every delivery still checks the share.
- **`bound` entries end with access.** `Permissions.revoke` ends a person's `bound` entries under an owner
  (`endBound`) when it revokes their `opened` or `access.*` entry there and they hold no other: revoking a link
  (which revokes the `opened` entries under it), a person rejecting a share, and an org taking app access away all
  go through it. `dropMember` calls `endBound` for the org, since membership gives its apps without an entry.
  Dataset authorities see the revocation within 5 seconds (`refreshRevoked`).
- **Requests through a relay.** state-sync's protocol 3 `hello` takes `requests: true`: the session's welcome
  carries its requests and no state (`changes: []`), and it gets `requested` and `decided` but no `changes`,
  `durable` or watermark. statenet's `ClientServer` opens one to the owner's authority (option `open`;
  `RelayNode` passes `MeshUpstream.open`, a tunnelled session) for each protocol 3 browser, as the browser's
  access: the subscription's welcome waits for it (at most `requestsWaitMs`, 5 seconds) and carries its requests,
  `requested` and `decided` follow, and the browser's `approve`, `reject` and `withdraw` go to it. The plain
  host of an owner node names an authority by the address with `/` as `.`, as every client says hello.
- **Requests through statenet views.** stateui-mcp's `StatenetViews` bridge passes the instance's emits to the
  pages (`sync.requests`), and a page's `sync.decide` and `sync.requests` without a value (a page asking) to
  the instance's authority.
- Files: state-sync `src/Messages.ts`, `src/Validate.ts`, `src/authority/Authority.ts` (`requestsOnly`),
  `src/authority/Ownership.ts`; statenet `src/mesh/ClientServer.ts`, `RelayNode.ts`; stateui-mcp
  `src/infrastructure/sync/DatasetSessions.ts` (`follow`), `src/infrastructure/statenet/StatenetViews.ts`;
  Magnetic `src/sharing/SharedData.ts`, `src/permissions/Permissions.ts` (`endBound`), `src/orgs/Orgs.ts`,
  `src/server/requestsRoutes.ts`.
- Tests: state-sync `src/authority/Requests.test.ts` ("should welcome a session that asked for requests only with
  its requests, and send it no changes or watermark"); statenet `src/mesh/clientServer.test.ts` (a browser that may
  only request hears of its request and the decision, and a second browser gets the waiting request in its
  welcome; a browser's rejection reaches the owner's authority); stateui-mcp
  `src/infrastructure/sync/DatasetSession.test.ts` ("should follow a dataset's records from the authority, and stop
  when closed") and `test/statenetBridge.test.ts` (a page's `sync.requests` is answered through the statenet);
  Magnetic `src/sharing/sharedData.test.ts` (a write to the namespace itself reaches the reading app) and
  `src/permissions/Permissions.test.ts` (the last link revoked ends the `bound` entry, another person's stays; a
  member leaving an org ends theirs).

## Stages
1. **R1, state-sync and statenet**: the pending request in the authority (`StoredNamespace.requests`, limits,
   expiry), sync protocol 3, `GrantRight` `request`, the client's list and its events, `WriteOutcome` `requested`,
   mesh protocol 4 with access on writes, `FileEpochStorage`. Tests in state-sync (`Requests.test.ts`) and statenet
   (`groups.test.ts`: a request from a node of another group decided by the owner).
2. **R2, storage and the runtime**: `PgEpochStorage` with `namespace_head.requests`, the serial and `pending_request` (stateui-pg
   migration 0010, applied by `migrate`; no reset); stateui-app `$.runtime.requests`, the three commands
   and the `syncRequested` notice; stateui-components' toast for it. The runtime half was built on the UI
   machine, which owns stateui-app and stateui-components.
3. **R3, Magnetic**, in three steps:
   - **R3a, datasets as namespaces** (stateui-mcp, stateui-pg, Magnetic): `<owner>/data/<dataset>` held by the owner's
     node; `WriteData`, the agent's data tools and the Data page read and write
     it through the authority; the part keeps no records. Magnetic has no users, so its databases are reset rather
     than their records moved.
   - **R3b, the write path**: the model check moves to the dataset authority's change handler; shares'
     `datasetAddress` becomes the namespace's address; `DatasetHub` bindings become sessions with the person's access; Magnetic's access
     context from the permission table; `tokenFor` keeps `request`; `use` entries give `write` on bound datasets;
     the instance passes its binding sessions' requests to `$.runtime.requests` (with R2's runtime).
   - **R3c, pages** (the tower; nothing in stateui-app or stateui-components): state-sync's `requestMs` and `lasts`
     claims; stateui-mcp's `datasetRequests` and the session's reconnect on lost access; Magnetic's
     `dataset_setting` and `request_days`, `boundAccess` from the setting, the Data page's setting, the Requests
     page and the home alert. Tests: state-sync (a request outlives its token and ends at
     `requestMs`); stateui-mcp (`datasetRequests` lists and approves one; a session refused for access reconnects
     with the new rights); Magnetic (the setting gives `request`, changing it revokes and remakes `bound` entries,
     the page lists and decides, the alert counts).

   Checks: a person with `request` on a shared dataset suggests a record, the owner approves it on
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

Made with the owner on 2026-11-23 ("Yes, build R3a"), as proposed:
- **A dataset becomes a namespace**, `<owner>/data/<dataset>`, whose authority runs the model check and checks access.
  The alternative, keeping datasets as parts and making `DatasetHub` keep requests of its own, would build a second
  request store beside R1's and leave every other check to the hub.
- **`use` gives `write` on the datasets an app binds**, so today's apps behave as now, and the owner lowers it to
  `request`. The alternative, `use` as `read` only (S14's table read strictly), would stop every shared app's users
  from saving until the owner gives them more.
- **A shared dataset may be written from another workspace** once the owner gives `request` or `write`.

Made with the owner on 2026-11-23 ("Yes, build R3c"), as proposed:
- **The setting is per dataset, for everyone using the owner's apps**, not per person: a `bound` entry is made by
  running an app, so the person is often not known to the owner beforehand. Per-person rights for app users can be
  added on the same page later.
- **The share form stays read only** until `$.external` can be written.
- **Deciders listed are the people who manage the workspace** (owner and org admins).
- **Raising a dataset to Saved at once drops its waiting requests** (`revoked`), after the page says how many.

Made while building the follow-ups:
- **A requests-only session** for the relay, rather than a second full session per browser: the relay serves state
  from its cache, and a full session would carry every change over the mesh twice.
- **The relay's welcome waits for the requests**, because the sync client replaces its list on every welcome; after
  5 seconds without them it goes without, and the requests arrive as they are made or decided.
- **`bound` entries end in `Permissions.revoke`**, the one place every way of losing an app goes through, rather
  than in each caller.

Made while building R3c:
- **The decider is the workspace itself** once Magnetic has checked that the person manages it, rather than a token
  for an org's `admins` entry: the check is Magnetic's either way, and the workspace's own access needs no entry.
- **A standing entry's `lasts` is 30 days from signing**, so a request made with it lives its `request_days` and
  the grant needs no claim the authority would read as "forever".

Made while building R3b:
- **A binding connects with a `bound` entry**, one per person and dataset, made the first time they bind it, rather
  than from the app's `use` entry: a person may reach an instance through an org's membership or a link, which have
  no `use` entry, and the entry is what R3c lowers to `request`.
- **The instance checks the model too**, synchronously, so a refusal reaches logic and the tools at once; the
  dataset's authority checks it again for every writer.
- **`durable` waits for the save** of the dataset's namespace (the session's pending count), not only its ack.

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
- The Data page shows a dataset's records as they are when it loads, and does not follow them.
- A tool's or the Data page's write of a dataset still claims its namespace for the server it runs on; instances
  reach it where it is.
- A revocation made on the other server reaches this one's dataset authorities within 5 seconds.
- Magnetic's authorities (`AppAuthorities`) and the statenet's (`Statenet.ts`) check no access today (who connects is
  decided before the session). R3 gives access only to the dataset namespaces; app instances stay as they are, each
  owned by the person it runs for.
