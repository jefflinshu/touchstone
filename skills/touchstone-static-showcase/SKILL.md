---
name: touchstone-static-showcase
description: Build or refine a Touchstone browser showcase as a polished self-contained HTML artifact. Use when a task must open directly from index.html without a build step, CDN, localhost dependency, secret, or parent-directory resource.
---

# Touchstone Static Showcase

Create the final browser artifact in the current working directory.

## Build

- Prefer one self-contained `index.html`.
- Inline CSS and JavaScript.
- Embed small required assets with data URLs when practical.
- Keep the experience responsive and usable with keyboard and touch input.
- Use semantic HTML and visible focus states.
- Do not use a network CDN, localhost service, secret, credential, or parent-directory file.
- Do not write outside the current working directory.

## Verify

1. Confirm `index.html` exists.
2. Confirm every required resource is embedded or uses a relative path inside the current directory.
3. Open the entry directly in a browser-compatible file context.
4. Check the primary interaction and a narrow viewport.
5. Remove development-only output and broken references.
