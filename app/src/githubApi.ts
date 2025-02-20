import { Octokit } from "@octokit/rest";
import * as dotenv from 'dotenv';

dotenv.config(); // Load environment variables from .env file

console.log("GITHUB_TOKEN: ", process.env.GITHUB_TOKEN);

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

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

export const addLabelToIssue = async (issueUrl: string, labels: string[]) => {
  try {
    const urlParts = issueUrl.match(/https:\/\/github.com\/([^\/]+)\/([^\/]+)\/issues\/(\d+)/);
    if (!urlParts) {
      throw new Error("Invalid issue URL format.");
    }
    const [, owner, repo, issueNumber] = urlParts;
    console.log('Adding labels to issue:',owner,repo, issueNumber, labels);
    const response = await octokit.issues.addLabels({
      owner,
      repo,
      issue_number: parseInt(issueNumber, 10),
      labels,
    });
    console.log('ラベルが正常に追加されました:', response.data);
  } catch (error) {
    console.error('ラベルの追加中にエラーが発生しました:', error);
  }
}