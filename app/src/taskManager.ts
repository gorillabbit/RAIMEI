import * as path from 'path';
import { spawn } from 'child_process';
import { once } from 'events';
import * as dotenv from 'dotenv';
import { LabelManager } from './labelManager';
import { getIssueContent } from './githubApi';
import fs from 'fs';
import os from 'os';

// 環境変数を読み込む
dotenv.config();

/**
 * RAIMEIのタスク管理クラス
 * GitHubのラベルに基づいてタスクの進行状況を管理し、
 * 適切なタイミングでcline-cliを使用してAIアクションを実行します。
 */
export class TaskManager {
  private labelManager: LabelManager;
  private clineCliPath: string;
  private workspacePath: string;

  /**
   * コンストラクタ
   * @param labelsFilePath ラベル定義ファイルのパス
   * @param clineCliPath cline-cliのパス
   * @param workspacePath ワークスペースのパス
   */
  constructor(
    labelsFilePath: string = path.join(process.cwd(), '../.github/labels.yml'),
    clineCliPath: string = process.env.CLINE_CLI_PATH || path.join(process.cwd(), '../cline-cli/build/index.js'),
    workspacePath: string = process.env.WORKSPACE_PATH || path.join(process.cwd(), '..')
  ) {
    this.labelManager = new LabelManager(labelsFilePath);
    this.clineCliPath = clineCliPath;
    this.workspacePath = workspacePath;
  }

  /**
   * 初期化
   */
  async initialize(): Promise<void> {
    await this.labelManager.loadLabels();
    console.log('TaskManager initialized');
  }

  /**
   * イシューのラベルに基づいて適切なアクションを実行
   * @param issueUrl イシューのURL
   * @returns 成功したかどうか
   */
  async processIssueByLabel(issueUrl: string): Promise<boolean> {
    try {
      // 現在のラベルを取得
      const currentLabels = await this.labelManager.getCurrentLabels(issueUrl);
      
      // イシュー番号を抽出
      const issueNumber = this.extractIssueNumber(issueUrl);
      if (!issueNumber) {
        console.error('イシュー番号の抽出に失敗しました:', issueUrl);
        return false;
      }

      // イシューの内容を取得
      const issueContent = await getIssueContent(issueUrl) || '';
      
      // リポジトリ情報を抽出
      const repoInfo = this.extractRepoInfo(issueUrl);
      if (!repoInfo) {
        console.error('リポジトリ情報の抽出に失敗しました:', issueUrl);
        return false;
      }
      
      const { owner, repo } = repoInfo;
      
      // ラベルに基づいてアクションを実行
      for (const label of currentLabels) {
        switch (label) {
          case 'RAIMEI イシュー記載中':
            // イシュー記載が完了したら、レビュー待ちラベルに変更
            await this.writeIssueDescription(issueNumber, issueUrl, issueContent);
            await this.labelManager.updateIssueLabel(issueUrl, 'RAIMEI イシューレビュー待ち');
            return true;
            
          case 'RAIMEI イシューレビュー待ち':
            // イシューレビューが完了したら、実装中ラベルに変更
            await this.reviewIssueDescription(issueNumber, issueUrl, issueContent);
            await this.labelManager.updateIssueLabel(issueUrl, 'RAIMEI 実装中');
            return true;
            
          case 'RAIMEI 実装中':
            // 実装が完了したら、PRレビュー待ちラベルに変更
            await this.implementFeature(issueNumber, issueUrl, issueContent);
            // 実装が完了すると、PRが作成され、Webhookによって自動的にラベルが更新される
            return true;
            
          case 'RAIMEI PRレビュー待ち':
            // PRレビューが完了したら、人間PRレビュー待ちラベルに変更
            await this.reviewPullRequest(issueNumber, issueUrl, issueContent);
            await this.labelManager.updateIssueLabel(issueUrl, '人間 PRレビュー待ち');
            return true;
            
          default:
            // その他のラベルの場合は何もしない
            break;
        }
      }
      
      console.log('対応するアクションがありません:', currentLabels);
      return false;
    } catch (error) {
      console.error('イシュー処理中にエラーが発生しました:', error);
      if (error instanceof Error) {
        console.error(error.stack);
      }
      return false;
    }
  }

  /**
   * イシュー番号を抽出
   * @param issueUrl イシューのURL
   * @returns イシュー番号
   */
  private extractIssueNumber(issueUrl: string): string | null {
    const match = issueUrl.match(/\/issues\/(\d+)$/);
    return match ? match[1] : null;
  }

  /**
   * リポジトリ情報を抽出
   * @param issueUrl イシューのURL
   * @returns リポジトリ情報
   */
  private extractRepoInfo(issueUrl: string): { owner: string, repo: string } | null {
    const match = issueUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    return match ? { owner: match[1], repo: match[2] } : null;
  }

  /**
   * cline-cliを使用してコマンドを実行
   * @param prompt プロンプト
   * @param model モデル名
   * @returns 成功したかどうか
   */
  private async executeClineCommand(prompt: string, model: string = 'gemini'): Promise<boolean> {
    try {
      console.log(`cline-cliを実行します: ${prompt}`);

      // Create a temporary directory
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cline-'));
      const promptFilePath = path.join(tmpDir, 'prompt.txt');

      // Write the prompt to the temporary file
      fs.writeFileSync(promptFilePath, prompt);
      
      const command = "node";
      const args = [
        this.clineCliPath,
        this.workspacePath,
        "-f", // Use the -f option
        promptFilePath, // Pass the path to the prompt file
        model,
      ];
      
      const childProcess = spawn(command, args, { shell: true });
      // TODO: Delete the temporary directory after the process finishes.  This is
      // tricky to do reliably, especially if the process is killed.
      
      childProcess.stdout.on('data', (data) => {
        console.log(`stdout: ${data}`);
      });
      
      childProcess.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`);
      });
      
      childProcess.on('error', (err) => {
        console.error('Failed to start subprocess.', err);
      });
      
      // promisify the 'close' event
      const code = await once(childProcess, 'close');
      console.log(`child process exited with code ${code}`);
      
      return code[0] === 0;
    } catch (error) {
      console.error('cline-cliの実行中にエラーが発生しました:', error);
      if (error instanceof Error) {
        console.error(error.stack);
      }
      return false;
    }
  }

  /**
   * イシューの説明を書く
   * @param issueNumber イシュー番号
   * @param issueUrl イシューのURL
   * @param issueContent イシューの内容
   * @returns 成功したかどうか
   */
  private async writeIssueDescription(issueNumber: string, issueUrl: string, issueContent: string): Promise<boolean> {
    const prompt = `このイシューを読んで、リポジトリの中身も考えて実装計画を立ててイシューに記載してください。issue_number:${issueNumber} タイトル:${issueContent.split('\n')[0] || 'No Title'} 内容:${issueContent}`;
    return await this.executeClineCommand(prompt);
  }

  /**
   * イシューの説明をレビュー
   * @param issueNumber イシュー番号
   * @param issueUrl イシューのURL
   * @param issueContent イシューの内容
   * @returns 成功したかどうか
   */
  private async reviewIssueDescription(issueNumber: string, issueUrl: string, issueContent: string): Promise<boolean> {
    const prompt = `このイシューの実装計画をレビューして、必要に応じて修正してください。issue_number:${issueNumber} 内容:${issueContent}`;
    return await this.executeClineCommand(prompt);
  }

  /**
   * 機能を実装
   * @param issueNumber イシュー番号
   * @param issueUrl イシューのURL
   * @param issueContent イシューの内容
   * @returns 成功したかどうか
   */
  private async implementFeature(issueNumber: string, issueUrl: string, issueContent: string): Promise<boolean> {
    const prompt = `このイシューに記載された実装計画に従って、機能を実装してください。実装が完了したら、PRを作成してください。issue_number:${issueNumber} 内容:${issueContent}`;
    return await this.executeClineCommand(prompt);
  }

  /**
   * PRをレビュー
   * @param issueNumber イシュー番号
   * @param issueUrl イシューのURL
   * @param issueContent イシューの内容
   * @returns 成功したかどうか
   */
  private async reviewPullRequest(issueNumber: string, issueUrl: string, issueContent: string): Promise<boolean> {
    const prompt = `このイシューに関連するPRをレビューして、必要に応じて修正してください。issue_number:${issueNumber} 内容:${issueContent}`;
    return await this.executeClineCommand(prompt);
  }
}
