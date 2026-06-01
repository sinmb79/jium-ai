# JiumAI Production Onboarding Public Operations Gate v0.3.65

v0.3.65 moves public app, privacy notice, and support route preparation into the private production onboarding gate. Operators now see these routes before final go-live, not only at the final go-live check.

## What Changed

- `ops:onboarding:init` now creates `public-operations.template.json`.
- `operator-checklist.json` now includes `public-operations-routes`.
- `ops:onboarding:check` now verifies:
  - `JIUM_PUBLIC_APP_URL` is HTTPS.
  - `JIUM_PRIVACY_NOTICE_URL` is HTTPS.
  - `JIUM_SUPPORT_CONTACT_ROUTE` is HTTPS.
  - `public-operations.template.json` has approved pseudonymous evidence references.
- `ops:onboarding:upgrade` now updates `public-operations.template.json` package metadata after version bumps.
- Onboarding reports still redact raw URLs and store only states, counts, and relative private paths.

## Private File

`ops/private/production-onboarding/public-operations.template.json` must be completed without raw URLs:

```json
{
  "status": "APPROVED",
  "publicApp": {
    "status": "APPROVED",
    "evidenceRef": "PUBLIC-APP-2026"
  },
  "privacyNotice": {
    "status": "APPROVED",
    "evidenceRef": "PRIVACY-NOTICE-2026"
  },
  "supportRoute": {
    "status": "APPROVED",
    "evidenceRef": "SUPPORT-ROUTE-2026"
  }
}
```

The real URL values belong in the ignored private env file or deployment secret store, not in this template.

## Operator Flow

```bash
npm run ops:public-env:init -- --base-url <approved-https-public-base-url> --write-env
npm run ops:onboarding:check
npm run ops:go-live:check
```

## Safety Boundary

The onboarding report does not store public URL values, support contact details, incident owner names, victim indicators, invite links, onion addresses, emails, phone numbers, passwords, tokens, certificate material, or private storage paths.

## Verification

```bash
npm test -- --run tests/productionOnboardingInit.test.ts tests/productionOnboardingCheck.test.ts tests/productionOnboardingUpgrade.test.ts tests/operationalGoLive.test.ts tests/operationalHandoffBundle.test.ts tests/operationalActionPlan.test.ts
npm run ci:verify
```
