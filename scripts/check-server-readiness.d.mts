export type ServerRuntimeReadiness = {
  valid: boolean;
  errors: string[];
  profile: "github-pages-static" | "server-routes" | "local-build";
  keyCount: number;
  templateFiles: string[];
};

export const REQUIRED_SERVER_ROUTE_TEMPLATES: string[];

export function validateServerRuntimeReadiness(options?: {
  root?: string;
  templateRoot?: string;
  env?: Record<string, string | undefined>;
}): ServerRuntimeReadiness;
