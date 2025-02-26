import fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { FastifyPluginAsync } from 'fastify';
import { config } from 'dotenv';
import { createHmac, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { exec } from 'child_process';
import { addLabelToIssue, getIssueContent } from './githubApi';
import { TaskManager } from './taskManager';

config(); // Load environment variables from .env

// Promisify exec for async/await usage
const execAsync = promisify(exec);

interface GitHubWebhookPayload {
  action: string;
  issue?: {
    title: string;
    html_url: string;
  };
  pull_request?: {
    title: string;
    merged?: boolean;
    html_url?: string;
    body?: string;
  };
  // Add other properties based on expected GitHub webhook payloads
}

const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;

if (!GITHUB_WEBHOOK_SECRET) {
  console.error('GITHUB_WEBHOOK_SECRET is not defined in .env');
  process.exit(1); // Exit if the secret is missing
}

const verifySignature = (secret: string, body: string, signatureHeader: string): boolean => {
  const [shaName, signature] = signatureHeader.split('=');
  if (shaName !== 'sha256') {
    return false;
  }

  const hmac = createHmac('sha256', secret);
  hmac.update(body);
  const digest = hmac.digest('hex');

  // Timing safe compare to prevent timing attacks
  return timingSafeEqual(Buffer.from(digest, 'hex'), Buffer.from(signature, 'hex'));
};

const extractLastNumber = (url: string): string | null => {
  const parts = url.split('/');
  const lastPart = parts.pop(); // 最後の要素を取得
  return lastPart && /^\d+$/.test(lastPart) ? lastPart : null;
}

/**
 * PRの説明文からイシュー番号を抽出する
 * @param body PRの説明文
 * @returns イシュー番号の配列
 */
const extractIssueNumbers = (body: string | undefined): number[] => {
  if (!body) return [];
  
  // "Fixes #123", "Closes #123", "Resolves #123" などの形式を検出
  const regex = /(close|closes|closed|fix|fixes|fixed|resolve|resolves|resolved)\s+#(\d+)/gi;
  const matches = [...body.matchAll(regex)];
  
  // マッチした数字部分を抽出して数値に変換
  return matches.map(match => parseInt(match[2], 10));
}

/**
 * イシュー番号からイシューのURLを生成する
 * @param owner リポジトリのオーナー
 * @param repo リポジトリ名
 * @param issueNumber イシュー番号
 * @returns イシューのURL
 */
const constructIssueUrl = (owner: string, repo: string, issueNumber: number): string => {
  return `https://github.com/${owner}/${repo}/issues/${issueNumber}`;
}


// タスクマネージャーのインスタンスを作成
const taskManager = new TaskManager();

const webhookHandler: FastifyPluginAsync = async (server: FastifyInstance) => {
  // タスクマネージャーを初期化
  await taskManager.initialize();
  server.post(
    '/webhook',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const signatureHeader = request.headers['x-hub-signature-256'] as string;
      if (!signatureHeader) {
        console.warn('Missing X-Hub-Signature-256 header');
        return reply.status(403).send({ error: 'Signature missing' });
      }

      const body = JSON.stringify(request.body); // Serialize the request body to a string

      if (!verifySignature(GITHUB_WEBHOOK_SECRET, body, signatureHeader)) {
        console.warn('Invalid signature');
        return reply.status(403).send({ error: 'Invalid signature' });
      }

      const payload: GitHubWebhookPayload = request.body as GitHubWebhookPayload;
      const eventType = request.headers['x-github-event'] as string || 'unknown';

      try {
        if (eventType === 'issues') {
          const { action, issue } = payload;
          if (!issue) {
            return reply.status(400).send({ error: 'Missing issue data' });
          }
          const issueContent = await getIssueContent(issue.html_url);
          const issueNumber = extractLastNumber(issue.html_url) ?? 'なし(本文は空白)';
          if (action === 'opened') {
            console.log(`Issue created: title=${issue.title}, url=${issue.html_url}`);
            // 未着手ラベルを付与
            await addLabelToIssue(issue.html_url, ['未着手 (Open)']);
            // RAIMEIがイシュー記載中ラベルに変更
            await addLabelToIssue(issue.html_url, ['RAIMEI イシュー記載中']);
            
            // タスクマネージャーでイシューを処理
            await taskManager.processIssueByLabel(issue.html_url);
            
          } else if (action === 'assigned') {
            // イシューが割り当てられたとき
            await addLabelToIssue(issue.html_url, ['作業中 (In Progress)']);
            console.log(`Issue assigned: title=${issue.title}, url=${issue.html_url}`);
          } else if (action === 'labeled') {
            // ラベルが追加されたとき
            console.log(`Issue labeled: title=${issue.title}, url=${issue.html_url}`);
            
            // ラベルが変更されたときにタスクマネージャーでイシューを処理
            await taskManager.processIssueByLabel(issue.html_url);
          } else {
            console.log(`Issue event received: action=${action}, title=${issue?.title}`);
          }
        } else if (eventType === 'pull_request') {
          const { action, pull_request } = payload;
          console.log(`Pull Request event received: action=${action}, title=${pull_request?.title}`);
          
          // PRが作成されたとき
          if (action === 'opened' && pull_request) {
            console.log(`PR opened: ${pull_request.title}`);
            
            // PRの説明からイシュー番号を抽出
            const issueNumbers = extractIssueNumbers(pull_request.body);
            
            if (issueNumbers.length > 0) {
              // URLからリポジトリ情報を抽出
              const urlParts = pull_request.html_url?.match(/https:\/\/github.com\/([^\/]+)\/([^\/]+)/);
              if (urlParts) {
                const [, owner, repo] = urlParts;
                
                // 関連するイシューのラベルを更新
                for (const issueNumber of issueNumbers) {
                  const issueUrl = constructIssueUrl(owner, repo, issueNumber);
                  try {
                    // イシューのラベルを「RAIMEI PRレビュー待ち」に更新
                    await addLabelToIssue(issueUrl, ['RAIMEI PRレビュー待ち']);
                    console.log(`Updated issue #${issueNumber} label to 'RAIMEI PRレビュー待ち'`);
                    
                    // タスクマネージャーでイシューを処理
                    await taskManager.processIssueByLabel(issueUrl);
                  } catch (error) {
                    console.error(`Failed to update issue #${issueNumber} label:`, error);
                  }
                }
              }
            }
          } 
          // PRがマージされたとき
          else if (action === 'closed' && pull_request?.merged && pull_request) {
            console.log(`PR merged: ${pull_request.title}`);
            
            // PRの説明からイシュー番号を抽出
            const issueNumbers = extractIssueNumbers(pull_request.body);
            
            if (issueNumbers.length > 0) {
              // URLからリポジトリ情報を抽出
              const urlParts = pull_request.html_url?.match(/https:\/\/github.com\/([^\/]+)\/([^\/]+)/);
              if (urlParts) {
                const [, owner, repo] = urlParts;
                
                // 関連するイシューのラベルを更新
                for (const issueNumber of issueNumbers) {
                  const issueUrl = constructIssueUrl(owner, repo, issueNumber);
                  try {
                    // イシューのラベルを「完了」に更新
                    await addLabelToIssue(issueUrl, ['完了 (Closed)']);
                    console.log(`Updated issue #${issueNumber} label to '完了 (Closed)'`);
                  } catch (error) {
                    console.error(`Failed to update issue #${issueNumber} label:`, error);
                  }
                }
              }
            }
          }
        } else {
          console.log(`Other event received: ${eventType}`);
        }
      } catch (error) {
        console.error("Error processing webhook event:", error);
        if (error instanceof Error) {
          console.error(error.stack);
        }
        reply.status(500).send({status: "error", message: "Failed to process webhook event"});
        return;
      }


      reply.send({ status: 'success', event: eventType });
    }
  );
};

const start = async () => {
  const server: FastifyInstance = fastify({
    logger: true, // Enable logger for debugging
    bodyLimit: 5 * 1024 * 1024, // Increase body limit to 5MB (adjust as needed)
  });

  try {
    await server.register(webhookHandler);
    const port = parseInt(process.env.PORT || '8000', 10);  // Parse port as integer with radix 10
    await server.listen({ port: port, host: '0.0.0.0' });

    console.log(`Server listening on port ${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
