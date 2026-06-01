# Desktop Release Upload Verification v0.3.102

v0.3.102 adds a post-upload verification report for signed desktop release assets.

## Command

```bash
npm run desktop:release-upload:check -- --release-tag v0.3.102
npm run desktop:release-upload:check:json -- --release-tag v0.3.102
npm run desktop:release-upload:check:markdown -- --release-tag v0.3.102
```

The command can also read a captured GitHub release JSON file for offline review:

```bash
npm run desktop:release-upload:check -- --release-tag v0.3.102 --release-view-json ops/private/release-view.json
```

## What It Verifies

The report checks that the target GitHub Release is visible, not draft, aligned with `package.json`, and contains:

- signed Windows installer asset (`*.exe`)
- Windows blockmap asset (`*.blockmap`)
- Windows update metadata (`latest.yml`)
- signed release evidence archive (`jium-ai-windows-signed-release-evidence.tgz`)

## Safety Boundary

The report stores only tag status, asset names, sizes, counts, and SHA-256 digests. It does not store GitHub tokens, repository URLs, asset download URLs, update endpoints, certificate material, victim indicators, invite links, onion addresses, emails, or phone numbers.

This is upload verification, not launch approval. Legal, institutional, incident-response, and go-live approval still need the private approval record flow.
