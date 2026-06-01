# Desktop Release Env Apply v0.3.80

v0.3.80 adds a guarded CLI for applying non-secret desktop release configuration before signed packaging and GitHub Release publication.

## Why this exists

Desktop release readiness needs a release lane, HTTPS update endpoint, release tag, and human publish approval state. Before this release, operators had to remember where to place those values manually, while signing certificates and GitHub upload tokens still had to stay in secure secret stores.

This command separates those two classes of data:

- Non-secret release configuration goes into the ignored `.env.desktop.local`.
- Signing certificates, certificate passwords, Azure signing secrets, and GitHub tokens stay in the shell environment or GitHub Secrets.
- Reports store only status fields and SHA-256 digests.

## Command

```bash
npm run desktop:release-env:apply -- --channel <approved-release-channel> --update-url <approved-https-update-url> --publish-approval-ref <pseudonymous-desktop-publish-approval-reference>
```

Optional report formats:

```bash
npm run desktop:release-env:apply:json -- --channel stable --update-url https://updates.example.com/jium-ai/ --publish-approval-ref DESKTOP-PUBLISH-APPROVAL-2026-001
npm run desktop:release-env:apply:markdown -- --channel stable --update-url https://updates.example.com/jium-ai/ --publish-approval-ref DESKTOP-PUBLISH-APPROVAL-2026-001
```

The release tag defaults to `v<package.json version>`. It can be set explicitly with `--release-tag vMAJOR.MINOR.PATCH`.

## What the Gate Checks

- Release channel must be a short release lane.
- Update URL must be a valid HTTPS URL without embedded credentials or fragments.
- Release tag must use `vMAJOR.MINOR.PATCH` or an approved prerelease suffix.
- Publish approval reference must be pseudonymous when provided.
- Placeholder values, raw URLs in approval refs, contacts, phone-like values, tokens, and private key material are blocked.
- Unsafe report output paths are rejected before `.env.desktop.local` is modified.

## Env Keys Applied

The command can set:

- `JIUM_DESKTOP_RELEASE_CHANNEL`
- `JIUM_DESKTOP_UPDATE_URL`
- `JIUM_DESKTOP_RELEASE_TAG`
- `JIUM_DESKTOP_PUBLISH_APPROVAL=APPROVED`

It never writes signing certificate material, certificate passwords, GitHub tokens, raw approval references, victim indicators, invite links, onion addresses, emails, or phone numbers.

## Outputs

The command updates:

- `.env.desktop.local`

The command also writes redacted reports:

- `dist/desktop-release-env/desktop-release-env-apply-report.json`
- `dist/desktop-release-env/desktop-release-env-apply-report.md`

`desktop:release:check`, `desktop:signing-secrets:check`, and `desktop:publish:check` now load only the allowlisted non-secret keys from `.env.desktop.local`. Any signing secret or GitHub token must still come from the actual process environment or CI secret store.

## Operating Sequence

```bash
npm run desktop:release-env:apply -- --channel <approved-release-channel> --update-url <approved-https-update-url> --publish-approval-ref <pseudonymous-desktop-publish-approval-reference>
npm run desktop:signing-secrets:check
npm run desktop:release:check
npm run desktop:package:signed
npm run desktop:distribution:check
npm run desktop:update-feed:check -- --feed-dir <signed-release-folder>
npm run desktop:publish:check -- --feed-dir <signed-release-folder>
```

`ops:action-plan` now includes this command in the signed desktop release phase so desktop release blockers no longer require undocumented local env edits.
