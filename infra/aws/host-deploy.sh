#!/bin/bash
# Runs on the Magnetic host as root, through Session Manager (infra/aws/deploy.mjs puts it in /opt/magnetic/docker with
# the compose files). Fetches the secrets, writes the two env files, makes sure the database has its extensions and the
# magnetic_app and magnetic_aggregate roles, then pulls the image and starts the stack.
#   host-deploy.sh <image> <database host> <master secret> <app password secret> <aggregate password secret> <secret key secret> <operator> <contact>
# No secret is printed: the env files are 0600 and the values never reach the command line of another process.
set -euo pipefail
IMAGE="$1" DB_HOST="$2" MASTER_SECRET="$3" APP_SECRET="$4" AGGREGATE_SECRET="$5" KEY_SECRET="$6" OPERATOR="$7" CONTACT="$8"
STACK_REGION=us-east-2
PARAM_REGION=us-east-1
export HOME=/root
cd /opt/magnetic/docker
umask 077

secret() { aws secretsmanager get-secret-value --region "$STACK_REGION" --secret-id "$1" --query SecretString --output text; }
param() { aws ssm get-parameter --region "$PARAM_REGION" --name "$1" --with-decryption --query Parameter.Value --output text; }
uri() { jq -rn --arg v "$1" '$v|@uri'; }

echo "== secrets"
MASTER_JSON=$(secret "$MASTER_SECRET")
MASTER_USER=$(jq -r .username <<<"$MASTER_JSON")
MASTER_PASS=$(jq -r .password <<<"$MASTER_JSON")
APP_PASS=$(secret "$APP_SECRET")
AGGREGATE_PASS=$(secret "$AGGREGATE_SECRET")
SECRET_KEY=$(secret "$KEY_SECRET")
LINKEDIN_ID=$(param /magnetic/linkedin-client-id)
LINKEDIN_SECRET=$(param /magnetic/linkedin-client-secret)
ANTHROPIC_KEY=$(param /magnetic/anthropic-api-key)
# Buying agent use after the allowance (docs/design/magnetic-payments.md): on only once both parameters are there
STRIPE_KEY=$(param /magnetic/stripe-secret-key 2>/dev/null || true)
STRIPE_WEBHOOK=$(param /magnetic/stripe-webhook-secret 2>/dev/null || true)
# Who reaches /admin: the emails in /magnetic/admin-emails (comma-separated), or else the privacy contact
ADMIN_EMAILS=$(param /magnetic/admin-emails 2>/dev/null || true)
ADMIN_EMAILS=${ADMIN_EMAILS:-$CONTACT}

echo "== the RDS certificate authority"
umask 022
curl -fsS -o rds-ca.pem "https://truststore.pki.rds.amazonaws.com/$STACK_REGION/$STACK_REGION-bundle.pem"
umask 077

# The servers connect as magnetic_app, which only reads people's state; the aggregate as magnetic_aggregate, which
# writes it (docs/design/statenet-network.md, S11). migrate --app-role and --aggregate-role grant them their tables
echo "== extensions and the magnetic_app and magnetic_aggregate roles"
export PGPASSWORD="$MASTER_PASS" PGSSLMODE=verify-full PGSSLROOTCERT=/opt/magnetic/docker/rds-ca.pem APP_PASS AGGREGATE_PASS
psql -h "$DB_HOST" -U "$MASTER_USER" -d magnetic -v ON_ERROR_STOP=1 -q <<'SQL'
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS ltree;
\getenv app_pass APP_PASS
SELECT format('CREATE ROLE magnetic_app LOGIN PASSWORD %L NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE', :'app_pass') WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'magnetic_app') \gexec
SELECT format('ALTER ROLE magnetic_app PASSWORD %L', :'app_pass') \gexec
\getenv aggregate_pass AGGREGATE_PASS
SELECT format('CREATE ROLE magnetic_aggregate LOGIN PASSWORD %L NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE', :'aggregate_pass') WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'magnetic_aggregate') \gexec
SELECT format('ALTER ROLE magnetic_aggregate PASSWORD %L', :'aggregate_pass') \gexec
SQL
unset PGPASSWORD

echo "== env files"
# For compose itself: the image, the host names and the three database URLs (the owner's only reaches migrate, the
# aggregate's only the aggregate)
cat > deploy.env <<EOF
MAGNETIC_IMAGE='$IMAGE'
MAGNETIC_ENV_FILE='magnetic.env'
MAGNETIC_HOST_NAME='magnetic.ai-minion.com'
MAGNETIC_RUNTIME_HOST_NAME='run.ai-minion.com'
MAGNETIC_EMBEDDING='local'
MAGNETIC_OWNER_DATABASE_URL='postgres://$(uri "$MASTER_USER"):$(uri "$MASTER_PASS")@$DB_HOST:5432/magnetic?sslmode=verify-full'
MAGNETIC_APP_DATABASE_URL='postgres://magnetic_app:$(uri "$APP_PASS")@$DB_HOST:5432/magnetic?sslmode=verify-full'
MAGNETIC_AGGREGATE_DATABASE_URL='postgres://magnetic_aggregate:$(uri "$AGGREGATE_PASS")@$DB_HOST:5432/magnetic?sslmode=verify-full'
EOF
# For the containers
cat > magnetic.env <<EOF
MAGNETIC_SECRET_KEY='$SECRET_KEY'
MAGNETIC_LINKEDIN_CLIENT_ID='$LINKEDIN_ID'
MAGNETIC_LINKEDIN_CLIENT_SECRET='$LINKEDIN_SECRET'
# LinkedIn takes PKCE only from apps it has enabled as native; a web app's code exchange with a verifier fails with
# invalid_client. The client secret, state and nonce still hold the flow
MAGNETIC_LINKEDIN_PKCE='false'
ANTHROPIC_API_KEY='$ANTHROPIC_KEY'
# The beta (docs/design/magnetic-beta.md): one org, beta, joined through the link on Admin; its first 100 members get
# $5 of agent use once, with no daily pace, and those after are told it is full. The server stops at $500 a month in
# all, the whole beta. Anyone else starts with none and may buy agent use when Stripe is on
MAGNETIC_USER_ALLOWANCE='5'
MAGNETIC_ALLOWANCE_USERS='100'
MAGNETIC_BETA_ORG='beta'
MAGNETIC_DAILY_BUDGET='off'
MAGNETIC_MONTHLY_BUDGET='500'
MAGNETIC_OPERATOR='$OPERATOR'
MAGNETIC_CONTACT_EMAIL='$CONTACT'
# The people whose verified email is listed see Admin on Your apps: feedback, people, and giving agent use
MAGNETIC_ADMIN_EMAILS='$ADMIN_EMAILS'
NODE_EXTRA_CA_CERTS='/etc/magnetic/rds-ca.pem'
# Invites are emailed through SES from the stack's mail domain; one SES refuses (the sandbox) still shows its link
MAGNETIC_MAIL_FROM='magnetic@ai-minion.com'
MAGNETIC_MAIL_REGION='$STACK_REGION'
EOF
if [ -n "$STRIPE_KEY" ] && [ -n "$STRIPE_WEBHOOK" ]; then
  printf "MAGNETIC_STRIPE_SECRET_KEY='%s'\nMAGNETIC_STRIPE_WEBHOOK_SECRET='%s'\n" "$STRIPE_KEY" "$STRIPE_WEBHOOK" >> magnetic.env
  echo "   agent use can be bought (Stripe)"
fi

echo "== the image"
# Each deploy's image is about 2 GB and the disk is 29 GB: drop the ones no container uses (the running stack's stays;
# every image is still in ECR to go back to) before pulling the new one
docker image prune --all --force | tail -1
aws ecr get-login-password --region "$STACK_REGION" | docker login --username AWS --password-stdin "${IMAGE%%/*}" >/dev/null
COMPOSE=(docker compose -p magnetic --env-file deploy.env -f magnetic.compose.yml -f magnetic.aws.compose.yml)
"${COMPOSE[@]}" pull --quiet migrate

echo "== the stack"
"${COMPOSE[@]}" up -d --no-build --remove-orphans
"${COMPOSE[@]}" ps --format '{{.Service}}: {{.Status}}'
echo "== migrate"
docker logs magnetic-migrate-1 2>&1 | tail -5
