# ◈ Touchstone — AI Coding Arena

**One prompt. Every AI coding CLI on your machine. Side-by-side results.**

English | [中文](#-touchstone--ai-编程竞技场)

---

Ever wondered which AI actually writes the best code — Claude, GPT, or Gemini? Touchstone turns that question into a one-click experiment. Type a task once, and it fans out to **Claude Code**, **Codex CLI**, and **Gemini CLI** running locally on your machine, fully automated. Minutes later, every model's work renders live in a comparison grid — like those viral "4 AIs, same prompt" videos, except you can run them yourself.

![arena](https://img.shields.io/badge/stack-Express%20·%20React%20·%20Tailwind-d4ff4f) ![local](https://img.shields.io/badge/runs-100%25%20local-d4ff4f)

## ✨ What you get

- **One prompt, parallel runs** — pick any combination of CLIs and models (even two Claude entries with different models racing each other). Each run is a fresh, isolated session.
- **Zero naming chores** — project names are auto-generated from your prompt (via Claude Haiku, with CLI and timestamp fallbacks).
- **Live arena view** — works render in scaled live previews the moment an `index.html` appears; click for fullscreen. Detail pages default to a 2×2 grid with selectable layouts and per-runner filtering.
- **Hard numbers, not vibes** — every run reports duration, token usage, tool-call count, and (for Claude) dollar cost.
- **Community signals** — per-run likes, per-project views, shareable project URLs, and a copyable prompt panel on every detail page.
- **Opt-in publishing** — tick "publish" on a task and finished works are auto-committed and pushed to the public showcase repo, organized as `runs/<project>/<model>/`.
- **Health checks built in** — the UI detects which CLIs are installed and logged in, and tells you exactly how to fix the ones that aren't.

## 🚀 Quick start

```bash
npm run setup   # one-time: install deps + build the web UI
npm start       # http://localhost:3000
```

## Repository layout

Touchstone is organized as a small monorepo:

- `apps/web` — React/Vite web UI and public showcase assets.
- `apps/server` — Express API, WebSocket runner, OAuth, publishing, and static hosting.
- `scripts` — data collection, validation, and deployment utilities.
- `runs` / `data` — local runtime output and persisted server state.

Google sign-in uses a standard OAuth 2.0 Web application client. In Google Cloud Console, create an OAuth client with:

- Application type: `Web application`
- Authorized redirect URI: `http://localhost:3000/api/auth/callback` for local development, or `https://touchstone.jefflin.ai/api/auth/callback` in production

Then start the server with:

```bash
GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... npm start
```

If the public URL is behind a proxy or differs from the request host, also set `PUBLIC_BASE_URL=https://touchstone.jefflin.ai` or `GOOGLE_REDIRECT_URI=https://touchstone.jefflin.ai/api/auth/callback`.

For the `touchstone.jefflin.ai` migration checklist, see [`docs/deploy-touchstone-jefflin-ai.md`](docs/deploy-touchstone-jefflin-ai.md).

GA4 analytics is optional. Create a GA4 Web data stream, then build the web UI with:

```bash
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX npm run build
```

The app sends SPA page views and lightweight product events. User/profile and project routes are reported with sanitized paths like `/u/:user` and `/p/:project` so email addresses and project names are not sent to GA.

Prerequisites: Node.js 20+, plus whichever CLIs you want in the arena:

| CLI | Install | First-time auth |
|---|---|---|
| Claude Code | `npm i -g @anthropic-ai/claude-code` | run `claude` once and log in |
| Codex CLI | `npm i -g @openai/codex` | run `codex login` |
| Gemini CLI | `npm i -g @google/gemini-cli` | run `gemini` once (browser sign-in) |

Missing or unauthenticated CLIs show an amber warning in the UI with the fix.

## ⚙️ How it works

1. You describe a task in the web UI and pick your runners (CLI × model — model lists are probed from each CLI's local config).
2. The server creates `runs/<project>/<model>/` per runner and spawns each CLI there in full-auto mode (`claude -p --dangerously-skip-permissions`, `codex exec --full-auto`, `gemini -p --yolo`).
3. A delivery requirement is appended to every prompt: produce a self-contained `index.html`.
4. Output streams to the UI over WebSocket; as soon as an HTML entry appears, the card previews it live.
5. On completion, metrics are parsed from each CLI's output, and (if you opted in) the work is committed and pushed to the showcase repo.

Everything runs on your machine — your prompts and API usage stay local unless you choose to publish results.

## 🔧 Configuration (`agents.json`)

- Add/remove CLIs, change commands and flags (`{{PROMPT}}` is the placeholder).
- `models`: fallback model suggestions per CLI (local config takes priority).
- `defaults.timeoutMinutes`: per-run timeout (default 20).
- `defaults.git`: `autoCommit` / `autoPush` switches for publishing.
- `defaults.artifactHint`: the delivery requirement appended to prompts.

## ⚠️ Notes

- All CLIs run in skip-confirmation mode. They work inside their run directory, but permissions are not sandboxed — only dispatch tasks you trust.
- Deleting a card deletes its run folder. Logs (`.touchstone.log`) are kept locally and never published.

---

# ◈ Touchstone — AI 编程竞技场

**一个提示词，驱动你本机所有 AI 编程 CLI，结果同台对比。**

[English](#-touchstone--ai-coding-arena) | 中文

---

想知道 Claude、GPT、Gemini 到底谁写代码最强？Touchstone 把这个问题变成一键实验：任务只写一次，自动并行下发给本机的 **Claude Code**、**Codex CLI**、**Gemini CLI** 全自动执行。几分钟后，每个模型的作品在对比网格里实时渲染——就像社交平台上"同题四模型"的爆款视频，但你自己就能跑。

## ✨ 你能得到什么

- **一个提示词，并行竞赛** — 任意组合 CLI 和模型（甚至让两个不同模型的 Claude 同场竞技），每次运行都是全新的独立会话
- **零命名负担** — 项目名根据提示词自动生成（Claude Haiku 总结，CLI / 时间戳兜底）
- **实时竞技场** — 作品一产出 `index.html` 立即等比缩放实时预览，点击全屏；详情页默认 2×2 宫格，列数可选、可按模型筛选
- **数据说话** — 每次运行展示耗时、token 消耗、工具调用次数，Claude 还有美元成本
- **社区信号** — 按模型点赞、按项目统计浏览量、项目页可分享 URL、提示词一键复制
- **可选发布** — 下发任务时勾选"发布"，完成的作品自动 commit 并推送到公开 showcase 仓库，按 `runs/<项目>/<模型>/` 归档
- **内置健康检查** — UI 自动检测各 CLI 是否安装、是否登录，没就绪的会告诉你怎么修

## 🚀 快速开始

```bash
npm run setup   # 一次性：安装依赖 + 构建前端
npm start       # http://localhost:3000
```

## 仓库结构

Touchstone 现在按 monorepo 组织：

- `apps/web` — React/Vite 网页端和公开 showcase 静态资产
- `apps/server` — Express API、WebSocket runner、OAuth、发布和静态托管
- `scripts` — 数据采集、校验和部署工具
- `runs` / `data` — 本地运行产物和服务端持久状态

Google 登录使用标准 OAuth 2.0 Web application client。请在 Google Cloud Console 创建 OAuth client：

- Application type：`Web application`
- Authorized redirect URI：本地开发填 `http://localhost:3000/api/auth/callback`，生产环境填 `https://touchstone.jefflin.ai/api/auth/callback`

启动服务时传入：

```bash
GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... npm start
```

如果公网访问地址经过代理，或和请求 Host 不一致，再设置 `PUBLIC_BASE_URL=https://touchstone.jefflin.ai` 或 `GOOGLE_REDIRECT_URI=https://touchstone.jefflin.ai/api/auth/callback`。

`touchstone.jefflin.ai` 迁移清单见 [`docs/deploy-touchstone-jefflin-ai.md`](docs/deploy-touchstone-jefflin-ai.md)。

GA4 数据分析是可选配置。创建 GA4 Web data stream 后，构建前端时传入：

```bash
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX npm run build
```

应用会发送 SPA 页面浏览和轻量产品事件。用户页和项目页会上报脱敏路径，例如 `/u/:user`、`/p/:project`，避免把邮箱或项目名传给 GA。

前置条件：Node.js 20+，以及你想参赛的 CLI：

| CLI | 安装 | 首次授权 |
|---|---|---|
| Claude Code | `npm i -g @anthropic-ai/claude-code` | 运行一次 `claude` 并登录 |
| Codex CLI | `npm i -g @openai/codex` | `codex login` |
| Gemini CLI | `npm i -g @google/gemini-cli` | 运行一次 `gemini`（浏览器登录） |

未安装或未登录的 CLI 会在界面上显示琥珀色警告和修复方法。

## ⚙️ 工作原理

1. 在网页里描述任务、选择参赛者（CLI × 模型——模型列表从各 CLI 本地配置探测）
2. 服务器为每个参赛者创建 `runs/<项目>/<模型>/` 目录，以全自动模式启动 CLI（`claude -p --dangerously-skip-permissions`、`codex exec --full-auto`、`gemini -p --yolo`）
3. 每个任务自动附加交付要求：产出可直接打开的单文件 `index.html`
4. 输出通过 WebSocket 实时流到页面；HTML 入口一出现，卡片立即实时预览
5. 完成后从各 CLI 输出解析运行指标；如果勾选了发布，作品自动 commit 并推送到 showcase 仓库

一切都在你本机运行——除非你选择发布结果，提示词和 API 用量都不会离开本地。

## 🔧 配置（agents.json）

- 增删 CLI、修改命令和参数（`{{PROMPT}}` 为占位符）
- `models`：各 CLI 的兜底模型清单（本地配置探测结果优先）
- `defaults.timeoutMinutes`：单次运行超时（默认 20 分钟）
- `defaults.git`：发布相关的 `autoCommit` / `autoPush` 开关
- `defaults.artifactHint`：自动附加的交付要求文案

## ⚠️ 注意

- 所有 CLI 以跳过确认的全自动模式运行，工作在各自运行目录内，但权限并未沙箱化——请只下发可信任务
- 删除卡片会同时删除对应运行文件夹；日志（`.touchstone.log`）仅保留在本地，永不发布
