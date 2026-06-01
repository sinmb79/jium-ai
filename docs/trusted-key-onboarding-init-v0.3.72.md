# Trusted Key Onboarding Init v0.3.72

v0.3.72 adds a safer first step for institution trusted-key onboarding.

## Why this exists

Server runtime readiness requires at least one approved active institution public key. Before this release, Jium AI could review a public-key candidate, but operators still had to create the keypair manually. That created a risky gap: private key material could accidentally be generated inside the repository or copied into approval packets.

## Command

```bash
npm run server:trusted-key:init -- --private-key-dir <approved-repo-external-private-key-dir> --key-id <approved-key-id> --issuer <approved-issuer-name>
```

The private key directory must be an absolute path outside the repository.

## Outputs

The command writes:

- private JWK: `<approved-repo-external-private-key-dir>/<approved-key-id>.private.jwk.json`
- public candidate: `ops/private/production-onboarding/<approved-key-id>.public-candidate.json`
- registry patch: `dist/trusted-key-onboarding/<approved-key-id>.registry-patch.json`
- redacted report: `dist/trusted-key-onboarding/trusted-key-onboarding-report.json`
- redacted report: `dist/trusted-key-onboarding/trusted-key-onboarding-report.md`
- candidate review markdown: `dist/trusted-key-onboarding/trusted-key-candidate-review.md`

The public candidate and registry patch contain public key material only. They still require institution/legal approval before the registry patch is applied.

## Follow-up sequence

After generating the candidate:

```bash
npm run security:trusted-key:review -- --candidate ops/private/production-onboarding/<approved-key-id>.public-candidate.json --patch-output dist/trusted-key-onboarding/<approved-key-id>.registry-patch.json
npm run security:feed-keys
npm run security:server-readiness
```

The operational action plan now includes `server:trusted-key:init` in the server-runtime phase before final trusted-key review.

## Redaction model

The onboarding report stores only key id, issuer name, fingerprint, status, counts, package version, and relative public artifact paths. It does not store private key values, raw public-key modulus values, private filesystem paths, contacts, URLs, victim indicators, invite links, onion addresses, emails, or phone numbers.

## Safety boundary

Do not commit the generated private JWK. Transfer it only through the approved institution secret-management process. Apply the registry patch only after comparing the fingerprint through a separate trusted channel and recording a pseudonymous approval evidence reference.
