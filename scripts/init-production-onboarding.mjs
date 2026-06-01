#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_SERVER_RUNTIME_ENV_PATH,
  writeServerRuntimeEnvTemplate,
} from "./init-server-runtime-env.mjs";
import {
  DEFAULT_OPERATIONAL_APPROVAL_RECORDS_PATH,
} from "./check-operational-approval-records.mjs";
import {
  writeOperationalApprovalRecordsTemplate,
} from "./init-operational-approval-records.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

export const DEFAULT_PRODUCTION_ONBOARDING_DIR = "ops/private/production-onboarding";
export const PRODUCTION_ONBOARDING_SCHEMA = "jium-production-onboarding-v1";

function readPackageVersion(root) {
  try {
    return JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).version || "";
  } catch {
    return "";
  }
}

function relativePath(root, target) {
  return path.relative(root, target).replace(/\\/g, "/");
}

function writeFileIfNeeded(filePath, content, force) {
  if (existsSync(filePath) && !force) {
    return "EXISTS";
  }
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, "utf8");
  return "CREATED";
}

function onboardingReadme({ generatedAt, packageVersion }) {
  return [
    "# JiumAI Production Onboarding",
    "",
    `- Generated at: ${generatedAt}`,
    `- Package version: ${packageVersion || "MISSING"}`,
    "",
    "## Fill These Private Files",
    "",
    "- `.env.server.local`: replace origin and storage placeholders with approved deployment values.",
    "- `ops/private/operational-approval-records.json`: replace every placeholder after real human approval.",
    "- `operator-checklist.json`: record pseudonymous evidence references only.",
    "- `storage-decision.template.json`: record storage readiness decisions without victim data.",
    "- `public-operations.template.json`: record public app, privacy notice, and support route approval without raw URLs.",
    "- `hosted-security-header-audit.json`: store the redacted READY audit report generated from the approved public app route.",
    "- `trusted-key-candidate.example.json`: copy to a real candidate file only after receiving an approved public key.",
    "",
    "## Verification Order",
    "",
    "1. `npm run security:trusted-key:review -- --candidate <approved-public-key.json> --patch-output <trusted-key-registry.patch.json>`",
    "2. `npm run security:server-storage`",
    "3. `npm run ops:onboarding:approve-storage-decision -- --section <audit-ledger|account-registry> --evidence-ref <pseudonymous-storage-evidence-reference>`",
    "4. `npm run security:server-readiness`",
    "5. `npm run ops:public-env:init -- --base-url <approved-https-public-base-url> --write-env`",
    "6. `npm run security:headers:check -- <approved-https-public-app-url> --json --output ops/private/production-onboarding/hosted-security-header-audit.json`",
    "7. `npm run ops:onboarding:approve-public-operations -- --section <public-app|privacy-notice|support-route> --evidence-ref <pseudonymous-public-operations-evidence-reference>`",
    "8. `npm run ops:onboarding:approve-checklist -- --record <checklist-record-id> --evidence-ref <pseudonymous-evidence-reference>`",
    "9. Set `JIUM_HOSTED_SECURITY_HEADER_AUDIT_REPORT=ops/private/production-onboarding/hosted-security-header-audit.json` in the private go-live environment.",
    "10. `npm run server:deployment:bundle`",
    "11. `npm run desktop:publish:check -- --feed-dir <signed-desktop-folder>`",
    "12. `npm run ops:approvals:check`",
    "13. `npm run ops:go-live:check`",
    "14. `npm run ops:handoff:bundle`",
    "",
    "## Safety Rules",
    "",
    "- Do not paste victim indicators, raw URLs, invite links, onion addresses, emails, phone numbers, passwords, tokens, or certificate material into these templates.",
    "- Store real deployment secrets only in approved secret storage or ignored env files.",
    "- Keep public-key approval, storage decision, legal review, data-retention acknowledgement, support route, and incident-response owner evidence as separate institutional records.",
    "",
  ].join("\n");
}

function operatorChecklist({ generatedAt, packageVersion }) {
  return {
    schema: PRODUCTION_ONBOARDING_SCHEMA,
    generatedAt,
    packageVersion,
    status: "PENDING_EXTERNAL_APPROVALS",
    records: [
      {
        id: "server-origin-approval",
        status: "PENDING_APPROVAL",
        evidenceRef: "REPLACE-ME-ORIGIN-APPROVAL-REF",
        requiredCheck: "Approved HTTPS institution operator origin list is available outside this file.",
      },
      {
        id: "trusted-public-key-approval",
        status: "PENDING_APPROVAL",
        evidenceRef: "REPLACE-ME-TRUSTED-KEY-FINGERPRINT-REF",
        requiredCheck: "Approved active institution public key fingerprint has been verified through a trusted channel.",
      },
      {
        id: "server-storage-decision",
        status: "PENDING_APPROVAL",
        evidenceRef: "REPLACE-ME-STORAGE-DECISION-REF",
        requiredCheck: "Audit ledger and account registry storage are repo-external, access-controlled, separated, and writable.",
      },
      {
        id: "desktop-signing-evidence",
        status: "PENDING_APPROVAL",
        evidenceRef: "REPLACE-ME-DESKTOP-SIGNING-REF",
        requiredCheck: "Signed installer, blockmap, and update metadata are from the same approved build.",
      },
      {
        id: "public-operations-routes",
        status: "PENDING_APPROVAL",
        evidenceRef: "REPLACE-ME-PUBLIC-OPERATIONS-REF",
        requiredCheck: "Public app URL, privacy notice URL, and support route are approved HTTPS routes and are set in private env.",
      },
      {
        id: "hosted-security-header-audit",
        status: "PENDING_APPROVAL",
        evidenceRef: "REPLACE-ME-HOSTED-SECURITY-HEADER-AUDIT-REF",
        requiredCheck: "Approved public app route has a READY redacted security header audit report and JIUM_HOSTED_SECURITY_HEADER_AUDIT_REPORT points to it.",
      },
      {
        id: "legal-go-live-approval",
        status: "PENDING_APPROVAL",
        evidenceRef: "REPLACE-ME-GO-LIVE-REF",
        requiredCheck: "Legal review, retention policy acknowledgement, support route, incident-response owner, and go-live approval are complete.",
      },
    ],
    forbiddenContent: [
      "victim indicators",
      "raw URLs",
      "invite links",
      "onion addresses",
      "emails",
      "phone numbers",
      "passwords",
      "tokens",
      "certificate material",
    ],
  };
}

function storageDecisionTemplate({ generatedAt, packageVersion }) {
  return {
    schema: PRODUCTION_ONBOARDING_SCHEMA,
    generatedAt,
    packageVersion,
    status: "PENDING_STORAGE_APPROVAL",
    auditLedgerStorage: {
      status: "PENDING_APPROVAL",
      evidenceRef: "REPLACE-ME-AUDIT-LEDGER-STORAGE-REF",
      requiredProperties: ["absolute-path", "repo-external", "not-public-or-build-artifact", "append-only-policy", "server-process-writable"],
    },
    accountRegistryStorage: {
      status: "PENDING_APPROVAL",
      evidenceRef: "REPLACE-ME-ACCOUNT-REGISTRY-STORAGE-REF",
      requiredProperties: ["absolute-path", "repo-external", "not-public-or-build-artifact", "separate-from-audit-ledger", "server-process-writable"],
    },
    verificationCommand: "npm run security:server-storage",
  };
}

function publicOperationsTemplate({ generatedAt, packageVersion }) {
  return {
    schema: PRODUCTION_ONBOARDING_SCHEMA,
    generatedAt,
    packageVersion,
    status: "PENDING_PUBLIC_OPERATIONS_APPROVAL",
    publicApp: {
      status: "PENDING_APPROVAL",
      evidenceRef: "REPLACE-ME-PUBLIC-APP-REF",
      requiredCheck: "JIUM_PUBLIC_APP_URL points to the approved HTTPS public app route.",
    },
    privacyNotice: {
      status: "PENDING_APPROVAL",
      evidenceRef: "REPLACE-ME-PRIVACY-NOTICE-REF",
      requiredCheck: "JIUM_PRIVACY_NOTICE_URL points to the approved HTTPS privacy notice route.",
    },
    supportRoute: {
      status: "PENDING_APPROVAL",
      evidenceRef: "REPLACE-ME-SUPPORT-ROUTE-REF",
      requiredCheck: "JIUM_SUPPORT_CONTACT_ROUTE points to the approved HTTPS support route without exposing case details.",
    },
    verificationCommand: "npm run ops:public-env:init -- --base-url <approved-https-public-base-url> --write-env",
  };
}

function trustedKeyCandidateExample({ generatedAt }) {
  return {
    schema: "jium-trusted-authorized-feed-key-candidate-v1",
    generatedAt,
    keyId: "REPLACE-ME-key-id",
    issuerName: "REPLACE-ME-pseudonymous-issuer",
    algorithm: "RSASSA-PKCS1-v1_5",
    publicKeyJwk: {
      kty: "RSA",
      n: "REPLACE-ME-public-modulus-only",
      e: "AQAB",
      use: "sig",
    },
    validFrom: "REPLACE-ME-ISO-DATE",
    validUntil: "REPLACE-ME-ISO-DATE",
    approvalRef: "REPLACE-ME-TRUSTED-KEY-APPROVAL-REF",
  };
}

function writeJson(filePath, value, force) {
  return writeFileIfNeeded(filePath, `${JSON.stringify(value, null, 2)}\n`, force);
}

function artifactRecord(root, filePath, status, label) {
  return {
    label,
    path: relativePath(root, filePath),
    status,
  };
}

export function writeProductionOnboardingScaffold({
  root = repoRoot,
  env = process.env,
  onboardingDir = DEFAULT_PRODUCTION_ONBOARDING_DIR,
  force = false,
  generatedAt = new Date().toISOString(),
} = {}) {
  const packageVersion = readPackageVersion(root);
  const artifacts = [];

  const serverEnvPath = path.resolve(root, DEFAULT_SERVER_RUNTIME_ENV_PATH);
  if (existsSync(serverEnvPath) && !force) {
    artifacts.push(artifactRecord(root, serverEnvPath, "EXISTS", "server-runtime-env"));
  } else {
    const result = writeServerRuntimeEnvTemplate({
      root,
      outputPath: DEFAULT_SERVER_RUNTIME_ENV_PATH,
      force,
      generatedAt,
    });
    artifacts.push({ label: "server-runtime-env", path: result.outputPathRelative, status: "CREATED" });
  }

  const approvalPath = path.resolve(root, DEFAULT_OPERATIONAL_APPROVAL_RECORDS_PATH);
  if (existsSync(approvalPath) && !force) {
    artifacts.push(artifactRecord(root, approvalPath, "EXISTS", "operational-approval-records"));
  } else {
    const result = writeOperationalApprovalRecordsTemplate({
      root,
      env,
      outputPath: DEFAULT_OPERATIONAL_APPROVAL_RECORDS_PATH,
      force,
      generatedAt,
    });
    artifacts.push(artifactRecord(root, result.filePath, "CREATED", "operational-approval-records"));
  }

  const resolvedOnboardingDir = path.resolve(root, onboardingDir);
  const readmePath = path.join(resolvedOnboardingDir, "README.md");
  const checklistPath = path.join(resolvedOnboardingDir, "operator-checklist.json");
  const storageDecisionPath = path.join(resolvedOnboardingDir, "storage-decision.template.json");
  const publicOperationsPath = path.join(resolvedOnboardingDir, "public-operations.template.json");
  const trustedKeyPath = path.join(resolvedOnboardingDir, "trusted-key-candidate.example.json");

  artifacts.push(
    artifactRecord(root, readmePath, writeFileIfNeeded(readmePath, onboardingReadme({ generatedAt, packageVersion }), force), "onboarding-readme"),
  );
  artifacts.push(
    artifactRecord(root, checklistPath, writeJson(checklistPath, operatorChecklist({ generatedAt, packageVersion }), force), "operator-checklist"),
  );
  artifacts.push(
    artifactRecord(
      root,
      storageDecisionPath,
      writeJson(storageDecisionPath, storageDecisionTemplate({ generatedAt, packageVersion }), force),
      "storage-decision-template",
    ),
  );
  artifacts.push(
    artifactRecord(
      root,
      publicOperationsPath,
      writeJson(publicOperationsPath, publicOperationsTemplate({ generatedAt, packageVersion }), force),
      "public-operations-template",
    ),
  );
  artifacts.push(
    artifactRecord(root, trustedKeyPath, writeJson(trustedKeyPath, trustedKeyCandidateExample({ generatedAt }), force), "trusted-key-candidate-example"),
  );

  return {
    schema: PRODUCTION_ONBOARDING_SCHEMA,
    generatedAt,
    packageVersion,
    onboardingDir: relativePath(root, resolvedOnboardingDir),
    force,
    artifacts,
    nextCommands: [
      "npm run security:trusted-key:review -- --candidate <approved-public-key.json> --patch-output <trusted-key-registry.patch.json>",
      "npm run security:server-storage",
      "npm run ops:onboarding:approve-storage-decision -- --section <audit-ledger|account-registry> --evidence-ref <pseudonymous-storage-evidence-reference>",
      "npm run security:server-readiness",
      "npm run ops:public-env:init -- --base-url <approved-https-public-base-url> --write-env",
      "npm run security:headers:check -- <approved-https-public-app-url> --json --output ops/private/production-onboarding/hosted-security-header-audit.json",
      "npm run ops:onboarding:approve-public-operations -- --section <public-app|privacy-notice|support-route> --evidence-ref <pseudonymous-public-operations-evidence-reference>",
      "npm run ops:onboarding:approve-checklist -- --record <checklist-record-id> --evidence-ref <pseudonymous-evidence-reference>",
      "npm run server:deployment:bundle",
      "npm run ops:approvals:check",
      "npm run ops:go-live:check",
      "npm run ops:handoff:bundle",
    ],
    safetyNotes: [
      "The scaffold intentionally remains BLOCKED until real external approvals replace placeholders.",
      "Command output and JSON summary do not include generated server session secrets.",
      "Do not store victim indicators, raw URLs, invite links, onion addresses, emails, phone numbers, passwords, tokens, or certificate material in onboarding files.",
    ],
  };
}

export function formatProductionOnboardingMarkdown(summary) {
  const lines = [
    "# JiumAI Production Onboarding Scaffold",
    "",
    `- Generated at: ${summary.generatedAt}`,
    `- Package version: ${summary.packageVersion || "MISSING"}`,
    `- Onboarding dir: ${summary.onboardingDir}`,
    `- Force overwrite: ${summary.force ? "YES" : "NO"}`,
    "",
    "## Artifacts",
    ...summary.artifacts.map((artifact) => `- ${artifact.status} ${artifact.label}: ${artifact.path}`),
    "",
    "## Next Commands",
    ...summary.nextCommands.map((command) => `- ${command}`),
    "",
    "## Safety Notes",
    ...summary.safetyNotes.map((note) => `- ${note}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseCliArgs(argv) {
  const args = { format: "text", root: repoRoot, onboardingDir: DEFAULT_PRODUCTION_ONBOARDING_DIR, force: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") {
      args.format = "json";
    } else if (arg === "--markdown" || arg === "--md") {
      args.format = "markdown";
    } else if (arg === "--force") {
      args.force = true;
    } else if (arg === "--root") {
      args.root = path.resolve(argv[index + 1] || args.root);
      index += 1;
    } else if (arg.startsWith("--root=")) {
      args.root = path.resolve(arg.slice("--root=".length));
    } else if (arg === "--dir") {
      args.onboardingDir = argv[index + 1] || args.onboardingDir;
      index += 1;
    } else if (arg.startsWith("--dir=")) {
      args.onboardingDir = arg.slice("--dir=".length);
    }
  }
  return args;
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || "")) {
  const args = parseCliArgs(process.argv.slice(2));
  try {
    const summary = writeProductionOnboardingScaffold({
      root: args.root,
      onboardingDir: args.onboardingDir,
      force: args.force,
    });
    if (args.format === "json") {
      console.log(JSON.stringify(summary, null, 2));
    } else {
      console.log(formatProductionOnboardingMarkdown(summary));
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
