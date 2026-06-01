# Operational Go-Live Env Apply v0.3.79

v0.3.79 adds a guarded CLI for applying production go-live approval flags from READY private operational approval records.

## Why this exists

Operational go-live previously required both a complete private approval-record packet and separate manual environment flags such as `JIUM_GO_LIVE_APPROVAL=APPROVED`. That double entry creates avoidable deployment risk: the private record may be approved while the env remains stale, or an operator may set approval flags before the private approval packet is ready.

This command does not create approval. It only applies local go-live env flags after the private operational approval records already validate as READY.

## Command

```bash
npm run ops:go-live:env:apply -- --incident-owner-ref <pseudonymous-incident-owner-reference>
```

Optional report formats:

```bash
npm run ops:go-live:env:apply:json -- --incident-owner-ref <pseudonymous-incident-owner-reference>
npm run ops:go-live:env:apply:markdown -- --incident-owner-ref <pseudonymous-incident-owner-reference>
```

If the approval records packet is stored outside the default private path:

```bash
npm run ops:go-live:env:apply -- --approval-records <approved-private-approval-records-path> --incident-owner-ref <pseudonymous-incident-owner-reference>
```

## What the Gate Checks

- `.env.server.local` must already exist.
- `ops:approvals:check` equivalent validation must be READY.
- Every required operational approval record must be APPROVED.
- Package version and release tag in the approval packet must match the current app release context.
- The incident owner reference must be a short pseudonymous reference.
- Placeholder values, raw URLs, invite links, onion values, emails, phone-like values, tokens, and private key material are blocked.
- Unsafe report output paths are rejected before `.env.server.local` is modified.
- UTF-8 BOM approval-record files are accepted, which helps when private JSON packets are reviewed on Windows.

## Env Keys Applied

The command sets:

- `JIUM_GO_LIVE_APPROVAL=APPROVED`
- `JIUM_LEGAL_REVIEW_APPROVAL=APPROVED`
- `JIUM_RELEASE_EVIDENCE_REVIEW=APPROVED`
- `JIUM_DATA_RETENTION_POLICY_ACK=APPROVED`
- `JIUM_INCIDENT_RESPONSE_OWNER=<pseudonymous-incident-owner-reference>`

If `JIUM_OPERATIONAL_APPROVAL_RECORDS` is configured for the command, the private env file also records that configured approval-record path for the runtime check.

## Outputs

The command updates:

- `.env.server.local`

The command also writes redacted reports:

- `dist/operational-go-live-env/operational-go-live-env-apply-report.json`
- `dist/operational-go-live-env/operational-go-live-env-apply-report.md`

Reports store only approval-record status, env key update status, key counts, and SHA-256 digests. They do not store raw incident owner references, approver refs, approval reference IDs, public URLs, support routes, contacts, victim indicators, invite links, onion addresses, emails, phone numbers, passwords, tokens, certificate material, or secrets.

## Operating Sequence

```bash
npm run ops:approvals:init
npm run ops:approvals:approve-record -- --type <approval-record-type> --approved-by-ref <pseudonymous-approver-ref> --reference-id <pseudonymous-approval-reference> --scope <approval-scope> --evidence-digest <sha256-evidence-digest>
npm run ops:approvals:check
npm run ops:public-env:init -- --base-url <approved-https-public-base-url> --write-env
npm run ops:go-live:env:apply -- --incident-owner-ref <pseudonymous-incident-owner-reference>
npm run ops:go-live:check
```

`ops:action-plan` now includes this command in the final go-live phase, and `ops:go-live:check` points to it when approval flags or the incident owner env are missing.
