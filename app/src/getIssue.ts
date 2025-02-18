import { Octokit } from "@octokit/rest";

export const getIssueContent = async (issueUrl: string): Promise<string | null> => {
  try {
    // URLをパースして必要な情報を抽出
    const urlParts = issueUrl.match(/https:\/\/github.com\/([^\/]+)\/([^\/]+)\/issues\/(\d+)/);
    if (!urlParts) {
      throw new Error("Invalid issue URL format.");
    }
    const [, owner, repo, issueNumber] = urlParts;

    // Octokit インスタンスを作成 (認証不要な場合は空でOK)
    const octokit = new Octokit({
       // auth: "YOUR_GITHUB_TOKEN" // 必要であればGitHubトークンを設定
    });

    // Issue を取得
    const { data: issue } = await octokit.issues.get({
      owner,
      repo,
      issue_number: parseInt(issueNumber, 10),
    });

    return issue.body || null; // Issue の本文を返す (存在しない場合は null)

  } catch (error) {
    console.error("Error fetching issue content:", error);
    if (error instanceof Error) {
        return `Error: ${error.message}`;
    }
    return "An unexpected error occurred";
  }
}