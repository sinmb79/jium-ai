# Operational Launch Inputs v0.3.98

v0.3.98 adds a guarded private-fill template for the non-secret operating inputs that still block production launch.

## Commands

```bash
npm run ops:launch-inputs
npm run ops:launch-inputs:review -- --input ops/private/production-onboarding/approved-launch-inputs.json
```

## What It Covers

- approved public app, privacy, support, and hosted-audit locations
- approved operator origins and origin approval reference
- trusted-key candidate and registry patch paths
- repo-external audit ledger and account registry paths
- desktop release channel, update URL, publish approval reference, and signed feed location
- private batch approval input path and approval evidence digest
- pseudonymous incident-response owner reference

## Safety Boundary

The review command does not write env files, approval files, trusted keys, or desktop release settings. It only checks the private input and emits a redacted report with statuses, counts, and SHA-256 digests.

The public report does not store raw URLs, storage paths, feed paths, support contacts, incident owner names, secrets, tokens, certificate material, victim indicators, invite links, onion addresses, emails, or phone numbers.

## Expected Review State

For a filled private input file, the review should show:

- `status`: `READY_FOR_OPERATOR_APPLY`
- `readyInputCount`: `19`
- `blockedInputCount`: `0`
- `leakScan.status`: `PASS`

After review, operators still run the guarded apply commands separately. This preserves human approval and avoids a single command silently changing launch-critical files.
