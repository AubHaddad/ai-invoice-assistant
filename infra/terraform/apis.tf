locals {
  apis = toset([
    "artifactregistry.googleapis.com",
    "run.googleapis.com",
    "sqladmin.googleapis.com",
    "secretmanager.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "compute.googleapis.com",
    "storage.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "serviceusage.googleapis.com",
    "cloudbuild.googleapis.com",
  ])

  # Secret shells only — versions are added out-of-band (infra/create-secrets.sh).
  secret_ids = toset([
    "database-url",
    "database-url-proxy",
    "auth-secret",
    "auth-google-secret",
    "anthropic-api-key",
    "openai-api-key",
    "langfuse-secret-key",
    "upstash-redis-rest-token",
  ])

  cloud_run_url = "https://${var.service_name}-${data.google_project.current.number}.${var.region}.run.app"
}

data "google_project" "current" {
  project_id = var.project_id
}

resource "google_project_service" "enabled" {
  for_each = local.apis

  project            = var.project_id
  service            = each.key
  disable_on_destroy = false
}
