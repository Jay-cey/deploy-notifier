// env: GH_TOKEN, SLACK_TOKEN, SLACK_CHANNEL, GEMINI_API_KEY


const express = require('express');
const { Octokit } = require('@octokit/rest');
const { WebClient } = require('@slack/web-api');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(express.json());

const octokit = new Octokit({ auth: process.env.GH_TOKEN });
const slack   = new WebClient(process.env.SLACK_TOKEN);
const genAI   = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post('/webhook/github', async (req, res) => {
  try {
    const { ref, head_commit, repository } = req.body;
    
    if (!ref) {
      return res.status(400).send('Missing ref parameter');
    }
    
    if (ref !== 'refs/heads/main') {
      return res.status(200).send('Not main branch push, skipped');
    }

    if (!head_commit) {
      return res.status(400).send('Missing head_commit parameter');
    }

    if (!repository || !repository.full_name) {
      return res.status(400).send('Missing repository or repository.full_name parameter');
    }

    const [owner, repo] = repository.full_name.split('/');
    if (!owner || !repo) {
      return res.status(400).send('Invalid repository format');
    }

    const sha = head_commit.id;
    if (!sha) {
      return res.status(400).send('Missing head_commit.id');
    }

    // Fetch the diff from GitHub
    const { data } = await octokit.repos.getCommit({ owner, repo, ref: sha });
    
    if (!data.files || data.files.length === 0) {
      return res.status(200).send('No files changed in this commit');
    }

    const diffText = data.files.map(f =>
      `${f.filename} (+${f.additions} -${f.deletions})\n${f.patch || ''}`
    ).join('\n\n');

    // Ask Gemini to summarize the diff
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(
      `Summarize this git diff in 2-3 sentences for a Slack deploy alert. Be concise and technical.\n\n${diffText}`
    );

    const summary = result.response.text();
    if (!summary) {
      throw new Error('Invalid or empty response from Gemini API');
    }

    // Post the Slack thread
    const files = data.files.slice(0, 5).map(f =>
      `+${f.additions} -${f.deletions}  ${f.filename}`).join('\n');
      
    const remainingFilesCount = data.files.length - 5;
    const filesText = remainingFilesCount > 0 
      ? `${files}\n... and ${remainingFilesCount} more file(s)`
      : files;

    await slack.chat.postMessage({
      channel: process.env.SLACK_CHANNEL,
      text: `🚀 *Deployed to production* · \`${sha.slice(0,7)}\``,
      blocks: [{
        type: 'section',
        text: { type: 'mrkdwn',
          text: `🚀 *Deployed to production* · \`${sha.slice(0,7)}\`\n*${head_commit.message || 'No message'}* — ${head_commit.author ? head_commit.author.name : 'Unknown'}\n\n${summary}\n\`\`\`${filesText}\`\`\`` }
      }]
    });

    res.sendStatus(200);
  } catch (error) {
    console.error('GitHub Webhook Error:', error);
    res.status(500).send(error.message || 'Internal server error occurred');
  }
});

// Start listening only if executed directly
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Listening on :${PORT}`));
}

// Export for integration testing
module.exports = { app, octokit, slack, genAI };