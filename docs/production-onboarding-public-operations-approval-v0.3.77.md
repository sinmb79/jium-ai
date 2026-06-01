# Production Onboarding Public Operations Approval v0.3.77

v0.3.77 adds a safe CLI for recording externally approved public operations route evidence.

## Why this exists

Production onboarding requires the public app URL, privacy notice URL, and support route to be approved HTTPS routes before go-live. Before this release, operators had to edit `public-operations.template.json` manually. That created avoidable risk: raw URLs or support contacts could be pasted into evidence fields, placeholders could remain, or section status could drift from the top-level public operations status.

This command does not approve a public route by itself. It records the result of a real external approval in the private onboarding packet after validating that the evidence reference is safe to store.

## Command

```bash
npm run ops:onboarding:approve-public-operations -- --section <public-app|privacy-notice|support-route> --evidence-ref <pseudonymous-public-operations-evidence-reference>
```

Optional report formats:

```bash
npm run ops:onboarding:approve-public-operations:json -- --section <public-app|privacy-notice|support-route> --evidence-ref <pseudonymous-public-operations-evidence-reference>
npm run ops:onboarding:approve-public-operations:markdown -- --section <public-app|privacy-notice|support-route> --evidence-ref <pseudonymous-public-operations-evidence-reference>
```

## Supported Sections

- `public-app`
- `privacy-notice`
- `support-route`
- `publicApp`
- `privacyNotice`
- `supportRoute`

## What the Gate Checks

- The private public operations template must exist.
- The section must be one of the required public operations sections.
- The public operations template package version must match the app version.
- The target section must preserve its required check text.
- The evidence reference must be a short pseudonymous reference.
- Placeholder values, raw URLs, invite links, onion addresses, emails, phone-like values, tokens, and private key material are blocked.
- Unsafe report output paths are rejected before the private public operations file is modified.

## Outputs

The command updates:

- `ops/private/production-onboarding/public-operations.template.json`

The command also writes redacted reports:

- `dist/production-onboarding-public-operations/production-onboarding-public-operations-approval-report.json`
- `dist/production-onboarding-public-operations/production-onboarding-public-operations-approval-report.md`

Reports store only the section id, counts, public operations status, and a SHA-256 digest of the evidence reference. The raw pseudonymous evidence reference is stored only in the ignored private onboarding packet.

## Operating Sequence

```bash
npm run ops:onboarding:init
npm run ops:public-env:init -- --base-url <approved-https-public-base-url> --write-env
npm run security:headers:check -- <approved-https-public-app-url> --json --output ops/private/production-onboarding/hosted-security-header-audit.json
npm run ops:onboarding:approve-public-operations -- --section public-app --evidence-ref <pseudonymous-public-operations-evidence-reference>
npm run ops:onboarding:approve-public-operations -- --section privacy-notice --evidence-ref <pseudonymous-public-operations-evidence-reference>
npm run ops:onboarding:approve-public-operations -- --section support-route --evidence-ref <pseudonymous-public-operations-evidence-reference>
npm run ops:onboarding:check
```

When all three sections are approved through this command, the public operations status becomes `APPROVED`.
