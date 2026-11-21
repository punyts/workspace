# Reporting across the libraries

Status: built (2026-11-20). Asked for on 2026-11-20: "Let's wire in the reporter system from punyts/core/logging.
We need to report at various key parts of the system. This is for all of the repos. For example, in the stateui repo,
we should report events like when a component is rendered. Find the key areas in all of the repos and add appropriate
reporter entries."

## The reporter
`@punyts/core`'s reporter takes a report of any category, and passes it to the listeners only when the category is on
(`setCategories`) and a listener takes it. A report whose category is off costs one map lookup. Details may be a
function, called only when the report goes out; `%s` in the message is filled from the details then.

- **A category list may name a family**: `stateui.*` takes every category that starts with `stateui.`, as `all` takes
  every category. Listeners' lists match the same way (`categoryMatches`).
- **`isReported(category)`** answers whether a report of the category would go out now. A hot path checks it before
  building details that cost something.

## Rules and Constraints
- **Categories are `<library>.<area>`**, lower case, with dots for depth: `stateui.render`, `state-sync.client`,
  `stateui-app.logic.machine`, `magnetic.http`. The library part is the folder name, so `<library>.*` turns on one
  library. The built-in categories (`info`, `warning`, `error`, `metric`) stay for what an operator always wants:
  `report.error` and `report.warning` for failures and refusals, as today; `report.info` for rare lifecycle events of a
  server (started, listening, stopped). Everything else, and everything per item, request, render or change, goes under
  a library category, which is off by default.
- **Never values.** A report names paths, ids, names, kinds, counts, sizes and durations. It never holds a change's
  value, a record's fields, an expression's result, a prompt, a message body, a token, a secret, an email, a query's
  parameters or a URL's query string. An error's message may be reported only when it is the library's own message,
  which takes paths and names (the error catalog's rule).
- **Hot paths cost nothing while off.** Where a report sits in a loop or runs per element, binding, set or emit, it is
  guarded with `if (isReported('<category>'))` before its details are built, or its details are a function. The perf
  suites (stateui-components' `test:perf`, stateui-3d's size gate) keep passing.
- **The message reads as a sentence** in the style of the docs ("Rendered %s", "Reconciled %s: %s moved"), with `%s`
  filled from an array of details, or a fixed message with an object of details. A duration is `ms` rounded to a tenth.
- **No listener in a library.** Libraries only report; hosts listen: statenet's bins, stateui-mcp, Magnetic's server and
  aggregate, stateui-app's runtime in the browser.
- **stateui-app's `/core`, the logic engine and state-sync's core stay free of DOM and Node code**: they report through
  `@punyts/core`'s `report`, which is neither.

## Turning categories on
- **Node hosts** read `PUNYTS_REPORT`, a comma-separated list of categories (`PUNYTS_REPORT=stateui-app.*,state-sync.*`),
  and add them to their own; each writes every report to stderr in its own line format (`[statenet] stateui.render …`).
  stateui-mcp writes to stderr only, since stdout is its protocol.
- **In the browser**, stateui-app's runtime reads `localStorage['punyts.report']` (the same list) when it mounts, and
  when it holds categories, turns them on and logs them to the console with `consoleLogger`. Reading it may throw (a
  private window): then nothing is turned on.

## Decisions
- **Existing categories take the new names**: `state-set` is `state.set`, `event-emit` is `state.event.emit`,
  `state-sync` is `state-sync.client` or `state-sync.authority` by where it is reported, `statenet` is
  `statenet.service`, `stateui-waiting` is `stateui.waiting`, `state-react` is `state-react.hook`. No old name is kept.
- **Magnetic's and stateui-mcp's own reporters stay** for their operational lines; their hosts also listen to the
  default reporter, where the libraries report, so a library's warnings and errors reach the host's log (they reached
  no listener before).
- **One test per library** turns on its categories, drives the code, and asserts the reports came with the details
  named and no value in them.

## As built
Each library's README has a "Reporting" section with its categories; its CHANGELOG names the test.
- **core**: `src/logging/Reporter.ts` (`categoryMatches`, `isReported`, the category checked before the timestamp);
  `src/logging/FileLogger.ts` writes through one buffered stream and `stopFileLogger()` flushes. Tests:
  `src/logging/Reporter.test.ts`, `src/logging/FileLogger.test.ts`.
- **expression**: `expression.parse`, `expression.execute` (`src/index.ts`). Test: `src/Reporting.test.ts`.
- **state**: `state.store`, `state.set`, `state.set.change` (the kinds of the old and new value; it logged the value
  before), `state.apply`, `state.link`, `state.protect`, `state.event.*`, `state.listener`. Test: `src/Reporting.test.ts`.
- **state-react**: `state-react.hook`, `state-react.update`, `state-react.throttle`. Test: `src/reporting.test.tsx`.
- **state-sync**: `state-sync.client`, `.capture`, `.authority`, `.relay`, `.ownership`; failures report an error's name,
  not its message. Test: `src/Reporting.test.ts`.
- **statenet**: `statenet.service`, `.mesh`, `.mesh.serving`, `.certificate`, `.owner`, `.relay`, `.relay.client`,
  `.aggregate`; the bins read `PUNYTS_REPORT` (`src/hostReporting.ts`). The nodes' `report` options are gone. Tests:
  `src/hostReporting.test.ts`, `src/Statenet.test.ts`, `src/mesh/aggregate.test.ts`.
- **stateui**: `stateui.render`, `.component`, `.repeat`, `.bind`, `.template`, `.waiting` (`src/reporting.ts`); two style
  reports no longer quote a rule. Test: `src/reporting.test.ts`.
- **stateui-3d** reports nothing itself (it has no `@punyts/core`, and its chunk has a size gate): stateui-components'
  `scene3d` reports for it, with each `onIssue`.
- **stateui-app**: `stateui-app.validate`, `.assemble`, `.mount`, `.command`, `.logic.machine`, `.logic.rule`,
  `.logic.table`, `.logic.compute`, `.logic.effect`, `.build` (`src/core/report.ts`); `startBrowserReporting()` in
  `src/dom/mount/reporting.ts` reads `localStorage['punyts.report']` at the first mount. Tests: `src/core/report.test.ts`,
  `src/dom/mount/reporting.browser.test.ts`.
- **stateui-components**: `stateui-components.records`, `.overlay`, `.gestures`, `.viewport`, `.board`, `.embed`, `.form`,
  `.conversation`, `.scene3d`. Tests: `src/shared/records/slotPool.report.test.ts`, `test/reporting.browser.test.ts`.
- **stateui-mcp**: `stateui-mcp.tool`, `.usecase`, `.preview`, `.storage`; `listenToLibraries()` in
  `src/config/reporter.ts`. Test: `test/reporting.test.ts`.
- **stateui-pg**: `stateui-pg.query`, `.transaction`, `.migrate`, `.lock`, `.changes`. Test: `src/db/reporting.test.ts`.
- **magnetic**: `magnetic.http`, `.signin`, `.agent`, `.budget`, `.pages`, `.statenet`, `.storage`, `.billing`, `.scim`;
  `--report` / `PUNYTS_REPORT` and `listenToLibraries()` in `src/server/reporting.ts`. Tests:
  `src/server/reporting.test.ts`, `src/server/options.test.ts`. The e2e server logs every category to
  `e2e-logs/server.log` and the pages' console to `e2e-logs/browser.log` (`MAGNETIC_E2E_REPORT` narrows them).
