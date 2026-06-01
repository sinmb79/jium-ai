export const OPERATIONAL_APPROVAL_RECORDS_SCHEMA: "jium-operational-approval-records-v1";
export const DEFAULT_OPERATIONAL_APPROVAL_RECORDS_PATH: "ops/private/operational-approval-records.json";
export const REQUIRED_OPERATIONAL_APPROVAL_RECORD_TYPES: readonly [
  "GO_LIVE_APPROVAL",
  "LEGAL_REVIEW_APPROVAL",
  "RELEASE_EVIDENCE_REVIEW",
  "DATA_RETENTION_POLICY_ACK",
  "SUPPORT_CONTACT_ROUTE_ASSIGNED",
  "INCIDENT_RESPONSE_OWNER_ASSIGNED",
];

export type OperationalApprovalRecordType = (typeof REQUIRED_OPERATIONAL_APPROVAL_RECORD_TYPES)[number];

export type OperationalApprovalRecordsReadiness = {
  valid: boolean;
  errors: string[];
  packageVersion: string;
  expectedReleaseTag: string;
  sourceSummary: {
    JIUM_OPERATIONAL_APPROVAL_RECORDS: "SET" | "DEFAULT_PRIVATE_PATH";
    fileStatus: "FOUND" | "MISSING";
  };
  recordTypesPresent: OperationalApprovalRecordType[];
  requiredRecordStatus: Record<OperationalApprovalRecordType, "APPROVED" | "MISSING" | "MISSING_OR_NOT_APPROVED">;
};

export type OperationalApprovalRecordsReport = {
  generatedAt: string;
  status: "READY" | "BLOCKED";
  summary: {
    errorCount: number;
    packageVersion: string;
    expectedReleaseTag: string;
    requiredRecordCount: number;
    approvedRecordCount: number;
    sourceStatus: "SET" | "DEFAULT_PRIVATE_PATH";
    fileStatus: "FOUND" | "MISSING";
  };
  sourceSummary: OperationalApprovalRecordsReadiness["sourceSummary"];
  requiredRecordStatus: OperationalApprovalRecordsReadiness["requiredRecordStatus"];
  checks: Array<{
    id: string;
    label: string;
    status: "PASS" | "BLOCKED";
  }>;
  errors: string[];
  nextActions: string[];
  safetyNotes: string[];
};

export function resolveOperationalApprovalRecordsPath(options?: {
  root?: string;
  env?: NodeJS.ProcessEnv;
}): {
  configured: boolean;
  sourceStatus: "SET" | "DEFAULT_PRIVATE_PATH";
  filePath: string;
};

export function validateOperationalApprovalRecords(options?: {
  root?: string;
  env?: NodeJS.ProcessEnv;
  now?: number;
}): OperationalApprovalRecordsReadiness;

export function buildOperationalApprovalRecordsReport(
  readiness: OperationalApprovalRecordsReadiness,
  options?: { generatedAt?: string },
): OperationalApprovalRecordsReport;

export function formatOperationalApprovalRecordsMarkdown(report: OperationalApprovalRecordsReport): string;
