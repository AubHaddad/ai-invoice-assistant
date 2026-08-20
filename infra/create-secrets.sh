#!/usr/bin/env bash
# Create Secret Manager secrets from local .env + Cloud SQL password.
# Prints secret names only — never values.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PROJECT="${PROJECT:-invoice-assistant-506013}"
REGION="${REGION:-europe-southwest1}"
SA="${SA:-invoice-assistant-app-sa@${PROJECT}.iam.gserviceaccount.com}"
INSTANCE="${INSTANCE:-invoice-assistant-pg}"
CONNECTION_NAME="${PROJECT}:${REGION}:${INSTANCE}"
ENV_FILE="${ENV_FILE:-.env}"
SQL_PASSWORD_FILE="${SQL_PASSWORD_FILE:-.cloudsql-postgres-password}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE" >&2
  exit 1
fi
if [[ ! -f "$SQL_PASSWORD_FILE" ]]; then
  echo "Missing $SQL_PASSWORD_FILE" >&2
  exit 1
fi

get_env() {
  local key="$1"
  python3 - "$ENV_FILE" "$key" <<'PY'
import sys
path, key = sys.argv[1], sys.argv[2]
value = ""
with open(path) as fh:
    for raw in fh:
        line = raw.rstrip("\n")
        if line.startswith(key + "="):
            value = line[len(key) + 1 :]
print(value, end="")
PY
}

urlencode() {
  python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.stdin.read(), safe=''), end='')"
}

DB_PASS="$(tr -d '\n' < "$SQL_PASSWORD_FILE")"
DB_PASS_ENC="$(printf '%s' "$DB_PASS" | urlencode)"
DATABASE_URL="postgresql://postgres:${DB_PASS_ENC}@/ai_invoice_assistant?host=/cloudsql/${CONNECTION_NAME}"
DATABASE_URL_PROXY="postgresql://postgres:${DB_PASS_ENC}@127.0.0.1:5432/ai_invoice_assistant"

upsert_secret() {
  local name="$1"
  local value="$2"

  if [[ -z "$value" ]]; then
    echo "SKIP ${name} (empty)"
    return
  fi

  if gcloud secrets describe "$name" --project="$PROJECT" >/dev/null 2>&1; then
    printf '%s' "$value" | gcloud secrets versions add "$name" \
      --data-file=- \
      --project="$PROJECT" \
      --quiet
    echo "UPDATED ${name}"
  else
    printf '%s' "$value" | gcloud secrets create "$name" \
      --data-file=- \
      --replication-policy=user-managed \
      --locations="$REGION" \
      --project="$PROJECT" \
      --quiet
    echo "CREATED ${name}"
  fi

  gcloud secrets add-iam-policy-binding "$name" \
    --member="serviceAccount:${SA}" \
    --role="roles/secretmanager.secretAccessor" \
    --project="$PROJECT" \
    --quiet >/dev/null
  echo "GRANTED ${name} -> ${SA}"
}

upsert_secret database-url "$DATABASE_URL"
upsert_secret database-url-proxy "$DATABASE_URL_PROXY"
upsert_secret auth-secret "$(get_env AUTH_SECRET)"
upsert_secret auth-google-secret "$(get_env AUTH_GOOGLE_SECRET)"
upsert_secret anthropic-api-key "$(get_env ANTHROPIC_API_KEY)"
upsert_secret openai-api-key "$(get_env OPENAI_API_KEY)"
upsert_secret langfuse-secret-key "$(get_env LANGFUSE_SECRET_KEY)"
upsert_secret upstash-redis-rest-token "$(get_env UPSTASH_REDIS_REST_TOKEN)"

echo ""
echo "Secrets in ${PROJECT}:"
gcloud secrets list --project="$PROJECT" --format="table(name,replication.userManaged.replicas[0].location)"
