# JiumAI Public Operations Env Init v0.3.64

v0.3.64 adds the public operations route preparation step for production go-live. It gives operators a reviewed way to set the public app URL, privacy notice URL, and support route without copying raw URLs into readiness reports.

## What Changed

- Added `/privacy/` as a public privacy and incident-data boundary page.
- Added `/support/` as a public support route that does not collect case details.
- Added `npm run ops:public-env:init`.
- Added redacted JSON and Markdown report modes.
- Updated the final go-live next action so public, privacy, and support routes are prepared before approval review.
- Routed the public-operations action into the final go-live phase of the operational action plan.

## Operator Command

```bash
npm run ops:public-env:init -- --base-url https://example.org/jium-ai/ --write-env
```

For GitHub Pages deployments, the helper can also derive the base URL from `GITHUB_REPOSITORY`:

```bash
npm run ops:public-env:init -- --repository sinmb79/jium-ai --write-env
```

The command writes private env values such as:

```env
JIUM_PUBLIC_APP_URL=https://example.org/jium-ai/
JIUM_PRIVACY_NOTICE_URL=https://example.org/jium-ai/privacy/
JIUM_SUPPORT_CONTACT_ROUTE=https://example.org/jium-ai/support/
```

## Safety Boundary

The public env init report records only route paths, URL validity states, counts, and env key statuses. It does not print the public URL values, support route value, tokens, victim indicators, invite links, onion addresses, emails, phone numbers, or private storage paths.

The private env file may contain real URLs, so it must stay out of git and must not be copied into public release evidence.

## Verification

```bash
npm test -- --run tests/publicOperationsEnvInit.test.ts tests/publicOperationsPages.test.tsx tests/operationalGoLive.test.ts tests/operationalActionPlan.test.ts
```

Full release verification should still run:

```bash
npm run ci:verify
npm run ops:go-live:json
```
