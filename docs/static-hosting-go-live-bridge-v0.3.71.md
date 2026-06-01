# Static Hosting Go-Live Bridge v0.3.71

v0.3.71 connects the secure static hosting bundle to the operational handoff and action-plan runbooks.

## Why this exists

v0.3.70 can build a `_headers`-capable static hosting bundle, but production operators still need that evidence to appear in the final go-live workflow. This release makes the public-hosting sequence explicit in the redacted operational plan.

## Go-live sequence

Operators should now follow this order before approving the public app URL:

```bash
npm run public:hosting:bundle
```

Then deploy:

- `dist/static-hosting-bundle/site`

to Cloudflare Pages, Netlify, or another approved host that enforces `_headers`.

After deployment, collect the hosted security header evidence:

```bash
npm run security:headers:check -- <approved-https-public-app-url> --json --output ops/private/production-onboarding/hosted-security-header-audit.json
```

Then point production onboarding to the redacted audit report:

```bash
$env:JIUM_HOSTED_SECURITY_HEADER_AUDIT_REPORT="ops/private/production-onboarding/hosted-security-header-audit.json"
npm run ops:onboarding:check
npm run ops:go-live:check
```

## Runbook impact

`npm run ops:handoff:bundle` now records that production launch requires:

- an approved `_headers`-capable public static hosting deployment record
- a READY hosted security header audit record

`npm run ops:action-plan` now places the following in the final go-live phase:

- build `npm run public:hosting:bundle`
- deploy `dist/static-hosting-bundle/site`
- run `npm run security:headers:check`
- attach `JIUM_HOSTED_SECURITY_HEADER_AUDIT_REPORT`
- continue with public URL approval, go-live check, and handoff archiving

## Redaction model

The generated handoff and action-plan files still store only command names, relative artifact paths, readiness states, counts, package version, commit, and gate status. They do not store public URL values, host names, support contacts, incident owner names, secrets, tokens, certificate material, victim indicators, raw URLs, invite links, onion addresses, emails, or phone numbers.
