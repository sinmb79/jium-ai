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

## Next hardening items

- Add encrypted case-local indicator storage.
- Add role-based access control for restricted intelligence.
- Add indicator provenance fields: source, source date, last checked, confidence, retention deadline.
- Add audit log for every view/export of exact indicators.
- Add official CSV/JSON import format for authorized public notices or partner feeds.
- Add retention/deletion workflow for closed cases.
