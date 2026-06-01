# Netlify Hosting Config v0.3.89

`public:netlify:check` validates the Netlify production hosting configuration before deployment.

## Why This Exists

Jium AI needs a public host that can serve the static app with the repository `_headers` policy. GitHub Pages is useful for the public demo, but it does not prove the required production response headers. The existing Netlify project can be used as the `_headers`-capable hosting lane if it builds and publishes the static hosting bundle.

## Required Config

`netlify.toml` must use:

```toml
[build]
  command = "npm run public:hosting:bundle"
  publish = "dist/static-hosting-bundle/site"

[build.environment]
  NODE_VERSION = "24"
  NEXT_TELEMETRY_DISABLED = "1"
```

The command publishes the generated static-hosting bundle, including `_headers`.

`.netlifyignore` must exclude local dependencies, generated build artifacts, and private operating files, including `node_modules`, `.git`, `.next`, `out`, `dist`, `.env`, `.env*.local`, and `ops/private`.

## Commands

```bash
npm run public:netlify:check
npm run public:hosting:bundle
npm run public:hosting:preflight -- <approved-netlify-https-url>
```

For the Netlify MCP upload lane, build the static bundle first, then run the generated Netlify MCP deploy command from:

```bash
dist/static-hosting-bundle/site
```

This keeps the upload focused on the static app, `_headers`, and generated assets. A repo-root MCP upload can include more source context than the static deployment needs and may fail before Netlify reaches the build step.

After a Netlify deployment, only a `READY` preflight candidate should be applied:

```bash
npm run ops:hosted-audit:apply -- --audit-report dist/public-hosting-go-live-preflight/hosted-security-header-audit-candidate.json
```

## Safety Boundary

The checker blocks raw URLs, invite links, onion addresses, emails, phone-like values, token-like values, private filesystem paths, and secret-like assignments in `netlify.toml`. It also blocks deployment config readiness if `.netlifyignore` does not exclude generated artifacts and private operating files.

Reports store readiness states, expected command names, required ignore entry names, and unsafe pattern IDs only. They do not store Netlify auth tokens, public URLs, raw host names, support contacts, incident owner names, victim indicators, invite links, onion addresses, emails, phone numbers, passwords, private paths, or certificate material.
