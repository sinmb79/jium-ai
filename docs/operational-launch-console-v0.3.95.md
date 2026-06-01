# Operational Launch Console v0.3.95

v0.3.95 adds a redacted launch-console report for real operator handoff.

The existing action plan is intentionally thorough, but it can contain dozens of actions. The launch console compresses that into owner lanes so a program owner can see:

- which phase is still blocked
- which owner role must act next
- how many P0 actions remain
- which external approval commands are waiting
- which verification commands should be run after the private approvals are recorded

## Commands

```bash
npm run ops:launch-console
npm run ops:launch-console:json -- --output dist/operational-launch-console/current-report.json
npm run ops:launch-console:markdown -- --output dist/operational-launch-console/current-report.md
```

The command writes:

- `dist/operational-launch-console/operational-launch-console.json`
- `dist/operational-launch-console/operational-launch-console.md`

## Safety boundary

The console is not a launch approval. It does not create legal approval, support approval, incident-response ownership, trusted institution keys, signed desktop release evidence, or publication approval.

It stores only redacted statuses, owner roles, counts, relative report names, and command templates. It blocks if the generated report contains raw URLs, invite routes, onion addresses, emails, phone numbers, tokens, or private filesystem paths.

## Review flow

Use this order before final production launch:

1. Build the handoff bundle with `npm run ops:handoff:bundle`.
2. Build the action plan with `npm run ops:action-plan`.
3. Build the approval command packet with `npm run ops:approvals:command-packet`.
4. Build this launch console with `npm run ops:launch-console`.
5. Record only real external approvals in the ignored private approval/onboarding files.
6. Run the verification commands listed by the console.
7. Archive the release dossier and approval evidence digests before go-live approval.
