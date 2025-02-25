# RAIMEI タスク管理システム

RAIMEI は GitHub Issues のラベルを使用してタスクの進行状況を監視し、各段階に応じて適切なアクションを実行する AI エージェントシステムです。

## 機能

-   GitHub Webhook を受信し、イベントに応じてラベルを自動更新
-   イシューが作成されたときに自動的にラベルを付与し、RAIMEI が実装計画を立てる
-   ラベルの状態に応じて cline-cli を使用して AI アクションを実行
-   PR が作成されたときに関連するイシューのラベルを更新し、RAIMEI が PR レビューを行う
-   PR がマージされたときに関連するイシューを完了状態に更新

## 設定

### 環境変数

`.env`ファイルを作成し、以下の環境変数を設定してください：

```
GITHUB_TOKEN=your_github_token
GITHUB_WEBHOOK_SECRET=your_webhook_secret
GITHUB_OWNER=your_github_username
GITHUB_REPO=your_repository_name
PORT=8000
```

-   `GITHUB_TOKEN`: GitHub API にアクセスするためのトークン
-   `GITHUB_WEBHOOK_SECRET`: GitHub の Webhook で設定した秘密鍵
-   `GITHUB_OWNER`: GitHub リポジトリのオーナー名
-   `GITHUB_REPO`: GitHub リポジトリ名
-   `PORT`: サーバーが待ち受けるポート番号

### ラベル定義

ラベルの定義は`.github/labels.yml`ファイルに記述します。このファイルには、ラベルの名前、説明、色、および遷移ルールが含まれています。RAIMEI はこのファイルに基づいてタスクの進行状況を管理します。

## インストール

```bash
# 依存関係をインストール
npm install

# ビルド
npm run build
```

## 使用方法

### サーバーの起動

```bash
npm start
```

これにより、Webhook を受け付けるサーバーが起動します。GitHub からのイベントを受信すると、RAIMEI が自動的に適切なアクションを実行します。

### タスクの流れ

1. GitHub で新しいイシューが作成されると、RAIMEI が自動的に実装計画を立てます
2. イシューのレビューが完了すると、RAIMEI が実装を開始します
3. 実装が完了すると、RAIMEI が PR を作成します
4. PR が作成されると、RAIMEI が PR のレビューを行います
5. RAIMEI のレビューが完了すると、人間のレビュー待ち状態になります
6. 人間がレビューを完了し、PR をマージすると、タスクが完了します

## ラベル遷移ワークフロー

RAIMEI は以下のワークフローに従ってタスクを進行します：

1. 未着手 → 作業中: イシューが割り当てられたとき
2. 作業中 → RAIMEI イシュー記載中: RAIMEI がイシュー記載を開始したとき
    - **アクション**: RAIMEI がリポジトリを分析し、実装計画を立ててイシューに記載
3. RAIMEI イシュー記載中 → RAIMEI イシューレビュー待ち: RAIMEI がイシュー記載を完了したとき
    - **アクション**: 人間がイシューの内容をレビュー
4. RAIMEI イシューレビュー待ち → RAIMEI 実装中: RAIMEI がイシューレビューを完了したとき
    - **アクション**: RAIMEI が実装計画に基づいてコードを実装
5. RAIMEI 実装中 → RAIMEI PR レビュー待ち: RAIMEI が PR を作成したとき
    - **アクション**: RAIMEI が自身の実装をレビュー
6. RAIMEI PR レビュー待ち → 人間 PR レビュー待ち: RAIMEI が PR レビューを完了したとき
    - **アクション**: 人間が PR をレビュー
7. 人間 PR レビュー待ち → 完了: 人間が PR をマージしたとき
    - **アクション**: タスク完了

## システムアーキテクチャ

RAIMEI タスク管理システムは以下のコンポーネントで構成されています：

1. **Webhook ハンドラー** (`app/src/index.ts`)

    - GitHub からのイベントを受信し、適切なアクションをトリガー

2. **タスクマネージャー** (`app/src/taskManager.ts`)

    - ラベルの状態に基づいて適切なアクションを実行
    - cline-cli を使用して AI アクションを実行

3. **ラベルマネージャー** (`app/src/labelManager.ts`)

    - ラベルの定義と遷移ルールを管理
    - GitHub API を使用してラベルを更新

4. **GitHub API クライアント** (`app/src/githubApi.ts`)
    - GitHub API を使用してイシューやラベルを操作

## 開発

### 開発サーバーの起動

```bash
npm run dev
```

### ビルド

```bash
npm run build
```

### テスト

```bash
npm test
```

## ライセンス

MIT
