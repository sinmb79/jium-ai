# Hosted Security Header Audit Env Apply v0.3.81

v0.3.81 adds a guarded CLI for applying READY hosted security header audit evidence to the private server runtime env.

## Why this exists

Final go-live and production onboarding already require a READY `jium-security-header-url-audit-v1` report. Before this release, an operator still had to copy the audit report path into `JIUM_HOSTED_SECURITY_HEADER_AUDIT_REPORT` by hand. That is easy to miss during launch pressure, and it can also accidentally place private paths or raw target details into reports.

This command keeps the boundary narrow:

- the hosted audit must already be READY
- the audit report must stay inside the repository, normally under ignored `ops/private`
- the private env file receives only the relative audit report path
- the generated apply report stores only status fields and a SHA-256 digest

## Command

```bash
npm run ops:hosted-audit:apply -- --audit-report ops/private/production-onboarding/hosted-security-header-audit.json
```

Optional report formats:

```bash
npm run ops:hosted-audit:apply:json -- --audit-report ops/private/production-onboarding/hosted-security-header-audit.json
npm run ops:hosted-audit:apply:markdown -- --audit-report ops/private/production-onboarding/hosted-security-header-audit.json
```

## What the Gate Checks

- `.env.server.local` must already exist.
- The audit report path must stay inside the repository.
- The audit report must be valid JSON, including UTF-8 BOM files created by Windows editors.
- The report schema must be `jium-security-header-url-audit-v1`.
- The report status must be `READY`.
- The target URL state must be `HTTPS`.
- Fetch state must be `COMPLETED`.
- HTTP status must be below 400.
- Header failure count must be `0`.
- Unsafe report output paths are rejected before `.env.server.local` is modified.

## Env Key Applied

The command sets:

- `JIUM_HOSTED_SECURITY_HEADER_AUDIT_REPORT=<relative-ready-audit-report-path>`

It does not write raw public URLs, hosts, paths, contacts, victim indicators, invite links, onion addresses, emails, phone numbers, tokens, passwords, or certificate material to generated reports.

## Outputs

The command updates:

- `.env.server.local`

The command also writes redacted reports:

- `dist/hosted-security-header-audit-env/hosted-security-header-audit-env-apply-report.json`
- `dist/hosted-security-header-audit-env/hosted-security-header-audit-env-apply-report.md`

## Operating Sequence

```bash
npm run public:hosting:bundle
npm run security:headers:check -- <approved-https-public-app-url> --json --output ops/private/production-onboarding/hosted-security-header-audit.json
npm run ops:hosted-audit:apply -- --audit-report ops/private/production-onboarding/hosted-security-header-audit.json
npm run ops:onboarding:check
npm run ops:go-live:check
```

`ops:action-plan`, `ops:onboarding:check`, and `ops:go-live:check` now point operators to this guarded command instead of undocumented manual env edits.
