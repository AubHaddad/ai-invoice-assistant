#!/usr/bin/env bash
# Create or update the Cloud Run service with Cloud SQL + Secret Manager.
# Requires a pushed image: IMAGE=europe-southwest1-docker.pkg.dev/PROJECT/app/ai-invoice-assistant:latest
set -euo pipefail

PROJECT="${PROJECT:-invoice-assistant-506013}"
REGION="${REGION:-europe-southwest1}"
SERVICE="${SERVICE:-ai-invoice-assistant}"
SA="${SA:-invoice-assistant-app-sa@${PROJECT}.iam.gserviceaccount.com}"
INSTANCE="${PROJECT}:${REGION}:invoice-assistant-pg"
IMAGE="${IMAGE:-}"

if [[ -z "$IMAGE" ]]; then
  echo "No Cloud Run service exists until an image is built and IMAGE is set." >&2
  echo "Example:" >&2
  echo "  export IMAGE=europe-southwest1-docker.pkg.dev/${PROJECT}/app/ai-invoice-assistant:latest" >&2
  echo "  bash infra/configure-cloud-run.sh" >&2
  exit 1
fi

get_env() {
  python3 - ".env" "$1" <<'PY'
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

gcloud run deploy "$SERVICE" \
  --project="$PROJECT" \
  --region="$REGION" \
  --image="$IMAGE" \
  --service-account="$SA" \
  --add-cloudsql-instances="$INSTANCE" \
  --allow-unauthenticated \
  --max-instances=2 \
  --concurrency=20 \
  --cpu=1 \
  --memory=1Gi \
  --timeout=300 \
  --port=8080 \
  --set-secrets="DATABASE_URL=database-url:latest,AUTH_SECRET=auth-secret:latest,AUTH_GOOGLE_SECRET=auth-google-secret:latest,ANTHROPIC_API_KEY=anthropic-api-key:latest,OPENAI_API_KEY=openai-api-key:latest,LANGFUSE_SECRET_KEY=langfuse-secret-key:latest,UPSTASH_REDIS_REST_TOKEN=upstash-redis-rest-token:latest" \
  --set-env-vars="GCS_BUCKET=invoices-ai-assistant,GCS_PROJECT_ID=${PROJECT},LANGFUSE_TRACING_ENVIRONMENT=production,AUTH_URL=https://ai-invoice-assistant-33478828660.europe-southwest1.run.app,AUTH_TRUST_HOST=true,AUTH_GOOGLE_ID=$(get_env AUTH_GOOGLE_ID),LANGFUSE_PUBLIC_KEY=$(get_env LANGFUSE_PUBLIC_KEY),LANGFUSE_BASE_URL=$(get_env LANGFUSE_BASE_URL),UPSTASH_REDIS_REST_URL=$(get_env UPSTASH_REDIS_REST_URL),AI_PRIMARY_PROVIDER=anthropic,AI_FALLBACK_PROVIDER=openai"
