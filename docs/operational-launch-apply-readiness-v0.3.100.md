# Operational Launch Apply Readiness v0.3.100

v0.3.100 adds a redacted pre-apply checker for filled operational launch inputs.

## Command

```bash
npm run ops:launch-inputs:apply-check -- --input ops/private/production-onboarding/approved-launch-inputs.json
npm run ops:launch-inputs:apply-check:json -- --input ops/private/production-onboarding/approved-launch-inputs.json
npm run ops:launch-inputs:apply-check:markdown -- --input ops/private/production-onboarding/approved-launch-inputs.json
```

## What It Checks

The checker reads the private launch input file and reports readiness for:

- launch input review
- private server env presence
- public operations env apply
- hosted security-header audit evidence
- repo-external server storage root
- server origin approval apply
- trusted-key candidate review and registry patch apply
- desktop release env, update feed, and publish readiness
- approved operational input packet presence
- final go-live env apply prerequisites

## Safety Boundary

The command does not apply env files, approval records, trusted keys, desktop release settings, or go-live flags.

The report stores statuses, counts, relative private paths, and SHA-256 digests only. Raw approved URLs, private storage paths, feed paths, incident owner refs, support contacts, secrets, tokens, victim indicators, invite links, onion addresses, emails, and phone numbers must remain in ignored private files.

Use this check before generating or running the private launch command packet so missing artifacts are found early.
