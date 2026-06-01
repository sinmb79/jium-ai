# JiumAI Server Deployment Bundle v0.3.56

## Purpose

Server deployment requires several separate checks: server runtime readiness, private storage readiness, trusted institution keys, and route materialization. This bundle gathers the redacted evidence into one handoff folder for the deployment operator.

## Commands

```bash
npm run server:deployment:bundle
npm run server:deployment:json
npm run server:deployment:markdown
```

The bundle is written to `dist/server-deployment-bundle`.

## Contents

- `server-runtime-readiness-report.json`
- `server-runtime-readiness-report.md`
- `server-storage-readiness-report.json`
- `server-storage-readiness-report.md`
- `server-route-materialization-report.json`
- `server-route-materialization-report.md`
- `server-deployment-summary.json`
- `server-deployment-summary.md`
- `server-deployment-runbook.md`

## Safety

The reports store readiness states, counts, relative route file names, package version, and commit only. They must not store server secrets, trusted origin values, storage directory paths, victim indicators, raw URLs, invite links, onion addresses, emails, or phone numbers.

The bundle is not a human approval substitute. It remains BLOCKED until approved institution keys, server-only env, private server storage, and route materialization readiness are all present.
