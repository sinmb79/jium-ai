# Desktop Publish Candidate v0.3.93

`desktop:publish:candidate` creates a redacted review packet before the final GitHub Release upload gate.

```bash
npm run desktop:release:digest-evidence -- --feed-dir <signed-release-folder>
npm run desktop:publish:candidate -- --feed-dir <signed-release-folder>
npm run desktop:publish:candidate:json -- --feed-dir <signed-release-folder> --output dist/desktop-publish-candidate/report.json
```

The candidate separates two decisions:

- Signed desktop artifacts, update metadata, and release evidence digest are technically ready.
- Human publish approval and GitHub upload context are still external operating steps.

`READY_FOR_PUBLISH_APPROVAL` means reviewers can inspect the redacted packet and decide whether to approve publication. It does not approve publication. `READY_FOR_RELEASE_UPLOAD` only appears when the final `desktop:publish:check` prerequisites are also present.

The report stores only release tag, package version, artifact counts, setting presence, digest status, and aggregate SHA-256 evidence digests. It does not store GitHub repository values, tokens, update URLs, certificate material, private paths, raw URLs, victim indicators, invite links, onion addresses, emails, or phone numbers.

Operational release dossiers and approval evidence digests now include this candidate report. The Desktop Signed Release workflow also uploads `dist/desktop-publish-candidate` with the release evidence bundle, and the publish job downloads the evidence artifact into `dist` so the archive preserves `desktop-release-bundle`, `desktop-release-evidence-digests`, and `desktop-publish-candidate` as sibling directories.
