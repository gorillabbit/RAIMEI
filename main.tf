provider "google" {
  project = "raimei-450611"
  region  = "us-central1"
}

resource "google_cloud_run_service" "raimei" {
  name     = "raimei-service"
  location = "us-central1"

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
          value = var.gemini_api_key
        }
      }
    }
  }

  traffic {
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

variable "gemini_api_key" {}
