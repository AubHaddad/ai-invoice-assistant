# Fresh project:
#   PROJECT=... bash bootstrap.sh
#   cp terraform.tfvars.example terraform.tfvars   # edit project_id
#   terraform init -backend-config=backend.hcl
#   terraform apply
# Secret values: terraform output -raw db_password, then infra/create-secrets.sh
terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Bucket is created by bootstrap.sh, then:
  #   terraform init -backend-config=backend.hcl
  backend "gcs" {}
}

provider "google" {
  project = var.project_id
  region  = var.region
}
