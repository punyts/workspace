# Magnetic hosting (M7)

Magnetic on AWS under `ai-minion.com`, for the LinkedIn test: two public origins over HTTPS, the statenet stack of
two servers and a relay, Postgres with backups, sign-in with LinkedIn, and a hard limit on AI spend. This is M7 of
`magnetic-v1.md`, updated for what was built since: storage moved to Postgres (`magnetic-postgres.md`) and the
servers became nodes of the statenet (`statenet-relays.md`).

## What is there today
| Piece | State |
|---|---|
| AWS account | `047947909044`, reached through the `magnetic` SSO profile with the `MagneticDeployer` permission set (`infra/aws/`) |
| Network | Only the default VPC in `us-east-2`; nothing in `us-east-1` |
| DNS | `ai-minion.com` is a Route 53 zone in the account. The apex and `www` are taken; `magnetic` and `run` are free |
| Image | `docker/Dockerfile` builds Magnetic and the relay; no Chromium (`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`) |
| Topology | `docker/statenet.compose.yml`: Postgres, migrate, two servers, a relay certificate, a relay. Local ports only |
| Origins | The runtime origin is built as `http://<Host>:<runtime port>` (`startMagnetic.ts` `runtimeOriginOf`, `HttpServer.ts` `runtimeRoute`), so it cannot be `https://run.ai-minion.com` yet |
| Budgets | `MAGNETIC_DAILY_BUDGET` per user per day, `MAGNETIC_MONTHLY_BUDGET` for the server per month |
| Invites | Org invites exist (`/invites/<token>`, once, 7 days, verified email). There is no gate on who may sign up |

## The shape
```
                 Route 53: magnetic.ai-minion.com, run.ai-minion.com  ->  Elastic IP
                                          |
  EC2 t3.medium, us-east-2, default VPC, Docker Compose, SSM Session Manager (no SSH)
   ├─ caddy        :443  TLS from Let's Encrypt; magnetic.* -> servers :4300, run.* -> servers :4301
   ├─ magnetic-1   :4300 pages and sockets, :4301 runtime, :4310 mesh
   ├─ magnetic-2   the same, a second node
   └─ relay-1      links to the mesh; not public in M7
                                          |
  RDS Postgres 16 db.t4g.micro with pgvector, private, 7 days of backups and point-in-time restore
  SSM Parameter Store (SecureString): secret key, LinkedIn client, Anthropic key, database URL
  ECR: punyts/magnetic, built here and pushed; the instance pulls it
```

Why this shape:
- **One machine with Compose, not ECS.** The stack already runs as a compose file, and the mesh wants nodes that know
  each other's addresses. ECS can come when one machine is not enough; the servers already share the database, so
  moving them changes no data.
- **Caddy, not a load balancer.** It gets the certificates by itself and costs nothing; an ALB is about $18 a month.
  The servers tunnel a view to whichever server runs the instance, so Caddy needs no sticky sessions.
- **RDS, not Postgres in a container.** Everything Magnetic keeps is in the database, uploaded files included, so the
  "backup of the volume" of `magnetic-v1.md` becomes RDS's automated backups. RDS has pgvector, and its master user is
  not a true superuser, so row-level security holds; Magnetic still connects as its own role (below).
- **`us-east-2`.** Close to you, and it has a default VPC to start in. The certificates come from Let's Encrypt, so
  nothing needs `us-east-1`.
- **About $50 a month:** t3.medium $30, RDS $13 plus 20 GB $2.30, Elastic IP $3.60, the rest pennies.

## Code changes (H1)
1. **Public origins.** `MAGNETIC_RUNTIME_ORIGIN` (`--runtime-origin`) beside `MAGNETIC_PUBLIC_ORIGIN`. When both are
   set, the pages put the runtime origin in the frame URL and the host page's policy, and the runtime page's policy
   names the public origin, instead of building `http://<Host>:<port>`. Unset, it behaves as today.
2. **Allowed hosts.** With public origins set, a request whose `Host` is neither origin's host (nor loopback, for a
   health check on the machine) gets 403, so a server bound to `0.0.0.0` answers only to its own names. Caddy keeps
   `Host` as sent.
3. **Behind a proxy.** Cookies are already `Secure` when the public origin is HTTPS. The servers do not read
   `X-Forwarded-*` for anything else; the check is that redirects and the OIDC callback use the public origin.
4. **The application role.** `magnetic migrate` creates `magnetic_app` (no superuser, no `BYPASSRLS`) and grants it the
   tables; the servers connect as it, migrate and `reindex` as the owner.
5. **`docker/magnetic.compose.yml`**, the hosted stack: the compose file above without `db` and `migrate`, with Caddy,
   `MAGNETIC_EMBEDDING=local` and a volume for the model cache, environment from a file the instance writes from
   Parameter Store, and `restart: unless-stopped`.

Not in M7: **Chromium.** The agent's browser tools are withheld until one shared browser can sign in
(`magnetic/README.md`, "Not yet"); the image stays without it, and it comes back with that work.

## AWS (H2)
Kept as one CloudFormation template, `infra/aws/magnetic.yml`, so the whole thing is made, changed and removed as a
stack. The `MagneticDeployer` permission set needs `cloudformation:*` in the two regions for that (a line in
`infra/aws/magnetic-deployer-policy.json`, which you then paste into the permission set).

- Security groups: the instance takes 80 and 443 from anywhere and nothing else; the database takes 5432 from the
  instance only.
- The instance role `/magnetic/magnetic-host`, under `magnetic-workload-boundary`: pull from ECR, read
  `/magnetic/*` parameters, Session Manager, logs.
- Parameters you put in by hand (I never see them): `/magnetic/linkedin-client-id`, `/magnetic/linkedin-client-secret`,
  `/magnetic/anthropic-api-key`. The stack makes `/magnetic/secret-key` and the database password itself.
- DNS: `A` records for `magnetic` and `run` to the Elastic IP. The apex and `www` are left alone.

## Deploy and launch (H3, H4)
- `infra/aws/deploy.mjs`: build the image, push it to ECR, and on the instance (through SSM) pull, migrate, and
  `docker compose up -d`. Plain Node, like the workspace scripts.
- LinkedIn: add `https://magnetic.ai-minion.com/auth/linkedin/callback` to the app's redirect URLs (you).
- AI spend: `MAGNETIC_MONTHLY_BUDGET=5` and `MAGNETIC_DAILY_BUDGET=0.25`, and a $10 monthly limit on the Anthropic
  key as the backstop (you, in the Anthropic console).
- Who may sign in: see the decisions.
- Before the post: a restore drill (restore the latest backup to a new instance and sign in to it), then the post.

## Checks
- **H1:** the compose stack runs locally behind Caddy with two host names (`magnetic.localhost`, `run.localhost`):
  sign in with the mock provider, open an app, and the frame loads from the run origin; a request with another `Host`
  gets 421; a frame script cannot read the session cookie; the servers' role cannot see another workspace's rows.
- **H2:** `https://magnetic.ai-minion.com` and `https://run.ai-minion.com` answer with valid certificates; port 5432
  and the mesh ports are closed from outside; the instance reads its parameters and nothing else.
- **H3:** LinkedIn sign-in end to end; `docker/check.mjs` against the hosted servers; stop `magnetic-1` and a view on
  it comes back on `magnetic-2`; the restore drill.

## As built
### H1: the server behind a proxy (15 November 2026)
- **`--runtime-origin`** (`MAGNETIC_RUNTIME_ORIGIN`) beside `--public-origin`. stateui-mcp's `startHttpServer` takes
  `publicOrigins: { main, runtime }`: the app and sign-in pages frame `<runtime>/runtime/<hash>.html` and name it in
  `frame-src`, and the runtime page names `<main>` in `frame-ancestors`. Magnetic refuses a runtime origin without a
  public origin, or on the same host as it, where an app could reach the session cookie.
- **The host check.** With public origins, `isPublicHost` answers their two host names and loopback, on both ports
  and on the sockets; any other `Host` gets 403. Without them, the loopback check of before is unchanged.
- **`magnetic migrate --app-role magnetic_app`** grants the role the rows of every table in the schema, the
  sequences and the functions, after the migrations (stateui-pg `grantAppRole`). It refuses a role that does not
  exist, or a superuser or `BYPASSRLS` one. The role is made outside the migrations, with its password: in the local
  stack by `docker/initdb-local/roles.sql`, on RDS by the deploy.
- **`docker/magnetic.compose.yml`** and **`docker/Caddyfile`**: Caddy in front of two servers and the relay; the
  servers connect as `magnetic_app` and `migrate` as the owner. `--profile local` adds Postgres, and
  `docker/magnetic.local.env` puts it on `magnetic.localhost` and `run.localhost` at port 8443, with Caddy's own
  certificates.
- Found on the way:
  - **A sign-in with a provider is kept in the memory of the server that began it** (`OidcSignIn.pending`), so the
    callback must reach the same server. Caddy is sticky by cookie (`magnetic_server`) on the pages' origin; the
    runtime origin needs no stickiness.
  - **The tests run as a superuser**, which row-level security does not hold. Magnetic's whole suite passes as a
    non-superuser role (`PUNYTS_TEST_DATABASE_URL` with such a user), and `appRole.test.ts` runs a server as a
    granted role that owns nothing: it signs people in, sees no rows outside a transaction that names its
    workspaces, and cannot change the schema.
  - **The search index of a model was made on first use**, by the server: DDL only the table's owner may run, so as
    `magnetic_app` every embedding failed ("must be owner of table embedding"). `magnetic migrate` now makes the index
    of the configured model (`MAGNETIC_EMBEDDING`), and `EmbeddingIndex.ensureIndex` looks for it before making it.
  - **Checked through Caddy** on `magnetic.localhost` and `run.localhost`: the sign-in page frames
    `https://run.localhost:8443`, the runtime page lets only `https://magnetic.localhost:8443` frame it, Caddy sets
    the `magnetic_server` cookie, and `docker/check.mjs` over HTTPS and `wss:` passes all four checks (an app made,
    written, and seen and written through the other server). Not checked in a browser: Caddy's local certificates
    are not trusted by one without installing its authority.
  - **`reindex` and `import` read every workspace**, which only a superuser or a `BYPASSRLS` role can. RDS's master
    user is neither, so on RDS they need a maintenance role with `BYPASSRLS`, made when they are first needed. Neither
    is needed to launch.

## Decisions (15 November 2026)
1. **This shape:** one EC2 machine with Compose, Caddy and RDS, about $50 a month, over ECS Fargate with an ALB
   (about $120), which pays off only when one machine is not enough.
2. **CloudFormation**, with `cloudformation:*` added to `infra/aws/magnetic-deployer-policy.json` (to paste into the
   permission set before H2), over plain AWS CLI scripts with no single teardown.
3. **Anyone with LinkedIn may sign in** for the test, held by the budgets, over a waitlist.
