# Hosted Security Header Onboarding Gate v0.3.69

v0.3.69 moves hosted security header evidence into production onboarding, not only final go-live.

## Why this exists

v0.3.68 made final go-live require a READY hosted security header audit report. That was correct, but operators should discover this requirement during onboarding, before the final approval meeting. v0.3.69 adds the same evidence requirement to `ops:onboarding:check`.

## Operator flow

```bash
npm run ops:onboarding:init
npm run ops:public-env:init -- --base-url <approved-https-public-base-url> --write-env
npm run security:headers:check -- <approved-https-public-app-url> --json --output ops/private/production-onboarding/hosted-security-header-audit.json
$env:JIUM_HOSTED_SECURITY_HEADER_AUDIT_REPORT="ops/private/production-onboarding/hosted-security-header-audit.json"
npm run ops:onboarding:check
```

The onboarding scaffold now includes an `operator-checklist.json` record named `hosted-security-header-audit`.

## Readiness criteria

`ops:onboarding:check` requires the referenced audit report to satisfy all of the following:

- schema is `jium-security-header-url-audit-v1`
- status is `READY`
- target URL state is `HTTPS`
- fetch state is `COMPLETED`
- HTTP status is below `400`
- failure count is `0`

The same validation helper is used by both onboarding and final go-live, so a report that fails onboarding will also fail go-live.

## Redaction model

The onboarding report stores only readiness states and counts. It does not store:

- audit report path
- public URL
- host
- path
- query string
- response header values
- support contact
- incident owner
- secrets or tokens
- victim indicators
- invite links, onion addresses, emails, or phone numbers

This keeps the private production checklist useful without turning it into a second exposure point.
