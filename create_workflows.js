/**
 * ══════════════════════════════════════════════════════
 *   n8n Workflow Suite — Bulk Creator
 *   Creates all daily automation workflows via REST API
 * ══════════════════════════════════════════════════════
 * Run: node create_workflows.js <N8N_API_KEY>
 */

const https = require('http');

const API_KEY = process.argv[2];
const BASE    = 'http://localhost:5678';

if (!API_KEY) {
  console.error('Usage: node create_workflows.js <N8N_API_KEY>');
  process.exit(1);
}

// ─── Helper: POST a workflow to n8n API ──────────────────────────────────────
async function createWorkflow(workflow) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      ...workflow,
      settings: workflow.settings || { executionOrder: 'v1' },
      staticData: null,
    });
    const opts = {
      hostname: 'localhost',
      port: 5678,
      path: '/api/v1/workflows',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'X-N8N-API-KEY': API_KEY,
      },
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        const parsed = JSON.parse(data);
        if (parsed.id) resolve(parsed);
        else reject(new Error(`Failed: ${data}`));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── Node builders ────────────────────────────────────────────────────────────
const manualTrigger = (id, pos) => ({
  parameters: {}, id, name: 'Manual Trigger',
  type: 'n8n-nodes-base.manualTrigger', typeVersion: 1, position: pos
});

const scheduleTrigger = (id, pos, cronExpr) => ({
  parameters: { rule: { interval: [{ field: 'cronExpression', expression: cronExpr }] } },
  id, name: 'Schedule Trigger', type: 'n8n-nodes-base.scheduleTrigger',
  typeVersion: 1.2, position: pos
});

const waitApproval = (id, pos, webhookId) => ({
  parameters: { resume: 'webhook', options: {} },
  id, name: '⏸ Wait for Your Approval',
  type: 'n8n-nodes-base.wait', typeVersion: 1.1,
  position: pos, webhookId
});

const httpRequest = (id, pos, name, method, url, body = null) => ({
  parameters: {
    method, url,
    ...(body ? { sendBody: true, specifyBody: 'json', jsonBody: JSON.stringify(body) } : {}),
    options: {}
  },
  id, name, type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: pos
});

const setNode = (id, pos, name, assignments) => ({
  parameters: { assignments: { assignments } },
  id, name, type: 'n8n-nodes-base.set', typeVersion: 3.4, position: pos
});

const codeNode = (id, pos, name, code) => ({
  parameters: { jsCode: code },
  id, name, type: 'n8n-nodes-base.code', typeVersion: 2, position: pos
});

const conn = (from, to) => ({ [from]: { main: [[{ node: to, type: 'main', index: 0 }]] } });
const chain = (...nodes) => Object.assign({}, ...nodes.map((n, i) => i < nodes.length - 1 ? conn(n, nodes[i + 1]) : {}));

// ─── WORKFLOWS ────────────────────────────────────────────────────────────────
const WORKFLOWS = [

  // ── 1. MORNING BRIEFING ────────────────────────────────────────────────────
  {
    name: '⏰ Morning Briefing (Daily 7am)',
    nodes: [
      scheduleTrigger('sched-mb-1', [240, 300], '0 7 * * *'),
      httpRequest('http-mb-weather', [460, 200], 'Get Weather',
        'GET', 'https://wttr.in/Lagos?format=j1'),
      httpRequest('http-mb-news', [460, 400], 'Get Top News',
        'GET', 'https://newsapi.org/v2/top-headlines?country=ng&pageSize=5&apiKey=YOUR_NEWSAPI_KEY'),
      codeNode('code-mb-1', [680, 300], 'Build Briefing Message', `
const weather = $('Get Weather').first().json;
const news = $('Get Top News').first().json;
const temp = weather?.current_condition?.[0]?.temp_C || 'N/A';
const feel = weather?.current_condition?.[0]?.FeelsLikeC || 'N/A';
const desc = weather?.current_condition?.[0]?.weatherDesc?.[0]?.value || '';
const date = new Date().toLocaleDateString('en-GB', {weekday:'long', year:'numeric', month:'long', day:'numeric'});
const headlines = (news?.articles || []).slice(0,5).map((a,i) => \`\${i+1}. \${a.title}\`).join('\\n');
const msg = \`🌅 *GOOD MORNING!*\\n📅 \${date}\\n\\n🌤 *Weather in Lagos:*\\n\${desc}, \${temp}°C (feels like \${feel}°C)\\n\\n📰 *Top News Today:*\\n\${headlines}\\n\\nHave a productive day! 💪\`;
return [{ json: { message: msg } }];
`),
      httpRequest('wa-mb-send', [900, 300], 'Send WhatsApp Briefing',
        'POST', 'https://api.callmebot.com/whatsapp.php',
        null) // configured separately
    ],
    connections: chain('Schedule Trigger', 'Get Weather', 'Build Briefing Message', 'Send WhatsApp Briefing'),
  },

  // ── 2. SEND EMAIL WITH AI DRAFT ───────────────────────────────────────────
  {
    name: '📧 Smart Email Sender (Gmail + AI Draft)',
    nodes: [
      manualTrigger('trig-email-1', [240, 300]),
      setNode('set-email-1', [460, 300], 'Set Email Details', [
        { id: 'e1', name: 'to', value: '', type: 'string' },
        { id: 'e2', name: 'subject', value: '', type: 'string' },
        { id: 'e3', name: 'prompt', value: 'Write a professional email about:', type: 'string' },
      ]),
      httpRequest('ai-email-draft', [680, 300], 'AI Draft Email (OpenAI)',
        'POST', 'https://api.openai.com/v1/chat/completions',
        { model: 'gpt-4o-mini', messages: [{ role: 'user', content: '={{ $json.prompt }}' }] }),
      waitApproval('wait-email-1', [900, 300], 'email-approval-001'),
      { parameters: { resource: 'message', operation: 'send', sendTo: '={{ $("Set Email Details").item.json.to }}', subject: '={{ $("Set Email Details").item.json.subject }}', message: '={{ $("AI Draft Email (OpenAI)").item.json.choices[0].message.content }}', options: {} },
        id: 'gmail-send-1', name: 'Send via Gmail', type: 'n8n-nodes-base.gmail', typeVersion: 2.1, position: [1120, 300] }
    ],
    connections: chain('Manual Trigger', 'Set Email Details', 'AI Draft Email (OpenAI)', '⏸ Wait for Your Approval', 'Send via Gmail'),
  },

  // ── 3. GOOGLE CALENDAR ────────────────────────────────────────────────────
  {
    name: '📅 Calendar Event Creator',
    nodes: [
      manualTrigger('trig-cal-1', [240, 300]),
      setNode('set-cal-1', [460, 300], 'Set Event Details', [
        { id: 'c1', name: 'title', value: 'New Event', type: 'string' },
        { id: 'c2', name: 'start', value: '={{ new Date().toISOString() }}', type: 'string' },
        { id: 'c3', name: 'end', value: '={{ new Date(Date.now() + 3600000).toISOString() }}', type: 'string' },
        { id: 'c4', name: 'description', value: '', type: 'string' },
        { id: 'c5', name: 'location', value: '', type: 'string' },
      ]),
      waitApproval('wait-cal-1', [680, 300], 'calendar-approval-001'),
      { parameters: { resource: 'event', operation: 'create', calendar: { __rl: true, value: 'primary', mode: 'list' }, start: '={{ $("Set Event Details").item.json.start }}', end: '={{ $("Set Event Details").item.json.end }}', summary: '={{ $("Set Event Details").item.json.title }}', additionalFields: { description: '={{ $("Set Event Details").item.json.description }}', location: '={{ $("Set Event Details").item.json.location }}' } },
        id: 'gcal-create-1', name: 'Create Calendar Event', type: 'n8n-nodes-base.googleCalendar', typeVersion: 1.3, position: [900, 300] }
    ],
    connections: chain('Manual Trigger', 'Set Event Details', '⏸ Wait for Your Approval', 'Create Calendar Event'),
  },

  // ── 4. GOOGLE SHEETS LOGGER ───────────────────────────────────────────────
  {
    name: '📊 Google Sheets Data Logger',
    nodes: [
      manualTrigger('trig-gs-1', [240, 300]),
      setNode('set-gs-1', [460, 300], 'Set Sheet Data', [
        { id: 's1', name: 'spreadsheet_url', value: 'YOUR_GOOGLE_SHEET_URL', type: 'string' },
        { id: 's2', name: 'sheet_name', value: 'Sheet1', type: 'string' },
        { id: 's3', name: 'date', value: '={{ new Date().toLocaleDateString("en-GB") }}', type: 'string' },
        { id: 's4', name: 'data', value: 'Enter data here', type: 'string' },
      ]),
      waitApproval('wait-gs-1', [680, 300], 'sheets-approval-001'),
      { parameters: { operation: 'append', documentId: { __rl: true, value: '={{ $("Set Sheet Data").item.json.spreadsheet_url }}', mode: 'url' }, sheetName: { __rl: true, value: '={{ $("Set Sheet Data").item.json.sheet_name }}', mode: 'name' }, columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: [], schema: [] }, options: {} },
        id: 'gsheets-append-1', name: 'Append to Google Sheet', type: 'n8n-nodes-base.googleSheets', typeVersion: 4.5, position: [900, 300] }
    ],
    connections: chain('Manual Trigger', 'Set Sheet Data', '⏸ Wait for Your Approval', 'Append to Google Sheet'),
  },

  // ── 5. GOOGLE DOCS CREATOR ────────────────────────────────────────────────
  {
    name: '📝 Google Docs Creator (AI-Powered)',
    nodes: [
      manualTrigger('trig-gdoc-1', [240, 300]),
      setNode('set-gdoc-1', [460, 300], 'Set Document Details', [
        { id: 'd1', name: 'title', value: '={{ "Document - " + new Date().toLocaleDateString("en-GB") }}', type: 'string' },
        { id: 'd2', name: 'ai_prompt', value: 'Write a professional document about:', type: 'string' },
      ]),
      httpRequest('ai-doc-content', [680, 300], 'Generate Content with AI',
        'POST', 'https://api.openai.com/v1/chat/completions',
        { model: 'gpt-4o-mini', messages: [{ role: 'user', content: '={{ $json.ai_prompt }}' }] }),
      waitApproval('wait-gdoc-1', [900, 300], 'gdoc-approval-001'),
      { parameters: { resource: 'document', operation: 'create', title: '={{ $("Set Document Details").item.json.title }}' },
        id: 'gdoc-create-1', name: 'Create Google Doc', type: 'n8n-nodes-base.googleDocs', typeVersion: 2, position: [1120, 300] }
    ],
    connections: chain('Manual Trigger', 'Set Document Details', 'Generate Content with AI', '⏸ Wait for Your Approval', 'Create Google Doc'),
  },

  // ── 6. AI ASSISTANT ──────────────────────────────────────────────────────
  {
    name: '🤖 AI Assistant (Summarize, Translate, Rewrite)',
    nodes: [
      manualTrigger('trig-ai-1', [240, 300]),
      setNode('set-ai-1', [460, 300], 'Set Task & Input', [
        { id: 'a1', name: 'task', value: 'summarize', type: 'string' },
        { id: 'a2', name: 'text', value: 'Paste your text here', type: 'string' },
        { id: 'a3', name: 'language', value: 'English', type: 'string' },
      ]),
      codeNode('code-ai-prompt', [680, 300], 'Build AI Prompt', `
const task = $json.task;
const text = $json.text;
const lang = $json.language;
const prompts = {
  summarize: \`Summarize the following text concisely in \${lang}:\\n\\n\${text}\`,
  translate: \`Translate the following text to \${lang}:\\n\\n\${text}\`,
  rewrite: \`Rewrite the following text in a professional tone in \${lang}:\\n\\n\${text}\`,
  explain: \`Explain the following in simple terms in \${lang}:\\n\\n\${text}\`,
  proofread: \`Proofread and correct the following text in \${lang}:\\n\\n\${text}\`,
};
return [{ json: { prompt: prompts[task] || \`\${task}:\\n\\n\${text}\` } }];
`),
      httpRequest('ai-process', [900, 300], 'Process with AI',
        'POST', 'https://api.openai.com/v1/chat/completions',
        { model: 'gpt-4o', messages: [{ role: 'user', content: '={{ $json.prompt }}' }] }),
      codeNode('code-ai-out', [1120, 300], 'Extract Result', `
const result = $json.choices?.[0]?.message?.content || 'No result';
return [{ json: { result, task: $('Set Task & Input').first().json.task } }];
`)
    ],
    connections: chain('Manual Trigger', 'Set Task & Input', 'Build AI Prompt', 'Process with AI', 'Extract Result'),
  },

  // ── 7. WEB RESEARCH + AI SUMMARY ─────────────────────────────────────────
  {
    name: '🔍 Web Research + AI Summary',
    nodes: [
      manualTrigger('trig-search-1', [240, 300]),
      setNode('set-search-1', [460, 300], 'Set Search Query', [
        { id: 'q1', name: 'query', value: 'Enter topic to research', type: 'string' },
        { id: 'q2', name: 'num_results', value: '5', type: 'string' },
      ]),
      httpRequest('http-search-1', [680, 300], 'Search the Web (SerpAPI)',
        'GET', 'https://serpapi.com/search.json?q={{ encodeURIComponent($json.query) }}&num={{ $json.num_results }}&api_key=YOUR_SERPAPI_KEY'),
      codeNode('code-search-sum', [900, 300], 'Prepare for AI Summary', `
const results = $json.organic_results || [];
const snippets = results.map((r, i) => \`\${i+1}. \${r.title}\\n\${r.snippet}\\nURL: \${r.link}\`).join('\\n\\n');
return [{ json: { snippets, query: $('Set Search Query').first().json.query } }];
`),
      httpRequest('ai-search-sum', [1120, 300], 'AI Research Summary',
        'POST', 'https://api.openai.com/v1/chat/completions',
        { model: 'gpt-4o-mini', messages: [{ role: 'user', content: '=Summarize these search results about "{{ $json.query }}":\n\n{{ $json.snippets }}' }] }),
      waitApproval('wait-search-1', [1340, 300], 'search-approval-001'),
    ],
    connections: chain('Manual Trigger', 'Set Search Query', 'Search the Web (SerpAPI)', 'Prepare for AI Summary', 'AI Research Summary', '⏸ Wait for Your Approval'),
  },

  // ── 8. FILE ORGANIZER ────────────────────────────────────────────────────
  {
    name: '📁 File Organizer (Local Machine)',
    nodes: [
      manualTrigger('trig-files-1', [240, 300]),
      httpRequest('http-pick-folder', [460, 300], 'Pick Source Folder',
        'GET', 'http://host.docker.internal:3001/pick-folder?title=Select Folder to Organize'),
      codeNode('code-file-check', [680, 300], 'Check Folder Selected', `
const result = $json;
if (result.cancelled) throw new Error('No folder selected');
return [{ json: { folder: result.path } }];
`),
      httpRequest('http-list-files', [900, 300], 'List Files in Folder',
        'GET', 'http://host.docker.internal:3001/list?path={{ encodeURIComponent($json.folder) }}'),
      codeNode('code-file-plan', [1120, 300], 'Plan Organization', `
const items = $json.items.filter(i => i.type === 'file');
const plan = items.map(f => {
  const ext = f.extension?.toLowerCase();
  const categories = {
    images: ['.jpg','.jpeg','.png','.gif','.webp','.svg','.bmp','.ico'],
    documents: ['.pdf','.doc','.docx','.txt','.md','.odt','.rtf'],
    spreadsheets: ['.xlsx','.xls','.csv','.ods'],
    videos: ['.mp4','.avi','.mov','.mkv','.wmv','.flv'],
    audio: ['.mp3','.wav','.flac','.aac','.ogg'],
    code: ['.js','.py','.html','.css','.json','.ts','.php'],
    archives: ['.zip','.rar','.7z','.tar','.gz'],
  };
  let folder = 'Others';
  for (const [cat, exts] of Object.entries(categories)) {
    if (exts.includes(ext)) { folder = cat.charAt(0).toUpperCase() + cat.slice(1); break; }
  }
  return { file: f.fullPath, targetFolder: folder, name: f.name };
});
return plan.map(p => ({ json: p }));
`),
      waitApproval('wait-files-1', [1340, 300], 'files-approval-001'),
    ],
    connections: chain('Manual Trigger', 'Pick Source Folder', 'Check Folder Selected', 'List Files in Folder', 'Plan Organization', '⏸ Wait for Your Approval'),
  },

  // ── 9. EXPENSE TRACKER ───────────────────────────────────────────────────
  {
    name: '💰 Expense Tracker → Google Sheets',
    nodes: [
      manualTrigger('trig-exp-1', [240, 300]),
      setNode('set-exp-1', [460, 300], 'Log Expense', [
        { id: 'ex1', name: 'date', value: '={{ new Date().toLocaleDateString("en-GB") }}', type: 'string' },
        { id: 'ex2', name: 'category', value: 'Food', type: 'string' },
        { id: 'ex3', name: 'description', value: '', type: 'string' },
        { id: 'ex4', name: 'amount', value: '0', type: 'string' },
        { id: 'ex5', name: 'currency', value: 'NGN', type: 'string' },
        { id: 'ex6', name: 'payment_method', value: 'Cash', type: 'string' },
      ]),
      waitApproval('wait-exp-1', [680, 300], 'expense-approval-001'),
      { parameters: { operation: 'append', documentId: { __rl: true, value: 'YOUR_EXPENSE_SHEET_URL', mode: 'url' }, sheetName: { __rl: true, value: 'Expenses', mode: 'name' }, columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: [], schema: [] }, options: {} },
        id: 'gsheets-exp-1', name: 'Save to Expense Sheet', type: 'n8n-nodes-base.googleSheets', typeVersion: 4.5, position: [900, 300] }
    ],
    connections: chain('Manual Trigger', 'Log Expense', '⏸ Wait for Your Approval', 'Save to Expense Sheet'),
  },

  // ── 10. TELEGRAM/WHATSAPP NOTIFIER ───────────────────────────────────────
  {
    name: '💬 Send WhatsApp Notification',
    nodes: [
      manualTrigger('trig-wa-1', [240, 300]),
      setNode('set-wa-1', [460, 300], 'Compose Message', [
        { id: 'w1', name: 'message', value: '🤖 Notification from n8n: Enter your message here', type: 'string' },
        { id: 'w2', name: 'phone', value: 'YOUR_PHONE_NUMBER', type: 'string' },
        { id: 'w3', name: 'apikey', value: 'YOUR_CALLMEBOT_API_KEY', type: 'string' },
      ]),
      waitApproval('wait-wa-1', [680, 300], 'whatsapp-approval-001'),
      httpRequest('http-wa-send', [900, 300], 'Send WhatsApp Message',
        'GET', 'https://api.callmebot.com/whatsapp.php?phone={{ $("Compose Message").item.json.phone }}&text={{ encodeURIComponent($("Compose Message").item.json.message) }}&apikey={{ $("Compose Message").item.json.apikey }}'),
    ],
    connections: chain('Manual Trigger', 'Compose Message', '⏸ Wait for Your Approval', 'Send WhatsApp Message'),
  },

  // ── 11. NEWS DIGEST ──────────────────────────────────────────────────────
  {
    name: '📰 Daily News Digest',
    nodes: [
      scheduleTrigger('sched-news-1', [240, 300], '0 8 * * *'),
      setNode('set-news-1', [460, 300], 'News Topics', [
        { id: 'n1', name: 'topics', value: 'technology, Africa, business', type: 'string' },
        { id: 'n2', name: 'api_key', value: 'YOUR_NEWSAPI_KEY', type: 'string' },
        { id: 'n3', name: 'country', value: 'ng', type: 'string' },
      ]),
      httpRequest('http-news-1', [680, 300], 'Fetch News',
        'GET', 'https://newsapi.org/v2/top-headlines?country={{ $json.country }}&pageSize=10&apiKey={{ $json.api_key }}'),
      codeNode('code-news-fmt', [900, 300], 'Format News Digest', `
const articles = $json.articles || [];
const lines = articles.map((a, i) => \`\${i+1}. *\${a.title}*\\n   _\${a.source?.name}_\\n   \${a.url}\`).join('\\n\\n');
const digest = \`📰 *DAILY NEWS DIGEST*\\n📅 \${new Date().toLocaleDateString('en-GB')}\\n\\n\${lines}\`;
return [{ json: { digest } }];
`),
      httpRequest('wa-news-send', [1120, 300], 'Send News to WhatsApp',
        'GET', 'https://api.callmebot.com/whatsapp.php?phone=YOUR_PHONE&text={{ encodeURIComponent($json.digest) }}&apikey=YOUR_APIKEY'),
    ],
    connections: chain('Schedule Trigger', 'News Topics', 'Fetch News', 'Format News Digest', 'Send News to WhatsApp'),
  },

  // ── 12. WEATHER BRIEFING ─────────────────────────────────────────────────
  {
    name: '🌤️ Weather Briefing',
    nodes: [
      manualTrigger('trig-wthr-1', [240, 300]),
      setNode('set-wthr-1', [460, 300], 'Set Location', [
        { id: 'w1', name: 'city', value: 'Lagos', type: 'string' },
      ]),
      httpRequest('http-weather-1', [680, 300], 'Get Weather Data',
        'GET', 'https://wttr.in/{{ $json.city }}?format=j1'),
      codeNode('code-weather-fmt', [900, 300], 'Format Weather Report', `
const w = $json;
const cur = w.current_condition?.[0] || {};
const city = $('Set Location').first().json.city;
const forecast = (w.weather || []).slice(0, 3).map(day => {
  const date = day.date;
  const max = day.maxtempC;
  const min = day.mintempC;
  const desc = day.hourly?.[4]?.weatherDesc?.[0]?.value || '';
  return \`📆 \${date}: \${desc}, \${min}°-\${max}°C\`;
}).join('\\n');
const msg = \`🌤 *Weather in \${city}*\\n\\n🌡 Now: \${cur.temp_C}°C (feels \${cur.FeelsLikeC}°C)\\n☁ \${cur.weatherDesc?.[0]?.value}\\n💧 Humidity: \${cur.humidity}%\\n🌬 Wind: \${cur.windspeedKmph} km/h\\n\\n📅 *3-Day Forecast:*\\n\${forecast}\`;
return [{ json: { report: msg } }];
`),
    ],
    connections: chain('Manual Trigger', 'Set Location', 'Get Weather Data', 'Format Weather Report'),
  },

  // ── 13. SOCIAL MEDIA POSTER ──────────────────────────────────────────────
  {
    name: '🐦 Social Media Post (with AI Caption)',
    nodes: [
      manualTrigger('trig-sm-1', [240, 300]),
      setNode('set-sm-1', [460, 300], 'Post Details', [
        { id: 'sm1', name: 'topic', value: 'Describe what you want to post about', type: 'string' },
        { id: 'sm2', name: 'platform', value: 'twitter', type: 'string' },
        { id: 'sm3', name: 'tone', value: 'professional', type: 'string' },
      ]),
      httpRequest('ai-caption-1', [680, 300], 'Generate Caption with AI',
        'POST', 'https://api.openai.com/v1/chat/completions',
        { model: 'gpt-4o-mini', messages: [{ role: 'user', content: '=Write a {{ $json.tone }} {{ $json.platform }} post about: {{ $json.topic }}. Add relevant hashtags. Keep it under 280 chars for Twitter.' }] }),
      codeNode('code-sm-1', [900, 300], 'Extract Caption', `
const content = $json.choices?.[0]?.message?.content || '';
return [{ json: { caption: content, platform: $('Post Details').first().json.platform } }];
`),
      waitApproval('wait-sm-1', [1120, 300], 'social-approval-001'),
    ],
    connections: chain('Manual Trigger', 'Post Details', 'Generate Caption with AI', 'Extract Caption', '⏸ Wait for Your Approval'),
  },

  // ── 14. SCREENSHOT SAVER ─────────────────────────────────────────────────
  {
    name: '📸 Screenshot Capture & Save',
    nodes: [
      manualTrigger('trig-ss-1', [240, 300]),
      setNode('set-ss-1', [460, 300], 'Screenshot Settings', [
        { id: 'ss1', name: 'save_folder', value: '={{ "%USERPROFILE%\\\\Pictures\\\\Screenshots\\\\n8n" }}', type: 'string' },
        { id: 'ss2', name: 'filename', value: '={{ "screenshot_" + new Date().toISOString().replace(/[:T.]/g,"_").slice(0,19) + ".png" }}', type: 'string' },
      ]),
      httpRequest('http-ss-create', [680, 300], 'Create Save Folder',
        'POST', 'http://host.docker.internal:3001/create-folder',
        { path: '={{ $("Screenshot Settings").item.json.save_folder }}' }),
    ],
    connections: chain('Manual Trigger', 'Screenshot Settings', 'Create Save Folder'),
  },

  // ── 15. TO-DO TASK MANAGER ───────────────────────────────────────────────
  {
    name: '📋 To-Do Task Logger',
    nodes: [
      manualTrigger('trig-todo-1', [240, 300]),
      setNode('set-todo-1', [460, 300], 'New Task', [
        { id: 't1', name: 'title', value: 'Task title', type: 'string' },
        { id: 't2', name: 'description', value: '', type: 'string' },
        { id: 't3', name: 'priority', value: 'medium', type: 'string' },
        { id: 't4', name: 'due_date', value: '={{ new Date(Date.now() + 86400000).toISOString().split("T")[0] }}', type: 'string' },
        { id: 't5', name: 'status', value: 'todo', type: 'string' },
        { id: 't6', name: 'created_at', value: '={{ new Date().toISOString() }}', type: 'string' },
      ]),
      waitApproval('wait-todo-1', [680, 300], 'todo-approval-001'),
      { parameters: { operation: 'append', documentId: { __rl: true, value: 'YOUR_TASKS_SHEET_URL', mode: 'url' }, sheetName: { __rl: true, value: 'Tasks', mode: 'name' }, columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: [], schema: [] }, options: {} },
        id: 'gsheets-todo-1', name: 'Save Task to Sheet', type: 'n8n-nodes-base.googleSheets', typeVersion: 4.5, position: [900, 300] }
    ],
    connections: chain('Manual Trigger', 'New Task', '⏸ Wait for Your Approval', 'Save Task to Sheet'),
  },

  // ── 16. FILE DOWNLOADER ──────────────────────────────────────────────────
  {
    name: '📦 File Downloader (URL → Local)',
    nodes: [
      manualTrigger('trig-dl-1', [240, 300]),
      setNode('set-dl-1', [460, 300], 'Download Settings', [
        { id: 'dl1', name: 'url', value: 'https://example.com/file.pdf', type: 'string' },
        { id: 'dl2', name: 'save_to', value: '={{ "%USERPROFILE%\\\\Downloads\\\\n8n_downloads" }}', type: 'string' },
        { id: 'dl3', name: 'filename', value: '', type: 'string' },
      ]),
      waitApproval('wait-dl-1', [680, 300], 'download-approval-001'),
      httpRequest('http-dl-file', [900, 300], 'Download File',
        'GET', '={{ $("Download Settings").item.json.url }}'),
    ],
    connections: chain('Manual Trigger', 'Download Settings', '⏸ Wait for Your Approval', 'Download File'),
  },

  // ── 17. GOOGLE SLIDES CREATOR ────────────────────────────────────────────
  {
    name: '📑 Google Slides Creator (AI-Generated)',
    nodes: [
      manualTrigger('trig-slides-1', [240, 300]),
      setNode('set-slides-1', [460, 300], 'Presentation Details', [
        { id: 'sl1', name: 'title', value: 'My Presentation', type: 'string' },
        { id: 'sl2', name: 'topic', value: 'Describe the presentation topic', type: 'string' },
        { id: 'sl3', name: 'num_slides', value: '10', type: 'string' },
      ]),
      httpRequest('ai-slides-outline', [680, 300], 'Generate Slide Outline (AI)',
        'POST', 'https://api.openai.com/v1/chat/completions',
        { model: 'gpt-4o', messages: [{ role: 'user', content: '=Create a {{ $json.num_slides }}-slide presentation outline about "{{ $json.topic }}". Return JSON: { "slides": [{ "title": "...", "points": ["...","..."] }] }' }] }),
      waitApproval('wait-slides-1', [900, 300], 'slides-approval-001'),
      { parameters: { resource: 'presentation', operation: 'create', title: '={{ $("Presentation Details").item.json.title }}' },
        id: 'gslides-create-1', name: 'Create Google Slides', type: 'n8n-nodes-base.googleSlides', typeVersion: 2, position: [1120, 300] }
    ],
    connections: chain('Manual Trigger', 'Presentation Details', 'Generate Slide Outline (AI)', '⏸ Wait for Your Approval', 'Create Google Slides'),
  },

  // ── 18. CANVA DESIGN REQUEST ─────────────────────────────────────────────
  {
    name: '🎨 Canva Design Creator',
    nodes: [
      manualTrigger('trig-canva-1', [240, 300]),
      setNode('set-canva-1', [460, 300], 'Design Brief', [
        { id: 'ca1', name: 'design_type', value: 'instagram_post', type: 'string' },
        { id: 'ca2', name: 'title', value: '={{ "Design - " + new Date().toLocaleDateString("en-GB") }}', type: 'string' },
        { id: 'ca3', name: 'canva_api_token', value: 'YOUR_CANVA_API_TOKEN', type: 'string' },
      ]),
      waitApproval('wait-canva-1', [680, 300], 'canva-approval-002'),
      httpRequest('http-canva-create', [900, 300], 'Create Canva Design',
        'POST', 'https://api.canva.com/rest/v1/designs',
        { title: '={{ $("Design Brief").item.json.title }}', design_type: { type: 'preset', name: '={{ $("Design Brief").item.json.design_type }}' } }),
      codeNode('code-canva-link', [1120, 300], 'Get Edit Link', `
const design = $json.design;
return [{ json: { id: design?.id, edit_url: design?.urls?.edit_url, message: \`Canva design ready! Edit here: \${design?.urls?.edit_url}\` } }];
`)
    ],
    connections: chain('Manual Trigger', 'Design Brief', '⏸ Wait for Your Approval', 'Create Canva Design', 'Get Edit Link'),
  },

];

// ─── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log(`\n🚀 Creating ${WORKFLOWS.length} workflows in n8n...\n`);
  let success = 0, failed = 0;

  for (const wf of WORKFLOWS) {
    try {
      const result = await createWorkflow(wf);
      console.log(`  ✅  ${wf.name} (id: ${result.id})`);
      success++;
    } catch (err) {
      console.error(`  ❌  ${wf.name}: ${err.message}`);
      failed++;
    }
    await new Promise(r => setTimeout(r, 300)); // small delay between requests
  }

  console.log(`\n─────────────────────────────────────`);
  console.log(`✅ Created: ${success}  ❌ Failed: ${failed}`);
  console.log(`🌐 Open n8n: http://localhost:5678/workflows`);
  console.log(`─────────────────────────────────────\n`);
})();
