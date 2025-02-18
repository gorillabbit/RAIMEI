import fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { FastifyPluginAsync } from 'fastify';
import { config } from 'dotenv';
import { createHmac, timingSafeEqual } from 'crypto';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { once } from 'events';

config(); // Load environment variables from .env

const execAsync = promisify(exec);

interface GitHubWebhookPayload {
  action: string;
  issue?: {
    title: string;
    html_url: string;
  };
  pull_request?: {
    title: string;
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


const webhookHandler: FastifyPluginAsync = async (server: FastifyInstance) => {
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
          if (action === 'opened' && issue) {
            console.log(`Issue created: title=${issue.title}, url=${issue.html_url}`);
            const command = "npx";
            const args = [
              "node",
              "~/RAIMEI/cline-cli/build/index.js",
              "/home/gorillabbit/RAIMEI",
              `Issue created: ${issue.title} URL: ${issue.html_url} このイシューを読んで、リポジトリの中身も考えて実装計画を立ててイシューに記載してください。`,
              "gemini",
            ];
          
            const childProcess = spawn(command, args, { shell: true }); // shell: true is important for npx
          
            childProcess.stdout.on('data', (data) => {
              console.log(`stdout: ${data}`);
            });
          
            childProcess.stderr.on('data', (data) => {
              console.error(`stderr: ${data}`);
            });
          
            childProcess.on('close', (code) => {
              console.log(`child process exited with code ${code}`);
            });
          
            childProcess.on('error', (err) => {
              console.error('Failed to start subprocess.', err);
            });
          
            // promisify the 'close' event
            await once(childProcess, 'close');
          
            console.log('Command execution completed.');

          } else {
            console.log(`Issue event received: action=${action}, title=${issue?.title}`);
          }
        } else if (eventType === 'pull_request') {
          const { action, pull_request } = payload;
          console.log(`Pull Request event received: action=${action}, title=${pull_request?.title}`);
        } else {
          console.log(`Other event received: ${eventType}`);
        }
      } catch (error) {
        console.error("Error processing webhook event:", error);
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
