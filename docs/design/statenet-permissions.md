# Statenet permissions: one table of path patterns per owner

Status: built 2026-11-22 (S14a, S14b and S14c). Statenet milestone S14.

Asked for on 2026-11-22: "Yes, design it", to the recommendation to design the direction's open item "the permission
schema, sharing and revocation" ([statenet-direction.md](statenet-direction.md), "Permissions").

## Why

The direction says permissions are a table from path patterns to who may read, request or write, served by the same
matcher as versioning, relays and logic. Today five separate mechanisms decide access, each with its own storage,
checks and page:

| Mechanism | Where | Names what | Rights | Revoked by |
|---|---|---|---|---|
| App access in an org | Magnetic `AppAccess`, `app_access`, `app_setting`, org roles | an app of a workspace | `view`, `use`, `edit`, `manage` | removing a row |
| Share links | Magnetic `Grants`, `link_grant`, `link_grant_member` | an app | `use`, `view`, `remix` | `revoked_at` |
| Signed state grants (S4) | state-sync `Grants.ts`, Magnetic `StateGrants`, `state_grant` | an address `<owner>/<app>/<scope>` and a path prefix | `read`, `write` | `revoked { grantId }` down the chain |
| Dataset shares | Magnetic `StateGrants` (`<workspace>/data/<dataset>`) | a dataset | read | the grant |
| The `/paths` read grant | stateui-mcp `PathGrants` | an app's files, 15 minutes | read | expiry only |

Each was right for its step, but together they cannot answer "who can read this path" in one place, a person sees
their sharing on three pages, and every new kind of access (a persona's file, a tile source, a request) would add a
sixth. This design replaces all five with one table and one check.

## The design

### An entry
Every right is a **permission entry**, kept by the owner it is about:

| Field | Meaning |
|---|---|
| `id` | uuid |
| `owner` | the owner number: the `$` of every path the entry covers |
| `pattern` | a path pattern under that owner (`$.apps.{app}.files`, `$.data.contacts`, `$.apps.a1b2…`): literal steps, `*` and `{name}` |
| `subject` | who holds it: `owner:<number>` (a person or an org), `members:<org number>` or `members:<org number>.<role>` (every member, or every member with at least that role), `group:<org number>.<group id>`, `link:<id>` (whoever opens the link), `everyone` |
| `rights` | a set of `read`, `request`, `write`, `share` |
| `parent` | the entry it was passed on from, or none for the owner's own |
| `by` | the person who made it (for the audit; an org's entries are made by its managers) |
| `created`, `until` | when it starts and, optionally, ends |
| `revoked`, `revokedBy` | set once; an entry is never deleted, so a browser that comes back is told |

- **A pattern covers its matches and everything below them**, as a grant's prefix does today. `$.data.contacts`
  covers every record; `$.data.contacts.*.email` covers only the email of each.
- **Rights** follow the direction: `read` listens to a value, `request` proposes a change the owner approves, `write`
  sends a change to the owner's authority, which may still reject it. `share` lets the subject make entries of its
  own from this one: no wider pattern, no more rights, no later `until`. `write` does not include `read`.
- **The owner holds everything** under its own `$` without an entry.
- **Passing on is a chain.** An entry with a `parent` is checked against it and up to the owner's, at most eight long
  (`MAX_GRANT_DEPTH`). Revoking an entry revokes every entry passed on from it.

### Today's mechanisms as entries

| Today | Entries |
|---|---|
| A person uses an app (`use`) | `read` on the app's definition (`$.apps.<app>` under the app's owner, and the definitions it reaches). Their own state of the app is at `$.apps.<app>` under their own number, which they own already |
| A `view` link | `read` on the owner's instance of the app |
| A `remix` link | `read` on the app's definition, used once to copy it |
| An `edit` entry in an org | `read` and `write` on the app's definition |
| A `manage` entry in an org | `read`, `write` and `share` on the app's definition |
| An app open to the org | `read` on the app's definition, subject `members:<org>` |
| Whoever made an app in an org | `read`, `write` and `share` on its definition, made with the app |
| Org owners and admins | `read`, `write` and `share` on `$` of the org, subject `members:<org>.admin`, made with the org |
| The org's standing read of a member's state in its apps (`org-read`) | under the member's number, `read` on `$.apps.<app>` for each app of the org, subject `members:<org>.admin`, made when the member joins and revoked when they leave |
| A dataset shared with a workspace | `read` on `$.data.<dataset>` under the data's owner, subject the reading owner |
| A grant passed on (`passed`) | an entry with a `parent` |
| The `/paths` read grant | not an entry: a short token made from the reader's entries (see "Tokens") |

A link is an entry with a `link:` subject. **Opening a link passes it on**: the person who opens it gets an entry with
the link's entry as `parent`, so revoking the link revokes everyone who opened it, and "Shared by me" lists who they
are (`link_grant_member` today). `usedBefore` (a revoked `use` beside a live `view`) is read from the revoked children.

### Subjects
- `owner:<number>` is a person or an org. **An org's members act for the org** in what other owners gave the org (a
  dataset shared with an org is read by its apps, whoever uses them), as a workspace does today. In the org's own
  tree a member is not its owner: what they may do there is the entries made for them.
- `members:<org>` and `members:<org>.<role>` follow the org's membership and roles (`owner` > `admin` > `builder` >
  `member`), so a role change needs no entry changed. `group:<org>.<group>` follows the org's group the same way.
- `everyone` is for what is public: a published sign-in page's app, a tile source.
- **An app acts as the person using it.** Its logic reads and writes with that person's entries, narrowed to what
  its blueprint declares (`uses.data`, `uses.external`). An app is never a subject of its own, so a person can always
  see everything that was shared with them, whichever app uses it.
- Nodes are not subjects: a node holds a certificate, is trusted by role (`trustedNodes`), and acts for the people
  signed in to it.

### The check
`allows(subject, owner, path, right)`:
1. The subject is the owner: yes.
2. Otherwise, the entries of that owner whose pattern covers the path, whose subject is the subject, an org it acts
   for (outside that org's own tree), its membership or role in an org, a group it is in, or `everyone`, live (not revoked, not past `until`, every ancestor live), with the right.
   Any one is enough.

There are no denials: an entry only adds. A narrower right is made by a narrower pattern.

**Where it runs.** The owner's node (the edge) checks against the table: every write, every request, and every read
it serves to a browser. Relays do not read the table; they check tokens.

### Tokens
A token carries a right to places that do not read the table: relays, the `/paths` route, a sandboxed frame.

- It is today's grant token (state-sync `signGrant`), signed with the owner's key (Ed25519, `owner_key`), with
  `address` and `prefix` replaced by `owner` and `pattern`, and `entry` naming the entry it was made from.
- It lives four hours (`TOKEN_LIFE_MS`) for relays and is renewed while in use; a token for a URL (`/paths`) lives
  15 minutes and is renewed every 10. The HMAC `PathGrants` is removed: the route checks the signed token like a
  relay does, so there is one format. A `/paths` token's subject is the reader and its `entry` the entry they hold
  the app by (an opened link), so revoking that entry ends the token at once; the owner's own token names a new id.
- **Revoking an entry** sends `revoked { entry }` toward the owner's node and down every subscription tree, as
  `revoked { grantId }` does now. Relays drop the subscriptions it carried and keep the id until the tokens made
  from it would have expired. The browser scrub runs as today.
- **A subscription wider than its patterns** gets only what they match. A relay delivers a change only when the
  token's pattern covers it, and a change above the pattern is cut to the parts the pattern matches
  (`matchPattern` against the value). The direction's tags, where a relay sees only leading parts of a path, move
  this filter to the edge; that is later.

### The pattern matcher moves down
The logic engine's `compilePattern` and `matchPattern` (stateui-app `src/core/logic/pattern.ts`) move to
`@punyts/state` (`src/pattern.ts`), which state-sync, statenet and stateui-app all depend on. stateui-app imports
them from there; the old module goes. The matcher is unchanged; this is the "one fast matcher" of the direction, and
the `/paths` sources table already uses it.

### Storage
- **Magnetic**: one table, `permission` (the fields above; `owner` as `numeric(20)`, `pattern` as `text`, `rights` as
  `text[]`), and `kind`, indexed by `(owner, subject)`, `(parent)` and
  `(pattern)`, without row-level security, as the tables it replaced (see Decisions). A migration moves `app_access`, `app_setting.open_to_org`, `link_grant`, `link_grant_member` and
  `state_grant` into it and drops them. The audit is unchanged: every made and revoked entry is an `audit_event`.
- **stateui-mcp alone**: a `PermissionStore` port, with a file store (one JSON file per owner) for the local server,
  which has one owner and today no sharing. The rules (`allowsIn`, `checkNewEntry`) are pure functions beside the port.
- An org's policy (`grantsInOrg`, `externalLinks`) is checked when an entry is made, as now.

### Pages
- **Shared by me** (`/settings/shared`) lists the entries a person or their orgs made, grouped by what they cover
  (an app, a dataset, a path), with who holds them, the rights, who opened a link, and Revoke. It replaces the link
  list in the share dialog, the Data page's shares and the org's app access list as the place to see everything;
  those keep their forms for making entries.
- The share dialog, the org's app access and the Data page make entries; they do not change otherwise.

### What stays out
- **Requests**: the `request` right exists and is checked; a request is answered `unavailable` until "requests that
  wait for an offline owner" is designed (the direction's next later item).
- **Read keys and tags**: granting read as handing out a key, revoking as rotating it, and relays that see tags. They
  need encrypted packets, which come with the binary wire format.
- **Denials and conditions** (a right only during working hours, only from a network).

## Stages
1. **S14a, the matcher and tokens**: the matcher in `@punyts/state`; state-sync's grant claims on `owner` and
   `pattern`, relays filtering by pattern, `revoked { entry }`. Tests in state-sync and statenet.
2. **S14b, the table**: Magnetic's `permission` table and migration, the `Permissions` service with `allows`,
   `make`, `pass`, `revoke`; `AppAccess`, `Grants`, `StateGrants` and `SharedData` ask it; links open as passed-on
   entries. Shared by me lists entries.
3. **S14c, `/paths` and stateui-mcp**: `/paths` checks signed tokens, `PathGrants` goes; stateui-mcp's
   `PermissionStore` and file store.

Each stage is one commit per repo and leaves every test passing; S14b changes no page but Shared by me.

## Rules and Constraints
- Every right is an entry of the table; no code decides access any other way. Node trust by certificate role is not
  a right of a person and stays as it is.
- An entry only adds; nothing denies.
- An entry is never deleted, only revoked, and revoking it revokes everything passed on from it.
- A passed-on entry is never wider than its parent: pattern, rights and `until`.
- The owner's node decides from the table; relays and routes decide from tokens signed with the owner's key.
- An app has no rights of its own; it acts as the person using it, within what its blueprint declares.
- Entries, tokens and audit events never hold values; tokens are never logged.
- One pattern syntax and one matcher, in `@punyts/state`.

## Decisions
Confirmed by the owner ("Yes, build S14a", owner, 2026-11-22):
- **One table replaces all five mechanisms** (app access, links, state grants, dataset shares, the `/paths` grant),
  with no old API kept beside it.
- **An app is not a subject**: it acts as the person using it. The alternative, rights given to an app, would let an
  app keep reading after the person stops using it, and the person could not see it.
- **No denials**: an entry only adds.
- **An org's members act for the org** in what other owners share with the org.

Made in this design:
- The matcher moves to `@punyts/state`, the lowest library that state-sync, statenet and stateui-app share.
- The `/paths` grant becomes a signed token, so there is one token format.
- `write` does not include `read`, as today's grants: a form may send without seeing what others sent.
- A read of a path above a grant's pattern is allowed and cut to what the pattern matches; a write there is refused.
  Above a match, `delete` passes, `set` and `replace` pass the picked value (a delete when nothing is picked), and
  `merge` keeps the picked keys, with `{}` for a key that has nothing matched under it.
- Tokens name an entry: its id is the token's `entry`, its owner and pattern the token's.

Made building S14b:
- **No row-level security on `permission`.** The five tables it replaced had none: they are read across owners (a
  link opened by someone else, an org's members), and the check runs as the server. Only stateui-pg's workspace
  tables have it.
- **A `kind` column** names what made an entry (`access.view|use|edit|manage`, `open`, `creator`, `admins`,
  `link.view|use|remix`, `opened`, `share`, `passed`, `org-read`). Pages read it; `allows` never does.
- **App levels map to rights**: view and use are `read`, edit adds `write`, manage adds `share`; an entry's level is
  read back from its rights, with its kind telling view from use. App access counts only `access.*`, `open`,
  `creator` and `admins` entries, so a state share never opens an app's editor.
- **An org acts as `members:<org>.admin`**: an `admins` entry on `$` of each org gives its owners and admins the
  whole tree; an org's org-read entry stays `$.apps.*` under the member's number with that subject. A subject
  `owner:<org>` counts only outside the org's own tree.
- **Passing on does not need `share`** yet: the grants people passed on before S14b did not, and a link's `opened`
  entries are passed on from it. A passed-on entry is still never wider than its parent.
- **Rejecting a shared app revokes the person's `opened` entries** with the person as revoker; Shared by me and the
  link's members ignore those, and the link stays live for others.
- **A `/paths` token for an org member names no entry**: `AppAccess` answers a level, not the entry behind it, and
  an org view's socket is closed when the member's access changes, so the token ends with its 15 minutes.
- **Revocations of `/paths` tokens are read from the table on each read** (`GrantKeys.revoked`), not pushed to the
  route as relays are told `revoked { entry }`: the route runs beside the table.
- **Without a secret key, Magnetic signs `/paths` tokens with keys kept in memory** (`MemoryGrantKeys`), as a local
  server does: its owner keys need the secret key to keep private keys sealed.
- **The migration names moved rows with `md5(...)::uuid`** (an `opened` entry from its link and person), the one place
  ids come from SQL: a migration has no code to call `randomUUID()`, and the ids are stable if it is run again on a
  copy.

## As built

S14a (2026-11-22):
- `state/src/Pattern.ts`: `compilePattern`, `matchPattern`, `patternCovers`, `patternContains`, `mayTouch` and
  their helpers, moved from stateui-app's `src/core/logic/pattern.ts` (deleted; `writeSteps` and `expressionPaths`
  stay in `src/core/logic/writtenPaths.ts`). Tests: `state/src/Pattern.test.ts`.
- `state-sync/src/authority/Grants.ts`: claims `entry`, `owner`, `pattern`; `addressPath`, `grantPattern`,
  `patternReach`; `checkAccess` answers `cut` for a read above the pattern. `Cut.ts` (`cutTo`) cuts a listener's
  snapshot and changes in `Relay.ts`; `Relay.revoke(entry, expires)`. `Authority.ts` reads its handlers and
  ephemeral paths with the shared matcher; `Patterns.ts` is deleted. Tests: `src/authority/Grants.test.ts`.
- statenet: `{ type: 'revoked', entry, expires }` (`src/mesh/protocol.ts`, `serving.ts`, `linkClient.ts`,
  `MeshUpstream.ts`, `OwnerMesh.ts`). Test: `src/mesh/mesh.test.ts`.
- Magnetic `src/grants/StateGrants.ts` signs owner and pattern; stateui-mcp's `HttpServer.ts` imports the matcher
  from `@punyts/state`.

S14b (2026-11-22):
- Magnetic `migrations/0024_permission.sql`: the `permission` table, the moved rows, the `admins` entries, and the
  old tables dropped. Test: `src/storage/permissionTable.test.ts`.
- `src/permissions/Permissions.ts`: `make` (parent live, same owner, `patternContains`, rights a subset, `until` cut,
  `MAX_DEPTH` 8), `revoke` (with everything passed on), `holder` (a person's subjects: number, org members and roles,
  groups, `everyone`), `allows`. Test: `src/permissions/Permissions.test.ts`.
- Over it: `src/orgs/AppAccess.ts`, `Orgs.ts` (admins entry, a leaving member's entries revoked), `Scim.ts`,
  `Lifecycle.ts` (export `magnetic-org-export/3`), `src/sharing/Grants.ts` (links, `opened` entries),
  `ShareAnswers.ts`, `src/grants/StateGrants.ts` (shares, passed-on, dataset shares, org-read, tokens),
  `src/storage/importFiles.ts`. Tests: `src/sharing/Grants.test.ts`, `src/server/grants.test.ts`,
  `src/server/scim.test.ts`, `src/sharing/sharedData.test.ts`.
- Shared by me: `src/http/orgSettings.ts` (`sharedPage` over entries), `src/http/orgText.ts`,
  `src/server/grantRoutes.ts` (`namesOf`).

S14c (2026-11-22):
- stateui-mcp `src/infrastructure/http/PathTokens.ts`: `PathTokens` (`issue`, `allows` with `verifyGrant`),
  `GrantKeys`, `MemoryGrantKeys`, `PathReader`; `HttpServer.ts` takes `grantKeys` and `HttpTenant.reader`;
  `PathGrants.ts` is deleted. Tests: `src/infrastructure/http/PathTokens.test.ts`, `test/http.test.ts`.
- stateui-mcp `src/application/ports/PermissionStore.ts`, `src/application/permissions.ts` and
  `src/infrastructure/storage/FilePermissionStore.ts`. Test: `src/infrastructure/storage/FilePermissionStore.test.ts`.
- Magnetic `src/server/startMagnetic.ts` (`pathTokenKeys`, each tenant's `reader`), `OwnerKeys.find`,
  `Permissions.revokedAmong`, `Grants.access` naming the `opened` entry. Test: `src/server/sharing.test.ts`.
