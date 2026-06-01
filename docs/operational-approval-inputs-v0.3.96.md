# Operational Approval Inputs v0.3.96

v0.3.96 adds a guarded batch path for externally approved operating references.

Before this release, operators had to run many individual approval commands after legal, program, storage, public-route, and onboarding reviewers finished their checks. That was safe, but it created copy/paste risk. This release keeps the same safety boundary and adds one private-fill input file that can be validated and applied in a batch.

## Template

```bash
npm run ops:approvals:input-template
npm run ops:approvals:input-template:json -- --output dist/operational-approval-inputs/template.json
```

The template contains placeholders for:

- operational approval records
- production onboarding checklist records
- storage decision approvals
- public operations route approvals

The generated template is reviewable. The filled version is private and must stay under an ignored private path or approved private storage.

## Apply

```bash
npm run ops:approvals:apply-inputs -- --input ops/private/production-onboarding/approved-operational-inputs.json --init
npm run ops:approvals:apply-inputs:json -- --input ops/private/production-onboarding/approved-operational-inputs.json --init --output dist/operational-approval-inputs/apply-report.json
```

Use `--dry-run` to validate the file without writing private approval or onboarding records.

The apply command validates every input first. If any record is blocked, nothing is applied.

## Safety boundary

The batch path does not create approval. It only records externally approved pseudonymous references into the same private files used by the existing guarded commands.

The report stores only statuses, counts, SHA-256 digests, and validation errors. It does not store raw URLs, support contacts, incident owner names, secrets, tokens, certificate material, victim indicators, invite links, onion addresses, emails, phone numbers, or private paths.
