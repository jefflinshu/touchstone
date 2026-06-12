# Community Publish Flow

Touchstone community publishing treats each run as a public static showcase directory. A published run is not limited to one `index.html`; it can include CSS, JavaScript, images, fonts, audio, video, and other static assets, as long as the browser entry is an HTML file and all resources stay inside the run directory.

## Flow

```text
Local Touchstone
  runs/<project>/<model>/
    index.html
    assets/...
  POST /api/publish on touchstone.jefflin.ai

Public Touchstone
  verify publisher
  validate paths, file count, and file sizes
  write runs/<project>/<model>/
  update data/runs.json
  serve immediately through /workspace/...
  optionally git add / commit / push for archive
```

The website renders published runs from the public server, not from GitHub:

```text
/api/runs
/workspace/<project>/<run>/<entry.html>
```

GitHub sync is an archive and redeploy convenience. It is not required for immediate rendering.

## Authentication

`POST /api/publish` accepts either:

- a Google `id_token` from the existing Touchstone Google login session, or
- `Authorization: Bearer <PUBLISH_API_TOKEN>` for trusted server-to-server publishing.

On the public server, set `PUBLISH_GOOGLE_CLIENT_IDS` if local development uses OAuth clients different from the production `GOOGLE_CLIENT_ID`.

## Public Resource Contract

Publishing means every uploaded file is public:

```text
https://touchstone.jefflin.ai/workspace/<project>/<run>/...
```

Users should not publish secrets, private data, internal documents, licensed assets they cannot share, or files that depend on private APIs.

## Validation

The server rejects:

- missing HTML entry
- absolute paths, backslash paths, `..`, or duplicate paths
- hidden files/directories
- `.git`, `.ssh`, `node_modules`
- `.env`, logs, private keys, shell/executable files, and local Touchstone logs/previews
- more than `PUBLISH_MAX_FILES` files
- total content larger than `PUBLISH_MAX_TOTAL_BYTES`
- a single file larger than `PUBLISH_MAX_FILE_BYTES`

Defaults:

```text
PUBLISH_MAX_FILES=500
PUBLISH_MAX_TOTAL_BYTES=52428800
PUBLISH_MAX_FILE_BYTES=20971520
PUBLISH_MAX_DEPTH=8
JSON_BODY_LIMIT=80mb
```

## Local Agent Contract

Each run directory gets an `AGENTS.md` file that instructs coding agents to create a static showcase in the current directory, use a local HTML entry, avoid external CDNs and localhost services, and never include secrets or parent-directory files. This file is not published.
