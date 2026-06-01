# Trusted Key Patch Apply Gate v0.3.73

v0.3.73 adds the controlled apply step for approved institution trusted-key registry patches.

## Why this exists

Before this release, Jium AI could generate and review a public-key candidate and produce a registry patch, but the final write to `data/trusted-authorized-feed-keys.json` was still a manual file edit. That manual step is risky in production because it can accidentally apply an unapproved patch, paste the wrong key material, or leak approval notes into repository artifacts.

The new apply gate turns that step into an auditable command with explicit approval evidence and redacted reports.

## Command

```bash
npm run server:trusted-key:apply -- --patch <trusted-key-registry.patch.json> --approval-ref <pseudonymous-approval-reference>
```

Optional report formats:

```bash
npm run server:trusted-key:apply:json -- --patch <trusted-key-registry.patch.json> --approval-ref <pseudonymous-approval-reference>
npm run server:trusted-key:apply:markdown -- --patch <trusted-key-registry.patch.json> --approval-ref <pseudonymous-approval-reference>
```

## What the gate checks

- The patch path must stay inside the repository.
- The patch must match `jium-authorized-feed-trusted-keys-v1`.
- The patch must contain at least one active trusted public key.
- The patch must not contain private JWK fields, signing key usage, duplicate key IDs, invalid validity windows, or PEM private key material.
- The approval reference is required and must be a pseudonymous record reference, not a raw URL, contact, invite link, token, private key, or placeholder.

## Outputs

The command writes:

- updated registry: `data/trusted-authorized-feed-keys.json`
- redacted JSON report: `dist/trusted-key-onboarding/trusted-key-apply-report.json`
- redacted Markdown report: `dist/trusted-key-onboarding/trusted-key-apply-report.md`

The report stores only counts, key IDs, status values, repository-relative artifact names, and a SHA-256 digest of the approval reference. It does not store the raw approval reference, raw public-key modulus values, private key values, absolute filesystem paths, contacts, URLs, victim indicators, invite links, onion addresses, emails, or phone numbers.

## Operating sequence

```bash
npm run server:trusted-key:init -- --private-key-dir <approved-repo-external-private-key-dir> --key-id <approved-key-id> --issuer <approved-issuer-name>
npm run security:trusted-key:review -- --candidate <approved-public-key.json> --patch-output <trusted-key-registry.patch.json>
npm run server:trusted-key:apply -- --patch <trusted-key-registry.patch.json> --approval-ref <pseudonymous-approval-reference>
npm run security:feed-keys
npm run security:server-readiness
npm run server:deployment:bundle
```

`server:deployment:bundle` and `ops:action-plan` now include the apply command in the server-runtime phase, so operators can move from key generation to readiness validation without an undocumented manual registry edit.
