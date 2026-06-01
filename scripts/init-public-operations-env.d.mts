export interface PublicOperationsEnvEndpoint {
  envKey: string;
  routePath: string;
  urlStatus: "MISSING" | "PLACEHOLDER" | "SET_HTTPS" | "SET_NOT_HTTPS" | "SET_INVALID";
}

export interface PublicOperationsEnvPlan {
  schema: "jium-public-operations-env-init-v1";
  generatedAt: string;
  status: "READY" | "BLOCKED";
  summary: {
    endpointCount: number;
    httpsUrlCount: number;
    envUpdateStatus: string;
    baseUrlStatus: string;
  };
  envFile: {
    path: string;
    status: string;
    keyStatuses: Record<string, string>;
  };
  endpoints: PublicOperationsEnvEndpoint[];
  errors: string[];
  nextActions: string[];
  safetyNotes: string[];
}

export const PUBLIC_OPERATIONS_ENDPOINTS: Array<{
  envKey: string;
  routePath: string;
  routeSuffix: string;
}>;

export function buildPublicOperationsEnvPlan(options?: {
  root?: string;
  env?: NodeJS.ProcessEnv;
  baseUrl?: string;
  envPath?: string;
  writeEnv?: boolean;
  forceEnv?: boolean;
  generatedAt?: string;
}): PublicOperationsEnvPlan;

export function formatPublicOperationsEnvMarkdown(plan: PublicOperationsEnvPlan): string;
