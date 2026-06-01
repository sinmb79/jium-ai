export const OPERATIONAL_APPROVAL_INPUTS_SCHEMA: "jium-operational-approval-inputs-v1";
export const OPERATIONAL_APPROVAL_INPUTS_DIR: "dist/operational-approval-inputs";
export const OPERATIONAL_APPROVAL_INPUTS_TEMPLATE_JSON: "operational-approval-inputs-template.json";
export const OPERATIONAL_APPROVAL_INPUTS_TEMPLATE_MARKDOWN: "operational-approval-inputs-template.md";
export const OPERATIONAL_APPROVAL_INPUTS_APPLY_REPORT_JSON: "operational-approval-inputs-apply-report.json";
export const OPERATIONAL_APPROVAL_INPUTS_APPLY_REPORT_MARKDOWN: "operational-approval-inputs-apply-report.md";

export interface OperationalApprovalInputsTemplate {
  schema: typeof OPERATIONAL_APPROVAL_INPUTS_SCHEMA;
  generatedAt: string;
  status: "READY_FOR_PRIVATE_FILL";
  version: string;
  summary: {
    operationalApprovalRecordCount: number;
    onboardingChecklistRecordCount: number;
    storageDecisionCount: number;
    publicOperationsCount: number;
    totalInputCount: number;
  };
  input: {
    schema: typeof OPERATIONAL_APPROVAL_INPUTS_SCHEMA;
    packageVersion: string;
    operationalApprovalRecords: unknown[];
    onboardingChecklist: unknown[];
    storageDecisions: unknown[];
    publicOperations: unknown[];
  };
  applyCommand: string;
  leakScan: {
    status: "PASS" | "BLOCKED";
    checkedPatternCount: number;
    findings: Array<{ id: string; label: string }>;
  };
  errors: string[];
  warnings: string[];
  safetyNotes: string[];
}

export interface OperationalApprovalInputsApplyReport {
  schema: "jium-operational-approval-inputs-apply-report-v1";
  generatedAt: string;
  status: "READY_TO_APPLY" | "APPLIED" | "BLOCKED";
  version: string;
  summary: {
    dryRun: boolean;
    init: boolean;
    inputDigest: string;
    totalInputCount: number;
    readyInputCount: number;
    blockedInputCount: number;
    appliedCount: number;
    approvalRecordsStatus: string;
    productionOnboardingStatus: string;
    approvalRecordsErrorCount: number;
    productionOnboardingErrorCount: number;
  };
  scaffold: {
    status: string;
    artifactCount: number;
    createdCount: number;
    existingCount: number;
  };
  validations: Array<{
    group: string;
    id: string;
    status: string;
    errorCount: number;
    errors: string[];
    evidence: Record<string, string>;
  }>;
  applied: Array<{
    group: string;
    id: string;
    status: string;
  }>;
  leakScan: {
    status: "PASS" | "BLOCKED";
    checkedPatternCount: number;
    findings: Array<{ id: string; label: string }>;
  };
  errors: string[];
  warnings: string[];
  nextActions: string[];
  safetyNotes: string[];
}

export function buildOperationalApprovalInputsTemplate(options?: {
  root?: string;
  generatedAt?: string;
}): OperationalApprovalInputsTemplate;

export function writeOperationalApprovalInputsTemplateFiles(options?: {
  root?: string;
  template: OperationalApprovalInputsTemplate;
  outputPath?: string;
  format?: "json" | "markdown" | "text";
}): {
  reportDir: string;
  reportDirRelative: string;
  jsonPath: string;
  markdownPath: string;
  jsonPathRelative: string;
  markdownPathRelative: string;
};

export function applyOperationalApprovalInputs(options?: {
  root?: string;
  env?: NodeJS.ProcessEnv;
  inputPath: string;
  onboardingDir?: string;
  init?: boolean;
  forceInit?: boolean;
  dryRun?: boolean;
  generatedAt?: string;
  now?: number;
}): Promise<{
  valid: boolean;
  report: OperationalApprovalInputsApplyReport;
  reportDir: string;
  reportDirRelative: string;
}>;

export function formatOperationalApprovalInputsTemplateMarkdown(template: OperationalApprovalInputsTemplate): string;
export function formatOperationalApprovalInputsApplyMarkdown(report: OperationalApprovalInputsApplyReport): string;
