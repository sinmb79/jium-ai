# Production Onboarding Storage Decision Approval v0.3.76

v0.3.76 adds a safe CLI for recording externally approved storage decision evidence.

## Why this exists

Production onboarding requires the audit ledger and institution account registry storage locations to be repo-external, access-controlled, separated, and writable by the server process. Before this release, operators had to edit `storage-decision.template.json` manually. That created avoidable risk: placeholders could remain, raw storage paths could be pasted into evidence fields, or the storage decision status could drift from the section states.

This command does not approve a storage policy by itself. It records the result of a real external storage decision in the private onboarding packet after validating that the evidence reference is safe to store.

## Command

```bash
npm run ops:onboarding:approve-storage-decision -- --section <audit-ledger|account-registry> --evidence-ref <pseudonymous-storage-evidence-reference>
```

Optional report formats:

```bash
npm run ops:onboarding:approve-storage-decision:json -- --section <audit-ledger|account-registry> --evidence-ref <pseudonymous-storage-evidence-reference>
npm run ops:onboarding:approve-storage-decision:markdown -- --section <audit-ledger|account-registry> --evidence-ref <pseudonymous-storage-evidence-reference>
```

## Supported Sections

- `audit-ledger`
- `account-registry`
- `auditLedgerStorage`
- `accountRegistryStorage`

## What the Gate Checks

- The private storage decision file must exist.
- The section must be one of the required storage decision sections.
- The storage decision package version must match the app version.
- The target section must preserve its required storage properties.
- The evidence reference must be a short pseudonymous reference.
- Placeholder values, raw URLs, invite links, onion addresses, emails, phone-like values, tokens, and private key material are blocked.
- Unsafe report output paths are rejected before the private storage decision file is modified.

## Outputs

The command updates:

- `ops/private/production-onboarding/storage-decision.template.json`

The command also writes redacted reports:

- `dist/production-onboarding-storage-decision/production-onboarding-storage-decision-approval-report.json`
- `dist/production-onboarding-storage-decision/production-onboarding-storage-decision-approval-report.md`

Reports store only the section id, counts, storage decision status, and a SHA-256 digest of the evidence reference. The raw pseudonymous evidence reference is stored only in the ignored private onboarding packet.

## Operating Sequence

```bash
npm run ops:onboarding:init
npm run server:storage:init -- --storage-root <approved-absolute-storage-root> --write-env
npm run security:server-storage
npm run ops:onboarding:approve-storage-decision -- --section audit-ledger --evidence-ref <pseudonymous-storage-evidence-reference>
npm run ops:onboarding:approve-storage-decision -- --section account-registry --evidence-ref <pseudonymous-storage-evidence-reference>
npm run ops:onboarding:check
```

When both required sections are approved through this command, the storage decision status becomes `APPROVED`.
