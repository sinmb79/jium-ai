# Operational Go-Live Rehearsal Approval Inputs v0.3.97

v0.3.97 closes the gap between the batch approval-input flow and the final go-live rehearsal.

## What Changed

- `ops:go-live:rehearsal` now creates a synthetic private approval input file inside a temporary workspace.
- The rehearsal applies that file through `applyOperationalApprovalInputs` with onboarding initialization enabled.
- The rehearsal report records only redacted status fields and counts:
  - approval input apply status
  - ready input count
  - applied input count
  - approval-record readiness
  - production-onboarding readiness
  - approval-input leak-scan status
- The rehearsal blocks if the batch path does not apply all 18 required inputs or if approval records/onboarding do not reach `READY`.

## Verification

```bash
npm run ops:go-live:rehearsal
npm test -- --run tests/operationalGoLiveRehearsal.test.ts
```

Expected rehearsal summary:

- `approvalInputsStatus`: `APPLIED`
- `approvalInputsReadyInputCount`: `18`
- `approvalInputsAppliedCount`: `18`
- `approvalInputsApprovalRecordsStatus`: `READY`
- `approvalInputsProductionOnboardingStatus`: `READY`
- `approvalInputsLeakScanStatus`: `PASS`
- `simulation.approvalsMode`: `SYNTHETIC_BATCH_INPUTS`

## Safety Boundary

The rehearsal is still synthetic. It does not approve production launch, does not publish signed desktop artifacts, and does not store real URLs, contacts, secrets, private paths, victim indicators, invite links, onion addresses, emails, phone numbers, or certificate material in the public report.

Real production go-live still requires institution approval, legal review, hosting approval, trusted-key approval, signed desktop artifacts, and incident-response owner records outside the repository.
