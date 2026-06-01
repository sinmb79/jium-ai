export const OPERATIONAL_LAUNCH_CONSOLE_SCHEMA: "jium-operational-launch-console-v1";
export const OPERATIONAL_LAUNCH_CONSOLE_DIR: "dist/operational-launch-console";
export const OPERATIONAL_LAUNCH_CONSOLE_JSON: "operational-launch-console.json";
export const OPERATIONAL_LAUNCH_CONSOLE_MARKDOWN: "operational-launch-console.md";

export interface OperationalLaunchConsoleOwnerLane {
  phaseId: string;
  title: string;
  ownerRole: string;
  status: string;
  openActionCount: number;
  p0OpenActionCount: number;
  gates: Array<{
    id: string;
    status: string;
    errorCount: number;
  }>;
  firstActions: Array<{
    id: string;
    status: string;
    priority: string;
    action: string;
    evidenceTarget: string;
    verificationCommands: string[];
  }>;
  verificationCommands: string[];
}

export interface OperationalLaunchConsoleReport {
  schema: typeof OPERATIONAL_LAUNCH_CONSOLE_SCHEMA;
  generatedAt: string;
  status: "BLOCKED" | "EXTERNAL_INPUTS_REQUIRED" | "READY_FOR_GO_LIVE_ARCHIVE";
  source: {
    actionPlanStatus: string;
    handoffStatus: string;
    version: string;
    commit: string;
    commandPacketStatus: string;
  };
  summary: {
    phaseCount: number;
    blockedPhaseCount: number;
    readyPhaseCount: number;
    openActionCount: number;
    p0OpenActionCount: number;
    externalApprovalCommandCount: number;
    verificationCommandCount: number;
    ownerLaneCount: number;
  };
  ownerLanes: OperationalLaunchConsoleOwnerLane[];
  externalApprovalQueue: Array<{
    id: string;
    group: string;
    ownerRole: string;
    phaseId: string;
    command: string;
    evidencePlaceholder: string;
  }>;
  verificationCommands: Array<{
    id: string;
    ownerRole: string;
    phaseId: string;
    command: string;
  }>;
  readyEvidence: Array<{
    phaseId: string;
    ownerRole: string;
    gates: OperationalLaunchConsoleOwnerLane["gates"];
  }>;
  nextOperatorRunOrder: Array<{
    order: number;
    phaseId: string;
    ownerRole: string;
    status: string;
    firstAction: string;
    verificationCommands: string[];
  }>;
  hardBlocks: Array<{
    phaseId: string;
    ownerRole: string;
    status: string;
    openActionCount: number;
    p0OpenActionCount: number;
    firstAction: string;
    firstVerificationCommand: string;
  }>;
  launchDecision: {
    canLaunchNow: boolean;
    label: string;
    reason: string;
  };
  leakScan: {
    status: "PASS" | "BLOCKED";
    checkedPatternCount: number;
    findings: Array<{
      id: string;
      label: string;
    }>;
  };
  errors: string[];
  warnings: string[];
  safetyNotes: string[];
}

export function buildOperationalLaunchConsole(options?: {
  root?: string;
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform | string;
  generatedAt?: string;
  actionPlan?: unknown;
  actionPlanPath?: string;
  commandPacket?: unknown;
  commandPacketPath?: string;
  noBuild?: boolean;
}): Promise<{
  valid: boolean;
  report: OperationalLaunchConsoleReport;
  reportDir: string;
  reportDirRelative: string;
}>;

export function formatOperationalLaunchConsoleMarkdown(report: OperationalLaunchConsoleReport): string;

export function writeOperationalLaunchConsoleOutput(options?: {
  root?: string;
  report: OperationalLaunchConsoleReport;
  outputPath?: string;
  format?: "json" | "markdown" | "text";
}): {
  outputPath: string;
  outputPathRelative: string;
};
