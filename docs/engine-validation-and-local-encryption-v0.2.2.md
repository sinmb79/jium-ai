# JiumAI Engine Validation and Local Encryption v0.2.2

Checked on: 2026-05-31

## Scope

This validation covers the hackathon demo engine, not a live law-enforcement attribution system.

- Victim-safe intake and evidence normalization
- Trace graph and timeline signal generation
- Digital-crime route class matching
- Promotion-surface intelligence for public teaser, payment, migration, and alias clues
- Safe public-search action generation
- Official handoff and submission packet generation
- Anonymized learning record storage
- Local encrypted vault for exact case evidence

## Engine Validation Result

The current engine is designed to answer this question: "Given victim-provided facts and visible public clues, what should be recorded, what route class is likely, and which official channel should receive the packet next?"

Validated safeguards:

1. Route intelligence remains category-based.
   - The public knowledge base exposes route classes and safe signals, not operational criminal-site directories.
   - Tests assert that unsafe operational target markers are absent from the public route knowledge.

2. Promotion-surface intelligence searches for hints, not private-room access.
   - The engine detects teaser posts, alias reuse, payment wording, crypto-payment claims, and platform-migration clues.
   - It does not provide hidden-room links, paid-room joining steps, dark-web addresses, infiltration advice, or deanonymization steps.

3. Search connectors are victim-safe.
   - Generated search actions are user-confirmed public-search links.
   - The engine avoids automated crawling of abuse material or bypassing platform controls.

4. Learning records are anonymized.
   - Stored learning records keep route IDs, promotion-surface IDs, severity, and counts.
   - URLs, handles, raw room names, victim content, and exact indicators are rejected from learning records.

5. Submission packets are official-handoff oriented.
   - High-risk routes are expressed as evidence checklists and escalation triggers.
   - Restricted routes point to official agencies, platform abuse channels, or professional support.

## Local Encryption Result

Implemented:

- `lib/localCrypto.ts`
  - Web Crypto API
  - PBKDF2-SHA-256 key derivation
  - AES-GCM encryption
  - 16-byte random salt
  - 12-byte random IV
  - 310,000 default PBKDF2 iterations
  - passphrase is never stored

- `lib/encryptedCaseStorage.ts`
  - stores encrypted case vault under `jium-ai.encrypted-cases.v1`
  - stores only an encrypted JSON payload in localStorage
  - appends an audit-log entry when a case is put into the encrypted vault

- `components/EncryptedVaultPanel.tsx`
  - lets the victim save the current case into an encrypted local vault
  - lets the victim open the vault with the passphrase
  - lets the victim export a decrypted copy only after unlocking
  - lets the victim delete the encrypted vault
  - requires a device-safety acknowledgement before saving or opening encrypted evidence

- `lib/caseStorage.ts`
  - the normal local case board now always redacts URL paths and high-risk storage details
  - exact URLs are preserved only in the current submission/export flow or in the encrypted vault

## Threat Model

Encryption protects local data at rest in the browser storage against casual inspection, device sharing, or accidental exposure of localStorage contents.

It does not protect against:

- malware or a fully compromised device
- malicious browser extensions
- active XSS while the app is open and unlocked
- shoulder surfing or weak passphrases
- passphrase loss
- browser localStorage quota or browser profile deletion

For court-grade evidence handling, the encrypted vault should be treated as a victim-support convenience layer, not as a full forensic evidence locker.

## Compromised Device Handling

Yes, a victim's own browser may already be unsafe. Malicious extensions, remote-control tools, screen-sharing sessions, keyloggers, or stealer malware can read what appears on the page or capture the passphrase while the user types it. Local encryption cannot solve that once the device is compromised.

Implemented mitigation:

- The encrypted vault now warns that plaintext and passphrases can be exposed on a compromised device.
- The vault save/open buttons remain disabled until the user confirms a device-safety check.
- The safety page lists high-risk device signals and safer preparation steps.
- The vault storage layer now prefers a desktop secure-storage bridge when `window.jiumSecureVault` is available, and does not copy the encrypted payload back to browser localStorage in that mode.
- The vault UI shows whether it is using browser localStorage encryption or a desktop secure-storage bridge.
- A native desktop bridge CLI now exists at `scripts/native-secure-vault-bridge.mjs`.
- `desktop/electron-preload.cjs` exposes the native bridge as `window.jiumSecureVault` for Electron-based local apps.
- Windows stores a DPAPI CurrentUser protected blob under the user profile; macOS uses Keychain generic passwords; Linux uses Secret Service through `secret-tool`.

This is intentionally a friction point: if the device is suspicious, the safer answer is not "encrypt harder in the same browser" but "do not open the vault here; use a trusted personal device or ask an official support worker for a safe environment."

## Security References

- MDN SubtleCrypto: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto
- OWASP Cryptographic Storage Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html
- NIST SP 800-132: https://csrc.nist.gov/pubs/sp/800/132/final

## Remaining Hardening

- Add Content Security Policy headers before public deployment.
- Add auto-lock and "forget decrypted cases" behavior after inactivity.
- Add encrypted `.jiumvault` import/export for offline handoff.
- Package and sign the desktop app that supplies the native OS-backed provider.
- Add role-based access control before any restricted partner intelligence feed is introduced.
- Add evidence-chain fields: collector, device, capture method, hash algorithm, verification timestamp, and handoff recipient.

## Verification Commands

Run before release:

```powershell
npm test
npm run typecheck
npm run build
npm audit --audit-level=moderate
git diff --check
```
