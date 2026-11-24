# What sharing leaves behind

Status: built 2026-11-22.

Asked for on 2026-11-22: "Yes, design it", to the three items of Magnetic's README, "Not yet", under "Sharing leaves
some things behind", and then "Do it all".

## Why

Sharing an app (`use`, `view` and `remix` links, `src/sharing/Grants.ts`) left three things behind:

- **Deleting an app kept other people's state of it and its links.** `DeletePart` stops every running instance of the
  app, but removes only the owner's own (`instances.reset`, the key whose person is the owner). Each person who used it through a
  `use` link, and each org member, keeps a namespace `<their number>/apps/<appId>` in the owner's workspace. The
  links stay live, so their pages say "This app was deleted" but their browsers keep what they cached.
- **The page of a revoked app shows its name.** The link page of a revoked token is titled with the app's name, and
  so is the app page a person reaches after it was taken back from them.
- **A person who moves from `use` to `view` keeps their `use` data in their browser.** Their `use` link is revoked
  while a `view` link of theirs stays live: they then open the owner's instance, read only, and the browser never
  deletes the namespace of their own instance.

## The design

### Deleting an app takes everything of it
- stateui-mcp's `ServicesStorage` gains `removeApp?(appId)`: removes every person's stored instance of the app. The
  delete of an app calls it while the app's instances are stopped, after the owner's own reset. File storage has
  no other person's instance kept by app, so it leaves it out.
- stateui-pg's `pgWorkspaceStorage` implements it: the addresses `<owner>/apps/<appId>` of the workspace in
  `namespace_head`, each removed whole through the workspace's namespace store at the epoch its head holds. In
  Magnetic that store is `StateWriter`, so the removal goes through the aggregate (S11).
- Magnetic wraps the workspace's storage: its `removeApp` also revokes the app's live links (`Grants.revokeApp`)
  and closes the views of everyone who opened them with the revoked message. A revoked link is kept, as for a link
  revoked by hand, so a browser that comes back is told and deletes what it kept.
- The link page of a revoked link whose app is gone says "This app was deleted."
- An org member's browser that kept an org app is not told when the app is deleted: org access is not a link, and its
  page answers 404. Their state on the server is removed with the rest.

### A revoked app's page does not name it
- The link page of a revoked link is titled "Link revoked" (in the person's language), not with the app's name.
- The app page of an app taken back from a person is titled "Not shared". The page still deletes what the browser
  kept, as before.

### Moving from `use` to `view` deletes the `use` data in the browser
- stateui-mcp's `HttpTenant` gains `forget?: readonly string[]`: namespaces the browser deletes before it opens the
  app. The page carries them in `data-forget` (space separated; a namespace has no spaces), and the host calls
  `forgetNamespace` for each before it starts (`forgetListed`).
- `Grants.access` answers a live `view` with `usedBefore: true` when the person had opened a `use` link of the app
  that is now revoked. Magnetic then gives the tenant `forget: [their use namespace]`.
- The state of their `use` instance on the server stays, so a new `use` link gives it back.

## Rules and Constraints
- Nothing names a revoked or deleted app to someone who no longer has it.
- People's state is removed only through the workspace's namespace store (the aggregate in Magnetic).
- A link is never deleted, only revoked: a browser that comes back must be told.
- Nothing logged but ids and counts.

## Decisions
- **All three, built in this workspace** (owner, 2026-11-22: "Do it all").
- **Links of a deleted app are revoked, not deleted**, so a browser that kept the app is told when it comes back.
- **Only the browser forgets a `use` instance after a move to `view`**; the server keeps it.

## As built
- **stateui-mcp**: `ServicesStorage.removeApp` (`src/config/createServices.ts`), `UiBuilderPorts.removeApp`
  (`src/config/createUiBuilder.ts`), `AppCleanup.removeApp` called by `DeletePart`
  (`src/application/use-cases/DeletePart.ts`); `HttpTenant.forget` and `RevokedApp.title`
  (`src/infrastructure/http/HttpServer.ts`), `AppPageOptions.forget` (`src/infrastructure/http/pages.ts`),
  `forgetListed` (`src/browser/forgetListed.ts`) called by the host (`src/browser/host.ts`). Test:
  `test/hostForget.test.ts`.
- **stateui-pg**: `removeApp` in `pgWorkspaceStorage` (`src/workspace/PgWorkspaceStorage.ts`). Test:
  `src/workspace/workspaceStorage.test.ts` ("should remove every persona's instance of an app with removeApp, and keep
  the other apps'").
- **Magnetic**: `Grants.revokeApp` and `SharedAccess.usedBefore` (`src/sharing/Grants.ts`); in
  `src/server/startMagnetic.ts` the wrapped storage and `appDeleted`, `REVOKED_TITLE`, the revoked link page, and
  `sharedTenant`'s `forget`; `link.revokedTitle` in `src/http/text.ts`. Tests: `src/server/sharing.test.ts` ("should
  name a revoked app neither on its link page nor on its own page", "should have the browser delete a person's own
  instance when their use link is revoked and a view link is left", "should revoke the links of a deleted app and
  remove each person's instance of it"), `src/sharing/Grants.test.ts` ("should prefer a live use link to a view link,
  mark a view left after a revoked use, and fall back to a revoked one", "should revoke every live link of an app with
  revokeApp, and answer only those").
