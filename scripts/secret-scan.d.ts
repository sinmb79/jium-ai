declare module "@/scripts/secret-scan.mjs" {
  export type SecretFinding = {
    id: string;
    filePath: string;
    line: number;
    preview: string;
  };

  export function scanTextForSecrets(text: string, filePath?: string): SecretFinding[];

  export function scanFilesForSecrets(root: string, files: string[]): SecretFinding[];

  export function runSecretScan(options?: { root?: string; allFiles?: boolean }): SecretFinding[];
}
