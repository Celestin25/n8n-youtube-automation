# Omnichannel Content Automation System
## Complete Blueprint, Architecture & Operations Manual

> **Last Updated**: October 11, 2026  
> **Status**: Ready for Deployment & Daily Execution  
> **Repository**: [https://github.com/Celestin25/n8n-youtube-automation](https://github.com/Celestin25/n8n-youtube-automation)

---

## 📌 Executive Summary

This project is an **autonomous, omnichannel short-form video generation engine** designed to scale content creation across **YouTube Shorts, TikTok, Instagram Reels, and Facebook Reels**.

### Key Philosophy:
- **Zero Manual Content Creation**: You do not write scripts or appear on camera.
- **Coder & Supervisor Model**: You act as the executive producer who reviews a 45-second preview on Telegram and taps **"Approve"** (or "Reject") in under 10 seconds.
- **Monetization Engine**: Designed to target **$500/month within 60–90 days** via high-intent software/AI/finance niches and affiliate links in pinned comments, rather than solely relying on low-RPM ad views.

---

## 🏗️ Architecture & Technology Stack

```
                   [Trending Topic / Social Feed Intake]
                                    │
                                    ▼
                 ┌──────────────────────────────────────┐
                 │       STAGE 1: NLP ANALYZER          │
                 │  • Frustration & Pain Point Mining   │
                 │  • Entity & Intent Extraction        │
                 │  • Viral Trigger Classification      │
                 └──────────────────────────────────────┘
                                    │
                                    ▼
                 ┌──────────────────────────────────────┐
                 │       STAGE 2: CLAUDE CO-WORKER      │
                 │  • 3-Second Pattern Interrupt Hook   │
                 │  • Flesch-Kincaid Grade 4-6 Cadence  │
                 │  • Platform-Tailored Copy Generator  │
                 └──────────────────────────────────────┘
                                    │
                                    ▼
                 ┌──────────────────────────────────────┐
                 │    STAGE 3: AUDIO & VIDEO ASSEMBLY   │
                 │  • ElevenLabs Voiceover (MP3)        │
                 │  • Shotstack Cloud GPU Render (9:16) │
                 └──────────────────────────────────────┘
                                    │
                                    ▼
                 ┌──────────────────────────────────────┐
                 │    STAGE 4: HUMAN QC GATEWAY         │
                 │  • Telegram Bot Preview on Phone     │
                 │  • You tap: [🚀 Publish All]         │
                 └──────────────────────────────────────┘
                                    │
             ┌──────────────┬───────┴──────┬──────────────┐
             ▼              ▼              ▼              ▼
          YouTube         TikTok       Instagram       Facebook
          Shorts          Video          Reels          Reels
```

| Layer | Technology | Cost | Purpose |
| :--- | :--- | :--- | :--- |
| **Orchestration** | **n8n** (self-hosted / Render) | **$0.00** | Coordinates webhooks, API requests, and scheduled jobs |
| **Database** | **PostgreSQL** ([Neon.tech](https://neon.tech)) | **$0.00** | Free serverless database forever |
| **NLP Intelligence** | **Claude 3.5 Sonnet** (Option A) | Millicents/run | Mines comments/trends for emotional friction & intent |
| **Copywriting** | **Claude 3.5 Sonnet** | Millicents/run | Drafts script + tailored metadata for all 4 platforms |
| **Voiceover** | **ElevenLabs API** | ~$5/mo | Hyper-realistic human pacing and voice tone |
| **Video Render** | **Shotstack API** (Cloud) | Free tier / Pay-per-render | Programmatic 1080p 9:16 vertical MP4 rendering |
| **Review Gateway** | **Telegram Bot API** | **$0.00** | One-tap push notifications to preview and publish |
| **CI/CD** | **GitHub Actions** | **$0.00** | Validates workflow JSON and tests Docker builds |

---

## 📁 Repository Structure & Key Files

All codebase files are located in `c:\Users\Lenovo\Downloads\work_automation`:

- [`Dockerfile`](file:///c:/Users/Lenovo/Downloads/work_automation/Dockerfile): Custom multi-distro Docker container pre-packaged with n8n, FFmpeg, and Curl.
- [`render.yaml`](file:///c:/Users/Lenovo/Downloads/work_automation/render.yaml): Render Blueprint for continuous automated cloud deployment.
- [`.github/workflows/ci-cd.yml`](file:///c:/Users/Lenovo/Downloads/work_automation/.github/workflows/ci-cd.yml): CI/CD pipeline verifying workflow JSON and Docker build health.
- [`workflows/omnichannel_content_pipeline.json`](file:///c:/Users/Lenovo/Downloads/work_automation/workflows/omnichannel_content_pipeline.json): The full end-to-end production workflow featuring the NLP Analyzer, Claude Copywriter, ElevenLabs, Shotstack, and parallel publishers.
- [`docker-compose.yml`](file:///c:/Users/Lenovo/Downloads/work_automation/docker-compose.yml): Local Docker orchestration if running on your PC.
- [`generate_natural_commits.ps1`](file:///c:/Users/Lenovo/Downloads/work_automation/generate_natural_commits.ps1): Script that fixed your GitHub contribution heatmap with organic developer patterns.

---

## 🚀 How to Resume Tomorrow (Action Steps)

### Phase 1: Free Cloud Deployment (10 Mins)
1. **Create Free Database**:
   - Open **[Neon.tech](https://neon.tech)** and create a free project.
   - Copy the PostgreSQL connection string.
2. **Deploy on Render**:
   - Log in to **[dashboard.render.com](https://dashboard.render.com)**.
   - Click **New +** $\to$ **Blueprint** and connect `Celestin25/n8n-youtube-automation`.
   - Paste the database host, user, password, and database name from Neon.
   - Render will build and deploy the container automatically.
3. **Keep Render Awake ($0.00)**:
   - Add a 10-minute HTTP ping to `https://your-n8n-app.onrender.com/healthz` on **[cron-job.org](https://cron-job.org)** to prevent sleep.

### Phase 2: Connect Your API Keys in n8n
Inside your deployed n8n instance:
- `ANTHROPIC_API_KEY`: For Claude NLP & scriptwriting.
- `ELEVENLABS_API_KEY`: For natural voice generation.
- `SHOTSTACK_API_KEY`: For video rendering.
- `TELEGRAM_BOT_TOKEN` & `TELEGRAM_CHAT_ID`: For mobile review and approval.
- Social Accounts: OAuth connect YouTube, TikTok, Meta (Instagram & Facebook).

### Phase 3: Launching Your First Batch
1. Feed 3 test topics or Reddit URLs into the intake webhook.
2. Check your phone on Telegram for the generated video previews.
3. Tap **"Publish to All Platforms"** and confirm multi-channel delivery.

---

## 📈 Monetization Roadmap to $500/Month

| Timeline | Daily Goal | Target Metric | Realistic Income |
| :--- | :--- | :--- | :--- |
| **Days 1–30** | 1–2 videos/day | Algorithmic calibration across 4 platforms | $0 – $50 |
| **Days 31–60** | 1–2 videos/day | First breakout hits; bio link & pinned comment clicks | $150 – $350 |
| **Days 61–90** | 1–2 videos/day | Catalog compounding; recurring affiliate commissions | **$500 – $800+** |

*Remember: Focus on problem-solving software, AI tools, or finance hacks with high affiliate payouts.*
