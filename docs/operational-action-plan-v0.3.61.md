# JiumAI Operational Action Plan v0.3.61

## Purpose

`ops:handoff:bundle` gathers the redacted readiness evidence. `ops:action-plan` turns that evidence into an operator-facing execution plan grouped by phase, owner role, evidence target, and verification command.

This is meant to reduce launch ambiguity for real operations without weakening the safety boundary.

## Commands

```bash
npm run ops:action-plan
npm run ops:action-plan:json
npm run ops:action-plan:markdown
```

The command writes these files under `dist/operational-handoff-bundle`:

- `operational-action-plan.json`
- `operational-action-plan.md`

By default the command refreshes the operational handoff bundle before creating the plan. To generate from an already reviewed summary:

```bash
npm run ops:action-plan -- --no-build
npm run ops:action-plan:json -- --summary dist/operational-handoff-bundle/operational-handoff-summary.json --output ./action-plan.json
```

## Phase Routing

The plan groups work into six operating phases:

- Private production onboarding: `OPERATIONS_LEAD`
- Institution server runtime: `DEPLOYMENT_ADMIN`
- Private server storage: `DATA_PROTECTION_OFFICER`
- Signed desktop release: `RELEASE_MANAGER`
- Private approval records: `LEGAL_REVIEWER`
- Final go-live decision: `PROGRAM_OWNER`

Each phase includes the relevant readiness gate, report references, evidence target, runbook actions, handoff-derived next actions, and the commands needed to verify completion.

## Redaction Boundary

The action plan is still a redacted artifact. It must not contain raw URLs, support contacts, incident owner names, secrets, tokens, certificate material, victim indicators, invite links, onion addresses, emails, phone numbers, or private storage paths.

Use the private approval packet and institution systems for real operational evidence. The action plan is a coordination checklist, not proof of approval.
