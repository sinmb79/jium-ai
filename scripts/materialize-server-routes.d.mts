export type ServerRouteTemplateFile = {
  sourcePath: string;
  relativePath: string;
};

export type ServerRouteMaterializeResult = {
  dryRun: boolean;
  profile: "github-pages-static" | "server-routes" | "local-build";
  routeFiles: string[];
  templateFiles: string[];
};

export type ServerRouteCleanResult = {
  dryRun: boolean;
  removed: string[];
  skipped: string[];
  removedCaches: string[];
};

export const SERVER_ROUTE_TEMPLATE_ROOT: string;
export const GENERATED_SERVER_ROUTE_MARKER: string;

export function listServerRouteTemplates(templateRoot?: string): ServerRouteTemplateFile[];

export function materializeServerRoutes(options?: {
  root?: string;
  templateRoot?: string;
  env?: Record<string, string | undefined>;
  dryRun?: boolean;
}): ServerRouteMaterializeResult;

export function cleanMaterializedServerRoutes(options?: {
  root?: string;
  templateRoot?: string;
  dryRun?: boolean;
}): ServerRouteCleanResult;
