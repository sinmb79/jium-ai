# JiumAI Server Storage Runbook Integration v0.3.63

## Purpose

v0.3.62 added `server:storage:init`. v0.3.63 wires that helper into the operational runbooks so operators see the command at the point where server storage blockers appear.

## Updated Surfaces

- `server:deployment:bundle` now lists `server:storage:init -- --storage-root <approved-absolute-storage-root> --write-env` before storage readiness checks.
- `ops:action-plan` now includes the same command in the `server-storage` phase verification commands.
- The server-storage phase now starts with an explicit action to prepare reviewed repo-external directories before running readiness checks.

## Boundary

The command still does not approve storage policy. It only creates or wires the directories after the operator has selected an approved absolute storage root.

Readiness remains BLOCKED until the server env, trusted institution key, storage decision, approval records, onboarding checklist, signed desktop artifacts, and go-live approvals are actually complete.
