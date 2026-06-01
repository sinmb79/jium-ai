# JiumAI Digital Crime Route Knowledge Base v0.1

## Goal

JiumAI should help a victim and a case worker understand where harmful material may have moved, what evidence is still safe to record, and which official route should receive the handoff packet.

This is not a public directory of criminal sites. Even if a route is already publicly mentioned, turning it into a browseable list can create secondary harm, drive traffic to abuse material, expose victims, or encourage unsafe investigation.

## Product policy

1. Public UI may show route classes, not operational targets.
2. Case-local exact indicators such as URLs, invite links, room names, handles, and file names stay in the encrypted evidence ledger.
3. Official or partner intelligence can be stored as restricted indicators with provenance, last-checked date, source type, access level, and audit logs.
4. The system may match and prioritize indicators, but it must not infiltrate private rooms, buy access, download abuse material, scrape victim content, attack infrastructure, or deanonymize people.
5. Every high-risk route must end in a handoff packet for D4U, ECRM, KOCSC/KCSC, platform abuse teams, or legal counsel.

## Why public lists still need controls

Publicly known does not automatically mean safe to republish, automate, or expose to every user. A victim-support tool needs a different standard: minimize rediscovery of abuse material, avoid accidental distribution, and preserve evidence in a form that official agencies can act on.

The practical compromise is a three-layer model:

| Layer | Stored content | Visible to victim UI | Use |
| --- | --- | --- | --- |
| Public guidance | Route type, safe signals, evidence checklist, official handoff | Yes | Education, demo, triage |
| Case indicator | Victim-provided URL, handle, room claim, screenshot metadata | Redacted summary only | Evidence packet and timeline |
| Authorized intelligence | Official notices, partner feeds, known repeated route indicators | No, unless authorized | Fast matching and escalation |

## Current route classes implemented

- SNS/public profile repost route
- Community/forum/imageboard route
- Encrypted messenger/private-room route
- Cloud/file-share link route
- Search/cache/archive persistence route
- P2P/webhard/reupload route
- Overseas hosting/CDN route
- Dark-web/onion claim route

Each route class includes:

- Safe signals
- Evidence to record
- Prohibited actions
- Official handoff routes
- Allowed indicator sources
- Access level
- Intelligence value
- Handoff question

## Official handoff references checked on 2026-05-31

- Central Digital Sex Crime Victim Support Center D4U: https://d4u.stop.or.kr/main
- D4U support application guide: https://d4u.stop.or.kr/support/content/guide
- Korean National Police ECRM: https://ecrm.police.go.kr
- KISA Privacy Infringement Report Center: https://privacy.kisa.or.kr
- Personal Information Portal / eraser service: https://www.privacy.go.kr
- Korea policy briefing on 1366 and digital sex-crime support integration: https://www.korea.kr/news/policyNewsView.do?newsId=148941931

## Hackathon scope

For the 4-hour build target, JiumAI should demonstrate:

1. Victim-safe evidence intake.
2. Route class detection from visible clues.
3. Timeline/graph generation.
4. Restricted-route warnings.
5. Official handoff packet creation.

The demo should not attempt live crawling, hidden-room access, dark-web access, offender deanonymization, or real-time law-enforcement attribution.

## Implemented in v0.2.2

- Add encrypted case-local indicator storage.
- Keep exact victim-provided URLs out of the normal plaintext local case board.

## Next hardening items

- Add role-based access control for restricted intelligence.
- Add indicator provenance fields: source, source date, last checked, confidence, retention deadline. v3.11 implements the first restricted feed model.
- Add audit log for every view/export of exact indicators. v3.11 adds import audit logs; future restricted viewing still needs role-based access control.
- Add official CSV/JSON import format for authorized public notices or partner feeds. v3.11 adds a JSON bundle shape for pre-vetted, non-raw indicators.
- Add retention/deletion workflow for closed cases.

## Implemented in v3.11

- `AuthorizedFeedIndicator` accepts only official, platform transparency, or authorized partner sources.
- Raw operational targets such as URLs, invite links, handles, phone numbers, and onion addresses are rejected.
- Pre-vetted indicators must use route pattern IDs, promotion-surface IDs, or non-raw `sha256-*` / `ahash-*` digests.
- Each indicator carries source date, last checked date, retention deadline, access level, confidence, allowed uses, prohibited uses, official handoff, and import audit logs.
- `npm run security:feeds` verifies the restricted feed model together with route knowledge, promotion surfaces, and anonymized learning storage.

## Implemented in v3.12

- Restricted feed import now requires a short local operator session with explicit capabilities.
- The local session is a guardrail, not organizational identity or legal authority.
- The dashboard exposes only aggregate counts by route pattern, promotion surface, source type, access level, and retention status.
- Feed import and expired-indicator purge are disabled until the operator session is opened.
- UI regression tests confirm that individual indicator labels are not displayed after import.

## Implemented in v3.13

- Authorized feed import now supports signed `jium-authorized-feed-signed-v1` envelopes.
- The signature payload uses canonical JSON so object key ordering does not change the verification result.
- Restricted imports must pass RSA-SHA256 WebCrypto verification against pinned trusted public keys.
- The default dashboard rejects unsigned feed JSON and stays closed until a trusted public key is registered.
- Regression tests reject tampered bundles, unknown or inactive keys, and imports without an operator session.

## Implemented in v3.14

- Trusted authorized feed public keys are loaded from `data/trusted-authorized-feed-keys.json`.
- `npm run security:feed-keys` rejects private JWK fields, private key usages, PEM private key material, duplicate key IDs, and invalid validity windows.
- The key-registry check is included in `npm run security:feeds`, so feed safety tests cover both signed bundles and the key registry.

## Implemented in v3.15

- Restricted feed operator sessions can be opened with signed `jium-authorized-operator-credential-signed-v1` credentials.
- Operator credentials are verified with the same pinned trusted public key model used for authorized feeds.
- Credential subject IDs must be pseudonymous and cannot contain raw URLs, handles, invite links, phone numbers, or onion addresses.
- Credential tests reject tampering, expiry, unsupported capabilities, and missing trusted signing keys.

## Implemented in v3.16

- Added an `InstitutionAccountSession` RBAC model for future server-issued institution accounts.
- Role matrices prevent caseworkers, platform operators, law-enforcement liaisons, and admins from inheriting each other's restricted capabilities.
- Trusted-key review requires MFA-backed server sessions.
- The authorized feed panel can accept a server institution session and convert valid feed capabilities into a restricted operator session.
- `npm run security:auth` is included in PR and deploy gates.

## Implemented in v3.17

- Added an HMAC-signed `jium-institution-session-token-v1` token core for future server-issued institution account sessions.
- Session token verification rejects tampered payloads, weak secrets, inactive keys, expired sessions, and local signed-credential sessions.
- `INSTITUTION_SESSION_SECRET` is documented as a server-only 32-byte minimum secret.
- `npm run security:auth` now covers RBAC, signed operator credentials, and server session token invariants.

## Implemented in v3.18

- Added a server login core that verifies signed operator credentials and issues server institution session tokens.
- Production institution session cookies use `__Host-jium_institution_session` with HttpOnly, Secure, SameSite=Strict, and Path=/.
- Login tests ensure role escalation is rejected before Set-Cookie is issued.
- Cookie tests ensure production cookies do not use a Domain attribute and do not expose the server session secret.

## Implemented in v3.19

- Added HTTP handler cores for institution credential login, session verification, and logout without adding static-export-breaking Next API routes.
- Login/logout handlers require POST, JSON content type for login, an allowlisted Origin when configured, `X-Jium-Institution-Login: 1`, and a bounded request body.
- Successful login returns only a safe session view in JSON and delivers the server session token through HttpOnly Set-Cookie.
- Regression tests cover CSRF header, origin, content-type, body-size, session cookie verification, logout cookie clearing, and token non-exposure.

## Implemented in v3.20

- Added a privacy-minimized institution authentication audit event model and optional audit sink.
- HTTP login, session verification, and logout handlers can now emit audit events for success and denial outcomes.
- Audit events do not store raw credentials, server session tokens, URLs, invite links, handles, onion addresses, emails, or phone numbers.
- Request origins are recorded only as ALLOWED, REJECTED, MISSING, or NOT_CONFIGURED classifications.

## Implemented in v3.21

- Added a hash-chained institution audit ledger for privacy-minimized authentication events.
- Each ledger record stores the previous record digest, event digest, and record digest so tampering or deletion can be detected.
- The HTTP institution login handler can attach a ledger sink without storing raw credentials, session tokens, or actual Origin URLs.
- Regression tests cover valid chains, tampered events, broken chain links, and token/origin non-exposure in ledger records.

## Implemented in v3.22

- Added a server/desktop JSONL file store for append-only institution audit ledger records.
- The file store verifies the existing ledger before each append and refuses to add records when tampering is detected.
- Ledger file paths are constrained to a configured base directory and simple `.jsonl` file names.
- Regression tests cover append/read/verify, tamper refusal, path traversal refusal, and token/origin non-exposure.

## Implemented in v3.23

- Added a Next server route adapter for institution login, session verification, and logout without adding static-export-breaking `app/api` files.
- Route config loading requires a server-only institution session secret, allowlisted origins, audit ledger storage, and trusted institution public keys.
- The loader rejects `NEXT_PUBLIC_INSTITUTION_SESSION_SECRET` and production insecure-cookie settings.
- Regression tests cover login/session/logout through the adapter, audit ledger writes, token/origin non-exposure, unsafe env rejection, and local dev-cookie handling.

## Implemented in v3.24

- Added a deployment profile guard script for GitHub Pages static export and future server-route deployments.
- Static export fails early if `app/**/route.ts` handlers are present while `GITHUB_PAGES=true`.
- Server-route mode requires session secret, allowlisted origins, audit ledger directory, and rejects public institution secrets or insecure production cookies.
- GitHub Pages deploy and PR quality-gate workflows now run `npm run security:deployment`.

## Implemented in v3.25

- Added server-route templates for institution login, session verification, and logout under `server-route-templates/app/api/institution`.
- Added `server:routes:materialize`, `server:routes:clean`, and `build:server` scripts for server-runtime deployments.
- Materialization refuses GitHub Pages mode, missing server-route env, and non-generated route overwrites.
- Generated `app/api/institution/*/route.ts` files are ignored by git and can be removed with the clean command before static export work.

## Implemented in v3.26

- Added `security:server-readiness` and `build:server:production` for production server readiness checks.
- Server readiness requires server-route mode, safe deployment env, all institution route templates, and at least one trusted institution public key.
- The default public registry is intentionally empty, so production readiness must fail until an approved partner key is registered.
- Server route cleanup now removes stale `.next/types` caches so static typechecks are not polluted by a previous server build.

## Implemented in v3.27

- Added a trusted institution public-key approval core and dashboard panel.
- Candidate JWK review blocks private JWK fields, private key usages, duplicate key IDs, and invalid validity windows.
- The panel computes an approval fingerprint, renders an operator checklist, and generates a registry patch JSON without writing private key material.
- Regression tests cover key approval logic and the dashboard UI.

## Implemented in v3.28

- Added an institution audit ledger report core and dashboard verification panel.
- The report accepts JSONL or JSON array exports, verifies the hash chain, and summarizes event type, outcome, origin classification, organization, and recent records.
- The UI can paste or load `.jsonl/.json` ledger files and export a Markdown verification report.
- Regression tests cover valid ledgers, parse failures, tamper detection, and the dashboard verification flow.

## Implemented in v3.29

- Added a server-side institution audit ledger summary HTTP core and Route template.
- Added `INSTITUTION_AUDIT_LEDGER_REVIEW` as a PROGRAM_ADMIN MFA-only capability.
- The audit-ledger API verifies the institution session cookie, requires the audit review capability, reads the server audit store, and returns only a redacted summary report.
- Audit-ledger view success and denial attempts are themselves recorded as privacy-minimized audit events.

## Implemented in v3.30

- Added trusted institution public-key lifecycle review for active, expiring, expired, no-expiry, and not-yet-active keys.
- Added retirement and rotation patch helpers so operators can review key changes before updating the registry.
- Server readiness now requires at least one currently active trusted key, not just any key in the registry.
- The dashboard trusted-key panel can review registry lifecycle status and generate a retirement patch without storing private key material.

## Implemented in v3.31

- Split the encrypted vault storage backend into browser localStorage and an optional desktop secure-storage bridge.
- Added the `window.jiumSecureVault` bridge contract for future Windows DPAPI, macOS Keychain, or Linux Secret Service providers.
- When the bridge is present, encrypted vault payloads are written to the bridge and removed from browser localStorage.
- The vault UI now shows the active storage backend and whether an OS-protected provider is connected.

## Implemented in v3.32

- Added an institution account admin review core and dashboard panel for server institution sessions.
- The account review checks role, capability, MFA, expiry, high-risk capabilities, and raw identifier exposure without issuing accounts.
- Added a regional digital-sex-crime support router based on the official D4U regional-center status page.
- The submission packet can now show regional center candidates, 1366, and the central D4U path while preserving the no-auto-submit boundary.

## Implemented in v3.33

- Added encrypted support handoff archives for counselor, supporter, and investigator review.
- The handoff archive stores the read-only packet, HTML, evidence-chain manifest, and checklist inside an AES-GCM passphrase-encrypted payload.
- Handoff metadata keeps only case ID, role, expiry, and chain fingerprint outside encryption.
- The submission packet UI can export `.jiumhandoff.json` plus a separate instruction memo, and the ZIP package now includes a support handoff guide.

## Implemented in v3.34

- Added a pre-submission checklist engine that classifies final handoff readiness as PASS, REVIEW, or BLOCKED.
- The checklist validates case summary, access path, timestamps, capture method, integrity fingerprints, request history, original media handling, and official-authority boundaries.
- The submission packet UI now shows a `제출 전 최종 검수` panel and can export the checklist as Markdown.
- The agency ZIP package now includes `pre-submission-checklist.md` so support workers and officials can see what was checked before handoff.

## Implemented in v3.35

- Added `scripts/native-secure-vault-bridge.mjs` for desktop OS-backed encrypted vault storage.
- Windows uses DPAPI CurrentUser protected blobs, macOS uses Keychain generic passwords, and Linux uses Secret Service through `secret-tool`.
- Added `desktop/electron-preload.cjs` so an Electron shell can expose the native bridge as `window.jiumSecureVault`.
- Added `desktop:vault` and `desktop:vault:describe` scripts for local operational checks.

## Implemented in v3.36

- Added institution account registry records with pseudonymous account IDs, roles, capabilities, evidence-access scope, and ACTIVE/SUSPENDED/REVOKED status.
- Added a server-side account registry file store guarded against path traversal and invalid registry contents.
- Added `/api/institution/accounts` server route template for LIST, PROVISION, and REVOKE operations.
- Account provisioning requires a PROGRAM_ADMIN MFA session with `INSTITUTION_ACCOUNT_ADMIN`; audit events stay privacy-minimized.

## Implemented in v3.37

- Connected the dashboard institution account admin panel to the server `/api/institution/accounts` route.
- The panel can list, provision, and revoke institution accounts using credential-included POST requests and the account-admin CSRF header.
- Account provisioning inputs are structured around pseudonymous organization and subject IDs, role, evidence-access scope, expiry, capabilities, and notes.
- The offline session-review report remains available, and Korean UI/report text for the account admin panel was repaired.

## Implemented in v3.38

- Added mandatory approval records for server institution account provisioning and revocation.
- Account approvals require a simple approval reference, a pseudonymous approving operator ID, an approval timestamp, and an independent reviewer when an acting operator is known.
- PROGRAM_ADMIN provisioning is stored with a separate `PROGRAM_ADMIN_PROVISION` approval scope.
- Approval records reject raw URLs, invite links, onion addresses, emails, and phone-like identifiers in refs, reviewer IDs, and notes.

## Implemented in v3.39

- Added privacy-minimized account lifecycle fields to institution audit events.
- Provision and revoke audit events now carry pseudonymous account ID, approval reference, approval scope, target role, and target account status.
- Revocation audit events also carry the safe reason code so registry records and audit ledgers can be reconciled.
- Audit event validation keeps rejecting raw URLs, invite links, onion addresses, emails, phone-like identifiers, and unsafe free-text approval references.

## Implemented in v3.40

- Added redacted JSON and Markdown server-runtime readiness reports for operator handoff.
- The readiness report summarizes env presence, trusted key counts, required route templates, blocked checks, and next actions.
- Secret values, trusted origin strings, and filesystem paths are intentionally excluded from report output.
- Added `security:server-readiness:json` and `security:server-readiness:markdown` scripts for repeatable deployment review.

## Implemented in v3.41

- Added an Electron desktop shell entrypoint that loads the static app through the private `jium://app` protocol.
- The desktop shell keeps Node integration disabled, exposes the OS-backed secure vault only through the preload bridge, blocks file/javascript/http navigation, and sends approved HTTPS external links to the system browser.
- Added `desktop:export` to build a desktop static export without the GitHub Pages `/jium-ai` basePath and write `out/jium-desktop-manifest.json`.
- Added redacted desktop release readiness reports for static export, Electron shell files, release channel, HTTPS update URL, and signing-profile presence.
- Added `desktop:release:check`, `desktop:release:json`, and `desktop:release:markdown` scripts; reports intentionally omit update endpoints, certificate paths, certificate hashes, team IDs, and package signing key IDs.

## Implemented in v3.43

- Expanded device-safety guidance into a readiness engine with required and recommended checks for personal device use, extension isolation, remote-access shutdown, attacker access, malware scan, trusted network, and clipboard/sync exposure.
- Added a reusable device-safety panel to the intake page and case board so victims see the compromised-device risk before entering sensitive facts or opening encrypted vaults.
- The panel classifies readiness as BLOCKED, REVIEW, or READY without storing victim data or raw device details.

## Implemented in v3.44

- Added a lean Electron app staging directory at `dist/electron-app` so desktop packaging does not pull the full Next.js, React, Prisma, and test workspace into `app.asar`.
- Added `scripts/prepare-desktop-app-dir.mjs` and wired `desktop:package:dir` and `desktop:package:signed` to stage the static export before electron-builder runs.
- Added a package-size guard to reject unexpectedly large desktop `app.asar` output, preventing accidental root dependency inclusion from being treated as release-ready.
- Moved the OS secure-vault bridge behind Electron main-process IPC, so packaged desktop builds do not rely on spawning the app executable as if it were Node.js.
- Desktop update checks remain opt-in and require an explicit HTTPS update URL plus release channel; readiness reports continue to redact endpoint and signing details.

## Implemented in v3.45

- Added `scripts/check-desktop-distribution.mjs` to validate local desktop artifacts, required `app.asar` entries, forbidden root web dependencies, artifact sizes, and SHA-256 fingerprints.
- Added `scripts/check-desktop-update-feed.mjs` to validate generic updater metadata such as `latest.yml`, artifact paths, package version, SHA-512 checksums, file sizes, and release dates.
- Added `desktop:distribution:check` and `desktop:update-feed:check` scripts so release operators can separate local package integrity from signed installer/update-feed readiness.
- The new distribution and update-feed reports use relative artifact names and checksum status only; they do not store update URLs, certificate paths, signing key IDs, victim indicators, raw URLs, invite links, onion addresses, emails, or phone numbers.
- The current unsigned local package can pass distribution integrity checks, while update-feed readiness must remain BLOCKED until signed installer metadata is generated and uploaded together.

## Implemented in v3.46

- Added `scripts/build-desktop-release-bundle.mjs` and `desktop:release:bundle` to gather desktop distribution, release readiness, update feed, and summary reports under `dist/desktop-release-bundle`.
- Added a manual `Desktop Release Candidate` GitHub Actions workflow that builds an unsigned Windows release candidate, creates the evidence bundle, and uploads both as artifacts.
- The bundle summary records gate status, version, commit, relative artifact names, byte sizes, and digest values while keeping update URLs, signing secrets, and victim indicators out of the evidence packet.
- The workflow is intentionally manual and does not embed signing certificate paths, passwords, or key material.
