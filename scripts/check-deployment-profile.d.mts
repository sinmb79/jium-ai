export type DeploymentProfileValidation = {
  valid: boolean;
  errors: string[];
  profile: "github-pages-static" | "server-routes" | "local-build";
  routeFiles: string[];
};

export function truthy(value: unknown): boolean;

export function findAppRouteFiles(root?: string): string[];

export function validateDeploymentProfile(
  env?: Record<string, string | undefined>,
  root?: string,
): DeploymentProfileValidation;
