// Tab switching logic based on explicit class toggling rather than positions
function switchTab(name) {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(t => {
    const onclickAttr = t.getAttribute('onclick') || '';
    t.classList.toggle('active', onclickAttr.includes(`'${name}'`));
  });
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  
  const targetSection = document.getElementById('tab-' + name);
  if (targetSection) {
    targetSection.classList.add('active');
  }
}

// Generate the webhook URL display text dynamically based on current values
function updateWebhook() {
  const owner = document.getElementById('gh-owner').value || 'owner';
  const repo = document.getElementById('gh-repo').value || 'repo';
  // Let the user configure their host, default to your-server.com
  const hostInput = document.getElementById('server-host');
  const host = (hostInput && hostInput.value) || 'https://your-server.com';
  
  const formattedHost = host.endsWith('/') ? host.slice(0, -1) : host;
  const url = `${formattedHost}/webhook/github`;
  
  const display = document.getElementById('webhook-display');
  if (display) {
    display.textContent = url;
  }
}

// Save configuration to localStorage
function saveConfig() {
  const config = {
    ghOwner: document.getElementById('gh-owner').value,
    ghRepo: document.getElementById('gh-repo').value,
    ghToken: document.getElementById('gh-token').value,
    slChannel: document.getElementById('sl-channel').value,
    slMention: document.getElementById('sl-mention').value,
    slToken: document.getElementById('sl-token').value,
    optSummary: document.getElementById('opt-summary').checked,
    optFiles: document.getElementById('opt-files').checked,
    optStats: document.getElementById('opt-stats').checked,
    optAuthor: document.getElementById('opt-author').checked,
    optCompare: document.getElementById('opt-compare').checked,
    optContext: document.getElementById('opt-context').value,
    serverHost: (document.getElementById('server-host') && document.getElementById('server-host').value) || ''
  };

  localStorage.setItem('deploy_notifier_config', JSON.stringify(config));

  // Show "Saved" toast
  const flash = document.getElementById('saved-flash');
  if (flash) {
    flash.classList.add('show');
    setTimeout(() => flash.classList.remove('show'), 2000);
  }
  
  updateWebhook();
}

// Load configuration from localStorage
function loadConfig() {
  const data = localStorage.getItem('deploy_notifier_config');
  if (data) {
    try {
      const config = JSON.parse(data);
      if (config.ghOwner !== undefined) document.getElementById('gh-owner').value = config.ghOwner;
      if (config.ghRepo !== undefined) document.getElementById('gh-repo').value = config.ghRepo;
      if (config.ghToken !== undefined) document.getElementById('gh-token').value = config.ghToken;
      if (config.slChannel !== undefined) document.getElementById('sl-channel').value = config.slChannel;
      if (config.slMention !== undefined) document.getElementById('sl-mention').value = config.slMention;
      if (config.slToken !== undefined) document.getElementById('sl-token').value = config.slToken;
      
      if (config.optSummary !== undefined) document.getElementById('opt-summary').checked = config.optSummary;
      if (config.optFiles !== undefined) document.getElementById('opt-files').checked = config.optFiles;
      if (config.optStats !== undefined) document.getElementById('opt-stats').checked = config.optStats;
      if (config.optAuthor !== undefined) document.getElementById('opt-author').checked = config.optAuthor;
      if (config.optCompare !== undefined) document.getElementById('opt-compare').checked = config.optCompare;
      if (config.optContext !== undefined) document.getElementById('opt-context').value = config.optContext;
      
      const hostInput = document.getElementById('server-host');
      if (hostInput && config.serverHost !== undefined) {
        hostInput.value = config.serverHost;
      }
    } catch (e) {
      console.error('Failed to parse config from localStorage', e);
    }
  }
  updateWebhook();
}

// Copy webhook URL to clipboard
function copyWebhook() {
  const display = document.getElementById('webhook-display');
  if (display) {
    const url = display.textContent.trim();
    navigator.clipboard.writeText(url).then(() => {
      showCopyTooltip(document.querySelector('.webhook-box .btn'));
    }).catch(() => {});
  }
}

// Copy Node.js server listener code to clipboard
function copyCode() {
  const codeEl = document.getElementById('code-preview');
  if (codeEl) {
    const code = codeEl.textContent;
    navigator.clipboard.writeText(code).then(() => {
      showCopyTooltip(document.querySelector('#tab-webhook .actions .btn'));
    }).catch(() => {});
  }
}

// Temporarily change button state to show code copied successfully
function showCopyTooltip(btn) {
  if (!btn) return;
  const originalHTML = btn.innerHTML;
  btn.innerHTML = `<i class="ti ti-circle-check" aria-hidden="true"></i> Copied!`;
  btn.style.borderColor = '#639922';
  btn.style.color = '#3b6d11';
  btn.style.background = '#eaf3de';
  setTimeout(() => {
    btn.innerHTML = originalHTML;
    btn.style.borderColor = '';
    btn.style.color = '';
    btn.style.background = '';
  }, 2000);
}

// Triggered when user asks Gemini to generate a test notification or asks how to deploy
function sendTestPrompt() {
  sendPrompt('Write a realistic example Slack deploy notification message for a Node.js API that added rate limiting and changed JWT expiry, formatted in Slack markdown with emoji.');
}

// Shows a beautiful simulated Gemini AI response modal
function sendPrompt(promptText) {
  let modal = document.getElementById('ai-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'ai-modal';
    modal.className = 'ai-modal-overlay';
    modal.innerHTML = `
      <div class="ai-modal-content">
        <div class="ai-modal-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div class="ai-avatar"><i class="ti ti-sparkles" aria-hidden="true"></i></div>
            <div>
              <strong style="color: var(--color-text-primary);">Gemini Assistant</strong>
              <div style="font-size: 11px; color: var(--color-text-tertiary);">Simulated API Response</div>
            </div>
          </div>
          <button class="ai-modal-close" onclick="closeAIModal()"><i class="ti ti-x" aria-hidden="true"></i></button>
        </div>
        <div class="ai-modal-body">
          <div class="ai-prompt-bubble">
            <strong>Prompt:</strong>
            <p id="modal-prompt-text"></p>
          </div>
          <div class="ai-response-bubble">
            <div id="modal-response-loading" class="ai-loading">
              <span class="dot"></span><span class="dot"></span><span class="dot"></span>
            </div>
            <div id="modal-response-text" class="ai-response-content markdown-body"></div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  document.getElementById('modal-prompt-text').textContent = promptText;
  const responseTextEl = document.getElementById('modal-response-text');
  const loadingEl = document.getElementById('modal-response-loading');

  responseTextEl.style.display = 'none';
  responseTextEl.innerHTML = '';
  loadingEl.style.display = 'flex';
  modal.classList.add('show');

  // Generate simulated response
  setTimeout(() => {
    loadingEl.style.display = 'none';
    responseTextEl.style.display = 'block';

    let responseHTML = '';
    if (promptText.includes('Slack deploy notification')) {
      const channel = document.getElementById('sl-channel').value || '#deployments';
      const mention = document.getElementById('sl-mention').value ? `${document.getElementById('sl-mention').value} ` : '';
      responseHTML = `
        <p>Here is a Slack markdown message preview matching your settings to be posted in <strong>${channel}</strong>:</p>
        <pre><code>🚀 *Deployed to production* · \`a3f9c12\`
*feat: add rate limiting to /api/auth endpoints* — @maya

${mention}This deployment adds rate limiting middleware to prevent authentication brute-forcing and reduces JWT expirations.

*What changed:*
• Implemented per-IP rate limiting (100 req/min) on auth routes using Redis.
• Updated JWT expiry from 7 days to 24 hours to match the new security policy.
• Added Redis connection pooling for optimal performance under load.

\`\`\`
+42 -3   src/middleware/rateLimiter.ts
+12 -1   src/routes/auth.ts
+5  -0   src/config/redis.ts
\`\`\`</code></pre>
      `;
    } else {
      responseHTML = `
        <h3>Deploying the Notifier Webhook Server</h3>
        <p>To self-host the listener server (<code>index.js</code>), you need to set the following environment variables:</p>
        <ul>
          <li><code>GH_TOKEN</code>: Your GitHub Personal Access Token (requires <code>repo</code> access).</li>
          <li><code>SLACK_TOKEN</code>: Your Slack Bot User OAuth Token (requires <code>chat:write</code>).</li>
          <li><code>SLACK_CHANNEL</code>: The target Slack channel (e.g. <code>#deployments</code>).</li>
          <li><code>GEMINI_API_KEY</code>: Your Google AI Studio API key.</li>
        </ul>

        <h4>Option A: Deploying to Railway</h4>
        <ol>
          <li>Sign in to <a href="https://railway.app" target="_blank" style="color: var(--color-text-info);">Railway</a> and click <strong>New Project</strong>.</li>
          <li>Select <strong>Deploy from GitHub repo</strong> and select this repository.</li>
          <li>Add the required variables in the <strong>Variables</strong> tab.</li>
          <li>Railway will auto-detect the Node.js server and deploy it. Copy your service URL.</li>
        </ol>

        <h4>Option B: Deploying to Render</h4>
        <ol>
          <li>Sign in to <a href="https://render.com" target="_blank" style="color: var(--color-text-info);">Render</a> and click <strong>New Web Service</strong>.</li>
          <li>Connect your GitHub repository.</li>
          <li>Set the Start Command to <code>node index.js</code>.</li>
          <li>Under <strong>Advanced</strong>, add your environment variables.</li>
          <li>Click <strong>Create Web Service</strong> and copy your new URL.</li>
        </ol>
      `;
    }
    responseTextEl.innerHTML = responseHTML;
  }, 1000);
}

function closeAIModal() {
  const modal = document.getElementById('ai-modal');
  if (modal) {
    modal.classList.remove('show');
  }
}

// Run config loader on startup
window.addEventListener('DOMContentLoaded', loadConfig);
