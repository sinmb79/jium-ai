export const DEFAULT_MAX_DESKTOP_APP_ARCHIVE_BYTES: number;

export function desktopPackageDirEnv(env?: NodeJS.ProcessEnv): NodeJS.ProcessEnv;

export function resolveElectronBuilderCli(root?: string): string;

export function expectedDesktopDirArtifact(
  root?: string,
  platform?: NodeJS.Platform,
): {
  appDir: string;
  executable: string;
  appArchive: string;
};

export function verifyDesktopDirPackage(options?: {
  root?: string;
  platform?: NodeJS.Platform;
  maxAppArchiveBytes?: number;
}): {
  valid: boolean;
  errors: string[];
  artifact: {
    appDir: string;
    executable: string;
    appArchive: string;
  };
  appArchiveBytes: number;
};

export function packageDesktopDir(options?: {
  root?: string;
  runner?: (
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
}): {
  valid: boolean;
  errors: string[];
  artifact: {
    appDir: string;
    executable: string;
    appArchive: string;
  };
  appArchiveBytes: number;
};
