# Public Hosting Go-Live Preflight v0.3.88

`public:hosting:preflight` checks the public hosting lane before a production go-live review.

## Why This Exists

GitHub Pages can serve the static app but does not apply the repository `_headers` policy. For a victim-support product, the public production host must prove that the app is served through an approved HTTPS route with the required response headers.

This preflight combines two checks:

- local static export readiness for a `_headers`-capable provider
- redacted live security-header audit of the approved public app URL

## Commands

```bash
npm run public:hosting:bundle
npm run public:hosting:preflight -- <approved-https-public-app-url>
npm run public:hosting:preflight:json -- <approved-https-public-app-url> --output dist/public-hosting-go-live-preflight/report.json
```

Use `-- --no-build` only when `out/` was already created and should be reused:

```bash
npm run public:hosting:preflight -- --no-build <approved-https-public-app-url>
```

## Outputs

The command writes:

- `dist/public-hosting-go-live-preflight/public-hosting-go-live-preflight.json`
- `dist/public-hosting-go-live-preflight/public-hosting-go-live-preflight.md`
- `dist/public-hosting-go-live-preflight/hosted-security-header-audit-candidate.json`
- `dist/public-hosting-go-live-preflight/hosted-security-header-audit-candidate.md`

If the preflight is `READY`, apply the hosted audit candidate with:

```bash
npm run ops:hosted-audit:apply -- --audit-report dist/public-hosting-go-live-preflight/hosted-security-header-audit-candidate.json
```

## Safety Boundary

Reports store status, counts, header names, relative artifact paths, and SHA-256 digests only. They do not store raw public URLs, host names, paths, query values, response header values, contacts, incident owner names, secrets, tokens, certificate material, victim indicators, invite links, onion addresses, emails, or phone numbers.

`READY` proves public header enforcement only. It is not legal review, support approval, incident-response approval, institution approval, or final go-live approval.
