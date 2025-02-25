import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { getIssueLabels, addLabelToIssue, removeIssueLabel, replaceIssueLabels } from './githubApi';

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
	description: string;
}

/**
 * GitHub Issuesのラベルを管理するクラス
 */
export class LabelManager {
	private labels: Label[] = [];
	private transitions: LabelTransition[] = [];
	private labelsFilePath: string;

	/**
	 * コンストラクタ
	 * @param labelsFilePath ラベル定義ファイルのパス（デフォルトは.github/labels.yml）
	 */
	constructor(labelsFilePath: string = path.join(process.cwd(), '../.github/labels.yml')) {
		this.labelsFilePath = labelsFilePath;
	}

	/**
	 * ラベル定義を読み込む
	 */
	async loadLabels(): Promise<void> {
		try {
			// ファイルを読み込む
			const fileContent = fs.readFileSync(this.labelsFilePath, 'utf8');
			
			// コメント行からラベル遷移ルールを抽出
			this.parseTransitionsFromComments(fileContent);
			
			// YAMLとしてパース
			const data = yaml.load(fileContent) as Label[];
			if (Array.isArray(data)) {
				this.labels = data;
				console.log(`${this.labels.length}個のラベルを読み込みました`);
			} else {
				throw new Error('ラベル定義の形式が不正です');
			}
		} catch (error) {
			console.error('ラベル定義の読み込みに失敗しました:', error);
			throw error;
		}
	}

	/**
	 * コメント行からラベル遷移ルールを抽出する
	 * @param fileContent ファイルの内容
	 */
	private parseTransitionsFromComments(fileContent: string): void {
		// コメント行を抽出
		const commentLines = fileContent
			.split('\n')
			.filter(line => line.trim().startsWith('#'))
			.map(line => line.trim().substring(1).trim());

		// 遷移ルールを定義
		// labels.ymlのコメントに基づいて手動で遷移ルールを定義
		this.transitions = [
			{
				from: '未着手 (Open)',
				to: '作業中 (In Progress)',
				condition: '割り当て',
				description: 'イシューが割り当てられたとき'
			},
			{
				from: '作業中 (In Progress)',
				to: 'RAIMEI イシュー記載中',
				condition: 'イシュー記載',
				description: 'RAIMEIがイシュー記載を開始したとき'
			},
			{
				from: 'RAIMEI イシュー記載中',
				to: 'RAIMEI イシューレビュー待ち',
				condition: 'イシュー記載完了',
				description: 'RAIMEIがイシュー記載を完了したとき'
			},
			{
				from: 'RAIMEI イシューレビュー待ち',
				to: 'RAIMEI 実装中',
				condition: 'イシューレビュー完了',
				description: 'RAIMEIがイシューレビューを完了したとき'
			},
			{
				from: 'RAIMEI 実装中',
				to: 'RAIMEI PRレビュー待ち',
				condition: 'PR作成',
				description: 'RAIMEIがPRを作成したとき'
			},
			{
				from: 'RAIMEI PRレビュー待ち',
				to: '人間 PRレビュー待ち',
				condition: 'PRレビュー完了',
				description: 'RAIMEIがPRレビューを完了したとき'
			},
			{
				from: '人間 PRレビュー待ち',
				to: '完了 (Closed)',
				condition: 'マージ',
				description: '人間がPRをマージしたとき'
			}
		];
		
		console.log(`${this.transitions.length}個の遷移ルールを抽出しました`);
	}

	/**
	 * 現在のラベルから次のラベルへの遷移を取得
	 * @param currentLabel 現在のラベル
	 * @param action アクション
	 * @returns 次のラベル（見つからない場合はnull）
	 */
	getNextLabel(currentLabel: string, action: string): string | null {
		// 現在のラベルに基づいて次のラベルを探す
		const transition = this.transitions.find(t => 
			t.from === currentLabel && 
			t.condition.toLowerCase().includes(action.toLowerCase())
		);
		
		if (transition) {
			return transition.to;
		}
		
		return null;
	}

	/**
	 * イシューの現在のラベルを取得する
	 * @param issueUrl イシューのURL
	 * @returns ラベルの配列
	 */
	async getCurrentLabels(issueUrl: string): Promise<string[]> {
		return await getIssueLabels(issueUrl);
	}

	/**
	 * イシューのラベルを更新する
	 * @param issueUrl イシューのURL
	 * @param newLabel 新しいラベル
	 */
	async updateIssueLabel(issueUrl: string, newLabel: string): Promise<void> {
		try {
			// 現在のステータスラベルを取得
			const currentLabels = await this.getCurrentLabels(issueUrl);
			
			// ステータスラベルを特定
			const statusLabels = this.labels.map(l => l.name);
			const currentStatusLabels = currentLabels.filter(label => 
				statusLabels.includes(label)
			);
			
			// 新しいラベルのリストを作成
			const newLabels = currentLabels.filter(label => 
				!statusLabels.includes(label)
			);
			newLabels.push(newLabel);
			
			// ラベルを更新
			await this.replaceIssueLabels(issueUrl, newLabels);
			
			console.log(`イシューのラベルを更新しました: ${currentStatusLabels.join(', ')} → ${newLabel}`);
		} catch (error) {
			console.error('ラベルの更新に失敗しました:', error);
			throw error;
		}
	}

	/**
	 * イシューのラベルを置き換える
	 * @param issueUrl イシューのURL
	 * @param labels 新しいラベルの配列
	 */
	async replaceIssueLabels(issueUrl: string, labels: string[]): Promise<void> {
		try {
			// GitHub APIを使用してラベルを置き換える
			await replaceIssueLabels(issueUrl, labels);
		} catch (error) {
			console.error('ラベルの置き換えに失敗しました:', error);
			throw error;
		}
	}

	/**
	 * ラベルの遷移を実行する
	 * @param issueUrl イシューのURL
	 * @param action アクション
	 * @returns 成功したかどうか
	 */
	async transitionLabel(issueUrl: string, action: string): Promise<boolean> {
		try {
			// 現在のラベルを取得
			const currentLabels = await this.getCurrentLabels(issueUrl);
			
			// ステータスラベルを特定
			const statusLabels = this.labels.map(l => l.name);
			const currentStatusLabels = currentLabels.filter(label => 
				statusLabels.includes(label)
			);
			
			if (currentStatusLabels.length === 0) {
				console.warn('ステータスラベルが見つかりません');
				return false;
			}
			
			// 次のラベルを取得
			const nextLabel = this.getNextLabel(currentStatusLabels[0], action);
			if (!nextLabel) {
				console.warn(`アクション "${action}" に対応する次のラベルが見つかりません`);
				return false;
			}
			
			// ラベルを更新
			await this.updateIssueLabel(issueUrl, nextLabel);
			
			return true;
		} catch (error) {
			console.error('ラベル遷移の実行に失敗しました:', error);
			return false;
		}
	}
}
