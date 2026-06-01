# Server Runtime Env File Loading v0.3.82

v0.3.82 lets operational readiness checks load the ignored `.env.server.local` file directly.

## Why this exists

Several guarded commands already write reviewed values to `.env.server.local`:

- `server:env:init`
- `server:origin:apply`
- `server:storage:init`
- `ops:public-env:init`
- `ops:hosted-audit:apply`
- `ops:go-live:env:apply`

Before this release, final readiness checks still depended heavily on the process environment. That made operators repeat values already present in the private env file and increased launch-time drift.

## What Now Loads the File

The following checks now merge allowlisted values from `.env.server.local` when the process environment does not already provide them:

- `security:server-readiness`
- `security:server-storage`
- `ops:go-live:check`

Process environment values keep priority, so CI, hosting platforms, and emergency override shells can still intentionally override private file values.

## Allowlisted Keys

The loader accepts only server runtime, public operations, hosted audit, and go-live approval keys used by the existing operational gates. Unknown keys are ignored.

This includes server-only secrets such as `INSTITUTION_SESSION_SECRET`, but reports continue to store only readiness states, counts, and redacted summaries. Raw secret values, trusted origins, storage paths, hosted audit paths, public URLs, contacts, victim indicators, invite links, onion addresses, emails, and phone numbers remain out of generated reports.

## BOM-Tolerant Parsing

The parser accepts UTF-8 BOM files created by Windows tools. This matches the private approval and hosted audit evidence tolerance already added in prior releases.

## Operating Sequence

```bash
npm run server:env:init
npm run server:origin:apply -- --origin <approved-https-operator-origin> --approval-ref <pseudonymous-origin-approval-reference>
npm run server:storage:init -- --storage-root <approved-absolute-storage-root> --write-env
npm run ops:public-env:init -- --base-url <approved-https-public-base-url> --write-env
npm run ops:hosted-audit:apply -- --audit-report ops/private/production-onboarding/hosted-security-header-audit.json
npm run ops:go-live:env:apply -- --incident-owner-ref <pseudonymous-incident-owner-reference>
npm run security:server-readiness
npm run ops:go-live:check
```

These checks now consume the same private file that the guarded commands update, reducing undocumented manual env export steps before production review.
