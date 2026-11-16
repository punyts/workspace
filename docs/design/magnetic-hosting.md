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

### H2: the AWS stack (15 November 2026)
- **`infra/aws/magnetic.yml`**, the CloudFormation stack `magnetic` in `us-east-2`, made with the `magnetic` SSO
  profile (`aws cloudformation create-stack --stack-name magnetic --template-body file://infra/aws/magnetic.yml
  --capabilities CAPABILITY_NAMED_IAM`). It holds:
  - ECR `punyts/magnetic`, scanned on push, keeping the last 10 images.
  - Secrets Manager `magnetic/secret-key` and `magnetic/app-db-password`, generated; RDS keeps the master password in
    its own secret (`ManageMasterUserPassword`). The LinkedIn and Anthropic keys go in Parameter Store under
    `/magnetic/` by hand.
  - RDS `magnetic`: Postgres 16.15, db.t4g.micro, 20 GB gp3 growing to 100, encrypted, private, 7 days of backups
    (08:00 UTC), deletion protection, and a final snapshot if the stack is deleted.
  - The machine: Ubuntu 24.04 (the image pinned, so a stack update never replaces it by itself), t3.medium, 30 GB
    encrypted, IMDSv2 only, a 2 GB swap file; Docker 29, Compose 2.40, the AWS CLI and psql 16 from its user data. No
    SSH: Session Manager only. Its role `/magnetic/magnetic-host` is under `magnetic-workload-boundary`.
  - The Elastic IP and `A` records for `magnetic.ai-minion.com` and `run.ai-minion.com`. No certificate yet: Caddy
    gets them from Let's Encrypt when the stack is deployed (H3).
  - The log group `/magnetic`, 30 days.
- Checked: both names resolve to the Elastic IP; the machine is online in Session Manager and, through it, logs in
  to ECR and reaches the database with the master secret; RDS offers `vector` 0.8.2 and `ltree` 1.2; its master user
  is neither superuser nor `BYPASSRLS`, as expected.
- Found on the way: Git Bash turns a leading `/` in an argument into a Windows path, so AWS CLI calls with
  Parameter Store names (`/aws/service/...`) need `MSYS_NO_PATHCONV=1`.

### H3: the deploy (15 November 2026)
- **`node infra/aws/deploy.mjs`** builds the image, tags it `<commit>[-dirty]-<UTC minute>`, pushes it to ECR, and
  through Session Manager writes the compose files and `infra/aws/host-deploy.sh` to `/opt/magnetic/docker` and runs
  it. The host script fetches the secrets, downloads the RDS certificate authority, makes the `vector` and `ltree`
  extensions and the `magnetic_app` role (its password from `magnetic/app-db-password`, set again on every deploy),
  writes two 0600 env files, pulls, and runs `docker compose -p magnetic up -d`.
  - `deploy.env` is for compose only: the image, the host names and both database URLs. The owner's URL reaches
    `migrate` alone; the servers get `magnetic_app`'s.
  - `magnetic.env` is the containers': the secret key, LinkedIn, Anthropic, the budgets ($5 a month, $0.25 a day
    each), who runs the service, and `NODE_EXTRA_CA_CERTS`, so the database connections verify RDS
    (`sslmode=verify-full`).
  - `docker/magnetic.aws.compose.yml` mounts the authority and sends every container's log to CloudWatch `/magnetic`.
- **`/privacy`**: with `MAGNETIC_OPERATOR` and `MAGNETIC_CONTACT_EMAIL` set, Magnetic says what it keeps, why, who
  else sees it, how long, and how to have it deleted, without a sign-in. LinkedIn's app links to it.
- **The keys** are in Parameter Store in `us-east-1`, so the stack's `ParameterRegion` says where the host reads
  them. `infra/aws/put-secrets.sh` puts them there with hidden prompts.
- Checked: both names serve HTTPS with Let's Encrypt certificates; HTTP redirects to HTTPS; the sign-in page frames
  `https://run.ai-minion.com`; Caddy sets the `magnetic_server` cookie; a socket without a session is answered by
  Magnetic (400), and a post from another origin gets 403; the migrations ran as the owner and the servers run as
  `magnetic_app`; the relay is linked to the mesh; LinkedIn's redirect URI is the public one.
- Found on the way:
  - **Docker's Windows credential store refuses ECR's token** ("The stub received bad data"). The push uses a
    Docker config of its own, holding the login as `auths`, which keeps Docker from picking the store, and is deleted
    after.
  - **Session Manager runs commands with `sh`**, which has no `pipefail`; the host script runs under `bash`.
  - **Semantic search was off**: the image had no `@huggingface/transformers`, so `local` fell back to nothing. The
    Dockerfile now installs it (4.3.2, `--no-save`, so the workspace keeps it optional); the model is fetched on
    first use into the `models` volume. Checked in the local stack: `migrate` makes the index of
    `Xenova/all-MiniLM-L6-v2`, the servers embed with it, and each uses about 300 MB. The image is 2.05 GB.
  - **Two servers starting at once raced** to make Magnetic's own apps on the first request: one `/signin` failed
    with a revision conflict. They are now made under a Postgres advisory lock (`magnetic/src/storage/exclusive.ts`):
    one key for the system workspace (the page apps and the default editor, which share the theme) and one per person
    (their editor and home app). A server checks without the lock, and only when the app looks missing or old takes
    it, reads the parts again past its own index, and makes the app if it is still needed. `startupRace.test.ts`
    gets 500s without the lock; after the deploy, six simultaneous first requests all answered 200.
- **Signing in with LinkedIn took four fixes**, each found by making the log say what LinkedIn said:
  1. The redirect URL had to be added to the LinkedIn app's Auth tab, and the app needed the "Sign In with LinkedIn
     using OpenID Connect" product.
  2. **No PKCE.** With a code challenge, LinkedIn's code exchange failed with `invalid_client: Client authentication
     failed`, though the secret was right: LinkedIn takes PKCE only from apps it enabled as native. Off by default
     for LinkedIn now (`MAGNETIC_LINKEDIN_PKCE=true` turns it on).
  3. **No nonce.** LinkedIn's ID token has no `nonce` claim, so checking one failed (`JWT "nonce" claim missing`).
     Providers take `nonce: false`, and `linkedInProvider` sets it. State and the client secret hold the flow, as
     OpenID Connect allows for the code flow of a confidential client.
  4. The log now keeps what a provider said: its `error` and `error_description` on the callback and at the token
     endpoint, and which check of its response failed; never the response body, which may hold tokens.
  Checked: a person signed in with LinkedIn at `https://magnetic.ai-minion.com` (15 November 2026).
- **The restore drill** (15 November 2026): `magnetic` restored to its latest restorable point, 20:58:33 UTC (after
  the first person signed in at 20:56:41), as `magnetic-restore-drill`, in the same subnets and security group. It
  took 10 minutes. `infra/aws/restore-check.sh`, run on the host, counts what a database holds (it names every
  workspace, as row-level security holds the master user too), and printed the same as for the live database:
  10 migrations, 1 person with a LinkedIn identity, 1 session, 32 parts, 2 embeddings. `magnetic_app` logs in to the
  copy and is held by row-level security there as on the live one. The copy was deleted after, without a snapshot.
  - RDS ships its transaction log every few minutes, so the latest restorable point trails by up to about 5
    minutes: a restore can lose that much.
  - To switch to a restored copy: point `DB_HOST` in a deploy at its endpoint (or rename the instances) and deploy.

## Decisions (15 November 2026)
1. **This shape:** one EC2 machine with Compose, Caddy and RDS, about $50 a month, over ECS Fargate with an ALB
   (about $120), which pays off only when one machine is not enough.
2. **CloudFormation**, with `cloudformation:*` added to `infra/aws/magnetic-deployer-policy.json` (to paste into the
   permission set before H2), over plain AWS CLI scripts with no single teardown.
3. **Anyone with LinkedIn may sign in** for the test, held by the budgets, over a waitlist.
