# Hosted Security Header Audit v0.3.67

Jium AI is built for victim support and official handoff, so the hosted app must prove that browser-facing security controls are active before real cases are accepted.

## Why this exists

Static header generation proves the repository can emit a deployable `_headers` file, but it does not prove that the live hosting provider actually serves those headers. A production operator needs a repeatable evidence artifact that can be stored with release notes and reviewed before go-live.

## Command

```bash
npm run security:headers:check -- https://your-approved-domain.example --json --output dist/security-header-audit.json
npm run security:headers:check -- https://your-approved-domain.example --markdown --output dist/security-header-audit.md
```

The command returns exit code `0` only when the target is fetchable, uses HTTPS or local test HTTP, and every required security header matches the repository policy.

## Redaction rules

The evidence report uses schema `jium-security-header-url-audit-v1` and intentionally omits:

- raw target URL
- host
- path
- query string
- response header values

The report records only the target URL state, HTTP status, pass/failure counts, required header keys, and redacted check states. This prevents an audit artifact from becoming a second exposure point for sensitive staging URLs, victim-specific support URLs, or incident handling routes.

## Status model

- `READY`: the endpoint is HTTPS or approved local HTTP, the fetch succeeds, the HTTP status is below `400`, and all required headers match.
- `BLOCKED`: the target is invalid, remote HTTP, unsupported, unavailable, returns an error status, or misses/mismatches at least one required header.

`LOCAL_HTTP` is accepted only for localhost automation. Any non-local `http://` URL is blocked as `HTTP_NOT_ALLOWED`.

## CI coverage

`npm run security:headers` now verifies:

- static `_headers` generation
- Next.js security header policy
- in-memory security header audit logic
- hosted URL audit script JSON output and redaction behavior

This makes the hosted audit command part of the same release gate that protects XSS, institution access, authorized feeds, deployment profile checks, secret scanning, typechecking, tests, and production builds.
