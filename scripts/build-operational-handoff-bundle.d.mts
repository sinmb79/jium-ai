import type { DesktopPublishReadiness } from "./check-desktop-publish-readiness.mjs";
import type { OperationalGoLiveReadiness } from "./check-operational-go-live.mjs";
import type { ServerRuntimeReadiness } from "./check-server-readiness.mjs";

export const OPERATIONAL_HANDOFF_BUNDLE_DIR: "dist/operational-handoff-bundle";

export type OperationalHandoffBundleSummary = {
  schema: "jium-operational-handoff-bundle-v1";
  generatedAt: string;
  status: "READY" | "BLOCKED";
  version: string;
  commit: string;
  platform: NodeJS.Platform | string;
  gates: Array<{
    id: string;
    status: "READY" | "BLOCKED";
    errorCount: number;
  }>;
  reports: Record<string, string>;
  externalRecordsNeeded: string[];
  nextActions: string[];
  safetyNotes: string[];
};

export function buildOperationalHandoffBundle(options?: {
  root?: string;
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform | string;
  generatedAt?: string;
  validations?: {
    serverRuntime?: ServerRuntimeReadiness;
    desktopPublish?: DesktopPublishReadiness;
    goLive?: OperationalGoLiveReadiness;
  };
}): Promise<{
  valid: boolean;
  bundleDir: string;
  bundleDirRelative: string;
  summary: OperationalHandoffBundleSummary;
}>;
