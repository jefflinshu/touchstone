# Deploy Touchstone on touchstone.jefflin.ai

Touchstone uses an edge-first split:

- `touchstone.jefflin.ai` is served by `touchstone-edge` on Cloudflare Workers, including the SPA and a public run snapshot.
- `touchstone-origin.jefflin.ai` reaches the local Node runner through Cloudflare Tunnel.
- The edge proxies login, task, WebSocket, and live workspace requests only while the local runner is online.
- If the Mac or runner is offline, the website and published snapshot remain available; local execution returns `LOCAL_RUNNER_OFFLINE`.

The edge proxy is the availability boundary. Do not route the public hostname directly to the local runner.

## Target

- Public URL: `https://touchstone.jefflin.ai`
- Edge site: Cloudflare Worker `touchstone-edge`
- Private Node origin: `https://touchstone-origin.jefflin.ai` → `http://localhost:3000`
- Google OAuth callback: `https://touchstone.jefflin.ai/api/auth/callback`

## Repository Boundaries

The public GitHub repository `jefflinshu/touchstone` should contain the Touchstone web/server code and public showcase data only. Private macOS product work should not be committed here; keep it in a private repository or local-only workspace.

The primary domain `jefflin.ai` should be managed by its own site/deployment. This project deploys to the subdomain `touchstone.jefflin.ai`; do not point the main domain at this repo unless that is an intentional product decision.

## Server Environment

Create `/opt/touchstone/.env` from `.env.example`:

```bash
PORT=3000
PUBLIC_BASE_URL=https://touchstone.jefflin.ai
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
ANTHROPIC_API_KEY=...
PUBLISH_GOOGLE_CLIENT_IDS=...
PUBLISH_API_TOKEN=...
# optional: set to 1 to serve published runs without committing them back to GitHub
DISABLE_GIT_AUTOCOMMIT=0
```

`ANTHROPIC_API_KEY` is optional. It is only used for faster project naming; the app falls back to the local Claude CLI and then timestamp naming.

`PUBLISH_GOOGLE_CLIENT_IDS` is optional when local and production use the same Google OAuth client. Set it to a comma-separated list of allowed OAuth client IDs if local Touchstone installs publish with a different client. `PUBLISH_API_TOKEN` is optional and only needed for trusted server-to-server publishing.

## Google OAuth

In Google Cloud Console, create or update an OAuth 2.0 Web application client:

- Authorized JavaScript origin: `https://touchstone.jefflin.ai`
- Authorized redirect URI: `https://touchstone.jefflin.ai/api/auth/callback`

## Build And Run

```bash
npm install
npm install
npm run build
npm start
```

On the local macOS production host used for `touchstone.jefflin.ai`, prefer the guarded deployment command instead of manually copying build files:

```bash
npm run deploy:local
```

It builds the web UI, syncs root workspace metadata, `apps/server/`, and `apps/web/dist/` into `/Users/linshu/Deploy/touchstone`, installs root dependencies, restarts `ai.jefflin.touchstone`, and verifies that both local and public HTML reference the newly built bundle. This prevents stale top navigation or old SPA assets from staying live after a deploy.

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
apps/web/public/fable5-data/
apps/web/public/fable5-media/
apps/web/public/fable5-avatars/
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
protocol: http2

ingress:
  - hostname: touchstone-origin.jefflin.ai
    service: http://localhost:3000
  - service: http_status:404
```

Route only `touchstone-origin.jefflin.ai` to the tunnel. Set the same random `TOUCHSTONE_EDGE_SECRET` in the Worker and local LaunchAgent, and set:

```bash
TOUCHSTONE_EDGE_ORIGIN_HOST=touchstone-origin.jefflin.ai
```

Direct requests to the origin hostname are rejected without the edge secret.

`protocol: http2` is intentional. Some local/proxy networks block Cloudflare Tunnel QUIC traffic on UDP 7844; forcing HTTP/2 keeps the tunnel connected over TCP and avoids Cloudflare 1033 errors caused by an inactive connector.

## Edge Build And Deploy

```bash
npm run test:edge
npm run build:edge
wrangler deploy
```

`build:edge` produces a sanitized public snapshot at `apps/web/dist/_edge/runs.json` and copies only published workspaces. Private/local runs are never included in Worker assets.

The production route is declared in `wrangler.toml`. For a full local-runner and edge release:

```bash
npm run deploy:production
```

`deploy:local` intentionally updates only the private runner. It no longer assumes that the public hostname is served by that process. `deploy:edge` updates the always-on website, and `verify:edge` checks the production bundle, edge health identity, and public-run privacy boundary.

## Production Notes

- Keep `data/` and `runs/` on persistent storage.
- The server needs access to the local CLIs it runs: Claude Code, Codex CLI, and Gemini CLI.
- The `touchstone_session` cookie is host-only, which is correct for `touchstone.jefflin.ai`.
- If a reverse proxy terminates TLS before Node, keep `PUBLIC_BASE_URL=https://touchstone.jefflin.ai` so OAuth and SEO URLs stay HTTPS.
- Community publish accepts complete static run directories through `POST /api/publish`; published files are public under `/workspace/...`. See `docs/community-publish.md`.
