# A person's state lives under their own owner

Status: built 2026-11-23 (stages 1 to 4), deployed 2026-11-24. It changes the statenet's direction (statenet-direction.md,
"Owners and paths").

Asked for on 2026-11-23:

> If we think about it, a user has their own <ownerid> and that's where we could say is their "personal" org. That is
> where their state lives, and their changes to state at some level (data state might not be their data so changes
> might live on another <ownerid>)

Then, answering where a person's state for an app lives:

> yes that's the pattern, we use the same path but with the user's owner id. This replaces the personas as it
> currently exists (we could repurpose for themes and settings)

## The design
- **A person's state for an app is at the app's own path, under the person's owner id.** The app `<app>` of owner
  `<owner>` is defined at `<owner>/components/<app>`; a person `<person>` keeps their state for it at
  `<person>/apps/<app>` (app ids are unique, so the app's owner needs no segment). The owner's own state of their app
  is an instance like anyone's, `<owner>/apps/<app>` (state-definitions-and-instances.md).
- **The state there is the delta over the definition**: reads lay it over the definition, writes go to it, reset
  deletes its entry, as the direction already says of the persona's copy.
- **Data stays where it lives.** A change to data the person does not own goes to the data's owner
  (`<owner>/data/<dataset>`), under the rights they hold there (statenet-permissions.md, statenet-requests.md); only
  what is theirs is under their owner id.
- **Personas as they are go.** There is no persona segment and no `default`; the key of an instance is the person, the
  app's owner and the app, `{person}.{ownerId}.{appId}`, and the owner's own preview is the key whose person is the
  owner. A binding that gives each person their own records of a model is `scope: "person"`. The run-time tools lose
  their `persona` argument. One person has an app once.
- **Personas may come back for themes and settings**: a named set of a person's preferences (a theme, a language, a
  layout) that they switch between. That is a later design, not part of the path.

## Stages
1. statenet-direction.md: the path shape and the rule on persona segments follow the owner's decision. Done with this
   doc.
2. stateui-app: the binding scope `persona` becomes `person` (`core/blueprint`, validation, assembly), and the
   comments that speak of a persona's instance speak of the person's.
3. stateui-mcp and stateui-pg: `InstanceKey` names the person; `DEFAULT_PERSONA` goes, and whoever used it passes the
   workspace's owner; the run-time tools' `persona` argument goes; `WritePersonaData` and the persona record source
   are the person's. Databases are reset, not migrated (no users).
4. Magnetic: `appShellPage` and the org routes stop passing a persona; the org's support view reads a member's state at
   their path; the share and grant code that names personas follows.

## Open questions
- How someone opens the same app twice (two projects in one notes app). Taken as not needed for now: one person has
  an app once (decided on the owner's "Do it all", 2026-11-23); the owner may revisit it.
- Whether a person's settings (theme, language) are themselves state at `<person>/settings`, and personas a name over
  sets of them. Left for its own design.

## Decisions
- The person's state uses the app's path under their own owner id, and replaces personas as they are (owner,
  2026-11-23).
- Personas may be repurposed for themes and settings (owner, 2026-11-23).
- The path is the app's, `<person>/apps/<app>`, with no segment for the app's owner: the owner said "the same path",
  and app ids are unique. Where apps go by a name per business (statenet-direction.md, `[user].apps.[business].[app]`),
  the business segment comes back. Made while building it.
- One person has an app once. Made while building it.

## As built
### Stage 2: stateui-app
- `scope: "person"` is the per-person binding (`PersonBinding`, `PERSON_SCOPE` in `src/core/blueprint/read.ts`,
  `types.ts`, `index.ts`); `scope: "persona"` is refused. Comments in `assembleApp.ts`, `snapshot/instance.ts`,
  `validate/sharedData.ts`, `dom/embed/types.ts`, `dom/mount/types.ts` and `runtime/messages.ts` speak of the
  person's instance. Tests: `src/core/blueprint/blueprint.test.ts` (scope `persona` refused at
  `$.uses.data.<binding>.scope`), `src/core/assemble/assemble.test.ts`.

### Stage 3: stateui-mcp and stateui-pg
- stateui-mcp `src/domain/InstanceKey.ts`: `InstanceKey` is `{ person, ownerId, appId }`, its text
  `<person>.<ownerId>.<appId>`; `isPersonId` checks an id is safe as a path segment. `DEFAULT_PERSONA` and
  `isPersonaName` are gone. `userStateAddress(person, appId, owners)` and `instanceOfAddress` in
  `src/domain/StateAddress.ts` take and answer the person; the owner's own state is the key whose person is the owner.
- `AuthorityInstanceStates`, `InstanceViews`, `createServices` and `FileUiInstanceRepository` default the person to
  the workspace's owner id; `HttpServer` passes the tenant's person through. `WritePersonData`
  (`src/application/use-cases/WritePersonData.ts`) replaces `WritePersonaData`. File storage keeps each person under
  `people/<person>/` (`src/infrastructure/storage/PartFolders.ts`).
- The run-time tools lose `persona` (`src/infrastructure/mcp/runTarget.ts`): a call that still passes it is refused as
  an invalid argument. The guide and tool descriptions say person. Tool names are unchanged.
- stateui-pg: `PERSON_RECORD_SOURCE` (`person-record`, `src/embeddings/records.ts`); `RecordSimilarity`'s place takes
  `person`; `pgWorkspaceStorage(...).instances(person)` and `txInstances(tx, workspace, person, owners)`. No
  migration: databases are reset, and the earlier migrations stay as they ran.
- Tests: stateui-mcp `src/domain/InstanceKey.test.ts`, `src/domain/StateAddress.test.ts`, `test/runTools.test.ts`
  (a `persona` argument is refused), `src/config/instanceStates.test.ts`, `src/infrastructure/preview/LiveViews.test.ts`,
  `test/hostForget.test.ts`; stateui-pg `src/embeddings/records.test.ts`, `src/db/roles.test.ts`,
  `src/workspace/workspaceStorage.test.ts`.

### Stage 4: Magnetic
- `src/server/startMagnetic.ts`: `appShellPage` takes the person (the signed-in user's id); an org's tenant, a `use`
  link and a revoked link pass the person's id, or the app's owner for the owner's own view.
  `StateGrants.boundAccess` gives the workspace itself access when the person is the workspace
  (`src/grants/StateGrants.ts`, used by `src/server/requestsRoutes.ts` and `src/sharing/SharedData.ts`).
- The editor's Statenet view shows `$.people.<your id>`, labelled with your name, with your state of each app at
  `$.people.<id>.apps.<app id>` (`src/inspector/viewInfo.ts`, `src/server/viewRoutes.ts`, `src/http/views.ts`, the
  `views.kind.person`, `views.note.person` and `views.personNote` texts in `src/http/text.ts`).
- Record search uses `PERSON_RECORD_SOURCE` and the person's id (`src/search/Search.ts`, `src/search/similar.ts`);
  file import reads `people/<person>` folders (`src/storage/importFiles.ts`); the agent's instructions and the pages
  say `scope: "person"`.
- Tests: `src/inspector/viewInfo.test.ts`, `src/server/viewRoutes.test.ts`, `src/server/enterprise.test.ts`,
  `src/server/grants.test.ts`, `src/orgs/orgs.test.ts`, `src/storage/importFiles.test.ts`, `src/search/search.test.ts`;
  `e2e/views.spec.ts` updated, not run.
- The wording follows in stateui-components (the table's export and the tour) and the design docs that described the
  persona key.

## Rules and Constraints
- A person's state for an app is at `<person>/apps/<app>`, the delta over the app's definition.
- Data a person does not own is changed at its owner's path, never copied under the person.
- No persona segment in state paths.
