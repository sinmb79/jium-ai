# Operational Launch Receipt v0.3.101

v0.3.101 adds a redacted launch receipt for the final private command-packet flow.

## Command

```bash
npm run ops:launch-inputs:receipt -- --input ops/private/production-onboarding/approved-launch-inputs.json
npm run ops:launch-inputs:receipt:json -- --input ops/private/production-onboarding/approved-launch-inputs.json
npm run ops:launch-inputs:receipt:markdown -- --input ops/private/production-onboarding/approved-launch-inputs.json
```

## What It Proves

The receipt verifies:

- the private command packet exists under `ops/private`
- the packet contains the expected launch command sequence
- the command packet input digest matches the reviewed launch input file
- current apply-readiness phases are not silently ignored
- the final go-live gate status and blocked checks are captured

## Safety Boundary

The receipt does not execute commands and does not approve launch.

It stores only command IDs, command digests, input digests, counts, statuses, and redacted blocker summaries. Raw URLs, storage paths, feed paths, support contacts, incident owner names, command text, secrets, tokens, certificate material, victim indicators, invite links, onion addresses, emails, and phone numbers stay out of the public report.

Use this receipt after generating and running the private command packet, then archive it with the private approval records, release dossier, handoff bundle, signed release evidence, and final go-live approval.
