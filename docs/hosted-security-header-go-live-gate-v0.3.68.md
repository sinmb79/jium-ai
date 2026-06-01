# Hosted Security Header Go-Live Gate v0.3.68

v0.3.68 connects the hosted security header audit from v0.3.67 to the final operational go-live gate.

## Why this exists

An HTTPS public URL is not enough for Jium AI production operation. The public app must also prove that the live hosting provider serves the required browser security headers. GitHub Pages can serve the static demo, but it does not apply the repository security header policy, so it must not be mistaken for a production-ready host.

## Operator flow

```bash
npm run security:headers:check -- https://your-approved-domain.example --json --output dist/security-header-audit.json
$env:JIUM_HOSTED_SECURITY_HEADER_AUDIT_REPORT="dist/security-header-audit.json"
npm run ops:go-live:check
```

The go-live gate requires the audit report to satisfy all of the following:

- schema is `jium-security-header-url-audit-v1`
- status is `READY`
- target URL state is `HTTPS`
- fetch state is `COMPLETED`
- HTTP status is below `400`
- failure count is `0`

Local HTTP audit reports are valid for automated tests only. They do not satisfy production go-live.

## Redaction model

The go-live report records only:

- whether `JIUM_HOSTED_SECURITY_HEADER_AUDIT_REPORT` is set
- whether the evidence file was found and parsed
- the audit status
- the target URL state
- fetch state
- HTTP status
- checked, passed, and failed header counts

The go-live report does not store the audit report path, public URL, host, path, query, response header values, support contact, incident owner, secrets, tokens, victim indicators, invite links, onion addresses, emails, or phone numbers.

## Impact

`ops:go-live:check` now has an additional `hosted-security-headers` check. A fully approved launch profile remains `BLOCKED` until the approved production host produces a READY redacted header audit report.

This keeps the demo deployment and real victim-facing production deployment clearly separated.
