# Operational Approval Command Packet v0.3.94

`ops:approvals:command-packet` creates one redacted command packet for the approvals that remain outside the codebase.

```bash
npm run ops:approvals:command-packet
npm run ops:approvals:command-packet:json -- --output dist/operational-approval-command-packet/report.json
```

The packet includes command templates for:

- private operational approval records
- production onboarding checklist records
- storage decision approvals
- public operations route approvals
- final verification commands

This command does not approve anything and does not write private approval records. Operators must replace placeholders only after external review, using pseudonymous references and SHA-256 evidence digests from reviewed redacted packets.

The report stores command templates, owner roles, group counts, and safety notes only. It does not store raw public URLs, support contacts, owner names, victim indicators, invite links, onion addresses, emails, phone numbers, tokens, certificate material, or private filesystem paths.

Operational release dossiers and approval evidence digests now include the command packet, so reviewers can see the exact guarded commands without copying sensitive values into public artifacts.
