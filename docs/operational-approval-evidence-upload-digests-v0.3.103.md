# Operational Approval Evidence Upload Digests v0.3.103

v0.3.103 adds the desktop release upload verification reports to the default operational approval evidence digest set.

## Command

```bash
npm run ops:approvals:digest-evidence
npm run ops:approvals:digest-evidence:json -- --output dist/operational-approval-evidence-digests/report.json
npm run ops:approvals:digest-evidence:markdown -- --output dist/operational-approval-evidence-digests/report.md
```

## What Changed

The default digest now requires:

- `dist/desktop-release-upload/desktop-release-upload-report.json`
- `dist/desktop-release-upload/desktop-release-upload-report.md`

This means final release-evidence approval cannot accidentally omit proof that the signed installer, blockmap, update metadata, and evidence archive were visible on the GitHub Release after upload.

## Safety Boundary

The digest manifest stores file names, byte counts, SHA-256 digests, unsafe pattern IDs, and approval command templates only. It does not store file contents, raw public URLs, GitHub token values, asset download URLs, support contacts, incident owner names, certificate material, victim indicators, invite links, onion addresses, emails, phone numbers, or private storage paths.

If the upload verification reports have not been produced yet, the digest command blocks with missing evidence files. That is intentional: final approval evidence should be built after the signed release upload verification step is complete.
