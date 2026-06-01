# Server Origin Approval v0.3.78

v0.3.78 adds a guarded CLI for applying externally approved institution operator origins to the private server runtime environment.

## Why this exists

Institution server deployment needs `JIUM_SERVER_ROUTES=true` and an exact `INSTITUTION_ALLOWED_ORIGINS` list. Before this release, operators had to edit `.env.server.local` manually. That made go-live fragile: a path-bearing URL, placeholder, invite link, contact value, or untracked approval reference could slip into the private env and keep readiness blocked.

This command does not approve an origin by itself. It records the result of an external approval in the local server env after validating that the origin list is safe for a production CORS/session boundary.

## Command

```bash
npm run server:origin:apply -- --origin <approved-https-operator-origin> --approval-ref <pseudonymous-origin-approval-reference>
```

Multiple origins are supported:

```bash
npm run server:origin:apply -- --origin <approved-https-operator-origin> --origin <approved-https-partner-origin> --approval-ref <pseudonymous-origin-approval-reference>
```

Optional report formats:

```bash
npm run server:origin:apply:json -- --origin <approved-https-operator-origin> --approval-ref <pseudonymous-origin-approval-reference>
npm run server:origin:apply:markdown -- --origin <approved-https-operator-origin> --approval-ref <pseudonymous-origin-approval-reference>
```

## What the Gate Checks

- `.env.server.local` must already exist; run `npm run server:env:init` first.
- Every origin must be HTTPS.
- Every origin must be an origin only, without path, credentials, query, or fragment.
- Empty origins, placeholders, raw contacts, invite links, onion values, and secret-like values are blocked.
- The approval reference must be pseudonymous and must not contain raw URLs, contacts, invites, onion values, or secrets.
- Unsafe report output paths are rejected before `.env.server.local` is modified.

## Outputs

The command updates the ignored private env file:

- `.env.server.local`

It sets:

- `JIUM_SERVER_ROUTES=true`
- `INSTITUTION_ALLOWED_ORIGINS=<approved-origin-list>`
- `INSTITUTION_SECURE_COOKIES=true`

The command also writes redacted reports:

- `dist/server-origin-approval/server-origin-approval-report.json`
- `dist/server-origin-approval/server-origin-approval-report.md`

Reports store only the origin count, env key update status, and SHA-256 digests of the approval reference and normalized origin list. They do not store raw origins, raw approval references, contacts, owner names, victim indicators, invite links, onion addresses, emails, phone numbers, passwords, tokens, certificate material, or secrets.

## Operating Sequence

```bash
npm run server:env:init
npm run server:origin:apply -- --origin <approved-https-operator-origin> --approval-ref <pseudonymous-origin-approval-reference>
npm run server:storage:init -- --storage-root <approved-absolute-storage-root> --write-env
npm run server:trusted-key:init -- --private-key-dir <approved-repo-external-private-key-dir> --key-id <approved-key-id> --issuer <approved-issuer-name>
npm run security:trusted-key:review -- --candidate <approved-public-key.json> --patch-output <trusted-key-registry.patch.json>
npm run server:trusted-key:apply -- --patch <trusted-key-registry.patch.json> --approval-ref <pseudonymous-approval-reference>
npm run security:server-readiness
```

`server:deployment:bundle` and `ops:action-plan` now include `server:origin:apply` in the server-runtime sequence so origin approval is visible before deployment.
