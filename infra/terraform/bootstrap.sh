#!/usr/bin/env bash
# Create the Terraform GCS backend bucket. Run once per project before `terraform init`.
set -euo pipefail

PROJECT="${PROJECT:-invoice-assistant-506013}"
REGION="${REGION:-europe-southwest1}"
BUCKET="${TF_STATE_BUCKET:-${PROJECT}-tfstate}"
ROOT="$(cd "$(dirname "$0")" && pwd)"

gcloud services enable storage.googleapis.com --project="$PROJECT"

if gcloud storage buckets describe "gs://${BUCKET}" --project="$PROJECT" >/dev/null 2>&1; then
  echo "State bucket already exists: gs://${BUCKET}"
else
  gcloud storage buckets create "gs://${BUCKET}" \
    --project="$PROJECT" \
    --location="$REGION" \
    --uniform-bucket-level-access
  echo "Created gs://${BUCKET}"
fi

gcloud storage buckets update "gs://${BUCKET}" --versioning --project="$PROJECT"

cat > "${ROOT}/backend.hcl" <<EOF
bucket = "${BUCKET}"
prefix = "terraform"
EOF

echo
echo "Next:"
echo "  cd ${ROOT}"
echo "  cp terraform.tfvars.example terraform.tfvars   # then edit project_id"
echo "  terraform init -backend-config=backend.hcl"
echo "  terraform apply"
