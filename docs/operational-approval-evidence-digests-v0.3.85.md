# Operational Approval Evidence Digests v0.3.85

v0.3.85 adds a redacted digest manifest for approval-record evidence:

```bash
npm run ops:approvals:digest-evidence
npm run ops:approvals:digest-evidence:json -- --output dist/operational-approval-evidence-digests/report.json
```

## Why this exists

Operational approval records require an `evidenceDigest`, but operators should not copy raw review documents, public URLs, contact details, tokens, invite links, onion addresses, or private paths into the approval packet.

The digest command gives reviewers a safe bridge:

1. Build the redacted release evidence packet.
2. Review the listed evidence files.
3. Use the aggregate SHA-256 digest as the `--evidence-digest` value after real approval.
4. Record approval with `npm run ops:approvals:approve-record`.

## What it checks

The digest manifest records:

- evidence file names
- byte counts
- SHA-256 file digests
- one aggregate digest over the reviewed file list
- approval command templates for all required approval record types
- unsafe pattern IDs if a file contains blocked raw content

The command blocks the aggregate digest when any source file is missing or contains raw URL, invite route, onion address, email, phone-like value, GitHub/OpenAI-style token, or a path outside the repository evidence area.

## Default source files

When run without `--file`, the command refreshes the release dossier and digests the default redacted review set:

- `dist/operational-release-dossier/operational-release-dossier.json`
- `dist/operational-release-dossier/operational-release-dossier.md`
- `dist/operational-handoff-bundle/operational-handoff-summary.json`
- `dist/operational-handoff-bundle/operational-action-plan.json`
- `dist/operational-go-live-rehearsal/operational-go-live-rehearsal-report.json`
- `dist/server-origin-candidate/server-origin-candidate-report.json`
- `dist/server-origin-candidate/server-origin-candidate-report.md`
- `dist/trusted-key-approval-candidate/trusted-key-approval-candidate-report.json`
- `dist/trusted-key-approval-candidate/trusted-key-approval-candidate-report.md`
- `dist/desktop-publish-candidate/desktop-publish-candidate-report.json`
- `dist/desktop-publish-candidate/desktop-publish-candidate-report.md`
- `dist/operational-approval-command-packet/operational-approval-command-packet.json`
- `dist/operational-approval-command-packet/operational-approval-command-packet.md`
- `dist/operational-launch-console/operational-launch-console.json`
- `dist/operational-launch-console/operational-launch-console.md`
- `dist/operational-approval-inputs/operational-approval-inputs-template.json`
- `dist/operational-approval-inputs/operational-approval-inputs-template.md`

For an already frozen review packet:

```bash
npm run ops:approvals:digest-evidence:json -- --no-build --output dist/operational-approval-evidence-digests/report.json
```

For a specific file:

```bash
npm run ops:approvals:digest-evidence:json -- \
  --file dist/operational-release-dossier/operational-release-dossier.json \
  --output dist/operational-approval-evidence-digests/report.json
```

## Safety boundaries

This manifest stores only file names, byte counts, SHA-256 digests, unsafe pattern IDs, and approval command templates.

It does not store file contents, raw public URLs, support contacts, incident owner names, secrets, tokens, certificate material, victim indicators, invite links, onion addresses, emails, phone numbers, or private storage paths.

The aggregate digest is evidence of exactly reviewed redacted files. It is not legal approval, institution approval, or production go-live approval.
