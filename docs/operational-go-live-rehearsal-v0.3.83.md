# Operational Go-Live Rehearsal v0.3.83

v0.3.83 adds a safe rehearsal command for the final operating gates:

```bash
npm run ops:go-live:rehearsal
npm run ops:go-live:rehearsal:json -- --output dist/operational-go-live-rehearsal/report.json
```

## Why this exists

The real go-live gate must stay blocked until institution keys, HTTPS public hosting, legal review, support routing, incident-response ownership, hosted security-header evidence, and signed desktop release artifacts are approved.

That is correct, but it also means operators need a way to check whether the internal gate wiring still reaches READY when those external records are present. The rehearsal command creates a temporary synthetic workspace, fills it with redacted pseudonymous records, runs the real server, onboarding, approval, hosted-audit, and go-live validators, then deletes the temporary data.

## What is simulated

- Desktop publish readiness is explicitly marked `SIMULATED_SIGNED_ARTIFACTS`.
- Public app, privacy notice, and support routes use synthetic HTTPS URLs.
- Legal, retention, support, incident-response, and go-live approvals use synthetic pseudonymous references.
- Hosted security-header evidence is a synthetic READY audit report.

## What remains real

- Server runtime readiness validates a real temporary `.env.server.local` file.
- Server storage readiness uses temporary repo-external storage paths.
- Trusted public-key registry readiness uses an active synthetic public key record.
- Production onboarding checks validate the private onboarding file structure.
- Operational approval records checks validate release alignment and redaction.
- Final go-live checks run through the same report builder used by production review.

## Safety boundaries

The generated report stores only statuses, counts, package version, and declared simulation modes. It does not store synthetic secrets, trusted origins, public URLs, hosted audit paths, storage paths, contacts, owner names, tokens, victim indicators, invite links, onion addresses, emails, or phone numbers.

A READY rehearsal proves internal gate wiring only. It is not production go-live approval.
