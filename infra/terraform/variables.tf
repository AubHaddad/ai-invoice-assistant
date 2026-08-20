variable "project_id" {
  description = "GCP project that will own all resources."
  type        = string
}

variable "region" {
  description = "Region for Cloud Run, Cloud SQL, Artifact Registry, and the bucket."
  type        = string
  default     = "europe-southwest1"
}

variable "service_name" {
  description = "Cloud Run service name."
  type        = string
  default     = "ai-invoice-assistant"
}

variable "artifact_registry_id" {
  description = "Artifact Registry repository ID."
  type        = string
  default     = "app"
}

variable "image" {
  description = "Container image for Cloud Run. Placeholder so apply works before the first build."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "sql_instance_name" {
  description = "Cloud SQL instance name."
  type        = string
  default     = "invoice-assistant-pg"
}

variable "db_name" {
  description = "PostgreSQL database name."
  type        = string
  default     = "ai_invoice_assistant"
}

variable "db_user" {
  description = "PostgreSQL user name."
  type        = string
  default     = "postgres"
}

variable "gcs_bucket" {
  description = "Invoice upload bucket. Must be globally unique."
  type        = string
  default     = "invoices-ai-assistant"
}

variable "auth_google_id" {
  description = "Google OAuth client ID (public). Empty until OAuth is configured."
  type        = string
  default     = ""
}

variable "langfuse_public_key" {
  description = "Langfuse public key. Empty until tracing is configured."
  type        = string
  default     = ""
}

variable "langfuse_base_url" {
  description = "Langfuse host."
  type        = string
  default     = "https://cloud.langfuse.com"
}

variable "upstash_redis_rest_url" {
  description = "Upstash Redis REST URL (token is a secret). Empty until Redis is configured."
  type        = string
  default     = ""
}

variable "extra_cors_origins" {
  description = "Additional browser origins allowed to PUT to the invoice bucket."
  type        = list(string)
  default     = []
}
