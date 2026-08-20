output "cloud_run_url" {
  description = "Predicted default Cloud Run URL (also used as AUTH_URL)."
  value       = local.cloud_run_url
}

output "cloud_run_service" {
  value = google_cloud_run_v2_service.app.name
}

output "artifact_registry" {
  value = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.app.repository_id}"
}

output "sql_connection_name" {
  value = google_sql_database_instance.main.connection_name
}

output "db_name" {
  value = google_sql_database.app.name
}

output "db_user" {
  value = google_sql_user.app.name
}

output "db_password" {
  description = "Cloud SQL user password. Use with infra/create-secrets.sh (DATABASE_URL)."
  value       = random_password.db.result
  sensitive   = true
}

output "gcs_bucket" {
  value = google_storage_bucket.invoices.name
}

output "app_service_account" {
  value = google_service_account.app.email
}

output "github_actions_service_account" {
  value = google_service_account.github_actions.email
}

output "secret_ids" {
  value = sort([for s in google_secret_manager_secret.app : s.secret_id])
}
