# JiumAI Server Storage Init v0.3.62

## Purpose

`server:storage:init` creates the two repo-external directories required by the server storage gate:

- `INSTITUTION_AUDIT_LEDGER_DIR`
- `INSTITUTION_ACCOUNT_REGISTRY_DIR`

It can also update the private `.env.server.local` file after review. The command is designed for local pilot setup or deployment preparation; it does not replace an approved storage decision, backup policy, retention policy, or access-control review.

## Commands

```bash
npm run server:storage:init
npm run server:storage:init:json
npm run server:storage:init:markdown
```

By default the command creates directories under the OS user data area and prints a redacted report. It does not print absolute storage paths.

To choose an approved storage root:

```bash
npm run server:storage:init -- --storage-root <approved-absolute-storage-root>
```

To update placeholders in the private env file:

```bash
npm run server:storage:init -- --storage-root <approved-absolute-storage-root> --write-env
```

Existing non-placeholder env values are preserved unless `--force-env` is passed.

For deployment workspaces outside the repository root, pass `--root <workspace-root>` so `.env.server.local` is updated in the intended private working directory.

## Safety Boundary

Reports store only roles, directory names, statuses, and counts. They do not store absolute filesystem paths, victim indicators, raw URLs, invite links, onion addresses, emails, phone numbers, secrets, tokens, or certificate material.

The private env file may contain real storage paths. Keep `.env.server.local` out of git and do not copy it into public reports.
