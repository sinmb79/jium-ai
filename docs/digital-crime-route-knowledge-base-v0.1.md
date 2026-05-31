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
