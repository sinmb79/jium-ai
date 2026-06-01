# JiumAI Server Storage Readiness v0.3.55

## Purpose

Production server deployments must not keep institution audit logs or account registry data inside the application repository, public static folders, build artifacts, or placeholder paths. This gate makes the storage decision explicit before go-live.

## Gate

Run:

```bash
npm run security:server-storage
npm run security:server-storage:json -- --output ./server-storage-readiness.json
npm run security:server-storage:markdown -- --output ./server-storage-readiness.md
```

The checker requires:

- `INSTITUTION_AUDIT_LEDGER_DIR`
- `INSTITUTION_ACCOUNT_REGISTRY_DIR`

Both directories must be absolute paths, outside the repository workspace, outside `public`, `out`, `dist`, `.next`, `app`, `server-route-templates`, and `data`, separate non-nested directories, and writable by the server process.

## Handoff

`security:server-readiness` now includes the storage result. `ops:handoff:bundle` also writes:

- `server-storage-readiness-report.json`
- `server-storage-readiness-report.md`

Reports redact filesystem paths and record only readiness states.
