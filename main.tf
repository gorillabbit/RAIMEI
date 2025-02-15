provider "google" {
  project = var.PROJECT_ID
  region  = var.REGION
}

resource "google_secret_manager_secret_iam_member" "github_webhook_secret_access" {
  secret_id = google_secret_manager_secret.github_webhook_secret.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:661241735961-compute@developer.gserviceaccount.com"
}


resource "google_project_iam_member" "secret_manager_secret_accessor" {
  project = var.PROJECT_ID
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:661241735961-compute@developer.gserviceaccount.com"
}

resource "google_project_iam_member" "cloudbuild_iam" {
  for_each = toset([
    "roles/run.admin",
    "roles/iam.serviceAccountUser",
    "roles/secretmanager.secretAccessor",
  ])
  role    = each.key
  member  = "serviceAccount:661241735961-compute@developer.gserviceaccount.com"
  project = var.PROJECT_ID
}

resource "google_cloudbuildv2_connection" "github_connection" {
  location = var.REGION
  name = "github-connection"

  github_config {
    app_installation_id = var.github_app_installation_id
    authorizer_credential {
      oauth_token_secret_version = var.github_oauth_token_secret_version
    }
  }
}

resource "google_cloudbuildv2_repository" "github_repository" {
  name = "github-repository"
  parent_connection = google_cloudbuildv2_connection.github_connection.id
  remote_uri = "http://github.com/gorillabbit/RAIMEI"
}


resource "google_cloud_run_service" "raimei" {
  name     = "raimei-service"
  location = var.REGION

  autogenerate_revision_name = true  # 追加

  template {
    spec {
      containers {
        image = "gcr.io/raimei-450611/raimei:latest"
        ports {
          container_port = 8000
        }
        env {
          name  = "GEMINI_API_KEY"
          value = var.GEMINI_API_KEY
        }
        env {
          name = "GITHUB_WEBHOOK_SECRET"
          value_from {
            secret_key_ref {
              name = "GITHUB_WEBHOOK_SECRET"  # Secret Manager のシークレット名
              key  = "latest"
            }
          }
        }
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }

  lifecycle {
    ignore_changes = [
      template[0].spec[0].containers[0].image,
    ]
  }
}

resource "google_cloud_run_service_iam_member" "raimei_invoker" {
  service  = google_cloud_run_service.raimei.name
  location = google_cloud_run_service.raimei.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_project_service" "secret_manager" {
  service            = "secretmanager.googleapis.com"
  disable_on_destroy = false
}

resource "google_secret_manager_secret" "github_webhook_secret" {
  secret_id = "GITHUB_WEBHOOK_SECRET"
  replication {
    user_managed {
      replicas {
        location = var.REGION
      }
    }
  }
  depends_on = [google_project_service.secret_manager]
}

resource "google_secret_manager_secret_version" "github_webhook_secret_version" {
  secret      = google_secret_manager_secret.github_webhook_secret.id
  secret_data = var.GITHUB_WEBHOOK_SECRET
  depends_on = [google_project_service.secret_manager]
}


variable "GEMINI_API_KEY" {
  type    = string
  default = ""  # 必要に応じて適切な初期値に置き換えてください
}

variable "GITHUB_WEBHOOK_SECRET" {
  type        = string
  description = "GitHub webhook secret value"
  default     = ""   # 同様に適切な初期値を設定するか、必要であればtfvarsで上書きしてください
}

variable "PROJECT_ID" {
  type    = string
  default = ""
}

variable "REGION" {
  type    = string
  default = "us-central1"
}

variable "github_owner" {
  description = "GitHub リポジトリの所有者（ユーザ名または組織名）"
  type        = string
  default = "gorillabbit"
}

variable "github_repo_name" {
  description = "対象の GitHub リポジトリ名"
  type        = string
  default     = "RAIMEI"
}