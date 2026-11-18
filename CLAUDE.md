# punyts workspace

The development workspace for the punyts libraries and Magnetic, the AI app builder built on them.

## Every library is its own git repo
- This repo (`punyts/workspace` on GitHub) holds only `bin/`, `docker/`, `docs/`, `infra/`, the root `package.json`
  and lock, and `.claude/`. Each library folder (`core`, `state`, `stateui*`, `statenet`, `magnetic`, `example`, …) is
  a separate repo (`punyts/<name>`), cloned by `bin/workspace.mjs` and listed in `.gitignore`.
- Commit a change in the repo that owns the file: `git -C magnetic …` for Magnetic, the root for docs and infra. A
  change often spans both (code in `magnetic/`, design doc or npm scripts here) and needs a commit in each.
- `npm run status` shows every repo's branch, changed files and unpushed commits. Work happens on `develop`; pull
  requests target `main`.

## Commands (from the root)
- `npm run setup`: clone, install, build, install Playwright's Chromium.
- `npm run build` / `test` / `typecheck`: every library in build order. `node bin/workspace.mjs run <script> <lib…>`
  for some.
- `npm run magnetic:build`: the libraries Magnetic uses, Magnetic and the runtime bundle. Rebuild after editing any
  of them: Magnetic runs from `dist/`.
- See `magnetic/CLAUDE.md` for running Magnetic.

## Environment
- Windows; Git Bash and PowerShell. No Python. Scripts are plain Node so they run in either shell.
- Docker Desktop may not be running: start it before `npm run magnetic:db`, and wait for Postgres to accept
  connections ("the database system is starting up" is a retry, not a bug).
- Postgres for development and tests: `npm run magnetic:db` (pgvector, `127.0.0.1:5433`, user/password/db
  `magnetic`). Tests that need it read `PUNYTS_TEST_DATABASE_URL`
  (`postgres://magnetic:magnetic@127.0.0.1:5433/magnetic`); each test file gets its own schema.
- Local secrets, such as `ANTHROPIC_API_KEY`, go in `.env` at the root (ignored).

## Dependencies and the lock
- Local npm 11 can prune `package-lock.json` entries that the image's npm 10 `npm ci` needs. After any dependency
  change, check `git diff --stat package-lock.json`: a large deletion is pruning; keep the last lock that built and add
  only the new package's entries.

## Design docs (`docs/design/`)
- One doc per feature: `Status:`, then "Asked for on <date>:" quoting the request, the design, `## Decisions`, and an
  `## As built` section listing the files and tests once it is built. Later asks are quoted where they change it.
- Update the doc with the code. Workspace commits for them read "Design and record <feature>; <what else changed>".

## Hosting and deploys
- Magnetic runs on AWS (`infra/aws/magnetic.yml`, us-east-2): one host with Docker compose (`docker/`), RDS Postgres,
  secrets in SSM Parameter Store. Design: `docs/design/magnetic-hosting.md`.
- `node infra/aws/deploy.mjs` (after `aws sso login --profile magnetic`) builds the image from the working tree, so
  uncommitted changes ship and the tag says `-dirty`. `infra/aws/host-deploy.sh` writes the host's env, including the
  beta settings. Deploying is the owner's call: ask first.

## Commits
- Messages are one plain sentence of what changed and why, no prefix (`feat:` etc.), with detail in the body when
  needed.
