# JiumAI Production Onboarding Upgrade v0.3.60

## Purpose

Private onboarding files are intentionally ignored by git. After the app version changes, those private files can still contain the previous package version or release tag.

`ops:onboarding:upgrade` refreshes release metadata without inventing or approving external evidence.

## Commands

```bash
npm run ops:onboarding:upgrade
npm run ops:onboarding:upgrade:json -- --dry-run
npm run ops:onboarding:upgrade:markdown -- --output ./production-onboarding-upgrade.md
```

Use `--dry-run` first when a real operator has already started filling private records.

## Safety Rules

- The command only updates package/release metadata.
- It never changes any record status to `APPROVED`.
- Placeholder operational approval records may be moved to the current release tag.
- Already approved operational approval records are skipped and require a new human-reviewed packet for the current release.
- Reports contain only relative paths, package version, release tag, and artifact status.

## Follow-Up

```bash
npm run ops:onboarding:check
npm run ops:go-live:check
npm run ops:handoff:bundle
```

If the upgrade reports `REVIEW`, inspect the skipped approval packet and create a new approval record for the current release instead of rewriting old evidence.
