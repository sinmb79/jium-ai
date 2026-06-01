# Operational Launch Command Packet v0.3.99

v0.3.99 adds a private command-packet step after launch input review.

## Commands

```bash
npm run ops:launch-inputs:commands -- --input ops/private/production-onboarding/approved-launch-inputs.json
npm run ops:launch-inputs:commands:json -- --input ops/private/production-onboarding/approved-launch-inputs.json
npm run ops:launch-inputs:commands:markdown -- --input ops/private/production-onboarding/approved-launch-inputs.json
```

## What It Solves

The reviewed launch input file contains approved operating values, but copying those values by hand into several separate commands is error-prone and can leak raw URLs or paths into public notes.

This command writes:

- a redacted public report under `dist/operational-launch-command-packet`
- a private JSON command packet under ignored `ops/private`
- a private PowerShell command script under ignored `ops/private`

## Safety Boundary

The public report stores command IDs, counts, statuses, relative private output paths, and SHA-256 digests only.

The raw approved values appear only in the private command packet. Do not commit it or paste it into public release evidence, issues, pull requests, or chat.

The command packet does not execute the commands. Authorized operators still run the reviewed commands after legal, institutional, and release approval.
