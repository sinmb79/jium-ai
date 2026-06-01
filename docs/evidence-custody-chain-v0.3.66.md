# Evidence Custody Chain v0.3.66

Checked on: 2026-06-01

## Purpose

This release strengthens the handoff packet for real operational use. A victim or support worker can now record chain-of-custody metadata without storing names, contact details, invite links, or raw investigative targets in the public packet.

## Added Fields

Each evidence item can carry these optional fields:

- `collectorRef`: pseudonymous collector reference, such as `victim-self-ref-01`
- `deviceRef`: pseudonymous device reference, such as `trusted-device-ref-01`
- `hashAlgorithm`: `SHA-256`, `A_HASH`, `METADATA_FINGERPRINT`, or `UNKNOWN`
- `verifiedAt`: timestamp when the evidence fingerprint was checked
- `handoffRecipientRef`: pseudonymous agency/support recipient reference

The evidence-chain manifest now includes the custody summary on evidence events. The manifest fingerprint also changes when custody metadata changes.

## Safety Boundary

Custody references are not identity fields. They must not contain:

- real names
- phone numbers
- email addresses
- URLs
- Telegram/Discord invite links
- onion addresses

When unsafe custody references are detected, the chain redacts the value as `REDACTED_UNSAFE_CUSTODY_REF` and adds a custody warning.

## Submission Checklist

The pre-submission checklist now includes an `evidence-custody-chain` item. It reports:

- `PASS` when custody fields are complete
- `REVIEW` when pseudonymous custody metadata is missing
- `BLOCKED` when unsafe raw custody references are detected

This helps a victim or case worker see evidence-quality gaps before submitting the package to an official agency.

## Verification

Primary regression coverage:

```bash
npm test -- --run tests/evidenceChain.test.ts tests/preSubmissionChecklist.test.ts tests/submissionPackage.test.ts tests/submissionPacket.test.ts tests/submissionVersioning.test.ts
npm run typecheck
```
