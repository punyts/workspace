# punyts workspace

The development workspace for the punyts libraries (a reactive state store, its sync and network, and StateUI: apps as
declarative JSON documents) and Magnetic, the AI app builder built on them. The owner's main product, ai-minion
(`../ai-minion`, branch `develop`), consumes these libraries; its `knowledge-base/design/stateui-*.md` hold StateUI's
design history.

## Working style
Be discerning without being argumentative: state facts, name problems, propose fixes directly. No apologies or
validation-seeking. Write docs and messages in plain declarative sentences, no hype or emoji.

## Every library is its own git repo
- This repo (`punyts/workspace`) holds only `bin/`, `docker/`, `docs/`, `infra/`, the root `package.json` and lock, and
  `.claude/`. Each library folder is a separate repo (`github.com/punyts/<name>`), cloned by `bin/workspace.mjs` and
  listed in `.gitignore`.
- Commit in the repo that owns the file (`git -C <lib> …`). A change often spans several repos (a library, Magnetic,
  a design doc here) and needs a commit in each. `npm run status` shows every repo's branch, changes and unpushed
  commits.
- Commit straight to `develop` in every punyts repo: no feature branches or pull requests (owner, 2026-11-17). ai-minion
  is different: branch from its `develop` and merge through a pull request. Pushing a library's `develop` is its
  release: ai-minion's CI and Docker clone `develop` of each library fresh, and locally ai-minion links
  `libraries/<name>` to these checkouts (its scripts default to `../punyts`, beside the ai-minion checkout). Nothing is published to npm. Bump a
  `version` only when a consumer raises its range; if a library's dependencies change, ai-minion's lockfile is
  regenerated with npm 10 (`npx npm@10 install --package-lock-only`).

## The libraries (build order)
| Library | What | Notes |
|---|---|---|
| core | reporter, logger, `getType`, JSON schema validator | index is browser-safe; `FileLogger` only via `@punyts/core/logging/FileLogger.js` |
| expression | text expressions → AST → `execute(ctx)` | the only way StateUI evaluates code |
| state | proxy store: links, aliases, `protect`, `PathIndex` | |
| state-sync | changes, protocol, sync client; `./authority` subpath (Node) | `test:browser` is separate from `test` |
| state-react | React 19 hooks over state | jsdom tests, `.test.tsx` |
| statenet | WebSocket sync service, mesh, relays, certificates; bins `statenet`, `statenet-relay` | binds loopback only |
| stateui | reactive custom elements over state; `{{ }}`, `repeat`, `if`, `key` | depends only on state, expression, core |
| stateui-3d | three.js renderer for `scene3d`, a lazy runtime chunk | must not depend on `@punyts/stateui-*` |
| stateui-app | documents, validation, logic engine, mount/runtime, build CLI, runtime bundle | `/core` is DOM-free |
| stateui-components | the component library, screen patterns, presets, icons | builds against stateui-app's `dist` and vice versa |
| stateui-mcp | MCP server for building apps (stdio), use cases, preview/view host | stdout is the protocol: log to stderr |
| stateui-pg | Postgres storage for stateui-mcp; migrations, row-level security | tests need Postgres |
| magnetic | the app builder (see `magnetic/CLAUDE.md`) | |
| example | Vite demo apps "Northwind Ops" and "Lumen" | `npm test` is the browser suite |

StateUI vocabulary: an **app is its screens** (`$.screens.<name>`, no shell). A **node** is
`{ component, children, layout, placement, theme, on }`; `_` prefixes content, `<-` links a state path. An owner's
**parts** (apps, themes, models, data, logic, components, patterns, personas) are assembled into an app document. A
**pattern** is a screen tree with slots and params. A **persona** binding holds per-user data; an **instance** is what
one persona did in an app, laid over its definition. Logic is machines, rules, lookup tables, computes and effects.

## Rules library code must not break
- No `eval`/`new Function`; expressions only through `@punyts/expression`. No `innerHTML` for text; `on*` attributes
  and `javascript:` URLs are refused. Agents write JSON only. Vocabularies, layouts, commands and tokens are closed
  lists.
- stateui writes the DOM synchronously and never reads layout (`stateui/src/guarantees.test.ts` scans for it). The
  logic engine, state-sync core and stateui-app `/core` stay free of DOM and Node code; adapters are passed in.
- No integer-like keys in ordered maps (children, options, columns, items, steps, messages, logic records): JSON
  objects would reorder them. Store StateUI JSON as `json`, never `jsonb` (key order matters).
- Data stays in `$.data`; `$.runtime` never syncs; `$.server` stays on the authority, encrypted, never logged. Never
  log change values, prompts, secrets or PII.
- All logging through the `@punyts/core` reporter.
- No backwards compatibility: replace an API, don't keep the old one beside it.
- Error codes live in one catalog (`stateui-app/src/core/errors/catalog.ts`); messages take paths and names, never
  values.
- Design docs in `docs/design/` and ai-minion's `knowledge-base/design/` carry "Rules and Constraints" sections; read
  the one for the area before changing it. `statenet-direction.md` (ai-minion) is direction new work must not
  contradict.

## Commands (from the root)
- `npm run setup`: clone, install, build, install Playwright's Chromium.
- `npm run build` / `test` / `typecheck`: every library in order; `node bin/workspace.mjs run <script> <lib…>` for
  some. `npm test` runs each library's unit tests only; browser suites need
  `node bin/workspace.mjs run test:browser <lib…>` (stateui, state-sync, stateui-app, stateui-components, stateui-3d).
- `npm run magnetic:build` (Magnetic and every library it uses), `ui:build`, `mcp:build`. Everything runs from `dist/`, so rebuild after a change; tests of a consumer otherwise run
  against the old code.
- Never pipe test or build output through `tail`/`head`: the exit code becomes the pipe's.

## Code and tests
- TypeScript strict, ESM with `.js` import suffixes, `module: NodeNext`, 4-space indent. Older libraries (core,
  expression, state, state-react) use double quotes and `tsc -b`; newer ones single quotes and `tsc -p`. Doc comments
  are `/** … */` plain sentences.
- Vitest with globals. Tests sit beside the code (`*.test.ts`, `*.browser.test.ts` for Chromium), use `it` (not
  `test`), are named "should …", and follow Arrange/Act/Assert with those comments.
- After deleting `dist` in a `tsc -b` library, run `npm run clean` (removes `*.tsbuildinfo`), or the build emits
  nothing.
- Each library keeps a `CHANGELOG.md` with an `## Unreleased` section: one bullet per change with a **bold one-line
  headline**, behaviour, "Breaking."/"Fix:" markers, and the test that covers it. Update the README section with the
  code.

### Adding a StateUI component (stateui-components)
1. `components/<group>/<kebab>/` with `<kebab>.state.json`, `.view.html`, `.view.css`, `.controller.ts` and
   `.locale.{de,es,fr}.json`. The name is the camelCased folder; the tag is `ui-<folder>`.
2. `state.json` needs `summary`, a `category` (one of the nine) and 3–8 `purposes` unique across components (search
   depends on them). CSS uses theme tokens only. The controller default-exports one factory and imports no siblings.
3. Add it to `test/catalog.test.ts`, write `test/<group>/<name>.browser.test.ts` with `mountComponent`, add a README
   section and a CHANGELOG entry.
4. Place it in the example's document (`example/test/app.browser.test.ts` requires every catalog component there),
   and regenerate stateui-mcp's committed showcase (`npm run showcase:build -w @punyts/stateui-mcp`; its test fails
   when stale).

### Gotchas
- stateui-components' browser suite: keep `maxWorkers: 6` (more ran Chromium out of memory on Windows). Its scene3d
  tests silently skip unless stateui-3d's `dist/runtime-chunk` is built. Visual references are per platform
  (`*-chromium-win32.png`); refresh with `-- -u` and look at each image.
- stateui-3d's runtime chunk has a gzip size gate (`runtime-chunk/build.test.ts`) with about 5 KB left. `three` and
  `@types/three` move together.
- stateui-mcp pins its tool list (`test/expectedTools.ts`) and caps its instructions' size (`test/toolSet.test.ts`).
- Playwright, Vitest and Vite are pinned by root `overrides`.

## Environment
- Windows; Git Bash and PowerShell. No Python. Scripts are plain Node so they run in either shell.
- Docker Desktop may not be running: start it before `npm run magnetic:db`, and wait for Postgres ("the database
  system is starting up" means retry).
- Postgres for development and tests: `npm run magnetic:db` (pgvector, `127.0.0.1:5433`, user/password/db
  `magnetic`). DB tests use `PUNYTS_TEST_DATABASE_URL`, defaulting to that database; each test file gets its own
  schema, and without a database they fail rather than skip.
- Local secrets, such as `ANTHROPIC_API_KEY`, go in `.env` at the root (ignored).
- Local npm 11 can prune `package-lock.json` entries the image's npm 10 `npm ci` needs. After a dependency change check
  `git diff --stat package-lock.json`; a large deletion is pruning. Regenerate with npm 10
  (`npx npm@10 install --package-lock-only`) or keep the last lock that built plus the new entries.

## Design docs (`docs/design/`)
- One doc per feature: `Status:`, "Asked for on <date>:" quoting the owner's words, the design, `## Decisions`, and
  `## As built` listing files and tests once built. Later asks are quoted where they change it; owner decisions are
  cited inline ("(owner, 2026-11-06)"). Milestones: Magnetic M1–M8 (M8 stages N1–N6), hosting H1–H4, Postgres P1–P7,
  statenet S1–S6.
- Write docs as the code is now, and update them with the code. Remove what describes removed code instead of marking
  it superseded; git keeps the history.
- Workspace commits for them read "Design and record <feature>; <what else changed>".

## Hosting and deploys
- Magnetic runs on AWS (`infra/aws/magnetic.yml`, stack in us-east-2): one EC2 host with Docker Compose and Caddy
  (`docker/`), RDS Postgres. The secret key and database passwords are in Secrets Manager (us-east-2); LinkedIn,
  Anthropic, Stripe and admin-email parameters are in SSM Parameter Store in **us-east-1** (`/magnetic/*`). Design:
  `docs/design/magnetic-hosting.md`.
- `node infra/aws/deploy.mjs` (after `aws sso login --profile magnetic`) builds the image from the working tree, so
  uncommitted changes ship; the tag ends in `-dirty` when any repo the image builds has changes.
  `infra/aws/host-deploy.sh` runs on the host: it writes the env (beta
  settings included), prunes old images (the disk filled once), pulls and restarts.
- Deploys, SSO sign-in, SSM values, Stripe, IAM changes and LinkedIn redirect URIs are the owner's: ask first.

## Commits
- A short imperative sentence, no prefix (`feat:`) or ticket tag, no trailing period; a plain-prose body when the why
  isn't obvious.
