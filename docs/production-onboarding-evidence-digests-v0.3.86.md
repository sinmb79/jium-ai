# Production Onboarding Evidence Digests v0.3.86

`ops:onboarding:digest-evidence` creates a redacted digest manifest for the private production onboarding packet.

## Why This Exists

Final launch review needs proof that the private onboarding packet was reviewed, but the packet itself can contain pseudonymous approval references and operational structure that should not be copied into public reports. The digest command lets an operator archive a verifiable hash of the reviewed files without exporting their contents.

## Commands

```bash
npm run ops:onboarding:digest-evidence
npm run ops:onboarding:digest-evidence:json -- --output dist/production-onboarding-evidence-digests/report.json
npm run ops:onboarding:digest-evidence:markdown -- --output dist/production-onboarding-evidence-digests/report.md
```

The default manifest hashes these private onboarding artifacts:

- `operator-checklist.json`
- `storage-decision.template.json`
- `public-operations.template.json`
- `hosted-security-header-audit.json`
- `operational-approval-records.json`

The report intentionally stores only roles, file names, byte counts, SHA-256 digests, unsafe finding IDs, and an aggregate digest. It excludes `.env.server.local` because that file may contain approved raw URLs, origins, storage paths, and server-only secrets.

## Safety Boundary

The command blocks the aggregate digest if any source file contains placeholders, raw URLs, invite routes, onion addresses, emails, phone-like values, token-like values, filesystem paths, private key material, or server session secrets.

The report must not contain file contents, private paths, pseudonymous evidence references, raw public URLs, support contacts, incident owner names, secrets, tokens, certificate material, victim indicators, invite links, onion addresses, emails, phone numbers, or storage paths.

## Operating Sequence

1. Complete external approval reviews and apply private onboarding references through the guarded onboarding commands.
2. Run `npm run ops:onboarding:digest-evidence`.
3. Archive the aggregate digest with the private onboarding evidence packet.
4. Run `npm run ops:onboarding:check`.
5. Continue to `npm run ops:go-live:check` only after onboarding, approval records, hosted audit, server runtime, and desktop release gates are ready.
