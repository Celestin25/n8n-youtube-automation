/**
 * ╔═══════════════════════════════════════════════════════╗
 * ║         n8n Local File System Agent                   ║
 * ║  Bridges n8n (Docker) ↔ Your Windows File System     ║
 * ║  Running on: http://localhost:3001                    ║
 * ╚═══════════════════════════════════════════════════════╝
 *
 * Endpoints:
 *  GET  /status              — Health check
 *  GET  /list                — List files/folders in a path
 *  POST /open-folder         — Open folder in Windows Explorer
 *  POST /save-file           — Save content to a local file
 *  GET  /read-file           — Read a local file's content
 *  POST /move-file           — Move/rename a file
 *  POST /delete-file         — Delete a file
 *  POST /create-folder       — Create a new folder
 *  GET  /pick-folder         — Open folder picker dialog (PowerShell)
 *  GET  /pick-file           — Open file picker dialog (PowerShell)
 *  POST /open-file           — Open a file with its default app
 *  GET  /drives              — List available drives
 *  GET  /recent              — List recently modified files in a path
 */

const express = require('express');
const cors    = require('cors');
const fs      = require('fs');
const path    = require('path');
const { execSync, exec, spawn } = require('child_process');

const app  = express();
const PORT = 3001;

// ─── Security: Only allow requests from localhost & n8n container ────────────
const ALLOWED_ORIGINS = [
  'http://localhost:5678',
  'http://127.0.0.1:5678',
  'http://localhost:3001',
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) callback(null, true);
    else callback(new Error('Not allowed by CORS'));
  }
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Logging middleware ───────────────────────────────────────────────────────
app.use((req, res, next) => {
  const time = new Date().toLocaleTimeString('en-GB');
  console.log(`[${time}] ${req.method} ${req.path}`, req.body || req.query);
  next();
});

// ─── Helper: Safe path resolution ────────────────────────────────────────────
function resolvePath(inputPath) {
  if (!inputPath) return null;
  // Expand common shortcuts
  inputPath = inputPath
    .replace(/^~/, process.env.USERPROFILE || process.env.HOME)
    .replace('%USERPROFILE%', process.env.USERPROFILE)
    .replace('%DESKTOP%', path.join(process.env.USERPROFILE, 'Desktop'))
    .replace('%DOWNLOADS%', path.join(process.env.USERPROFILE, 'Downloads'))
    .replace('%DOCUMENTS%', path.join(process.env.USERPROFILE, 'Documents'));
  return path.resolve(inputPath);
}

// ─── GET /status ─────────────────────────────────────────────────────────────
app.get('/status', (req, res) => {
  res.json({
    status: 'online',
    agent: 'n8n Local File Agent v1.0',
    machine: require('os').hostname(),
    user: process.env.USERNAME || process.env.USER,
    userProfile: process.env.USERPROFILE,
    time: new Date().toISOString(),
    commonPaths: {
      desktop:   path.join(process.env.USERPROFILE, 'Desktop'),
      downloads: path.join(process.env.USERPROFILE, 'Downloads'),
      documents: path.join(process.env.USERPROFILE, 'Documents'),
      n8nFiles:  path.resolve(__dirname, '..', 'local_files'),
    }
  });
});

// ─── GET /drives ─────────────────────────────────────────────────────────────
app.get('/drives', (req, res) => {
  try {
    const result = execSync(
      'wmic logicaldisk get DeviceID,DriveType,FreeSpace,Size,VolumeName /format:csv',
      { encoding: 'utf8' }
    );
    const lines = result.split('\n').filter(l => l.trim() && !l.startsWith('Node'));
    const drives = lines.map(line => {
      const parts = line.split(',');
      return {
        drive:     parts[1]?.trim(),
        type:      parts[2]?.trim(),
        freeSpace: parts[3]?.trim(),
        size:      parts[4]?.trim(),
        name:      parts[5]?.trim(),
      };
    }).filter(d => d.drive);
    res.json({ drives });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /list ────────────────────────────────────────────────────────────────
// Query params: path, showHidden (bool), filter (extension e.g. ".pdf")
app.get('/list', (req, res) => {
  const folderPath = resolvePath(req.query.path || process.env.USERPROFILE);
  const showHidden = req.query.showHidden === 'true';
  const filter     = req.query.filter || '';

  if (!fs.existsSync(folderPath)) {
    return res.status(404).json({ error: `Path not found: ${folderPath}` });
  }

  try {
    const items = fs.readdirSync(folderPath, { withFileTypes: true });
    const result = items
      .filter(item => showHidden || !item.name.startsWith('.'))
      .filter(item => !filter || item.name.endsWith(filter))
      .map(item => {
        const fullPath = path.join(folderPath, item.name);
        let stats = {};
        try { stats = fs.statSync(fullPath); } catch {}
        return {
          name:         item.name,
          type:         item.isDirectory() ? 'folder' : 'file',
          extension:    item.isFile() ? path.extname(item.name) : null,
          size:         stats.size || 0,
          modified:     stats.mtime?.toISOString() || null,
          fullPath:     fullPath,
        };
      })
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

    res.json({
      path:    folderPath,
      count:   result.length,
      items:   result,
    });
  } catch (err) {
    res.status(500).json({ error: err.message, path: folderPath });
  }
});

// ─── POST /open-folder ────────────────────────────────────────────────────────
// Body: { path: "C:\\Users\\..." }
app.post('/open-folder', (req, res) => {
  const folderPath = resolvePath(req.body.path || process.env.USERPROFILE);

  if (!fs.existsSync(folderPath)) {
    return res.status(404).json({ error: `Folder not found: ${folderPath}` });
  }

  try {
    exec(`explorer.exe "${folderPath}"`);
    res.json({ success: true, opened: folderPath, message: `Opened: ${folderPath}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /open-file ─────────────────────────────────────────────────────────
// Body: { path: "C:\\Users\\...\\file.pdf" }
app.post('/open-file', (req, res) => {
  const filePath = resolvePath(req.body.path);
  if (!filePath) return res.status(400).json({ error: 'path is required' });
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: `File not found: ${filePath}` });

  try {
    exec(`start "" "${filePath}"`);
    res.json({ success: true, opened: filePath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /read-file ───────────────────────────────────────────────────────────
// Query params: path, encoding (default: utf8)
app.get('/read-file', (req, res) => {
  const filePath = resolvePath(req.query.path);
  if (!filePath) return res.status(400).json({ error: 'path is required' });
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: `File not found: ${filePath}` });

  const encoding = req.query.encoding || 'utf8';
  try {
    const stats   = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, encoding);
    res.json({
      path:      filePath,
      name:      path.basename(filePath),
      extension: path.extname(filePath),
      size:      stats.size,
      modified:  stats.mtime.toISOString(),
      content:   content,
      encoding:  encoding,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /save-file ──────────────────────────────────────────────────────────
// Body: { path: "...", content: "...", encoding: "utf8", overwrite: true }
app.post('/save-file', (req, res) => {
  const { content, encoding = 'utf8', overwrite = true } = req.body;
  const filePath = resolvePath(req.body.path);

  if (!filePath) return res.status(400).json({ error: 'path is required' });
  if (content === undefined) return res.status(400).json({ error: 'content is required' });

  if (!overwrite && fs.existsSync(filePath)) {
    return res.status(409).json({ error: `File already exists: ${filePath}. Set overwrite: true to replace.` });
  }

  try {
    // Create parent directories if needed
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, encoding);
    const stats = fs.statSync(filePath);
    res.json({
      success:  true,
      path:     filePath,
      size:     stats.size,
      message:  `File saved to ${filePath}`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /move-file ──────────────────────────────────────────────────────────
// Body: { from: "...", to: "..." }
app.post('/move-file', (req, res) => {
  const from = resolvePath(req.body.from);
  const to   = resolvePath(req.body.to);

  if (!from || !to) return res.status(400).json({ error: 'from and to are required' });
  if (!fs.existsSync(from)) return res.status(404).json({ error: `Source not found: ${from}` });

  try {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.renameSync(from, to);
    res.json({ success: true, from, to, message: `Moved: ${from} → ${to}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /delete-file ───────────────────────────────────────────────────────
// Body: { path: "...", confirm: true }
app.post('/delete-file', (req, res) => {
  const filePath = resolvePath(req.body.path);
  if (!filePath) return res.status(400).json({ error: 'path is required' });
  if (!req.body.confirm) return res.status(400).json({ error: 'Set confirm: true to delete' });
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: `Not found: ${filePath}` });

  try {
    const stats = fs.statSync(filePath);
    if (stats.isDirectory()) fs.rmSync(filePath, { recursive: true });
    else fs.unlinkSync(filePath);
    res.json({ success: true, deleted: filePath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /create-folder ─────────────────────────────────────────────────────
// Body: { path: "..." }
app.post('/create-folder', (req, res) => {
  const folderPath = resolvePath(req.body.path);
  if (!folderPath) return res.status(400).json({ error: 'path is required' });

  try {
    fs.mkdirSync(folderPath, { recursive: true });
    res.json({ success: true, created: folderPath, message: `Folder created: ${folderPath}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /pick-folder ────────────────────────────────────────────────────────
// Opens a Windows folder picker dialog and returns chosen path
app.get('/pick-folder', (req, res) => {
  const title      = req.query.title || 'Select a Folder';
  const startPath  = resolvePath(req.query.startPath || process.env.USERPROFILE);

  const psScript = `
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = '${title}'
$dialog.SelectedPath = '${startPath.replace(/\\/g, '\\\\')}'
$dialog.ShowNewFolderButton = $true
$result = $dialog.ShowDialog()
if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
  Write-Output $dialog.SelectedPath
} else {
  Write-Output 'CANCELLED'
}
`;
  exec(`powershell -WindowStyle Hidden -Command "${psScript.replace(/\n/g, ' ')}"`,
    { timeout: 60000 },
    (err, stdout) => {
      if (err) return res.status(500).json({ error: err.message });
      const chosen = stdout.trim();
      if (chosen === 'CANCELLED' || !chosen) {
        return res.json({ cancelled: true, path: null });
      }
      res.json({ cancelled: false, path: chosen, message: `Selected: ${chosen}` });
    }
  );
});

// ─── GET /pick-file ───────────────────────────────────────────────────────────
// Opens a Windows file picker dialog
// Query: title, startPath, filter (e.g. "PDF files|*.pdf|All files|*.*")
app.get('/pick-file', (req, res) => {
  const title     = req.query.title || 'Select a File';
  const startPath = resolvePath(req.query.startPath || process.env.USERPROFILE);
  const filter    = req.query.filter || 'All files|*.*';

  const psScript = `
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Title = '${title}'
$dialog.InitialDirectory = '${startPath.replace(/\\/g, '\\\\')}'
$dialog.Filter = '${filter}'
$dialog.Multiselect = $false
$result = $dialog.ShowDialog()
if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
  Write-Output $dialog.FileName
} else {
  Write-Output 'CANCELLED'
}
`;
  exec(`powershell -WindowStyle Hidden -Command "${psScript.replace(/\n/g, ' ')}"`,
    { timeout: 60000 },
    (err, stdout) => {
      if (err) return res.status(500).json({ error: err.message });
      const chosen = stdout.trim();
      if (chosen === 'CANCELLED' || !chosen) {
        return res.json({ cancelled: true, path: null });
      }
      res.json({
        cancelled:  false,
        path:       chosen,
        name:       path.basename(chosen),
        extension:  path.extname(chosen),
        message:    `Selected: ${chosen}`,
      });
    }
  );
});

// ─── GET /recent ──────────────────────────────────────────────────────────────
// Query: path, limit (default 20), hours (modified within last N hours)
app.get('/recent', (req, res) => {
  const folderPath = resolvePath(req.query.path || process.env.USERPROFILE);
  const limit      = parseInt(req.query.limit) || 20;
  const hours      = parseInt(req.query.hours) || 24;

  if (!fs.existsSync(folderPath)) {
    return res.status(404).json({ error: `Path not found: ${folderPath}` });
  }

  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  const results = [];

  function scan(dir, depth = 0) {
    if (depth > 3) return; // don't go too deep
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        if (item.name.startsWith('.')) continue;
        const fullPath = path.join(dir, item.name);
        try {
          const stats = fs.statSync(fullPath);
          if (item.isFile() && stats.mtime > cutoff) {
            results.push({
              name:      item.name,
              path:      fullPath,
              size:      stats.size,
              modified:  stats.mtime.toISOString(),
              extension: path.extname(item.name),
            });
          } else if (item.isDirectory() && depth < 3) {
            scan(fullPath, depth + 1);
          }
        } catch {}
      }
    } catch {}
  }

  scan(folderPath);
  results.sort((a, b) => new Date(b.modified) - new Date(a.modified));

  res.json({
    path:    folderPath,
    hours:   hours,
    count:   Math.min(results.length, limit),
    files:   results.slice(0, limit),
  });
});

// ─── 404 catch-all ────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    error:     'Endpoint not found',
    available: [
      'GET  /status',
      'GET  /drives',
      'GET  /list?path=C:\\Users\\...',
      'POST /open-folder  { path }',
      'POST /open-file    { path }',
      'GET  /read-file?path=...',
      'POST /save-file    { path, content }',
      'POST /move-file    { from, to }',
      'POST /delete-file  { path, confirm: true }',
      'POST /create-folder { path }',
      'GET  /pick-folder?title=...&startPath=...',
      'GET  /pick-file?title=...&filter=...',
      'GET  /recent?path=...&hours=24',
    ]
  });
});

// ─── Start server ─────────────────────────────────────────────────────────────
app.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║       n8n Local File System Agent                ║');
  console.log(`║       Listening on http://localhost:${PORT}         ║`);
  console.log('║       n8n can now access your local files!       ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
  console.log('Available at:');
  console.log(`  http://localhost:${PORT}/status`);
  console.log(`  http://localhost:${PORT}/list?path=C:\\Users\\${process.env.USERNAME}`);
  console.log('');
  console.log('Press Ctrl+C to stop.');
  console.log('');
});
