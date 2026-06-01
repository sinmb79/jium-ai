# JiumAI Production Onboarding Gate v0.3.59

## Purpose

`ops:onboarding:check` is no longer only a standalone operator command. It is now part of the final production gates.

This prevents a launch package from looking complete while the private onboarding checklist, storage decision, server env scaffold, or approval records are still placeholders.

## Go-Live Integration

```bash
npm run ops:go-live:check
```

The go-live report now includes a `production-onboarding` check and a `productionOnboardingStatus` summary field. The report remains redacted and stores only states, counts, version, release metadata, and setting presence.

## Handoff Integration

```bash
npm run ops:handoff:bundle
```

The bundle now writes:

- `production-onboarding-readiness-report.json`
- `production-onboarding-readiness-report.md`

The handoff summary treats onboarding readiness as a separate gate beside server runtime, server storage, desktop publish, operational approval records, and operational go-live.

## Required External Evidence

- Approved HTTPS institution operator origin list
- Repo-external audit ledger and account registry storage decision
- Approved trusted public-key candidate evidence
- Signed desktop release evidence
- Legal, data-retention, support route, incident-response, and go-live approvals

The bundle remains a review artifact, not a substitute for those approvals.
