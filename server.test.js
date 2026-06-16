const test = require('node:test');
const assert = require('node:assert');
const http = require('http');

// Set dummy environment variables for setup before requiring the server
process.env.GH_TOKEN = 'mock-github-token';
process.env.SLACK_TOKEN = 'xoxb-mock-slack-token';
process.env.SLACK_CHANNEL = '#mock-channel';
process.env.GEMINI_API_KEY = 'mock-gemini-key';

const { app, octokit, slack, genAI } = require('./index.js');

test('GitHub Webhook Server - Integration Tests', async (t) => {
  // Start the server on a dynamic port
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const url = `http://localhost:${port}/webhook/github`;

  // Close the server at the end of all tests
  t.after(() => {
    server.close();
  });

  await t.test('should skip push webhook if the branch is not main', async () => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ref: 'refs/heads/feature-branch',
        head_commit: { id: 'sha123' },
        repository: { full_name: 'acme/backend' }
      })
    });

    assert.strictEqual(response.status, 200);
    const text = await response.text();
    assert.match(text, /Not main branch push, skipped/);
  });

  await t.test('should skip push webhook if default branch is master but push is main', async () => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ref: 'refs/heads/main',
        head_commit: { id: 'sha123' },
        repository: { full_name: 'acme/backend', default_branch: 'master' }
      })
    });

    assert.strictEqual(response.status, 200);
    const text = await response.text();
    assert.match(text, /Not master branch push, skipped/);
  });

  await t.test('should return 400 if critical payload properties are missing', async () => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ref: 'refs/heads/main'
        // Missing head_commit and repository
      })
    });

    assert.strictEqual(response.status, 400);
    const text = await response.text();
    assert.match(text, /Missing head_commit parameter/);
  });

  await t.test('should successfully fetch commits, call AI, and notify Slack', async () => {
    // Mock octokit.repos.getCommit
    octokit.repos.getCommit = async (params) => {
      assert.strictEqual(params.owner, 'acme');
      assert.strictEqual(params.repo, 'backend');
      assert.strictEqual(params.ref, 'sha-abc-123');
      return {
        data: {
          files: [
            { filename: 'index.js', additions: 10, deletions: 2, patch: '@@ -1,3 +1,10 @@' }
          ]
        }
      };
    };

    // Mock genAI.getGenerativeModel to return a fake model
    genAI.getGenerativeModel = (opts) => {
      assert.strictEqual(opts.model, 'gemini-2.5-flash');
      return {
        generateContent: async (prompt) => {
          assert.match(prompt, /index.js/);
          return {
            response: {
              text: () => 'Added express endpoint structure with basic logging.'
            }
          };
        }
      };
    };

    // Mock slack.chat.postMessage
    let slackCallPayload = null;
    slack.chat.postMessage = async (params) => {
      slackCallPayload = params;
      return { ok: true };
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ref: 'refs/heads/main',
        head_commit: {
          id: 'sha-abc-123',
          message: 'feat: add endpoint',
          author: { name: 'Dev Jane' }
        },
        repository: {
          full_name: 'acme/backend'
        }
      })
    });

    assert.strictEqual(response.status, 200);
    assert.ok(slackCallPayload, 'slack.chat.postMessage should have been called');
    assert.strictEqual(slackCallPayload.channel, '#mock-channel');
    assert.match(slackCallPayload.text, /Deployed to production/);
    
    const blockText = slackCallPayload.blocks[0].text.text;
    assert.match(blockText, /Added express endpoint structure/);
    assert.match(blockText, /Dev Jane/);
    assert.match(blockText, /feat: add endpoint/);
    assert.match(blockText, /index.js/);
  });

  await t.test('should return 500 if an API service fails', async () => {
    // Mock Octokit to fail
    octokit.repos.getCommit = async () => {
      throw new Error('GitHub API rate limit exceeded');
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ref: 'refs/heads/main',
        head_commit: {
          id: 'sha-failure',
          message: 'fix: database connection leak',
          author: { name: 'Ops John' }
        },
        repository: {
          full_name: 'acme/backend'
        }
      })
    });

    assert.strictEqual(response.status, 500);
    const text = await response.text();
    assert.match(text, /GitHub API rate limit exceeded/);
  });
});
