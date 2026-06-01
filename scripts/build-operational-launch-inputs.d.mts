export const OPERATIONAL_LAUNCH_INPUTS_SCHEMA: "jium-operational-launch-inputs-v1";
export const OPERATIONAL_LAUNCH_INPUTS_REVIEW_SCHEMA: "jium-operational-launch-inputs-review-v1";
export const OPERATIONAL_LAUNCH_INPUTS_DIR: "dist/operational-launch-inputs";
export const OPERATIONAL_LAUNCH_INPUTS_TEMPLATE_JSON: "operational-launch-inputs-template.json";
export const OPERATIONAL_LAUNCH_INPUTS_TEMPLATE_MARKDOWN: "operational-launch-inputs-template.md";
export const OPERATIONAL_LAUNCH_INPUTS_REVIEW_JSON: "operational-launch-inputs-review.json";
export const OPERATIONAL_LAUNCH_INPUTS_REVIEW_MARKDOWN: "operational-launch-inputs-review.md";

export interface OperationalLaunchInputsTemplate {
  schema: typeof OPERATIONAL_LAUNCH_INPUTS_SCHEMA;
  generatedAt: string;
  status: "READY_FOR_PRIVATE_FILL" | "BLOCKED";
  version: string;
  summary: {
    totalInputCount: number;
    groupCounts: Record<string, number>;
  };
  input: Record<string, unknown>;
  reviewCommand: string;
  leakScan: {
    status: "PASS" | "BLOCKED";
    checkedPatternCount: number;
    findings: Array<{ id: string; label: string }>;
  };
  errors: string[];
  warnings: string[];
  safetyNotes: string[];
}

export interface OperationalLaunchInputsReview {
  schema: typeof OPERATIONAL_LAUNCH_INPUTS_REVIEW_SCHEMA;
  generatedAt: string;
  status: "READY_FOR_OPERATOR_APPLY" | "BLOCKED";
  version: string;
  summary: {
    totalInputCount: number;
    readyInputCount: number;
    blockedInputCount: number;
    groupCounts: Record<string, number>;
    inputDigest: string;
  };
  fields: Array<{
    group: string;
    id: string;
    type: string;
    status: "READY" | "BLOCKED" | string;
    errorCount: number;
    errors: string[];
    evidence: Record<string, string | number>;
  }>;
  commandPlan: string[];
  leakScan: {
    status: "PASS" | "BLOCKED";
    checkedPatternCount: number;
    findings: Array<{ id: string; label: string }>;
  };
  errors: string[];
  warnings: string[];
  safetyNotes: string[];
}

export function buildOperationalLaunchInputsTemplate(options?: {
  root?: string;
  generatedAt?: string;
}): OperationalLaunchInputsTemplate;

export function reviewOperationalLaunchInputs(options?: {
  root?: string;
  inputPath: string;
  generatedAt?: string;
}): OperationalLaunchInputsReview;

export function writeOperationalLaunchInputsTemplateFiles(options?: {
  root?: string;
  template: OperationalLaunchInputsTemplate;
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

export function writeOperationalLaunchInputsReviewFiles(options?: {
  root?: string;
  review: OperationalLaunchInputsReview;
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

export function formatOperationalLaunchInputsTemplateMarkdown(template: OperationalLaunchInputsTemplate): string;
export function formatOperationalLaunchInputsReviewMarkdown(review: OperationalLaunchInputsReview): string;
