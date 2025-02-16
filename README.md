AI 自律開発支援アプリ 概要ドキュメント

1. はじめに
   本ドキュメントは、GitHub 上で動作する AI 自律開発支援アプリの全体像を説明します。本アプリは、GitHub Issues をトリガーとして AI（Gemini）に指示を出し、コードの自動生成、レビュー、テスト、デプロイまでの一連の開発プロセスを自動化することを目的としています。

2. アプリの目的
   開発効率の向上: AI を活用して、開発タスクの自動化と効率化を図る。
   品質の確保: AI によるコードレビューとテストの自動化により、コード品質を維持・向上させる。
   開発者の負担軽減: 定型的な作業を AI に任せ、開発者が創造的なタスクに集中できる環境を提供する。
3. アプリの主な機能
   Issue の監視と解析

GitHub 上のオープンな Issue を定期的に取得・監視。
Issue の内容を解析し、AI に適切な指示を生成。
コードの自動生成

AI（Gemini）に Issue の内容を基にコード生成を指示。
生成されたコードを新しいブランチにコミットし、Pull Request（PR）を作成。
コードレビューとテスト

AI によるコードレビューを実施し、改善点を PR にコメント。
自動テストを実行し、結果を PR に反映。
デプロイと運用監視

PR がマージされた後、自動的にデプロイを実行。
運用中のエラーログを解析し、必要に応じて AI が修正コードを生成。
フィードバックループの構築

過去の開発履歴を AI が学習し、次回以降の開発プロセスを最適化。 4. アプリの構成
GitHub App（または Bot）

GitHub 上で動作し、リポジトリごとにインストール可能。
Webhook を利用して、Issue や PR のイベントをトリガーとして処理を開始。
AI エンジン（Gemini）

Issue の解析、コード生成、コードレビュー、テストコード生成などを担当。
CI/CD パイプライン

GitHub Actions を活用し、テストの実行やデプロイを自動化。 5. 動作フロー
Issue の作成

開発者が GitHub 上で新しい Issue を作成。
Issue の取得と解析

GitHub App が新しい Issue を検知し、内容を取得。
AI に Issue の内容を解析させ、実装方針を決定。
コードの生成と PR の作成

AI がコードを生成し、新しいブランチを作成。
生成されたコードをコミットし、PR を作成。
コードレビューとテスト

AI が PR のコードをレビューし、必要に応じて修正。
自動テストを実行し、結果を PR に反映。
マージとデプロイ

テストが成功した PR を自動的にマージ。
マージ後、自動デプロイを実行。
Issue のクローズ

対応する Issue を自動的にクローズし、完了コメントを追加。
フィードバックの蓄積

開発履歴を AI が学習し、次回以降の開発プロセスを改善。 6. 設定とカスタマイズ
設定ファイル

リポジトリ内に .ai-dev-config.json などの設定ファイルを配置し、アプリの動作をカスタマイズ可能。
カスタマイズ項目

対象とする Issue のラベルや種類の指定。
コード生成時のガイドラインやコーディング規約。
テストの実行条件やデプロイ環境の設定。 7. セキュリティと権限
GitHub App の権限

リポジトリの読み取り・書き込み権限。
Issue や PR の管理権限。
必要最小限の権限設定を推奨。
AI の動作制限

生成されたコードのレビューや承認プロセスを設定し、誤ったコードのマージを防止。 8. 導入手順
GitHub App のインストール

対象のリポジトリにアプリをインストール。
設定ファイルの配置

リポジトリのルートディレクトリに設定ファイルを配置。
CI/CD パイプラインの設定

必要に応じて GitHub Actions のワークフローを設定。
AI エンジンの設定

Gemini の API キーやエンドポイントを設定。 9. 今後の展望
機能拡張

他の AI モデルの統合や、追加の自動化機能の開発。
ユーザーフィードバックの反映

開発者からのフィードバックを基に、アプリの改善を継続。
コミュニティの構築

オープンソース化やコミュニティの形成を検討し、共同開発を促進。

# ビルド手順

dockerfile のビルド

```sh
uv pip compile app/pyproject.toml > app/requirements.txt
gcloud auth configure-docker

docker compose --env-file .env.production up --build

docker build --no-cache -t gcr.io/raimei-450611/raimei:latest . && docker run -e ENV=production -p 8000:8000 gcr.io/raimei-450611/raimei:latest
docker push gcr.io/raimei-450611/raimei:latest

# 確認
test/test.sh
curl -X POST "http://0.0.0.0:8000/webhook"
curl -X POST https://raimei-service-661241735961.us-central1.run.app/webhook -d '{"test": "value"}' -H "Content-Type: application/json"

# dockerに入る
sudo docker ps
docker images
sudo docker exec -it raimei bash

# terraformで出力する
PROJECT_ID=raimei-450611
REGION=us-central1
echo $PROJECT_ID $REGION
terraformer import google --projects=$PROJECT_ID --regions=$REGION
terraformer import google --resources="*" --projects=$PROJECT_ID --regions=$REGION
terraformer import google --compact --resources=cloudbuild --projects=$PROJECT_ID  --regions=$REGION

# tailscaleでサーバーを起動する
sudo tailscale funnel 8000
```
