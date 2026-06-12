# Deploy Touchstone on touchstone.jefflin.ai

This app should run as a normal Node.js service behind Cloudflare. Do not deploy only `web/dist` to Cloudflare Pages unless you intentionally want a static preview without login, API, WebSocket, task execution, or workspace previews.

## Target

- Public URL: `https://touchstone.jefflin.ai`
- Node origin: `http://localhost:3000`
- Google OAuth callback: `https://touchstone.jefflin.ai/api/auth/callback`

## Server Environment

Create `/opt/touchstone/.env` from `.env.example`:

```bash
PORT=3000
PUBLIC_BASE_URL=https://touchstone.jefflin.ai
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
ANTHROPIC_API_KEY=...
```

`ANTHROPIC_API_KEY` is optional. It is only used for faster project naming; the app falls back to the local Claude CLI and then timestamp naming.

## Google OAuth

In Google Cloud Console, create or update an OAuth 2.0 Web application client:

- Authorized JavaScript origin: `https://touchstone.jefflin.ai`
- Authorized redirect URI: `https://touchstone.jefflin.ai/api/auth/callback`

## Build And Run

```bash
npm install
npm --prefix web install
npm run build
npm start
```

Verify locally:

```bash
curl --noproxy '*' http://127.0.0.1:3000/api/health
```

Expected shape:

```json
{"ok":true,"service":"touchstone","baseUrl":"https://touchstone.jefflin.ai","googleOAuthConfigured":true,"uptime":12}
```

## Fable5 Showcase Assets

The public Fable5 showcase output should be committed to the GitHub repository:

```text
web/public/fable5-data/
web/public/fable5-media/
web/public/fable5-avatars/
```

The frontend reads these files directly from `/fable5-data`, `/fable5-media`, and `/fable5-avatars`. Keeping them in Git means a fresh deploy can show the Fable5 page immediately after `git clone` and `npm run build`, without rerunning the X scraping pipeline.

`data-archive/fable5/` is different: it contains raw scrape windows and run summaries used for regeneration or audit. It is not required at runtime. Keep it in Git only if you intentionally want the source scrape archive in the repo; otherwise keep it as local/off-repo archival data.

To refresh the public Fable5 files from the archive:

```bash
npm run fable5:update
```

## Cloudflare Tunnel

Use the sample at `deploy/cloudflared/config.example.yml` as the tunnel ingress shape:

```yaml
tunnel: touchstone-jefflin-ai
credentials-file: /etc/cloudflared/touchstone-jefflin-ai.json

ingress:
  - hostname: touchstone.jefflin.ai
    service: http://localhost:3000
  - service: http_status:404
```

Then route `touchstone.jefflin.ai` to the tunnel in Cloudflare.

## Production Notes

- Keep `data/` and `runs/` on persistent storage.
- The server needs access to the local CLIs it runs: Claude Code, Codex CLI, and Gemini CLI.
- The `touchstone_session` cookie is host-only, which is correct for `touchstone.jefflin.ai`.
- If a reverse proxy terminates TLS before Node, keep `PUBLIC_BASE_URL=https://touchstone.jefflin.ai` so OAuth and SEO URLs stay HTTPS.
