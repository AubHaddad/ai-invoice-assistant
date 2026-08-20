#!/usr/bin/env bash
# Apply Drizzle migrations to Cloud SQL via the Auth Proxy.
# Never prints DATABASE_URL.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PROJECT="${PROJECT:-invoice-assistant-506013}"
REGION="${REGION:-europe-southwest1}"
INSTANCE="${INSTANCE:-invoice-assistant-pg}"
CONNECTION_NAME="${PROJECT}:${REGION}:${INSTANCE}"
PROXY_PORT="${PROXY_PORT:-5433}"

if ! command -v cloud-sql-proxy >/dev/null 2>&1; then
  echo "cloud-sql-proxy is not installed. Run:" >&2
  echo "  brew install cloud-sql-proxy" >&2
  exit 1
fi

DATABASE_URL="$(gcloud secrets versions access latest --secret=database-url-proxy --project="$PROJECT")"
DATABASE_URL="${DATABASE_URL/127.0.0.1:5432/127.0.0.1:${PROXY_PORT}}"
export DATABASE_URL

PROXY_AUTH_FLAGS=()
if [[ -z "${CI:-}" ]]; then
  PROXY_AUTH_FLAGS+=(--gcloud-auth)
fi

cloud-sql-proxy "$CONNECTION_NAME" --port="$PROXY_PORT" "${PROXY_AUTH_FLAGS[@]}" --quiet &
PROXY_PID=$!
cleanup() {
  kill "$PROXY_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Waiting for Cloud SQL Auth Proxy on 127.0.0.1:${PROXY_PORT}..."
for _ in $(seq 1 30); do
  if (echo >/dev/tcp/127.0.0.1/"$PROXY_PORT") >/dev/null 2>&1; then
    echo "Proxy is up."
    npm run db:migrate
    echo "Cloud SQL migrations finished."
    exit 0
  fi
  sleep 1
done

echo "Cloud SQL Auth Proxy did not become ready on port ${PROXY_PORT}." >&2
exit 1
