# ラベル管理機能の実装計画

## 概要

GitHub Issues のラベルを自動的に管理し、タスクの進行状況に応じてラベルを更新する機能を実装します。この機能により、`.github/labels.yml`に定義されたラベルとワークフローに従って、タスクの状態を視覚的に追跡できるようになります。

## 現状分析

現在のシステムでは:

-   GitHub Webhook を受け取り、イシューが作成されたときに「RAIMEI イシュー記載中」ラベルを付与する機能がある
-   ラベルの定義は`.github/labels.yml`に存在する
-   ラベル間の遷移ルールはコメントとして`.github/labels.yml`に記述されている
-   `addLabelToIssue`関数でラベルを追加できるが、ラベルの置き換え機能はまだ実装されていない

## 実装計画

### 1. ラベル管理モジュールの作成

新しいファイル `app/src/labelManager.ts` を作成し、以下の機能を実装します:

```typescript
// ラベル定義の型
interface Label {
	name: string;
	description: string;
	color: string;
}

// ラベル遷移の型
interface LabelTransition {
	from: string;
	to: string;
	condition: string;
}

// ラベル管理クラス
class LabelManager {
	private labels: Label[] = [];
	private transitions: LabelTransition[] = [];

	// ラベル定義を読み込む
	async loadLabels(): Promise<void> {
		// .github/labels.ymlからラベル定義を読み込む
	}

	// 現在のラベルから次のラベルへの遷移を取得
	getNextLabel(currentLabel: string, action: string): string | null {
		// 遷移ルールに基づいて次のラベルを返す
	}

	// イシューのラベルを更新する
	async updateIssueLabel(issueUrl: string, newLabel: string): Promise<void> {
		// 現在のラベルを取得し、新しいラベルに置き換える
	}

	// イシューの現在のラベルを取得する
	async getCurrentLabels(issueUrl: string): Promise<string[]> {
		// GitHub APIを使用してイシューの現在のラベルを取得
	}

	// ラベルの遷移を実行する
	async transitionLabel(issueUrl: string, action: string): Promise<boolean> {
		// 現在のラベルを取得し、アクションに基づいて次のラベルに遷移させる
	}
}
```

### 2. GitHub API 機能の拡張

`app/src/githubApi.ts` に以下の機能を追加します:

```typescript
// イシューの現在のラベルを取得する
export const getIssueLabels = async (issueUrl: string): Promise<string[]> => {
	// GitHub APIを使用してイシューのラベルを取得
};

// イシューのラベルを置き換える
export const replaceIssueLabels = async (
	issueUrl: string,
	labels: string[]
): Promise<void> => {
	// 現在のラベルを削除し、新しいラベルを設定
};

// イシューのラベルを削除する
export const removeIssueLabel = async (
	issueUrl: string,
	label: string
): Promise<void> => {
	// 特定のラベルを削除
};
```

### 3. ラベル遷移ロジックの実装

ラベル遷移のロジックを実装します。`.github/labels.yml`のコメントに基づいて、以下のような遷移ルールを定義します:

1. 未着手 → 作業中: イシューが割り当てられたとき
2. 作業中 → RAIMEI イシュー記載中: RAIMEI がイシュー記載を開始したとき
3. RAIMEI イシュー記載中 → RAIMEI イシューレビュー待ち: RAIMEI がイシュー記載を完了したとき
4. RAIMEI イシューレビュー待ち → RAIMEI 実装中: RAIMEI がイシューレビューを完了したとき
5. RAIMEI 実装中 → RAIMEI PR レビュー待ち: RAIMEI が PR を作成したとき
6. RAIMEI PR レビュー待ち → 人間 PR レビュー待ち: RAIMEI が PR レビューを完了したとき
7. 人間 PR レビュー待ち → 完了: 人間が PR をマージしたとき

### 4. Webhook 処理の拡張

`app/src/index.ts`の Webhook 処理を拡張して、イベントに応じてラベル遷移を実行します:

```typescript
// LabelManagerのインスタンスを作成
const labelManager = new LabelManager();
await labelManager.loadLabels();

// Webhookハンドラー内で、イベントに応じてラベル遷移を実行
if (eventType === 'issues') {
	const { action, issue } = payload;
	if (action === 'opened') {
		// 既存の処理...
		await labelManager.updateIssueLabel(
			issue.html_url,
			'RAIMEI イシュー記載中'
		);
	} else if (action === 'assigned') {
		await labelManager.updateIssueLabel(
			issue.html_url,
			'作業中 (In Progress)'
		);
	}
	// 他のアクションに対する処理...
} else if (eventType === 'pull_request') {
	const { action, pull_request } = payload;
	if (action === 'opened') {
		// PRが作成されたときの処理
		// 関連するイシューを特定し、ラベルを更新
	} else if (action === 'closed' && payload.pull_request.merged) {
		// PRがマージされたときの処理
		// 関連するイシューを特定し、ラベルを「完了」に更新
	}
}
```

### 5. コマンドラインインターフェースの実装

RAIMEI がラベルを手動で更新するためのコマンドラインインターフェースを実装します:

```typescript
// app/src/cli.ts
import { LabelManager } from './labelManager';

const updateLabel = async (issueUrl: string, action: string) => {
	const labelManager = new LabelManager();
	await labelManager.loadLabels();
	const success = await labelManager.transitionLabel(issueUrl, action);
	if (success) {
		console.log('ラベルが正常に更新されました');
	} else {
		console.error('ラベルの更新に失敗しました');
	}
};

// コマンドライン引数を解析して実行
const [, , issueUrl, action] = process.argv;
if (issueUrl && action) {
	updateLabel(issueUrl, action).catch(console.error);
} else {
	console.error('使用方法: node cli.js <issue_url> <action>');
}
```

## 実装手順

1. `app/src/labelManager.ts`を作成し、基本的なクラス構造を実装
2. `app/src/githubApi.ts`にラベル管理関連の関数を追加
3. `.github/labels.yml`からラベル定義と遷移ルールを読み込む機能を実装
4. ラベル遷移ロジックを実装
5. Webhook 処理を拡張して、イベントに応じてラベル遷移を実行
6. コマンドラインインターフェースを実装
7. テストとデバッグ

## 技術的な考慮事項

-   YAML パーサーが必要なため、`js-yaml`パッケージを追加する必要があります
-   ラベル遷移のルールは柔軟に設定できるようにする
-   エラーハンドリングを適切に実装し、ラベル更新の失敗を検知できるようにする
-   ログ機能を強化して、ラベル遷移の履歴を追跡できるようにする

## 将来の拡張性

-   WebUI でラベル遷移を管理できるようにする
-   ラベル遷移に基づいて自動的にタスクを割り当てる機能を追加
-   ラベル遷移に基づいて通知を送信する機能を追加
-   カスタムワークフローを定義できるようにする
