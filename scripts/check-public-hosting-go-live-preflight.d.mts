export const PUBLIC_HOSTING_GO_LIVE_PREFLIGHT_SCHEMA: "jium-public-hosting-go-live-preflight-v1";
export const PUBLIC_HOSTING_GO_LIVE_PREFLIGHT_DIR: "dist/public-hosting-go-live-preflight";
export const PUBLIC_HOSTING_GO_LIVE_PREFLIGHT_JSON: "public-hosting-go-live-preflight.json";
export const PUBLIC_HOSTING_GO_LIVE_PREFLIGHT_MARKDOWN: "public-hosting-go-live-preflight.md";
export const HOSTED_AUDIT_CANDIDATE_JSON: "hosted-security-header-audit-candidate.json";
export const HOSTED_AUDIT_CANDIDATE_MARKDOWN: "hosted-security-header-audit-candidate.md";

export type PublicHostingGoLivePreflightStatus = "READY" | "BLOCKED";

export type PublicHostingGoLivePreflightReport = {
  schema: typeof PUBLIC_HOSTING_GO_LIVE_PREFLIGHT_SCHEMA;
  generatedAt: string;
  status: PublicHostingGoLivePreflightStatus;
  version: string;
  providerTargets: string[];
  summary: {
    staticHostingStatus: string;
    staticRequiredFileCount: number;
    staticFoundFileCount: number;
    staticHeaderPolicyStatus: string;
    hostedAuditStatus: string;
    targetUrlState: string;
    fetchState: string;
    httpStatus: number | null;
    headerFailureCount: number;
    hostedAuditCandidateStatus: string;
  };
  checks: Array<{
    id: string;
    status: "PASS" | "BLOCKED" | string;
    label: string;
  }>;
  hostedAuditCandidate: {
    path: string;
    digest: string;
    schema: string;
    status: string;
  };
  applyCommand: string;
  errors: string[];
  nextActions: string[];
  safetyNotes: string[];
};

export function buildPublicHostingGoLivePreflight(options?: {
  root?: string;
  targetUrl?: string;
  noBuild?: boolean;
  generatedAt?: string;
  fetcher?: (targetUrl: string) => Promise<{
    status: number;
    headers: Headers | Record<string, string | string[] | undefined>;
    arrayBuffer?: () => Promise<ArrayBuffer>;
  }>;
  runner?: (...args: unknown[]) => unknown;
}): Promise<{
  valid: boolean;
  bundleDir: string;
  bundleDirRelative: string;
  report: PublicHostingGoLivePreflightReport;
  hostedAudit: unknown;
}>;

export function formatPublicHostingGoLivePreflightMarkdown(report: PublicHostingGoLivePreflightReport): string;
