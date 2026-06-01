# Secure Static Hosting Bundle v0.3.70

v0.3.70 adds a production-style static hosting bundle for providers that enforce `_headers`, such as Cloudflare Pages and Netlify.

## Why this exists

The GitHub Pages demo is convenient, but it does not apply the security headers required by Jium AI's production go-live gate. Operators need a separate static artifact that can be deployed to a host that serves the repository's `_headers` policy.

## Command

```bash
npm run public:hosting:bundle
```

The command builds a static export with `JIUM_STATIC_HOSTING_EXPORT=true`, validates it, and writes:

- `dist/static-hosting-bundle/site`
- `dist/static-hosting-bundle/static-hosting-readiness-report.json`
- `dist/static-hosting-bundle/static-hosting-readiness-report.md`
- `dist/static-hosting-bundle/static-hosting-deployment-runbook.md`

## Readiness checks

The bundle is `READY` only when:

- required route files exist
- `_next` static assets exist
- `_headers` exists
- `_headers` exactly matches the repository security policy
- the export does not contain the GitHub Pages `/jium-ai` base path

After deploying `dist/static-hosting-bundle/site`, operators still need to run:

```bash
npm run security:headers:check -- <approved-https-public-app-url> --json --output ops/private/production-onboarding/hosted-security-header-audit.json
```

That deployed-host audit remains the evidence required by production onboarding and final go-live.

## Redaction model

The bundle report stores only relative artifact names, counts, version, commit, provider target names, and readiness states. It does not store public URL values, host names, support contacts, incident owner names, secrets, tokens, victim indicators, raw URLs, invite links, onion addresses, emails, or phone numbers.
