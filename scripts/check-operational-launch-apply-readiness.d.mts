export const OPERATIONAL_LAUNCH_APPLY_READINESS_SCHEMA: "jium-operational-launch-apply-readiness-v1";
export const OPERATIONAL_LAUNCH_APPLY_READINESS_DIR: "dist/operational-launch-apply-readiness";
export const OPERATIONAL_LAUNCH_APPLY_READINESS_JSON: "operational-launch-apply-readiness.json";
export const OPERATIONAL_LAUNCH_APPLY_READINESS_MARKDOWN: "operational-launch-apply-readiness.md";

export interface OperationalLaunchApplyReadinessPhase {
  id: string;
  title: string;
  status: string;
  evidence: Record<string, unknown>;
  errorCount: number;
  errors: string[];
  nextActions: string[];
}

export interface OperationalLaunchApplyReadinessReport {
  schema: typeof OPERATIONAL_LAUNCH_APPLY_READINESS_SCHEMA;
  generatedAt: string;
  status: "READY_TO_RUN_PRIVATE_COMMAND_PACKET" | "BLOCKED";
  version: string;
  summary: {
    phaseCount: number;
    readyPhaseCount: number;
    blockedPhaseCount: number;
    inputDigest: string;
    launchReviewStatus: string;
  };
  phases: OperationalLaunchApplyReadinessPhase[];
  leakScan: {
    status: "PASS" | "BLOCKED";
    checkedPatternCount: number;
    findings: Array<{ id: string; label: string }>;
  };
  errors: string[];
  nextActions: string[];
  safetyNotes: string[];
}

export function buildOperationalLaunchApplyReadiness(options?: {
  root?: string;
  inputPath: string;
  envPath?: string;
  platform?: string;
  generatedAt?: string;
  now?: number;
}): Promise<OperationalLaunchApplyReadinessReport>;

export function writeOperationalLaunchApplyReadinessFiles(options?: {
  root?: string;
  report: OperationalLaunchApplyReadinessReport;
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

export function formatOperationalLaunchApplyReadinessMarkdown(report: OperationalLaunchApplyReadinessReport): string;
