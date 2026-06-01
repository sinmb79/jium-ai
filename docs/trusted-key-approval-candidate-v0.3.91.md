# Trusted Key Approval Candidate v0.3.91

`server:trusted-key:approval-candidate` prepares the trusted institution public-key review packet before any registry change is applied.

## Why This Exists

The server runtime cannot go live until at least one active institution public key is registered. That key must be reviewed through an official channel, but release evidence must not expose private key material, raw public-key modulus values, private paths, contacts, URLs, or victim indicators.

This command reads the trusted-key onboarding report and produces a redacted approval candidate report with file digests only. It does not generate a key, approve a key, or write the trusted-key registry.

## Commands

```bash
npm run server:trusted-key:init -- --private-key-dir <approved-repo-external-private-key-dir> --key-id <approved-key-id> --issuer <approved-issuer-name>
npm run server:trusted-key:approval-candidate
npm run server:trusted-key:approval-candidate:json -- --output dist/trusted-key-approval-candidate/report.json
npm run server:trusted-key:approval-candidate:markdown -- --output dist/trusted-key-approval-candidate/report.md
```

After approval:

```bash
npm run server:trusted-key:apply -- --patch <trusted-key-registry.patch.json> --approval-ref <pseudonymous-approval-reference>
npm run security:feed-keys
npm run security:server-readiness
```

## Evidence Boundary

The report stores:

- key id
- fingerprint
- validation status
- artifact file names
- byte counts
- SHA-256 digests
- warning and error counts
- next action templates

The report does not store raw public-key modulus values, private JWK values, private filesystem paths, raw approval references, contacts, URLs, victim indicators, invite links, onion addresses, emails, phone numbers, tokens, or certificate material.

The operational release dossier and approval evidence digest manifest now include this redacted trusted-key approval candidate report. A blocked report is still useful evidence because it shows reviewers exactly which trusted-key approval step remains unresolved.
