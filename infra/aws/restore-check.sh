#!/bin/bash
# Runs on the Magnetic host through Session Manager, after a restore drill (docs/design/magnetic-hosting.md): counts what a database holds, so a restored copy can
# be compared with the live one. Prints counts and times only, never anyone's data.
#   restore-check.sh <database host> <master secret>
set -euo pipefail
DB_HOST="$1" MASTER_SECRET="$2"
S=$(aws secretsmanager get-secret-value --region us-east-2 --secret-id "$MASTER_SECRET" --query SecretString --output text)
export PGUSER=$(jq -r .username <<<"$S") PGPASSWORD=$(jq -r .password <<<"$S") PGSSLMODE=verify-full PGSSLROOTCERT=/opt/magnetic/docker/rds-ca.pem
psql -h "$DB_HOST" -d magnetic -v ON_ERROR_STOP=1 -tA -F ' ' <<'SQL'
-- Row-level security holds the master user too: name every workspace, the people's, the orgs' and the system's
SELECT set_config('app.workspace_ids', concat_ws(',', (SELECT string_agg(id::text, ',') FROM app_user), (SELECT string_agg(id::text, ',') FROM org), '00000000-0000-4000-8000-000000000000'), false) IS NOT NULL AS scoped;
SELECT 'migrations', count(*) FROM schema_migration;
SELECT 'people', count(*) FROM app_user;
SELECT 'identities', provider, count(*) FROM identity GROUP BY provider;
SELECT 'sessions', count(*) FROM session;
SELECT 'parts', kind, count(*) FROM part GROUP BY kind ORDER BY kind;
SELECT 'embeddings', count(*) FROM embedding;
SELECT 'newest person', to_char(max(created_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') FROM app_user;
SQL
