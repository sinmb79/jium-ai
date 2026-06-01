# Desktop Release Evidence Digests v0.3.87

`desktop:release:digest-evidence` creates a redacted digest manifest for signed desktop release evidence.

## Why This Exists

Desktop publication needs proof that the installer, blockmap, update metadata, and release-candidate summary were reviewed together. The digest command lets release managers archive the exact reviewed artifact set without copying update endpoints, certificate material, private paths, or raw report contents into approval records.

## Commands

```bash
npm run desktop:release:digest-evidence -- --feed-dir <signed-release-folder>
npm run desktop:release:digest-evidence:json -- --feed-dir <signed-release-folder> --output dist/desktop-release-evidence-digests/report.json
npm run desktop:release:digest-evidence:markdown -- --feed-dir <signed-release-folder> --output dist/desktop-release-evidence-digests/report.md
```

For Windows, the default evidence set is:

- signed installer `*.exe`
- update blockmap `*.blockmap`
- update metadata `latest.yml`
- `desktop-release-candidate-summary.json`
- `desktop-release-candidate-summary.md`

The report stores only file names, roles, byte counts, SHA-256 digests, unsafe finding IDs, and an aggregate digest. Binary installer artifacts are hashed but not text-scanned.

## Safety Boundary

The command blocks the aggregate digest if text evidence contains raw URLs, invite routes, onion addresses, emails, phone-like values, token-like values, private filesystem paths, private key material, or signing secret names.

The report must not contain file contents, feed directories, update endpoint values, GitHub tokens, certificate material, victim indicators, invite links, onion addresses, emails, phone numbers, or private storage paths.

## Operating Sequence

1. Build signed desktop artifacts through the approved signing workflow.
2. Run `npm run desktop:release:bundle`.
3. Run `npm run desktop:release:digest-evidence -- --feed-dir <signed-release-folder>`.
4. Run `npm run desktop:publish:check -- --feed-dir <signed-release-folder>`.
5. Attach the aggregate digest to the private release approval record before GitHub Release upload.
