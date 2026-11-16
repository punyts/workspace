# Magnetic: reading another owner's data

M8 left one kind of data out (magnetic-m8.md, "The three kinds of data"): an app's logic can read its own
workspace's datasets and the person's own state of its other apps, but nothing another owner has. This design lets an
owner share a dataset, read only, with another person or org, and lets that workspace's apps read it live.

## What exists
- **Owner datasets** are `data` parts of a workspace (`{ model, records }`, a name unique in the workspace). Every app
  of the workspace that binds the name (`uses.data.<binding> = { dataset }`) reads and writes it live (`DatasetHub`).
  They have no statenet address (statenet-relays.md, S1).
- **`uses.external`** reads the person's own state of another app of the same workspace, read only, at
  `$.external.<alias>` (`ExternalReads`, S3). It presents no grant.
- **Signed grants** (S4): `state_grant` rows, tokens signed with the owner's key, revocation down every grant passed
  on, the org policy `grantsInOrg` at issue, and Shared by me (`/settings/shared`). Their addresses are
  `<owner>/<app>/<app|user>`, and nothing at run time reads through one but the org's support view.

## Decisions
### A dataset gets an address for grants: `<workspace>/<dataset>/data`
- A grant names a dataset by a third scope, `data`, beside `app` and `user`. The records stay in their data part; the
  address names them for grants only. `addressCovers` and `ownerOfAddress` work on it as they are.
- **The subject is a workspace:** a person's own (their user id) or an org's. Sharing with someone means their apps
  may read it, whoever uses them; it is the owner's data, not one person's.
- **Read only, the whole dataset** (prefix `$`). Writing to another owner's dataset is left out: it needs the owner's
  model checks and logic to run on another owner's writes, which is a design of its own.
- **Who shares:** whoever manages the workspace: the person, for their own; an org's owners and admins, for the
  org's. The grant's issuer is the workspace (the owner of the address), and the audit names the person.
- **Policy:** an org with `grantsInOrg` shares its datasets only with its own members' workspaces.
- **Life:** a share lasts until it is revoked. `MAX_SHARE_MS` (30 days) is for state grants that people pass on; a
  dataset share is a standing right, renewed in place when a token is signed for it.

### An app reads it at `$.external.<alias>`
- `uses.external.<alias> = { owner: "<workspace id>", dataset: "<name>" }`, beside `{ app, path }`. The records show
  at `$.external.<alias>` as a record map, read only and never stored, and the logic runs on their changes, as for
  another app's state.
- stateui-mcp takes a `sharedData` port: `open(owner, dataset, listener)` gives the records now and on each change,
  and says when the read ended (a share revoked, expired or never made). Ended, the alias is cleared.
- Magnetic's `SharedData` finds the share for the reading workspace, signs a token for it and checks it as a relay
  would (`StateGrants.check`), then follows the owner's data part (`Services.watchDataset`), keeping the owner's
  workspace open while anyone reads it. Revoking closes every read through the grant at once. Each delivery checks
  the share again.

### People see and manage it on a Data page
- `/settings/data?w=<workspace>`, tabbed by workspace like Connections:
  - **The workspace's datasets**, each with the workspaces it is shared with, Revoke, and a form to share it by a
    person's email or an org's short name.
  - **Shared with this workspace:** each dataset other owners shared with it: the owner, the name, the model's fields
    and the `uses.external` that reads it.
- Shares show on Shared by me too, as every grant does.
- Four languages, as the other pages.

### The agent is told what it can read
- With each request, the agent gets the datasets shared with the app's workspace (owner name and id, dataset, fields)
  and how to read one with `uses.external`. Only these exist: sharing is the owner's, never the agent's.

## Checks
- A shared dataset's records reach a reading app at `$.external.<alias>`, and a change by the owner reaches it live.
- An app that names a dataset nobody shared with its workspace reads nothing.
- Revoking clears what the reading app shows at once.
- `$.external` refuses a client's write.
- Only the workspace's managers share; an org with `grantsInOrg` refuses an outsider.
- E2E: an owner shares a dataset by email; the other person sees it under Shared with this workspace; revoking
  removes it.

## As built
- stateui-app: `uses.external.<alias>` takes `{ owner, dataset }` beside `{ app, path }`.
- stateui-mcp: `ExternalReads` opens data uses through the `sharedData` port (`SharedData`, exported) and writes
  their records at `$.external.<alias>`, clearing the alias when a read ends; closing an instance's authorities
  closes its reads.
- magnetic:
  - `grants/StateGrants.ts`: data addresses, standing grants (no expiry), `by` in the audit, and `datasetShares`,
    `datasetsSharedWith`, `datasetShare`.
  - `sharing/SharedData.ts`: the port per reading workspace; it checks the signed grant as a read opens and on each
    change of the owner's dataset, and `revoked()` ends reads at once.
  - `server/dataRoutes.ts`, `http/dataPage.ts`, `http/dataText.ts`: the Data page; `sharing/facts.ts`: the agent's
    facts.
- Tests: `sharing/sharedData.test.ts` (6), stateui-mcp `externalReads.test.ts` (2 more), stateui-app
  `blueprint.test.ts` (2 more), `e2e/data.spec.ts` (3 at two sizes).
- The page says "Stop sharing" where this design says Revoke.
