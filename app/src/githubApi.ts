import { Octokit } from "@octokit/rest";
import * as dotenv from 'dotenv';

dotenv.config(); // Load environment variables from .env file

console.log("GITHUB_TOKEN: ", process.env.GITHUB_TOKEN);

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

/**
 * URLからowner、repo、issue_numberを抽出する
 * @param issueUrl イシューのURL
 * @returns [owner, repo, issue_number]
 */
const parseIssueUrl = (issueUrl: string): [string, string, number] => {
  const urlParts = issueUrl.match(/https:\/\/github.com\/([^\/]+)\/([^\/]+)\/issues\/(\d+)/);
  if (!urlParts) {
    throw new Error("Invalid issue URL format.");
  }
  const [, owner, repo, issueNumber] = urlParts;
  return [owner, repo, parseInt(issueNumber, 10)];
};

export const getIssueContent = async (issueUrl: string): Promise<string | undefined> => {
  try {
    // URLをパースして必要な情報を抽出
      const urlParts = issueUrl.match(/https:\/\/github.com\/([^\/]+)\/([^\/]+)\/issues\/(\d+)/);
      if (!urlParts) {
        throw new Error("Invalid issue URL format.");
      }
    const [, owner, repo, issueNumber] = urlParts;

    // Issue を取得
    const { data: issue } = await octokit.issues.get({
      owner,
      repo,
      issue_number: parseInt(issueNumber, 10),
    });

    return issue.body || undefined // Issue の本文を返す (存在しない場合は null)

  } catch (error) {
    console.error("Error fetching issue content:", error);
    if (error instanceof Error) {
        return `Error: ${error.message}`;
    }
    return "An unexpected error occurred";
  }
}

/**
 * イシューにラベルを追加する
 * @param issueUrl イシューのURL
 * @param labels 追加するラベルの配列
 */
export const addLabelToIssue = async (issueUrl: string, labels: string[]) => {
  try {
    const [owner, repo, issue_number] = parseIssueUrl(issueUrl);
    console.log('Adding labels to issue:', owner, repo, issue_number, labels);
    const response = await octokit.issues.addLabels({
      owner,
      repo,
      issue_number,
      labels,
    });
    console.log('ラベルが正常に追加されました:', response.data);
  } catch (error) {
    console.error('ラベルの追加中にエラーが発生しました:', error);
  }
};

/**
 * イシューの現在のラベルを取得する
 * @param issueUrl イシューのURL
 * @returns ラベルの配列
 */
export const getIssueLabels = async (issueUrl: string): Promise<string[]> => {
  try {
    const [owner, repo, issue_number] = parseIssueUrl(issueUrl);
    
    const { data: issue } = await octokit.issues.get({
      owner,
      repo,
      issue_number,
    });
    
    return issue.labels.map(label => 
      typeof label === 'string' ? label : label.name
    ).filter((name): name is string => name !== undefined);
  } catch (error) {
    console.error('ラベルの取得中にエラーが発生しました:', error);
    return [];
  }
};

/**
 * イシューからラベルを削除する
 * @param issueUrl イシューのURL
 * @param label 削除するラベル
 */
export const removeIssueLabel = async (issueUrl: string, label: string): Promise<void> => {
  try {
    const [owner, repo, issue_number] = parseIssueUrl(issueUrl);
    
    await octokit.issues.removeLabel({
      owner,
      repo,
      issue_number,
      name: label,
    });
    
    console.log(`ラベル "${label}" を削除しました`);
  } catch (error) {
    console.error(`ラベル "${label}" の削除中にエラーが発生しました:`, error);
  }
};

/**
 * イシューのラベルを置き換える（すべてのラベルを削除して新しいラベルを設定）
 * @param issueUrl イシューのURL
 * @param labels 新しいラベルの配列
 */
export const replaceIssueLabels = async (issueUrl: string, labels: string[]): Promise<void> => {
  try {
    const [owner, repo, issue_number] = parseIssueUrl(issueUrl);
    
    await octokit.issues.setLabels({
      owner,
      repo,
      issue_number,
      labels,
    });
    
    console.log('ラベルを置き換えました:', labels);
  } catch (error) {
    console.error('ラベルの置き換え中にエラーが発生しました:', error);
  }
};
