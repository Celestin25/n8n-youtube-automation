# n8n Work Automation — Local Setup Guide

A full n8n workflow automation environment with PostgreSQL, running on Docker.

## 🚀 Quick Start

### First-time launch
1. Open this folder in **File Explorer** or a terminal
2. Double-click `n8n.bat` **or** run in PowerShell:
   ```powershell
   .\n8n.bat
   ```
3. Wait ~30 seconds for containers to start
4. Open your browser: **http://localhost:5678**
5. Create your owner account on first visit

---

## 🎮 Commands

| Command | What it does |
|---|---|
| `.\n8n.bat` | Start n8n |
| `.\n8n.bat stop` | Stop n8n |
| `.\n8n.bat restart` | Restart n8n |
| `.\n8n.bat logs` | View live logs |
| `.\n8n.bat update` | Pull latest n8n version |
| `.\n8n.bat backup` | Export all workflows to `./backups/` |
| `.\n8n.bat status` | Check container health |

---

## ⚙️ Configuration

Edit `.env` to customize:

| Variable | Default | Description |
|---|---|---|
| `GENERIC_TIMEZONE` | `Africa/Lagos` | Your local timezone |
| `N8N_HOST` | `localhost` | Change to IP for LAN access |
| `POSTGRES_PASSWORD` | `n8nSecurePass2024!` | DB password |
| `N8N_BASIC_AUTH_ACTIVE` | `false` | Enable HTTP auth for internet exposure |

---

## 📁 Folder Structure

```
work_automation/
├── docker-compose.yml    ← Service definitions
├── .env                  ← Secrets & config (keep private!)
├── n8n.bat               ← Launcher script
├── local_files/          ← Drop files here to use in workflows
└── backups/              ← Exported workflow backups land here
```

---

## 🔗 Useful n8n Integrations for Daily Work

| Category | Apps |
|---|---|
| **Email** | Gmail, Outlook, SMTP |
| **Chat** | Slack, Telegram, WhatsApp (via Twilio) |
| **Spreadsheets** | Google Sheets, Airtable, Excel |
| **Calendar** | Google Calendar, Outlook Calendar |
| **Files** | Google Drive, Dropbox, OneDrive |
| **Code/Dev** | GitHub, GitLab, Jira, Linear |
| **AI** | OpenAI, Google Gemini, Anthropic |
| **HTTP** | REST API, Webhook triggers |
| **Database** | PostgreSQL, MySQL, MongoDB, Supabase |
| **Scheduling** | Cron trigger (run on any schedule) |

---

## 💡 Starter Workflow Ideas

1. **Daily email digest** — Summarize emails and send to Telegram each morning
2. **Meeting notes to Sheets** — Auto-parse calendar events → Google Sheets log
3. **AI assistant webhook** — POST text → GPT → formatted reply
4. **File monitor** — Watch a folder → process files → notify on Slack
5. **Form → task** — Google Form submission → create task in Notion/Trello
6. **Social media scheduler** — Google Sheets rows → scheduled posts

---

## 🔒 Securing n8n (if exposing to internet)

1. Set `N8N_BASIC_AUTH_ACTIVE=true` in `.env`
2. Set a strong password in `N8N_BASIC_AUTH_PASSWORD`
3. Or use Cloudflare Tunnel for zero-trust access

---

## 🆙 Updating n8n

```powershell
.\n8n.bat update
```
Your workflows and credentials are **always preserved** in the Docker volume.

---

## 📦 Backup & Restore

**Backup:**
```powershell
.\n8n.bat backup
```

**Restore from backup:**
```powershell
docker exec n8n_app n8n import:workflow --input=/backups/your_backup.json
```

---

## 🛑 Troubleshooting

| Issue | Fix |
|---|---|
| Port 5678 in use | Change `"5678:5678"` to e.g. `"5679:5678"` in `docker-compose.yml` |
| Can't connect to DB | Run `.\n8n.bat logs` and check postgres health |
| Forgot account password | Go to http://localhost:5678 → "Forgot password" |
| Container won't start | Run `docker compose down -v` then `.\n8n.bat` (⚠️ clears DB) |
