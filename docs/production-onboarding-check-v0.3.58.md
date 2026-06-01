# JiumAI Production Onboarding Check v0.3.58

## Purpose

`ops:onboarding:init` creates the private files needed for production preparation. `ops:onboarding:check` validates that those private files have been completed safely before operators move into deployment, release publication, go-live approval, and handoff.

This is a readiness gate, not a substitute for legal or institutional approval.

## Commands

```bash
npm run ops:onboarding:check
npm run ops:onboarding:check:json -- --output ./production-onboarding-readiness.json
npm run ops:onboarding:check:markdown -- --output ./production-onboarding-readiness.md
```

The command exits with status `1` while onboarding is incomplete. That is the expected result for a freshly generated scaffold.

For test fixtures or alternate workspaces, pass `--root <repo-root>`.

## What It Validates

- Required private onboarding files exist under `ops/private/production-onboarding`.
- `.env.server.local` enables server routes, keeps the session secret server-only, uses approved origin status, and points server storage to repo-external locations.
- `ops/private/operational-approval-records.json` passes the operational approval records gate.
- `operator-checklist.json` is approved and contains every required pseudonymous evidence reference.
- `storage-decision.template.json` is approved for audit ledger and account registry storage.
- `trusted-key-candidate.example.json` contains no private JWK material.

## Report Safety

Reports include only readiness states, counts, package version, and relative private paths.

Reports must not contain generated session secrets, trusted origin values, storage directory paths, support contacts, incident owner names, victim indicators, raw URLs, invite links, onion addresses, emails, phone numbers, passwords, tokens, or certificate material.

## Expected Operating Flow

```bash
npm run ops:onboarding:init
npm run ops:onboarding:check
npm run security:trusted-key:review -- --candidate <approved-public-key.json> --patch-output <trusted-key-registry.patch.json>
npm run security:server-storage
npm run security:server-readiness
npm run server:deployment:bundle
npm run ops:approvals:check
npm run ops:go-live:check
npm run ops:handoff:bundle
```

Only proceed to release publication after the private evidence and external approvals are complete.
