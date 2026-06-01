# Production Onboarding Checklist Approval v0.3.74

v0.3.74 adds a safe CLI for recording externally approved onboarding checklist evidence.

## Why this exists

Production onboarding already requires `operator-checklist.json` to contain approved records with pseudonymous evidence references. Before this release, operators had to edit that JSON manually. That created avoidable risk: placeholders could remain, raw URLs or contacts could be pasted, or the checklist status could fail to match the record states.

This command does not approve anything by itself. It records the result of a real external approval in the private onboarding checklist after validating that the evidence reference is safe to store.

## Command

```bash
npm run ops:onboarding:approve-checklist -- --record <checklist-record-id> --evidence-ref <pseudonymous-evidence-reference>
```

Optional report formats:

```bash
npm run ops:onboarding:approve-checklist:json -- --record <checklist-record-id> --evidence-ref <pseudonymous-evidence-reference>
npm run ops:onboarding:approve-checklist:markdown -- --record <checklist-record-id> --evidence-ref <pseudonymous-evidence-reference>
```

## Supported Record IDs

- `server-origin-approval`
- `trusted-public-key-approval`
- `server-storage-decision`
- `desktop-signing-evidence`
- `public-operations-routes`
- `hosted-security-header-audit`
- `legal-go-live-approval`

## What the Gate Checks

- The checklist file must exist under the private onboarding directory.
- The record ID must be one of the required onboarding checklist records.
- The evidence reference must be a short pseudonymous reference.
- Placeholder values, raw URLs, invite links, onion addresses, emails, phone-like values, tokens, and private key material are blocked.
- Unsafe report output paths are rejected before the private checklist is modified.

## Outputs

The command updates:

- `ops/private/production-onboarding/operator-checklist.json`

The command also writes redacted reports:

- `dist/production-onboarding-checklist/production-onboarding-checklist-approval-report.json`
- `dist/production-onboarding-checklist/production-onboarding-checklist-approval-report.md`

Reports store only the record ID, counts, checklist status, and a SHA-256 digest of the evidence reference. The raw evidence reference is stored only in the ignored private onboarding checklist.

## Operating Sequence

```bash
npm run ops:onboarding:init
npm run ops:onboarding:approve-checklist -- --record server-origin-approval --evidence-ref <pseudonymous-evidence-reference>
npm run ops:onboarding:approve-checklist -- --record trusted-public-key-approval --evidence-ref <pseudonymous-evidence-reference>
npm run ops:onboarding:check
```

When all required records have been approved through this command, the checklist status becomes `APPROVED`.
