resource "google_artifact_registry_repository" "app" {
  location      = var.region
  repository_id = var.artifact_registry_id
  description   = "ai-invoice-assistant container images"
  format        = "DOCKER"

  depends_on = [google_project_service.enabled]
}

resource "google_sql_database_instance" "main" {
  name             = var.sql_instance_name
  database_version = "POSTGRES_17"
  region           = var.region
  project          = var.project_id

  deletion_protection = false

  settings {
    edition           = "ENTERPRISE"
    tier              = "db-f1-micro"
    availability_type = "ZONAL"
    disk_size         = 10
    disk_type         = "PD_SSD"
    disk_autoresize   = false

    backup_configuration {
      enabled = false
    }

    ip_configuration {
      ipv4_enabled = true
    }
  }

  timeouts {
    create = "30m"
    update = "30m"
    delete = "30m"
  }

  depends_on = [google_project_service.enabled]
}

resource "google_sql_database" "app" {
  name     = var.db_name
  instance = google_sql_database_instance.main.name
  charset  = "UTF8"
}

resource "random_password" "db" {
  length  = 32
  special = false
}

resource "google_sql_user" "app" {
  name     = var.db_user
  instance = google_sql_database_instance.main.name
  password = random_password.db.result
}

resource "google_storage_bucket" "invoices" {
  name                        = var.gcs_bucket
  location                    = var.region
  project                     = var.project_id
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  lifecycle_rule {
    action {
      type = "Delete"
    }
    condition {
      age = 90
    }
  }

  lifecycle_rule {
    action {
      type = "AbortIncompleteMultipartUpload"
    }
    condition {
      age = 7
    }
  }

  cors {
    origin          = concat(["http://localhost:3000", local.cloud_run_url], var.extra_cors_origins)
    method          = ["PUT", "OPTIONS"]
    response_header = ["Content-Type", "Content-Length"]
    max_age_seconds = 3600
  }

  depends_on = [google_project_service.enabled]
}

resource "google_secret_manager_secret" "app" {
  for_each  = local.secret_ids
  secret_id = each.key
  project   = var.project_id

  replication {
    user_managed {
      replicas {
        location = var.region
      }
    }
  }

  depends_on = [google_project_service.enabled]
}

# Cloud Run requires a version to exist when mounting :latest.
# Real values are added out-of-band; Terraform never updates this data.
resource "google_secret_manager_secret_version" "placeholder" {
  for_each = google_secret_manager_secret.app

  secret      = each.value.id
  secret_data = "UNSET"

  lifecycle {
    ignore_changes = [secret_data]
  }
}

resource "google_cloud_run_v2_service" "app" {
  name     = var.service_name
  location = var.region
  project  = var.project_id
  ingress  = "INGRESS_TRAFFIC_ALL"

  deletion_protection = false

  template {
    service_account                  = google_service_account.app.email
    timeout                          = "300s"
    max_instance_request_concurrency = 20

    scaling {
      max_instance_count = 2
    }

    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [google_sql_database_instance.main.connection_name]
      }
    }

    containers {
      image = var.image

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "1Gi"
        }
      }

      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }

      env {
        name  = "GCS_BUCKET"
        value = google_storage_bucket.invoices.name
      }
      env {
        name  = "GCS_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "AUTH_URL"
        value = local.cloud_run_url
      }
      env {
        name  = "AUTH_TRUST_HOST"
        value = "true"
      }
      env {
        name  = "LANGFUSE_BASE_URL"
        value = var.langfuse_base_url
      }
      env {
        name  = "LANGFUSE_TRACING_ENVIRONMENT"
        value = "production"
      }
      env {
        name  = "AI_PRIMARY_PROVIDER"
        value = "anthropic"
      }
      env {
        name  = "AI_FALLBACK_PROVIDER"
        value = "openai"
      }

      # Cloud Run rejects empty env values — omit until tfvars is filled in.
      dynamic "env" {
        for_each = {
          for k, v in {
            AUTH_GOOGLE_ID         = var.auth_google_id
            LANGFUSE_PUBLIC_KEY    = var.langfuse_public_key
            UPSTASH_REDIS_REST_URL = var.upstash_redis_rest_url
          } : k => v if v != ""
        }
        content {
          name  = env.key
          value = env.value
        }
      }

      # Secret values are created out-of-band. Cloud Run still references
      # :latest so the first revision after versions exist picks them up.
      dynamic "env" {
        for_each = {
          DATABASE_URL             = "database-url"
          AUTH_SECRET              = "auth-secret"
          AUTH_GOOGLE_SECRET       = "auth-google-secret"
          ANTHROPIC_API_KEY        = "anthropic-api-key"
          OPENAI_API_KEY           = "openai-api-key"
          LANGFUSE_SECRET_KEY      = "langfuse-secret-key"
          UPSTASH_REDIS_REST_TOKEN = "upstash-redis-rest-token"
        }
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.app[env.value].secret_id
              version = "latest"
            }
          }
        }
      }
    }
  }

  lifecycle {
    ignore_changes = [
      client,
      client_version,
      template[0].containers[0].image,
    ]
  }

  depends_on = [
    google_project_service.enabled,
    google_secret_manager_secret_version.placeholder,
    google_secret_manager_secret_iam_member.app_accessor,
    google_secret_manager_secret_iam_member.run_agent_accessor,
    google_project_iam_member.app_cloudsql,
    google_artifact_registry_repository.app,
  ]
}
