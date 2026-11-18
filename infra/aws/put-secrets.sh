#!/usr/bin/env bash
# Puts the keys Magnetic needs into Parameter Store as SecureStrings (docs/design/magnetic-hosting.md, H3).
# They go to us-east-1, where infra/aws/host-deploy.sh reads them (PARAM_REGION); the stack itself is in us-east-2.
# It asks for each value without showing it, so the values never reach the screen, a file or the shell history.
#   bash infra/aws/put-secrets.sh
# Press Enter on a prompt to leave that parameter as it is.
set -euo pipefail
export MSYS_NO_PATHCONV=1 AWS_PROFILE="${AWS_PROFILE:-magnetic}" AWS_REGION="${AWS_REGION:-us-east-1}"

aws sts get-caller-identity --query Arn --output text >/dev/null || {
    echo "Not signed in to AWS: run  aws sso login --profile magnetic  and try again" >&2
    exit 1
}

put() {
    local name="$1" label="$2" value
    read -r -s -p "$label (hidden; Enter to skip): " value
    echo
    if [ -z "$value" ]; then
        echo "  skipped $name"
        return
    fi
    aws ssm put-parameter --name "$name" --type SecureString --overwrite --value "$value" --query Version --output text >/dev/null
    echo "  saved $name"
}

put /magnetic/linkedin-client-id "LinkedIn client ID"
put /magnetic/linkedin-client-secret "LinkedIn client secret"
put /magnetic/anthropic-api-key "Anthropic API key"
# Optional: buying agent use turns on once both Stripe values are there (docs/design/magnetic-payments.md)
put /magnetic/stripe-secret-key "Stripe secret key"
put /magnetic/stripe-webhook-secret "Stripe webhook signing secret"
# Optional: the verified emails that may open /admin, comma separated
put /magnetic/admin-emails "Admin emails"
echo "Done. Parameter Store now has:"
aws ssm describe-parameters --parameter-filters Key=Name,Option=BeginsWith,Values=/magnetic/ --query "Parameters[].Name" --output text | tr '\t' '\n' | sed 's/^/  /'
