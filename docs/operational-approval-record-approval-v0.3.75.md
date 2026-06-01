# Operational Approval Record Approval v0.3.75

v0.3.75 adds a safe CLI for recording externally approved operational approval records.

## Why this exists

The production gate already requires legal review, release evidence, retention, support route, incident response, and go-live approvals. Before this release, operators had to edit `operational-approval-records.json` manually. That created avoidable risk: placeholders could remain, raw contacts or URLs could be pasted, or release tags could drift from the approved desktop release.

This command does not grant approval by itself. It records the result of a real external approval in the private approval packet after validating that all stored values are pseudonymous and safe.

## Command

```bash
npm run ops:approvals:approve-record -- --type <approval-record-type> --approved-by-ref <pseudonymous-approver-ref> --reference-id <pseudonymous-approval-reference> --scope <approval-scope> --evidence-digest <sha256-evidence-digest>
```

Optional report formats:

```bash
npm run ops:approvals:approve-record:json -- --type <approval-record-type> --approved-by-ref <pseudonymous-approver-ref> --reference-id <pseudonymous-approval-reference> --scope <approval-scope> --evidence-digest <sha256-evidence-digest>
npm run ops:approvals:approve-record:markdown -- --type <approval-record-type> --approved-by-ref <pseudonymous-approver-ref> --reference-id <pseudonymous-approval-reference> --scope <approval-scope> --evidence-digest <sha256-evidence-digest>
```

## Supported Approval Types

- `GO_LIVE_APPROVAL`
- `LEGAL_REVIEW_APPROVAL`
- `RELEASE_EVIDENCE_REVIEW`
- `DATA_RETENTION_POLICY_ACK`
- `SUPPORT_CONTACT_ROUTE_ASSIGNED`
- `INCIDENT_RESPONSE_OWNER_ASSIGNED`

## What the Gate Checks

- The private approval records file must exist.
- The approval type must be one of the required operational approval types.
- The approval packet package version and release tag must match the current release context.
- `approvedByRef`, `referenceId`, and `scope` must be short pseudonymous references.
- `evidenceDigest` must be a `sha256-` digest.
- Placeholder values, raw URLs, invite links, onion addresses, emails, phone-like values, tokens, and private key material are blocked.
- Unsafe report output paths are rejected before the private approval packet is modified.

## Outputs

The command updates:

- `ops/private/operational-approval-records.json`

The command also writes redacted reports:

- `dist/operational-approval-record/operational-approval-record-approval-report.json`
- `dist/operational-approval-record/operational-approval-record-approval-report.md`

Reports store only the approval type, counts, readiness status, and SHA-256 digests of pseudonymous approval references. Raw pseudonymous approval values are stored only in the ignored private approval packet.

## Operating Sequence

```bash
npm run ops:approvals:init
npm run ops:approvals:approve-record -- --type LEGAL_REVIEW_APPROVAL --approved-by-ref <pseudonymous-approver-ref> --reference-id <pseudonymous-approval-reference> --scope <approval-scope> --evidence-digest <sha256-evidence-digest>
npm run ops:approvals:approve-record -- --type GO_LIVE_APPROVAL --approved-by-ref <pseudonymous-approver-ref> --reference-id <pseudonymous-approval-reference> --scope <approval-scope> --evidence-digest <sha256-evidence-digest>
npm run ops:approvals:check
```

When all required records are approved through this command, `ops:approvals:check` can move from `BLOCKED` to `READY`.
