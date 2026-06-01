export type DesktopExportVerification = {
  valid: boolean;
  errors: string[];
  outDir: string;
  routeFiles: string[];
  requiredFiles: string[];
};

export type DesktopExportRunner = (
  command: string,
  args: string[],
  options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
    stdio: "inherit";
  },
) => {
  status?: number | null;
  error?: Error;
};

export function desktopExportEnv(env?: NodeJS.ProcessEnv): NodeJS.ProcessEnv;

export function resolveNextBuildInvocation(
  root?: string,
  platform?: NodeJS.Platform,
): {
  command: string;
  args: string[];
};

export function verifyDesktopExport(options?: {
  root?: string;
  outDir?: string;
}): DesktopExportVerification;

export function writeDesktopManifest(options?: {
  root?: string;
  outDir?: string;
  routes?: string[];
}): {
  manifestPath: string;
  manifest: {
    profile: string;
    generatedAt: string;
    staticRoot: string;
    routes: string[];
    safetyNotes: string[];
  };
};

export function buildDesktopExport(options?: {
  root?: string;
  runner?: DesktopExportRunner;
  clean?: boolean;
}): DesktopExportVerification & {
  manifestPath: string;
};
