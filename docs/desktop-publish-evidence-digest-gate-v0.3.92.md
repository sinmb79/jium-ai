# Desktop Publish Evidence Digest Gate v0.3.92

`desktop:publish:check` now requires a READY signed desktop release evidence digest before GitHub Release asset publication can pass.

## Why This Exists

The signed desktop release lane already validates installer artifacts, update metadata, and release publication approval. The remaining operational risk was procedural: a release manager could build signed artifacts and pass publish readiness without archiving the exact reviewed evidence digest first.

This release closes that gap by making the digest part of the publish gate.

## Updated Flow

```bash
npm run desktop:package:signed
npm run desktop:distribution:check
npm run desktop:update-feed:check -- --feed-dir ./dist/desktop
npm run desktop:release:bundle
npm run desktop:release:digest-evidence -- --feed-dir ./dist/desktop
npm run desktop:publish:check -- --feed-dir ./dist/desktop
```

The Desktop Signed Release workflow now runs `desktop:release:digest-evidence` after the release bundle is built. The uploaded evidence artifact contains both:

- `dist/desktop-release-bundle`
- `dist/desktop-release-evidence-digests`

If the optional GitHub Release upload job runs, the evidence archive uploaded to the release includes both directories.

## Safety Boundary

The publish readiness report stores only:

- release tag and package version
- artifact counts
- release evidence digest status
- release evidence file counts
- aggregate `sha256-*` digest

It does not store GitHub token values, update endpoints, certificate material, certificate passwords, raw evidence file contents, victim indicators, invite links, onion addresses, emails, phone numbers, or private paths.

This gate still does not approve publication. Human publish approval, signed artifacts, update feed metadata, GitHub upload context, and external go-live approvals remain required.
