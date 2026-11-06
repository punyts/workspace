# workspace
The development workspace for the punyts system. Each library is its own repo, cloned into this folder on `develop`
and listed in the npm `workspaces`, so the libraries install, build and test together and on their own.

## Setup

```bash
git clone -b develop https://github.com/punyts/workspace.git punyts
cd punyts
bash bin/clone-repos.sh       # every library repo, on develop (bin/repos.sh lists them)
npm install
npm run build                 # every library in build order, then the stateui-app runtime bundle
npx playwright install chromium chromium-headless-shell   # once, for the browser tests
```

## Commands

| Command | What it does |
|---------|--------------|
| `npm run build` | `npm run build` in every library, in build order, then `build:runtime-bundle` of `stateui-app` (the `stateui-mcp` tests and the host page need it) |
| `npm test` | Every library's node tests |
| `npm run typecheck` | Every library's type check |
| `npm run status` | Branch, changed files and unpushed commits of the workspace and each library repo |
| `bash bin/run-all.sh <script> [library...]` | One npm script in the libraries that have it; stops at the first failure |

Browser tests run per library: `npm run test:browser -w @punyts/stateui-components`.

## Versions

`overrides` pins Playwright, vitest and vite to the versions in ai-minion's lockfile, so tests here run with the same
tools and in the same Chromium as there. Move them together with ai-minion's.

## ai-minion

ai-minion links its `libraries/<name>` to these repos (`bash bin/clone-libraries.sh --link` in ai-minion, which
expects this workspace at `../../punyts` from its repo root), so both build against the same checkouts. A library
`package.json` dependency change needs ai-minion's lockfile regenerated: `npx npm@10 install --package-lock-only`
there.

## stateui-3d

`stateui-3d` (graphics epic 3) is a local repo until `github.com/punyts/stateui-3d` exists; it has no `package.json`
until story G3.2, so it is not in `bin/repos.sh` or the npm `workspaces` yet.
