provider "google" {
  project = "your-gcp-project-id"
  region  = "asia-northeast1"
}

resource "google_cloud_run_service" "raimei" {
  name     = "raimei-service"
  location = "asia-northeast1"

  template {
    spec {
      containers {
        image = "gcr.io/your-gcp-project-id/raimei:latest"
        ports {
          container_port = 8000
        }
        env {
          name  = "GITHUB_APP_SECRET"
          value = var.github_app_secret
        }
        env {
          name  = "GEMINI_API_KEY"
          value = var.gemini_api_key
        }
      }
    }
  }

  traffics {
    percent         = 100
    latest_revision = true
  }
}

resource "google_cloud_run_service_iam_member" "raimei_invoker" {
  service  = google_cloud_run_service.raimei.name
  location = google_cloud_run_service.raimei.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

variable "github_app_secret" {}
variable "gemini_api_key" {}
