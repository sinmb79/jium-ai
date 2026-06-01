export type DesktopSigningSecretSummary = {
  JIUM_DESKTOP_RELEASE_CHANNEL: "SET" | "MISSING";
  JIUM_DESKTOP_UPDATE_URL: "SET_HTTPS" | "SET_NOT_HTTPS" | "SET_INVALID" | "MISSING";
  CSC_LINK: "SET" | "MISSING";
  CSC_KEY_PASSWORD: "SET" | "MISSING";
  WIN_CSC_LINK: "SET" | "MISSING";
  WIN_CSC_KEY_PASSWORD: "SET" | "MISSING";
  WINDOWS_SIGNING_CERT_PATH: "SET" | "MISSING";
  WINDOWS_SIGNING_CERT_PASSWORD: "SET" | "MISSING";
  WINDOWS_SIGNING_CERT_SHA256: "SET" | "MISSING";
  AZURE_TRUSTED_SIGNING_PROFILE: "SET" | "MISSING";
  WINDOWS_ELECTRON_BUILDER_SIGNING_PROFILE: "SET" | "MISSING";
};

export function summarizeDesktopSigningSecrets(env?: NodeJS.ProcessEnv): DesktopSigningSecretSummary;

export function validateDesktopSigningSecrets(options?: {
  root?: string;
  env?: NodeJS.ProcessEnv;
}): {
  valid: boolean;
  errors: string[];
  summary: DesktopSigningSecretSummary;
};

export function buildDesktopSigningSecretsReport(
  validation: ReturnType<typeof validateDesktopSigningSecrets>,
  options?: { generatedAt?: string },
): {
  generatedAt: string;
  status: "READY" | "BLOCKED";
  summary: DesktopSigningSecretSummary;
  errors: string[];
  nextActions: string[];
  safetyNotes: string[];
};

export function formatDesktopSigningSecretsMarkdown(report: ReturnType<typeof buildDesktopSigningSecretsReport>): string;
