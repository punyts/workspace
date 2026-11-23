# Magnetic on Postgres: enterprise orgs, roles, state and vectors

## Summary
Magnetic keeps everything in files today: `accounts.json`, `sessions.json`, `grants.json`, `budgets.json` in the data
folder, and one folder per user (`data/users/<userId>`) holding that user's parts, instances, persona datasets, file
metadata and chats. That was the right call for v1 ("Storage stays on files for v1", `magnetic-v1.md`), and the design
named the storage ports as the place a database goes later.

This design makes Magnetic enterprise ready. It moves Magnetic entirely onto Postgres with pgvector, with no file
storage left, and adds:

- **Orgs:** a company is an org. Its employees are members, its apps live in the org's workspace, and its admins
  control who may do what.
- **Roles and app permissions:** an employee's role decides whether they build and change apps or use them, and an
  app's own access list can raise or lower that for a person or a group.
- **State per employee where it belongs:** each employee has their own instance of an app (route, form values, local
  choices), and the app decides, binding by binding, which data the whole org shares and which is each employee's own.
- **Enterprise controls:** sign-in through the company's own identity provider, verified email domains, an audit log,
  row-level security, and org policies for sharing and spend.
- **Vectors:** semantic search over apps and parts, agent recall of earlier chats, the component catalog, and vector
  search over the records of the apps people build.

**State moves to the statenet.** `statenet-relays.md` puts the app's state and each user's state in statenet
namespaces, stored in its `state_node` and `state_change` tables, with owners, relays and grants. This design's
`instance`, `persona_dataset` and `dataset_record` tables give way to those, and its P2 stores only the parts, files and
error logs; everything else here stands.

## What already exists
| Need | Already in | Notes |
|---|---|---|
| Part storage port | `stateui-mcp` `UiPartRepository` | Create, find by name or id, list, write and delete with `expectedRevision`, rename with rewrites all or nothing |
| Instance storage port | `stateui-mcp` `UiInstanceRepository` | The diff of an instance over its definition, and persona binding records, by app id |
| File metadata and bytes | `UiFileRepository`, `UiFileStore`, `AppFolderStore` | At most 10 MB a file, 50 files and 100 MB an app; quotas checked under a per-app lock |
| Sync authority storage | `state-sync` `NamespaceStorage` | stateui-mcp keeps instance namespaces through `InstanceNamespaceStorage`, which writes the instance repository, not a sync log |
| Shared and personal data | `stateui-app` `DataBinding` | A binding is an owner dataset (`{ dataset }`, shared by everyone using the app) or a persona binding (`{ model, scope: 'persona' }`, each persona's own records) |
| Personas | `InstanceKey` `{ persona, ownerId, appId }` | `use` links already give each viewer their own instance with persona = their user id |
| A contract test for parts | `stateui-mcp` `partRepository.contract.test.ts` | The Postgres adapter runs the same contract |
| Magnetic's own stores | `Accounts`, `Sessions`, `Grants`, `Budgets`, `Chats` | Each a class over one JSON file (`storage/jsonFile.ts`), one write at a time |
| One `Services` per user | `Workspaces`, `createServices({ ownerId, dataDir })` | Isolation comes from each user having their own folder |
| Generic OIDC sign-in | `OidcSignIn` | Any OpenID Connect provider by issuer, client id and secret; LinkedIn is the first |
| Model-tagged vectors | ai-minion ADR 0016 | Every stored vector records its model; queries compare only vectors of the same model. This design takes the same rule |

These pieces are new:
- A Postgres adapter for each stateui-mcp storage port, and a way to hand `createServices` adapters instead of a
  data folder.
- Magnetic's stores on Postgres, replacing the JSON files.
- Orgs, members, groups, roles, app access, invites, org SSO, verified domains, policies and the audit log.
- An `Embedder` port, an embedding queue, and the four kinds of semantic search.
- A migrator, and a one-time importer from the files.

## Decisions

### Postgres only
- Magnetic requires Postgres 16 or later with the `vector` extension (the `pgvector/pgvector:pg16` image, as ai-minion
  uses). `--database-url` / `MAGNETIC_DATABASE_URL` is required, and `--data-dir` goes away.
- Everything Magnetic keeps is in the database, uploaded file bytes included: at most 10 MB a file and 100 MB an app,
  in their own table (`app_file_content`, `bytea`) so a file's metadata is read without its bytes. Object storage can
  replace that table later behind the `UiFileStore` port, if volumes call for it.
- The driver is `pg` (node-postgres) with one pool per server. No ORM: each adapter writes its SQL, with parameters
  only.
- **StateUI's JSON is stored as `json`, never `jsonb`.** Key order is part of a StateUI value: it orders `children`,
  `options` and the other keyed maps (`stateui-mcp` `JsonValue.ts`, `orderedMap.ts`), and the runtime lays out and
  lists them in key order. `jsonb` sorts keys by length and bytes, which would reorder a layout. So part bodies,
  instance diffs and dataset records are `json` columns, which keep the text as written, and the port's promise
  ("Bodies keep their key order") holds. Nothing queries inside them, so `jsonb`'s operators are not missed. The order
  of records in a dataset, which is the order of their keys, is kept in a `position` column. Magnetic's own documents
  (policies, audit details, tool lines) are `jsonb`, as their order means nothing.
- The local stateui-mcp server (`npm run mcp`, Claude Code's MCP server) keeps its file adapters. It has one owner on
  one machine and no reason to need a database. Only Magnetic moves.
- Development: `npm run magnetic:db` starts the database in Docker (`magnetic/docker-compose.yml`), and
  `npm run magnetic` points at it. The tests need a database too: they read `PUNYTS_TEST_DATABASE_URL` and give each
  test file its own schema, dropped afterwards, so files run in parallel.

### The adapters live in a new library, `@punyts/stateui-pg`
- `stateui-pg` implements the stateui-mcp ports on Postgres: `PgPartRepository`, `PgUiInstanceRepository`,
  `PgUiFileRepository`, `PgUiFileStore`, `PgUiErrorLog`, and an `AppFolderStore` that removes an app's rows.
- It depends on `stateui-mcp` for the port types and on `pg`. stateui-mcp does not depend on it, so the local server
  stays free of a database driver.
- Magnetic's own stores (`PgAccounts`, `PgSessions`, `PgGrants`, `PgSpend`, `PgChats`, orgs, audit) live in Magnetic,
  under `src/storage/`. The JSON file classes and `storage/jsonFile.ts` are deleted once the importer is done.
- The migrations are numbered SQL files, one folder per owner: `stateui-pg/migrations/` for the workspace tables and
  `magnetic/migrations/` for Magnetic's. A small Node migrator applies them in order in one transaction each, and
  records them in `schema_migration`. Plain Node, so it runs from cmd, PowerShell and bash like the workspace scripts.
- `magnetic migrate` applies both sets. The server refuses to start on a database that is behind.
- **Magnetic's schema is one baseline while it has no users.** On 2026-11-22 the owner said "We can stop doing
  migrations right now. There are no users" and chose "Fold into a baseline": Magnetic's migrations 0001–0024 became
  `magnetic/migrations/0001_baseline.sql`. A database already migrated through 0024 has the same schema and records
  version 1, so it needed no reset. Until there are users, a schema change edits the baseline and the databases are
  reset.

### `createServices` takes storage instead of a folder
- `ServicesOptions` gets `storage?: ServicesStorage`. With it, `createServices` uses the given adapters. Without it,
  `dataDir` builds the file adapters, for the local server.
- `ServicesStorage` holds `parts`, `instances(persona)` (a factory, because `AuthorityInstanceStates` makes one per
  persona today), `files`, `fileStore`, `errorLog`, `appFolders`, and `recover` (files finish a crashed rename; on
  Postgres a rename is one transaction, so there is nothing to finish).
- The Postgres adapters lock with the transaction itself: `SELECT ... FOR UPDATE` on the part row for revisions, and
  on the app's quota row for file adds. That makes them safe across processes, which the in-process `KeyedLock` was
  not. More than one server stays out of scope, but the storage no longer stands in the way.

### A workspace is the owner
- Today `ownerId` is the user id. Now the owner is a **workspace**, and every row of workspace data carries its
  `workspace_id`.
- An org has one workspace. Every user also has a personal workspace, whose id is their user id, so existing
  instance keys (`instances.<persona>.<ownerId>.<appId>`), personas and links move over unchanged. People try things
  there privately, then move an app into the org when it is ready. An org can turn personal workspaces off for its
  members (policy `personalWorkspaces`, on by default).
- App URLs stay `/apps/<appId>` and `/edit/<appId>`. App ids are UUIDs and unique across workspaces, and
  `app_directory` maps each to its workspace, so a route finds the workspace first and then asks `AppAccess`. A link
  or bookmark keeps working after the app moves.
- `createServices({ ownerId: <workspace id> })` serves either kind. `Workspaces` is keyed by workspace id instead of
  user id. The idle close and the cap of 200 apply to both.
- Isolation is enforced twice:
  - **By construction:** every adapter is made for one workspace id and puts it in every query, and no adapter method
    takes a workspace id from its caller.
  - **By row-level security:** every workspace table has a policy on `workspace_id = current_setting('app.workspace_id')`,
    and each transaction sets it with `SET LOCAL`. Magnetic connects as a role without `BYPASSRLS`; migrations and the
    importer use the owner role. A bug in an adapter then returns nothing rather than another company's rows.
- A contract test runs the M1 check (two users, and now two orgs, never see each other's apps, files or state, by page,
  route, tool or socket).

### Orgs, members and groups
- An **org** is a company: a name, a unique slug, verified email domains and policies.
- A **member** is an employee in the org, with one org role. A person can be in more than one org (a contractor),
  and switches between them on the home page.
- A **group** is a set of members (a department or a team: Finance, Field Ops). Groups are what app access is usually
  given to, so access follows people as they move between teams. Admins manage groups by hand, or the
  org's identity provider pushes them by SCIM (magnetic-scim.md).
- People join an org by:
  - **Invite:** an admin invites an email with a role and groups. The link's random token is kept only as its
    SHA-256, as sessions are. Accepting needs a signed-in user whose verified email matches. Invites expire after 7 days.
  - **Verified domain:** someone who signs in through the org's SSO, or with a verified email at a verified domain,
    joins as `member` when the org allows it (policy `autoJoin`).
- **Removing** a member ends their sessions' views of the org's apps at once (1008 `Removed from org`), as a revoke does,
  and they lose access to the org's apps. Their instances and persona records stay until an admin deletes them or the
  retention policy does, so their work can be handed over.

### Roles and app permissions
Each member has one **org role**:

| Org role | Can |
|---|---|
| `owner` | Everything below, plus delete the org, manage billing, SSO and domains, and change owners. An org has at least one |
| `admin` | Manage members, groups, invites, policies and budgets; read the audit log; manage access to every app; edit every app |
| `builder` | Make new apps; edit the apps they made and those whose access gives them `edit` |
| `member` | Use the apps whose access gives them `use` or `view` |

Each app has an **access list** of entries: a member or a group, with one **app permission**:

| App permission | Can |
|---|---|
| `manage` | Everything below, and change the app's access list and links, and delete the app |
| `edit` | Change the app's definition: its screens, logic, models and shared datasets' structure, by hand or through the agent |
| `use` | Run the app with their own instance; read and write the shared data the app lets its users write |
| `view` | Run the app read only: changes are rejected and uploads refused, as with a `view` link |

- A person's permission on an app is the highest of their access entries, their group's entries and their role's floor:
  `owner` and `admin` have `manage` on every app; whoever made an app gets `manage` on it. A `builder` or `member` has
  no permission on an app with no entry for them, unless the app is marked **open to the org**, which gives every
  member `use`.
- The agent works for the person, with their permission: it can change an app only for someone with `edit`. A `use`
  person's chat can still ask the agent about the app and their own data, with the writing tools withheld.
- Every check is on the server: pages, the editor routes, the agent's tools and the view sockets all ask the same
  `AppAccess` service. A socket whose person loses `use` is closed, as on revoke.
- Links (`/s/<token>`) stay, as `use`, `view` and `remix`. An org's policy decides whether links may reach people outside
  the org (`externalLinks`); the default for an org is members only.

### State: each employee's own where it belongs
- **Each employee has their own instance** of every org app they use: persona = their user id, as `use` links work
  today. Their instance holds their route, form values, selections and theme choices, so two employees never see each
  other's half-filled forms.
- **The app decides which data is shared**, binding by binding, with what StateUI already has:
  - an owner dataset binding (`{ dataset }`) is the org's data: one set of records everyone using the app reads and
    writes, live (an inventory, the team's tickets);
  - a persona binding (`{ model, scope: 'persona' }`) is each employee's own records (their expense claims, their
    drafts).
- The agent's guide gets a section on choosing between them, and the editor's Data panel shows each binding as
  **Shared with everyone** or **Each person's own**.
- Who may write the shared data is the app's logic and the person's permission: `view` writes nothing, `use` writes
  what the app's screens and logic let them, `edit` also changes the dataset's model and records directly in the
  inspector.
- The owner's `default` persona is not used in an org workspace. Admins can open any employee's instance read only, for
  support, and that access is written to the audit log.
- A new section of the inspector lists the instances of an app (who uses it, last used), for people with `manage`.

### Moving an app into an org
- From the editor or Your apps, **Move to <org>** moves an app from a person's personal workspace into an org's
  workspace. The person needs to own the app, and to be a `builder` or above in the org. It is a move, not a copy:
  afterwards the app exists only in the org.
- What moves with it, in one database transaction (both workspaces are in the same database, so nothing is left
  half done):
  - the app part, with its id, so its URLs and links keep working;
  - the parts it reaches (themes, logic, models, datasets, components, patterns). A part that no other app in the
    personal workspace uses moves. One that another personal app also uses is copied, so that app keeps working;
  - its instances: the owner's `default` instance becomes their instance with persona = their user id, and the
    instances of people who opened its `use` links move as they are;
  - persona records, shared dataset records, uploaded files and their bytes, the preview error log, the chat, and
    the embeddings (no re-embedding needed);
  - its links: they keep working if the org's `externalLinks` policy allows them, and are revoked otherwise, with
    the usual scrub of the browsers that opened them.
- A part name the org already uses gets a suffix (`budget` becomes `budget-2`), and the parts that name it are
  rewritten, as a rename does.
- Access in the org: the person who moved it gets `manage`, and nobody else gets anything until they give access or
  mark the app open to the org.
- Open views of the app are closed (1012 `Moved`). Their pages reload into the org workspace, where the person's
  permission is checked afresh.
- Row-level security: the move runs with both workspace ids set for its transaction (`app.workspace_ids`), and the
  policies accept either. Nothing else in Magnetic sets two.
- The move writes one `audit_event` in the org (`app.moved_in`, with the parts moved and copied).
- There is no move back out. An admin can delete the app, or someone with `remix` access can copy it into a personal
  workspace, without data, as remix does.

### Enterprise controls
- **SSO per org.** An org configures its own OpenID Connect provider (Okta, Entra ID, Google Workspace): issuer, client
  id and secret, kept encrypted with the server key. The sign-in page asks for the work email and sends people at a
  verified domain to their org's provider. `requireSso` makes it the only way in for the org's domains. An org may use
  SAML instead, behind the same sign-in step (statenet-network.md, S12).
- **Verified domains.** An owner proves a domain with a DNS TXT record. Only verified domains route to SSO or allow
  `autoJoin`.
- **Audit log.** Every change of membership, role, group, access, link, policy, SSO setting and app (made, renamed,
  deleted, definition written, by whom and through the agent or by hand), every support view of an employee's
  instance, and every sign-in, as `audit_event` rows: who, what, which org and app, when, from which address. Admins
  read and export it from the org settings. App data changes are not audited row by row (that is the apps' own
  business), only the definition.
- **Policies** per org, in `org_policy`: `personalWorkspaces` (on by default), `externalLinks` (off), `autoJoin` (off),
  `requireSso` (off), `agentModels` (which models the org's people may pick), `retentionDays` for removed members'
  data and for chats (unset: kept).
- **Budgets.** Each person keeps a daily budget. An org has a monthly budget, which every turn in its workspace spends,
  and the server's monthly cap stays above all of them. Admins see spend by person and app.
- **Export and deletion.** An owner can export the org (apps, datasets, members, audit log) as JSON, and delete the org,
  which removes every row of its workspace.

### Every stored vector names its model
- `embedding` columns are `vector` without a fixed size, next to a required `model` column (a check constraint ties
  them together), as in ai-minion ADR 0016.
- Unlike ai-minion, each model in use gets an HNSW index on a cast expression, partial on the model:
  `CREATE INDEX ... USING hnsw ((embedding::vector(384)) vector_cosine_ops) WHERE model = 'all-minilm-l6-v2'`. Queries
  use the same cast and filter, so they hit the index. A migration adds the index when a model is added.
- **The `Embedder` port:** `embed(texts, purpose: 'document' | 'query') → { model, dimensions, vectors }`.
  - The model is local, on the CPU, in development and in hosting: all-MiniLM-L6-v2 through ONNX Runtime, 384
    dimensions, no key. It costs nothing per call, and no company's text leaves the server.
  - The model (about 90 MB) is baked into the server's container image, not downloaded on first use, so a server
    starts the same with or without network. The worker embeds in batches on its own thread, so embedding never
    competes with the request loop.
  - A hosted provider can be added behind the port later. None is built now.
  - It never falls back to another model. A changed model leaves older vectors unsearched until `magnetic reindex`.
- **Embedding never holds up a write.** A write that changes embeddable text adds a row to `embedding_job` in the same
  transaction. A worker in the server takes jobs with `FOR UPDATE SKIP LOCKED`, embeds them in batches, and writes the
  vectors. A job whose source has changed since is dropped, and the newer one does the work.
- Vectors never go to the browser. State sync carries text; similarity is answered on the server.
- Every search filters by the workspaces the person can open and, within an org, by the apps they have at least `view`
  on, before ranking. Row-level security applies to `embedding` as to every workspace table.

### Four kinds of semantic search
1. **The component catalog.** The catalog's components and patterns are embedded once per catalog version and model
   (`catalog_embedding`, shared by every workspace). `ui_components_search` and `ui_patterns_search` mix the keyword
   index and vector similarity by reciprocal rank. The keyword index already answers its purpose phrases well ("choose
   start and end dates" finds `dateRangeField`); the vectors are for the requests it marks `weak`, phrased in words no
   purpose phrase has.
2. **Apps and parts.** Each part gets a search text: kind, name, and the text in its body (labels, headings, field
   names, model and dataset names), embedded on write. A new tool, `ui_parts_search`, searches the parts the agent may
   use. The home page gets a search box over the apps the person can open, personal, org and shared.
3. **Agent recall.** Chat entries are rows (`chat_entry`), and each person entry and agent answer is embedded. A turn
   still sends the recent chat as text. A new tool, `chat_recall`, searches the person's earlier chats in that
   workspace, across apps, so the agent can answer "make it like the budget app I did last week". It sees only the
   chats of the person it is working for.
4. **Data in the apps.** A model field can be marked `embed: true` (a string field only). The records of datasets and
   persona bindings with such fields are embedded per record and field. Apps query them with a new data operation,
   `similar` (`{ binding, field, text, limit }`), which logic and the agent's tools can run. The answer is record keys
   with scores, so the app reads the records as usual. A persona binding's search covers only that person's records.
   `embed` is a new key on `FieldDeclaration` in `stateui-app`, and the local server ignores it.

## The schema
Workspace tables (`stateui-pg`), each with row-level security on `workspace_id`:

| Table | Columns | Notes |
|---|---|---|
| `part` | `workspace_id`, `id` uuid, `kind`, `name`, `revision`, `body` json, `search_text`, `created_by`, `created_at`, `updated_at` | PK (`workspace_id`, `kind`, `id`); unique (`workspace_id`, `kind`, `name`). `json`, so key order survives. For a `data` part the body holds the model and settings, and the records are rows |
| `dataset_record` | `workspace_id`, `part_id` null, `persona` null, `app_id` null, `binding` null, `key`, `position`, `record` json, `updated_at` | One row per record, of a `data` part or of a persona binding (check: exactly one of the two). `position` keeps the records' key order |
| `instance` | `workspace_id`, `persona`, `app_id`, `diff` json, `updated_at` | PK (`workspace_id`, `persona`, `app_id`); an empty diff deletes the row |
| `persona_dataset` | `workspace_id`, `persona`, `app_id`, `binding`, `model` | The binding's model; its records are `dataset_record` rows |
| `app_file` | `workspace_id`, `app_id`, `id`, `name`, `size`, `type`, `sha256`, `created_by`, `created_at` | |
| `app_file_content` | `workspace_id`, `app_id`, `file_id`, `bytes` bytea | Read only when the file is opened |
| `app_file_usage` | `workspace_id`, `app_id`, `count`, `bytes` | The row locked to check quotas |
| `preview_error` | `workspace_id`, `app_id`, `at`, `entry` jsonb | Bounded per app as the file log is |
| `embedding` | `workspace_id`, `source_kind`, `source_id`, `field` null, `persona` null, `model`, `embedding` vector, `source_hash`, `updated_at` | Parts, records and chats; HNSW index per model |
| `catalog_embedding` | `catalog_version`, `entry_kind`, `name`, `model`, `embedding` vector | Shared, no workspace |
| `embedding_job` | `id`, `workspace_id`, `source_kind`, `source_id`, `field`, `source_hash`, `queued_at`, `attempts` | The queue |
| `schema_migration` | `owner`, `version`, `applied_at` | One per applied file |

Magnetic tables:

| Table | Columns | Notes |
|---|---|---|
| `app_user` | `id` uuid, `name`, `email`, `email_verified`, `picture`, `created_at` | `user` is a reserved word |
| `identity` | `provider`, `subject`, `user_id`, `org_id` null | PK (`provider`, `subject`); `org_id` for an org's SSO provider |
| `session` | `token_hash`, `user_id`, `created_at`, `expires_at`, `ip`, `user_agent` | Expired rows deleted by a sweep |
| `org` | `id`, `slug` unique, `name`, `created_by`, `created_at` | |
| `org_domain` | `org_id`, `domain` unique, `txt_token`, `verified_at` | |
| `org_sso` | `org_id`, `issuer`, `client_id`, `client_secret` (encrypted), `enabled` | One OIDC provider per org |
| `org_policy` | `org_id`, `policy` jsonb, `updated_by`, `updated_at` | The policies above |
| `org_member` | `org_id`, `user_id`, `role`, `joined_at`, `removed_at` | PK (`org_id`, `user_id`) |
| `org_group` | `id`, `org_id`, `name` | Unique (`org_id`, `name`) |
| `org_group_member` | `group_id`, `user_id` | |
| `org_invite` | `id`, `org_id`, `email`, `role`, `groups` uuid[], `token_hash`, `created_by`, `expires_at`, `accepted_at` | |
| `workspace` | `id`, `kind` (`personal`, `org`), `user_id` unique null, `org_id` unique null, `created_at` | Check: exactly one of `user_id`, `org_id`; a personal workspace's `id` = `user_id` |
| `app_access` | `workspace_id`, `app_id`, `principal_kind` (`user`, `group`), `principal_id`, `permission`, `granted_by`, `granted_at` | PK (`workspace_id`, `app_id`, `principal_kind`, `principal_id`) |
| `app_setting` | `workspace_id`, `app_id`, `open_to_org`, `created_by` | |
| `app_directory` | `app_id` PK, `workspace_id`, `moved_at` null | Which workspace an app lives in, for routes and links |
| `link_grant` | `id`, `token`, `workspace_id`, `app_id`, `app_name`, `right`, `created_by`, `created_at`, `revoked_at` | `grant` is a reserved word |
| `link_grant_member` | `grant_id`, `user_id`, `first_opened_at` | Was `members` in the grant |
| `agent_request` | `id`, `user_id`, `workspace_id`, `org_id` null, `app_id`, `model`, token counts, `dollars`, `at` | A ledger. Budgets sum it per UTC day, user, month and org |
| `chat_entry` | `id`, `workspace_id`, `app_id`, `user_id`, `role`, `text`, `tools` jsonb, `outcome`, `message`, `at` | A turn reads the last 100 as now |
| `audit_event` | `id`, `org_id` null, `workspace_id` null, `actor_id`, `action`, `target_kind`, `target_id`, `detail` jsonb, `ip`, `at` | Append only: the server's role may insert and read, not update or delete |

## Moving the data
- `magnetic import --data-dir <dir>` is run once, against the new database. It reads a file data folder and writes
  every row: users and identities, live sessions, grants and their members, spend as one `agent_request` per user and
  day, and each user's personal workspace (parts, instances, persona datasets, file metadata and bytes, error logs,
  chats).
- It is idempotent per workspace: a workspace already in the database is skipped unless `--replace`.
- It queues the embeddings rather than making them, so the import is quick and the worker catches up.
- The file folder is left as it was, as a backup. After the import Magnetic no longer reads it.

## Not in this design
- More than one Magnetic server. The storage allows it; sessions, live views and authorities still assume one process.
- SCIM (magnetic-scim.md). SAML came in statenet-network.md, S12.
- Object storage for file bytes.
- Sharing between orgs, and an org app reaching another org's data.
- Field-level permissions inside an app's data. An app restricts writes through its logic and screens; the server
  enforces only the app permission.
- Vectors of images or files.

## Stages
Each stage ends in something you can run and is committed on `develop`.

| Stage | Delivers | Depends on |
|---|---|---|
| P1 | Postgres foundation: the database in Docker, the migrator, `--database-url` required, the test harness with a schema per test file; Magnetic's stores on Postgres (users, identities, sessions, links, the spend ledger, chats) with the JSON stores deleted; `magnetic import` for those | — |
| P2 | Workspace state on Postgres: `stateui-pg` with every port adapter, file bytes included; `createServices({ storage })`; row-level security; the part contract test and the isolation test; `magnetic import` for user folders | P1 |
| P3 | Orgs, roles and state: orgs, members, groups, invites, org workspaces, `Workspaces` by workspace id, org roles, app access and `AppAccess` on every route, tool and socket; each employee's own instance, shared and personal bindings in the Data panel and the guide; the home page's org switcher and app list by access; moving an app from a personal workspace into the org | P2 |
| P4 | Enterprise controls: org SSO over OIDC, verified domains, `requireSso` and `autoJoin`, the audit log and its page, policies, org budgets and spend by person, export and deletion | P3 |
| P5 | Embeddings foundation: the `Embedder` port with the local CPU model in a worker thread, the `embedding` and `embedding_job` tables, the worker, `magnetic reindex`; the catalog's hybrid search | P2 |
| P6 | Apps, parts and recall: part search text, `ui_parts_search`, the home search box filtered by access, `chat_recall` | P3, P5 |
| P7 | Vectors in app data: `dataset_record` search, `embed: true` on model fields, record embeddings, the `similar` data operation in logic and the tools, and the guide text so the agent knows to use it | P3, P5 |

P5 can run beside P3 and P4. P6 and P7 can run beside each other.

## Checks
- **P1:**
  - The Magnetic tests pass on Postgres, and nothing reads or writes the data folder.
  - Sign-in, sessions, sign-out, budgets and links behave as they did on files.
  - An imported data folder signs the same people in to the same user ids.
- **P2:**
  - The part repository contract passes against `PgPartRepository`, including a rename with rewrites that conflicts
    halfway and changes nothing.
  - Two users never see each other's apps, files or state, through pages, tools or sockets.
  - A query run without `app.workspace_id`, or with another workspace's, returns no rows.
  - Two processes adding files to one app at once never pass the quota.
  - A server on an imported database opens every app with its instances, data and files as on files.
- **P3:**
  - A `member` with no access to an app gets 404 for it, by page, route, tool and socket; with `use` they run it; with
    `view` their writes are rejected.
  - A `builder` with `edit` changes an app by hand and through the agent; with `use` the agent's writing tools are
    withheld.
  - Access given to a group reaches a member added to the group, and leaves one removed from it, closing their views.
  - Two employees using one app keep their own route, form values and persona records, and see each other's changes to
    a shared dataset live.
  - Removing a member closes their open views of the org's apps.
  - An invite opens only for the invited verified email, once, before it expires.
  - Moving an app into the org keeps its id, URLs, instances, data, files and chat; leaves a part another personal app
    uses working there as a copy; leaves nothing in the personal workspace when it fails halfway; and refuses a person
    who is not a `builder` in the org.
- **P4:**
  - With `requireSso`, a person at the org's domain cannot sign in any other way.
  - Someone at an unverified domain never auto-joins.
  - Each audited action writes one `audit_event`, and the server's role cannot change or delete one.
  - With `externalLinks` off, a link opens only for the org's members.
  - A spent org budget refuses turns in the org's workspace and nowhere else.
- **P5:**
  - A part write returns before its embedding is made, and is findable once the worker runs.
  - Vectors of a second model are never compared with the first; `magnetic reindex` makes them searchable.
  - The catalog search tests still pass, and a set of requests that come back `weak` today find the right component in
    the top three.
- **P6:**
  - Search never returns an app the person cannot open, in their own org or another.
  - `chat_recall` finds an earlier chat of the same person by meaning, and never another person's.
- **P7:**
  - A dataset with an `embed` field answers `similar` with the closest records' keys, in logic and in the tools.
  - `similar` over a persona binding returns only that person's records.
  - A record edit re-embeds only that record and field.

## Settled
- Personal workspaces: on by default, and an org can turn them off.
- Bringing an app into an org: a move, with its instances, data, files and chat.
- Embeddings: the local CPU model, in development and in hosting.
- Key order: StateUI's JSON is stored as `json`, and record order as `position`.

## As built (night of 14 November 2026)

Built on `feature/postgres` in the workspace, `magnetic` and `stateui-mcp`, and in the new repo `stateui-pg`
(`github.com/punyts/stateui-pg`). Every stage below runs its tests against Postgres.

### P1: Postgres foundation
- `stateui-pg`: `createDatabase` (one pool; `transaction(work, { workspaceIds })` sets `app.workspace_ids` for
  row-level security), the migrator (numbered SQL files per owner, each in its own transaction, under an advisory lock;
  `assertMigrated` refuses a database that is behind) and `createTestDatabase` (a schema per test file). The tests use
  `PUNYTS_TEST_DATABASE_URL`, or the database `npm run magnetic:db` starts (port 5433).
- Magnetic: users, identities, sessions, links, the spend ledger (`agent_request`), chats, preferences and the stamps
  of Magnetic's own apps in `migrations/0001_baseline.sql`; the JSON stores are gone. Commands `serve`, `migrate`,
  `import` (from an earlier file data folder, idempotent) and `--migrate` for development.

### P2: workspace state
- `createServices({ storage })` takes a `ServicesStorage`; the preview error log is a port (`UiErrorLog`).
  `installShowcaseInto` installs the showcase, its files included, into such storage.
- `pgWorkspaceStorage(db, workspaceId)`: parts (`SELECT ... FOR UPDATE` for revisions, a rename in one transaction),
  instances, persona records, file metadata (quotas under an advisory lock, safe across processes), file bytes
  (`app_file_content`) and preview errors, all with row-level security. The stateui-mcp part contract runs against it.
- Changed from the design: persona records are one `json` value per binding (`persona_dataset.records`), not
  `dataset_record` rows, since the statenet design moves app data to `state_node` anyway. `app_file_usage` was not
  needed: the quota is summed under the app's advisory lock.

### P3: orgs, roles and access
- The org tables in `migrations/0001_baseline.sql`; `Orgs` (members and roles, groups, invites, the audit log),
  `AppAccess` (permissions, access lists, open to the org, where an app is) and `moveAppToOrg`. JSON routes under
  `/orgs`, `/invites` and `/apps/<id>/move` (listed in Magnetic's README). Pages, the editor, agent turns, shares and
  view sockets all ask `AppAccess`; members use org apps with persona = their user id; losing an app closes its views.
  Your apps lists the org apps a person may open.
- Changed from the design: no `app_directory`. An app's workspace is found by looking in the person's own workspace,
  then their orgs' (`AppAccess.locate`), so the table had nothing to add. A moved app's reached parts are copied, and
  the person's own workspace keeps its copies, so nothing there breaks; a later clean-up can drop the ones no app uses.
- Finished on 15 November 2026: the org settings pages (`/settings/orgs`, the **Orgs** button on Your apps): members and
  roles, groups, invites, making an app in the org or bringing one in, access lists and open to the org, who uses each
  app, the audit log, and leaving. An invite link opens a page that joins the org (before, only the JSON accept route
  existed, so the link itself was a 404). `AgentTurns` runs one turn at a time per app (`<workspaceId>:<appId>`) as well
  as per person. `AppInstances` lists who uses an app (for people who manage it) and opens a member's instance read
  only for org admins and owners, writing `instance.support_view` to the audit log. Taking someone out of a group now
  closes their views of the apps they had only through it.
- Changed from the design: the settings pages are plain HTML forms, not StateUI apps, as Magnetic's page policy allows
  no script and every control is a form post. Who uses an app and the support view are on the org's settings page, not
  in the editor's inspector, and the support view shows the member's state as last saved (their instance diff and
  persona records) as text, rather than opening the app live as them; opening it live would cache their state in the
  admin's browser.

### P4: enterprise controls (15 November 2026)
- `migrations/0001_baseline.sql`: `org_domain`, `org_sso`, `org_policy`, `identity.org_id`, and triggers that make
  `audit_event` append only for every role (the database raises on update, delete and truncate).
- `OrgDomains` (claim, verify by a TXT record at `_magnetic-challenge.<domain>`, a domain belongs to one org), `OrgSso`
  (an org's OIDC provider, its secret sealed with AES-256-GCM under `MAGNETIC_SECRET_KEY`), `OrgPolicies` (the seven
  policies, checked values, `requireSso` for owners only, the hourly retention sweep), `SignInRules` (the `requireSso`
  gate, `autoJoin`, and a `user.signed_in` event in each org of the person, with their address), org spend in `Budgets`,
  `exportOrg` and `deleteOrg`.
- Sign-in: "Sign in with your work email" (`/signin/sso`) finds the org that verified the domain and starts its
  provider; every org provider returns to `/auth/sso/callback`, and its identities are `org:<orgId>`. An org's provider
  vouches for an email only at that org's verified domains, so it cannot make someone verified elsewhere.
- Enforced: `externalLinks` when a link is opened and when its view connects; `personalWorkspaces` when making or
  remixing an app; `agentModels` on turns and in the editor's model list; `monthlyBudget` before and during each turn
  in the org's apps (`AgentTurns.workspaceRefusal`).
- The org settings page shows admins the policies, domains, sign-in and this month's spend by person and app, and
  owners the export and deletion. Each is also a JSON route.
- Fixed on the way: `profileOf` never set `emailVerified`, so nobody signing in through a provider had a verified email
  (and so could not accept an invite).
- Changed from the design: moving an app into an org does not revoke its links when `externalLinks` is off; they stop
  opening for people outside the org instead, as every org link does. The org budget is a policy (`monthlyBudget`),
  not a table. Deleting an org keeps its `agent_request` rows (the server's spend ledger) and its audit events.

### P5 and P6: embeddings and search
- `stateui-pg/migrations/0002_embeddings.sql`, `EmbeddingIndex` (queue, worker with SKIP LOCKED, per-model HNSW
  index over a cast, partial on the model), `localEmbedder` (all-MiniLM-L6-v2 through the optional
  `@huggingface/transformers`) and `hashEmbedder` (no model; tests).
- Magnetic: parts and chat entries are queued as they change; `GET /search`, and the agent's `parts_search` and
  `chat_recall`; `magnetic reindex`.
- The catalog's hybrid search (15 November 2026): a `CatalogMeanings` port in stateui-mcp, which `SearchComponents` and
  `SearchPatterns` call only when the keyword result is weak; the catalog merges the two rankings by reciprocal rank
  (k = 60), keeps to the category, tier or kind asked for, marks hits found by meaning `byMeaning: true`, and stays
  weak only when the best meaning is below the model's close score. `CatalogEmbeddings` in stateui-pg implements it
  over `0003_catalog_embeddings.sql`: the version is the hash of the entries' texts, so a changed catalog is embedded
  again, and older versions are removed. Deviations: the table has no vector index (about 200 rows), and owner
  components and patterns are not embedded (the design's table is shared by every workspace).
  - Not checked yet: the design's check that requests weak today find the right component in the top three with the
    local model. The tests use the hash embedder, as the model is not installed here, and the local model's close
    score (0.45) is a starting value to tune against those requests.

### P7: vectors in app data (15 November 2026)
- `embed: true` on a model's string field (`FieldDeclaration.embed` in stateui-app; `readModel` refuses it on any
  other type, and on screen and module params); `ui_model_write` sets it, and the local server ignores it.
- stateui-pg `records.ts`: two sources, `record` (`<dataset part id>/<key>`) and `persona-record`
  (`<app id>/<binding>/<persona>/<key>`, owned by the persona), one vector per embedded field. A part change now carries
  its body before and after (`PartChange`), and a persona binding's write the records it replaces
  (`PersonaDataWrite`), so a record edit queues only the records and fields it changed; a model that starts or stops
  embedding a field queues that field of every record of its datasets and persona bindings; `queueAllRecords` for
  `magnetic reindex`. `EmbeddingIndex.search` takes `sourcePrefix` and `field`.
- `RecordSimilarity`: `{ binding, field, text, limit }` resolved through the app's `uses.data`, refused for a field the
  model does not embed, answered with record keys and scores; a persona binding searches only that persona's records.
- Magnetic: workspaces queue records (`embedRecords`), the server registers the `similar` procedure in every workspace,
  and the agent gets `data_similar` (the person's own records over a persona binding: the default persona in their own
  workspace, their id in an org's).
- Deviations:
  - `similar` is a server procedure that logic reaches with `call`, not a new logic command. Logic commands run
    synchronously in a transition, and embedding the text and searching cannot; `call` already answers a machine
    later as a named result. To let it search a persona binding, a procedure now gets the persona whose instance calls
    it (`AppProcedureContext.persona` in stateui-mcp). The design's `dataset_record` table was never built: records
    stay in their part body and `persona_dataset`, and their vectors are keyed by their place there.
  - The guide's text is a topic of its own (`similar`), as the `logic` topic is at its size cap.
  - A record written moments ago is found once the worker has embedded it (every 2 seconds), as the design says of
    every embedding.

### Since
- SAML (`statenet-network.md`, S12) and SCIM (`magnetic-scim.md`) are built, so an org's identity provider signs
  people in and pushes its people and groups.
- The statenet stages S1 to S6 are built, and Magnetic's instances run on owner nodes behind the mesh, any number of
  servers on one database (`statenet-relays.md`, "Magnetic behind the mesh").
- Hosting (`magnetic-hosting.md`): the host sets `MAGNETIC_SECRET_KEY`, so orgs can use their own sign-in. A superuser
  bypasses row-level security, so the servers connect as `magnetic_app`, which is not one; `magnetic reindex` and
  `import` read every workspace, so they need the owner or a `BYPASSRLS` role.
