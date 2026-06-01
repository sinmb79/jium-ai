export const DESKTOP_APP_DIR: string;

export function resolveNpmCommand(platform?: NodeJS.Platform): string;

export function resolveNpmInstallInvocation(options?: {
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
}): {
  command: string;
  args: string[];
};

export function buildDesktopAppPackageJson(root?: string): {
  name: string;
  version: string;
  private: boolean;
  description: string;
  author: string;
  main: string;
  dependencies: {
    "electron-updater": string;
  };
};

export function verifyDesktopAppDir(options?: {
  root?: string;
  appDir?: string;
}): {
  valid: boolean;
  errors: string[];
  appDir: string;
};

export function prepareDesktopAppDir(options?: {
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
  install?: boolean;
}): {
  valid: boolean;
  errors: string[];
  appDir: string;
};
