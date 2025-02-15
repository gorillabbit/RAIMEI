#!/bin/bash
set -e  # エラー発生時にスクリプトを終了

# .env ファイルが存在するかチェック
if [ ! -f ".env.production" ]; then
  echo ".env ファイルが見つかりません。"
  exit 1
fi

# .env ファイルから tfvars ファイル（terraform.tfvars）を生成
echo "Generating terraform.tfvars from .env..."
grep -v '^#' .env.production | sed -E 's/^([^=]+)=(.*)$/\1 = "\2"/' > terraform.tfvars

# Terraform の初期化
echo "Initializing Terraform..."
terraform init

# Terraform プランの作成（内容を確認したい場合はこちら）
echo "Creating Terraform plan..."
terraform plan -var-file="terraform.tfvars"

# Terraform の適用（-auto-approve により確認プロンプトを省略）
echo "Applying Terraform deployment..."
terraform apply -var-file="terraform.tfvars" -auto-approve

echo "Terraform deployment completed."

uv pip compile app/pyproject.toml > app/requirements.txt
gcloud auth configure-docker
docker build --no-cache -t gcr.io/raimei-450611/raimei:latest .
docker push gcr.io/raimei-450611/raimei:latest