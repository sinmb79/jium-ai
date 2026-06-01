# Operational Release Dossier v0.3.84

v0.3.84 adds a redacted external-review dossier for production release evidence:

```bash
npm run ops:release-dossier
npm run ops:release-dossier:json -- --output dist/operational-release-dossier/report.json
```

## Why this exists

The final go-live gate is intentionally strict. It must remain BLOCKED until institution keys, HTTPS hosting, legal review, support routing, incident-response ownership, hosted security-header evidence, signed desktop artifacts, and private approval records are complete.

That strictness is correct, but reviewers still need a compact packet that explains what is ready, what is blocked, which redacted reports must be reviewed, and which owner role should handle each remaining action. The release dossier gathers that material without copying raw operational values into a shareable report.

## What the command gathers

- Operational handoff summary and report index
- Owner-routed operational action plan
- Synthetic go-live rehearsal result and simulation boundary
- Gate status counts
- External records still needed
- Priority remaining actions
- Required review file manifest
- Leak scan result for unsafe raw values

## Status meanings

- `READY_FOR_EXTERNAL_REVIEW`: the dossier is safe to hand to reviewers, but production launch still needs external approvals or artifacts.
- `READY_FOR_GO_LIVE_ARCHIVE`: all handoff and action-plan gates are READY, and the dossier can be archived with the final approval packet.
- `BLOCKED`: the dossier itself is unsafe or the rehearsal did not pass.

## Safety boundaries

The dossier stores only statuses, counts, report names, owner roles, verification command templates, simulation modes, and redacted actions.

It does not store raw public URLs, support contacts, incident owner names, secrets, tokens, certificate material, victim indicators, invite links, onion addresses, emails, phone numbers, or private storage paths.

The command runs a leak scan over the generated dossier and fails if those unsafe raw patterns are found.

## Source reports

By default, the command refreshes the handoff bundle, action plan, and go-live rehearsal before writing:

- `dist/operational-release-dossier/operational-release-dossier.json`
- `dist/operational-release-dossier/operational-release-dossier.md`

For review automation that already generated source reports:

```bash
npm run ops:release-dossier:json -- --no-build --output dist/operational-release-dossier/report.json
```

Or pass explicit source reports:

```bash
npm run ops:release-dossier:json -- \
  --summary dist/operational-handoff-bundle/operational-handoff-summary.json \
  --action-plan dist/operational-handoff-bundle/operational-action-plan.json \
  --rehearsal dist/operational-go-live-rehearsal/operational-go-live-rehearsal-report.json
```

## Operating note

This dossier is not legal approval and not go-live approval. It is the redacted review manifest that helps legal, release, security, operations, and program owners review the same evidence packet without exposing victim data or operational secrets.
