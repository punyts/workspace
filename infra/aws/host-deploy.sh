#!/bin/bash
# Runs on the Magnetic host as root, through Session Manager (infra/aws/deploy.mjs puts it in /opt/magnetic/docker with
# the compose files). Fetches the secrets, writes the two env files, makes sure the database has its extensions and the
# magnetic_app role, then pulls the image and starts the stack.
#   host-deploy.sh <image> <database host> <master secret> <app password secret> <secret key secret> <operator> <contact>
# No secret is printed: the env files are 0600 and the values never reach the command line of another process.
set -euo pipefail
IMAGE="$1" DB_HOST="$2" MASTER_SECRET="$3" APP_SECRET="$4" KEY_SECRET="$5" OPERATOR="$6" CONTACT="$7"
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
SECRET_KEY=$(secret "$KEY_SECRET")
LINKEDIN_ID=$(param /magnetic/linkedin-client-id)
LINKEDIN_SECRET=$(param /magnetic/linkedin-client-secret)
ANTHROPIC_KEY=$(param /magnetic/anthropic-api-key)

echo "== the RDS certificate authority"
umask 022
curl -fsS -o rds-ca.pem "https://truststore.pki.rds.amazonaws.com/$STACK_REGION/$STACK_REGION-bundle.pem"
umask 077

echo "== extensions and the magnetic_app role"
export PGPASSWORD="$MASTER_PASS" PGSSLMODE=verify-full PGSSLROOTCERT=/opt/magnetic/docker/rds-ca.pem APP_PASS
psql -h "$DB_HOST" -U "$MASTER_USER" -d magnetic -v ON_ERROR_STOP=1 -q <<'SQL'
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS ltree;
\getenv app_pass APP_PASS
SELECT format('CREATE ROLE magnetic_app LOGIN PASSWORD %L NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE', :'app_pass') WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'magnetic_app') \gexec
SELECT format('ALTER ROLE magnetic_app PASSWORD %L', :'app_pass') \gexec
SQL
unset PGPASSWORD

echo "== env files"
# For compose itself: the image, the host names and the two database URLs (the owner's only reaches migrate)
cat > deploy.env <<EOF
MAGNETIC_IMAGE='$IMAGE'
MAGNETIC_ENV_FILE='magnetic.env'
MAGNETIC_HOST_NAME='magnetic.ai-minion.com'
MAGNETIC_RUNTIME_HOST_NAME='run.ai-minion.com'
MAGNETIC_EMBEDDING='local'
MAGNETIC_OWNER_DATABASE_URL='postgres://$(uri "$MASTER_USER"):$(uri "$MASTER_PASS")@$DB_HOST:5432/magnetic?sslmode=verify-full'
MAGNETIC_APP_DATABASE_URL='postgres://magnetic_app:$(uri "$APP_PASS")@$DB_HOST:5432/magnetic?sslmode=verify-full'
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
MAGNETIC_MONTHLY_BUDGET='5'
MAGNETIC_DAILY_BUDGET='0.25'
MAGNETIC_OPERATOR='$OPERATOR'
MAGNETIC_CONTACT_EMAIL='$CONTACT'
NODE_EXTRA_CA_CERTS='/etc/magnetic/rds-ca.pem'
EOF

echo "== the image"
aws ecr get-login-password --region "$STACK_REGION" | docker login --username AWS --password-stdin "${IMAGE%%/*}" >/dev/null
COMPOSE=(docker compose -p magnetic --env-file deploy.env -f magnetic.compose.yml -f magnetic.aws.compose.yml)
"${COMPOSE[@]}" pull --quiet migrate

echo "== the stack"
"${COMPOSE[@]}" up -d --no-build --remove-orphans
"${COMPOSE[@]}" ps --format '{{.Service}}: {{.Status}}'
echo "== migrate"
docker logs magnetic-migrate-1 2>&1 | tail -5
