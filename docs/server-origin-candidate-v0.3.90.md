# Server Origin Candidate v0.3.90

`server:origin:candidate` prepares the next server-runtime approval step without applying or approving it.

## Why This Exists

After the public app, privacy notice, and support route are configured, the institution server still needs an approved HTTPS origin list before `security:server-readiness` can pass. Operators should not copy raw public URLs into public reports, and the tool must not silently mark origins as approved.

This command derives origin candidates from the private server env, writes a private apply-command memo, and emits a redacted public report with digests only.

## Commands

```bash
npm run server:origin:candidate -- --from-public-env
npm run server:origin:candidate:json -- --from-public-env --output dist/server-origin-candidate/report.json
npm run server:origin:candidate:markdown -- --from-public-env --output dist/server-origin-candidate/report.md
```

For a separately reviewed operator app origin:

```bash
npm run server:origin:candidate -- --origin <approved-https-origin>
```

The generated private command is written to:

```text
ops/private/server-origin-candidate/server-origin-apply-command.md
```

That private file may contain raw origins and is ignored by git. The public report stores only:

- URL key readiness states
- origin counts
- relative private command path
- SHA-256 digests
- next action templates

The operational release dossier and approval evidence digest manifest include the redacted server-origin candidate report, so reviewers can see that the raw command exists without exposing the origin in public evidence.

## Safety Boundary

This is not approval. The operator must review the private command, replace the approval reference placeholder with a pseudonymous approved reference, and run `server:origin:apply` only after external approval.

Reports do not store raw origins, public URLs, support contacts, incident owner names, victim indicators, invite links, onion addresses, emails, phone numbers, passwords, tokens, certificate material, or secrets.
