# Test runs write scratch copies of their datasets

Status: built 2026-11-24, deployed 2026-11-24.

Asked for on 2026-11-24, after building the starter apps showed that trying an app changed its seed records:

> Fix the limits

and, choosing among scratch copies, restoring on reset, and documenting it:

> Scratch copies

Which runs are test runs:

> Editor and agent runs

and, since Magnetic's editor and the app alone are one page:

> Reconnect at each zoom

## The problem
A shared binding (`uses.data` with `dataset`) shows the owner's dataset `<owner>/data/<dataset>` in `$.data.<binding>`.
Every write the running app made there landed in the instance's authority, and `DatasetHub` copied it on to the dataset.
Server logic wrote the same way through the `DataGate`. `ui_state_reset` removed the instance and its person bindings'
records, not the dataset, so a test run's writes stayed in the owner's data. Every run of an owner app by its owner used
one instance, `instances.<owner>.<owner>.<app>`, so nothing told a test run from real use.

## The design
- **Which runs are test runs.** The builder's: the stateui-mcp tools (`ui_preview`, `ui_interact`, `ui_screenshot`,
  `ui_state_*`, `ui_tree`), the stateui-mcp view host, Magnetic's editor (`/edit/<id>`) and the agent's browser
  (owner, 2026-11-24). The app at `/apps/<id>` in Magnetic is real use, as is every person the app is shared with.
- **The test person.** A test run is the instance of a reserved person, `test-<ownerId>` (`testPersonOf`), so the
  instance key keeps its shape `{ person, ownerId, appId }`. Its namespace is `instances.test-<owner>.<owner>.<app>`,
  its address `<owner>/apps/<appId>.test` (`userStateAddress`, parsed back by `instanceOfAddress`), and it is stored
  as a person's instance. In a personal workspace the person of real use equals the owner, so the owner's own instance
  could not also be the test run: the reserved person separates them.
- **Shared bindings as copies.** In a test run a shared binding of a dataset with a model is a person binding of that
  model that still names its dataset (`assembleInstance`). Its records start as the dataset's, its writes stay in the
  instance, and they are checked against the model by `DatasetHub` as a shared binding's are. The hub opens a session
  for it as the owner that only reads: each change of the dataset (`ui_data_write`, the Data page, a real instance) is
  applied to the copy as that change, so a seed edit shows in a running test run and the copy's own writes to other
  records stay. A copy's records are not part of the definition (`definitionText`), so a seed edit does not restart
  the test run. A dataset with no model stays shared.
- **Reset.** `ui_state_reset` removes the test instance, so the copies go with it; the next start copies the dataset's
  records again. Deleting an app resets the test run and the owner's own instance, and stateui-pg's `removeApp`
  removes the `.test` namespace with every person's instance.
- **Editing the seed.** `ui_data_write`, `ui_data_query` and Magnetic's Data page read and write the owner's dataset
  directly.
- **Magnetic's page.** `/edit/<id>` and `/apps/<id>` are one shell page. It carries both namespaces
  (`data-test-namespace`, `data-own-namespace`), starts on the one its address names, and at each zoom calls
  `stateuiHost.reconnect(namespace, run)`: the view's sync client stops, the page's `data-namespace` and `data-run`
  change, and a new client connects. The app stays loaded, and the other instance's welcome replaces its state (the
  host diffs it in whole, deleting what the new state lacks). The editor's socket and its CSV exports
  send `run=test`; the tenant answers them with no person (the test run), and every other request of the person's own
  workspace with the person's own instance. An org app gives the org's test run to someone who may edit it.
  Magnetic's own pages are real use: Your apps writes each visit's lists into the person's own instance of their
  home app (`HomeApps.show`, through `instanceViews.authority(app, person)`), and its page syncs with that instance.
- **Embeddings.** A test run's copies are never embedded (stateui-pg), so a reset costs nothing; record similarity in
  a test run searches the dataset, which the copy follows.

## Decisions
- A reserved person, not a marked key: the key, the namespace and the stores keep their shapes (2026-11-24).
- The copy follows the dataset's changes while the test run is running, instead of keeping its records until a reset,
  so the agent's seed edits show in its next screenshot. A copy stored from an earlier run keeps its records until a
  reset (2026-11-24).
- The editor reconnects at each zoom rather than keeping the instance the page was loaded with (owner, 2026-11-24).
- The State view's graph lists a person's real state, not the test run's.

## As built
- stateui-mcp: `src/domain/InstanceKey.ts` (`testPersonOf`, `ownerOfTestPerson`), `src/domain/StateAddress.ts` (the
  `.test` address), `src/infrastructure/sync/InstanceStart.ts` (copies, `definitionText`),
  `src/infrastructure/sync/DatasetHub.ts` (checks and follows copies), `src/infrastructure/sync/AuthorityInstanceStates.ts`
  (the test person by default), `src/infrastructure/preview/InstanceViews.ts`, `src/config/createUiBuilder.ts` and
  `createServices.ts` (`instances` and `ownInstances`), `src/application/use-cases/DeletePart.ts`, `src/browser/host.ts`
  (`reconnect`), `src/browser/viewChannel.ts` and `fileExport.ts` (`run=test`). Tests: `src/config/datasetHub.test.ts`
  ("should take a change of the dataset into a test run's copy …", "should give a save-data with a bad field in the
  copy of a test run the rejected result …"), `src/config/instanceStates.test.ts`, `src/config/placement.test.ts`,
  `test/runTools.test.ts` ("should refuse a definition path, and write a shared dataset to the copy of the test run
  until a reset"), `test/browser.integration.test.ts`, `test/instanceView.integration.test.ts`.
- stateui-pg: `src/workspace/PgWorkspaceStorage.ts` (`removeApp`), `src/embeddings/records.ts`. Tests:
  `src/workspace/workspaceStorage.test.ts`, `src/embeddings/records.test.ts`.
- Magnetic: `src/server/startMagnetic.ts` (`testRun`, the tenant, `appShellPage`, `personApps`), `src/http/shell.ts`
  (both namespaces, the reconnect in `setEditing`), `src/home/HomeApp.ts` (Your apps in the person's own instance). Tests: `src/server/viewRoutes.test.ts` ("should sync the app at its
  address with the owner's own instance, and the editor with the test run"), `src/server/statenet.test.ts`,
  `e2e/home.spec.ts`, `e2e/profile.spec.ts`.

## Rules and Constraints
- A test run never writes an owner's dataset; `ui_data_write` and the Data page are the only ways the builder changes
  its records.
- Real use, by the owner at the app's address or by a person the app is shared with, writes the dataset as before.
- No backwards compatibility: the tools name the test run only; the owner's own instance is real use.
- The `.test` instance address is hosted by Magnetic's statenet node like any instance address; the tower owns that
  node (docs/work-split.md).
