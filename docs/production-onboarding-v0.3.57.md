# JiumAI Production Onboarding v0.3.57

## Purpose

Production operation depends on external approvals and private deployment values. The onboarding scaffold creates the ignored local files that an operator must complete before go-live, without storing secrets or victim data in committed files.

## Command

```bash
npm run ops:onboarding:init
```

The command creates:

- `.env.server.local`
- `ops/private/operational-approval-records.json`
- `ops/private/production-onboarding/README.md`
- `ops/private/production-onboarding/operator-checklist.json`
- `ops/private/production-onboarding/storage-decision.template.json`
- `ops/private/production-onboarding/trusted-key-candidate.example.json`

Existing files are not overwritten unless `-- --force` is passed.

## Follow-Up Gates

Run these after filling approved values:

```bash
npm run security:trusted-key:review -- --candidate <approved-public-key.json> --patch-output <trusted-key-registry.patch.json>
npm run security:server-storage
npm run security:server-readiness
npm run server:deployment:bundle
npm run ops:approvals:check
npm run ops:go-live:check
npm run ops:handoff:bundle
```

## Safety

The onboarding summary redacts generated server session secrets and uses relative paths only. Do not store victim indicators, raw URLs, invite links, onion addresses, emails, phone numbers, passwords, tokens, or certificate material in onboarding files.
