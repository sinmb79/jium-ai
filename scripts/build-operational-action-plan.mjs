#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  OPERATIONAL_HANDOFF_BUNDLE_DIR,
  buildOperationalHandoffBundle,
} from "./build-operational-handoff-bundle.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
export const OPERATIONAL_ACTION_PLAN_JSON = "operational-action-plan.json";
export const OPERATIONAL_ACTION_PLAN_MARKDOWN = "operational-action-plan.md";

const ROLE_BY_PHASE = {
  "production-onboarding": "OPERATIONS_LEAD",
  "server-runtime": "DEPLOYMENT_ADMIN",
  "server-storage": "DATA_PROTECTION_OFFICER",
  "desktop-release": "RELEASE_MANAGER",
  "approval-records": "LEGAL_REVIEWER",
  "go-live": "PROGRAM_OWNER",
};

const REPORT_REFS_BY_GATE = {
  "server-runtime-readiness": ["serverRuntimeJson", "serverRuntimeMarkdown"],
  "server-storage-readiness": ["serverStorageJson", "serverStorageMarkdown"],
  "desktop-publish-readiness": ["desktopPublishJson", "desktopPublishMarkdown"],
  "operational-approval-records": ["approvalRecordsJson", "approvalRecordsMarkdown"],
  "production-onboarding-readiness": ["productionOnboardingJson", "productionOnboardingMarkdown"],
  "operational-go-live": ["goLiveJson", "goLiveMarkdown"],
};

const PHASE_BLUEPRINTS = [
  {
    id: "production-onboarding",
    title: "Private production onboarding",
    ownerRole: ROLE_BY_PHASE["production-onboarding"],
    gateIds: ["production-onboarding-readiness"],
    objective: "Complete the private onboarding scaffold before deployment, approval, or release publication.",
    evidenceTarget: "ops/private/production-onboarding and ops/private/operational-approval-records.json",
    verificationCommands: [
      "npm run ops:onboarding:approve-checklist -- --record <checklist-record-id> --evidence-ref <pseudonymous-evidence-reference>",
      "npm run ops:onboarding:approve-storage-decision -- --section <audit-ledger|account-registry> --evidence-ref <pseudonymous-storage-evidence-reference>",
      "npm run ops:onboarding:approve-public-operations -- --section <public-app|privacy-notice|support-route> --evidence-ref <pseudonymous-public-operations-evidence-reference>",
      "npm run ops:onboarding:digest-evidence",
      "npm run ops:onboarding:check",
      "npm run ops:onboarding:check:markdown -- --output <redacted-onboarding-report.md>",
    ],
    baseActions: [
      "Run npm run ops:onboarding:init if private onboarding files do not exist.",
      "Record each externally approved onboarding checklist item with npm run ops:onboarding:approve-checklist.",
      "Record each externally approved storage decision section with npm run ops:onboarding:approve-storage-decision.",
      "Record each externally approved public operations route section with npm run ops:onboarding:approve-public-operations.",
      "Build the reviewed private onboarding evidence digest with npm run ops:onboarding:digest-evidence before final onboarding archive.",
      "Replace onboarding placeholders with approved operator checklist, storage decision, trusted-key review, and release evidence references.",
      "Run npm run ops:onboarding:upgrade after each app version bump, then re-check readiness.",
    ],
    completionCriteria: [
      "Production onboarding readiness is READY.",
      "No scaffold placeholder or unapproved checklist record remains.",
    ],
  },
  {
    id: "server-runtime",
    title: "Institution server runtime",
    ownerRole: ROLE_BY_PHASE["server-runtime"],
    gateIds: ["server-runtime-readiness"],
    objective: "Prepare the server-only deployment profile, trusted institution key, session secret, and approved origins.",
    evidenceTarget: ".env.server.local, data/trusted-authorized-feed-keys.json, and server deployment evidence bundle",
    verificationCommands: [
      "npm run server:trusted-key:init -- --private-key-dir <approved-repo-external-private-key-dir> --key-id <approved-key-id> --issuer <approved-issuer-name>",
      "npm run server:origin:apply -- --origin <approved-https-operator-origin> --approval-ref <pseudonymous-origin-approval-reference>",
      "npm run security:trusted-key:review -- --candidate <approved-public-key.json> --patch-output <trusted-key-registry.patch.json>",
      "npm run server:trusted-key:apply -- --patch <trusted-key-registry.patch.json> --approval-ref <pseudonymous-approval-reference>",
      "npm run security:server-readiness",
      "npm run server:deployment:bundle",
    ],
    baseActions: [
      "Create or refresh the server env scaffold with npm run server:env:init.",
      "Apply the approved HTTPS operator origin list with npm run server:origin:apply before server readiness.",
      "Generate a repo-external private key and public trusted-key candidate with npm run server:trusted-key:init.",
      "Review an approved institution public-key candidate before applying any trusted-key registry patch.",
      "Apply the approved trusted-key registry patch with a pseudonymous approval reference after fingerprint comparison.",
      "Verify server-only secrets, allowed HTTPS origins, and generated institution route readiness.",
    ],
    completionCriteria: [
      "Server runtime readiness is READY.",
      "At least one active trusted institution public key is approved and registered.",
    ],
  },
  {
    id: "server-storage",
    title: "Private server storage",
    ownerRole: ROLE_BY_PHASE["server-storage"],
    gateIds: ["server-storage-readiness"],
    objective: "Provision audit ledger and account registry storage outside the repository and build artifacts.",
    evidenceTarget: "approved private storage decision record and redacted server storage readiness report",
    verificationCommands: [
      "npm run server:storage:init -- --storage-root <approved-absolute-storage-root> --write-env",
      "npm run security:server-storage",
      "npm run security:server-storage:markdown -- --output <redacted-storage-report.md>",
    ],
    baseActions: [
      "Prepare reviewed repo-external storage directories with npm run server:storage:init before validating readiness.",
      "Select absolute, access-controlled, repo-external storage roots for the audit ledger and account registry.",
      "Confirm the two storage roots are separate, non-nested, writable by the server process, and excluded from static artifacts.",
      "Record only pseudonymous storage decision evidence in the private onboarding packet.",
    ],
    completionCriteria: [
      "Server storage readiness is READY.",
      "Storage evidence does not expose raw filesystem paths in public reports.",
    ],
  },
  {
    id: "desktop-release",
    title: "Signed desktop release",
    ownerRole: ROLE_BY_PHASE["desktop-release"],
    gateIds: ["desktop-publish-readiness"],
    objective: "Prepare a signed desktop installer, update metadata, publish approval, and GitHub Release assets.",
    evidenceTarget: "dist/desktop-release-bundle and signed release workflow artifacts",
    verificationCommands: [
      "npm run desktop:release-env:apply -- --channel <approved-release-channel> --update-url <approved-https-update-url> --publish-approval-ref <pseudonymous-desktop-publish-approval-reference>",
      "npm run desktop:signing-secrets:check",
      "npm run desktop:package:signed",
      "npm run desktop:distribution:check",
      "npm run desktop:update-feed:check -- --feed-dir <signed-release-folder>",
      "npm run desktop:release:digest-evidence -- --feed-dir <signed-release-folder>",
      "npm run desktop:publish:check -- --feed-dir <signed-release-folder>",
    ],
    baseActions: [
      "Apply approved non-secret desktop release env with npm run desktop:release-env:apply before signing checks.",
      "Run the Desktop Signed Release workflow with the release tag that matches package.json.",
      "Keep signing material in GitHub Secrets or an approved signing service, never in the repository.",
      "Build the signed desktop release evidence digest with npm run desktop:release:digest-evidence before publish approval archive.",
      "Validate installer, blockmap, update metadata, and publish approval before uploading assets.",
    ],
    completionCriteria: [
      "Desktop publish readiness is READY.",
      "Installer, blockmap, latest metadata, release tag, and package version all match.",
    ],
  },
  {
    id: "approval-records",
    title: "Private approval records",
    ownerRole: ROLE_BY_PHASE["approval-records"],
    gateIds: ["operational-approval-records"],
    objective: "Collect legal, retention, support, incident-response, release-evidence, and go-live approvals as redacted records.",
    evidenceTarget: "ops/private/operational-approval-records.json",
    verificationCommands: [
      "npm run ops:approvals:init",
      "npm run ops:approvals:digest-evidence",
      "npm run ops:approvals:approve-record -- --type <approval-record-type> --approved-by-ref <pseudonymous-approver-ref> --reference-id <pseudonymous-approval-reference> --scope <approval-scope> --evidence-digest <sha256-evidence-digest>",
      "npm run ops:approvals:check",
      "npm run ops:approvals:markdown -- --output <redacted-approval-records-report.md>",
    ],
    baseActions: [
      "Create the private approval packet if it does not exist.",
      "Build approval evidence digests from reviewed redacted release evidence with npm run ops:approvals:digest-evidence.",
      "Record each externally approved operating approval with npm run ops:approvals:approve-record.",
      "Replace placeholders only after real human review, using pseudonymous approver and evidence references.",
      "Keep URLs, contacts, owner names, secrets, victim indicators, invite links, onion addresses, emails, and phone numbers out of the packet.",
    ],
    completionCriteria: [
      "Operational approval records readiness is READY.",
      "Every required approval type is APPROVED for the current release tag and package version.",
    ],
  },
  {
    id: "go-live",
    title: "Final go-live decision",
    ownerRole: ROLE_BY_PHASE["go-live"],
    gateIds: ["operational-go-live"],
    objective: "Run the final cross-gate check and archive the redacted handoff evidence before production launch.",
    evidenceTarget: "dist/operational-handoff-bundle",
    verificationCommands: [
      "npm run ops:go-live:rehearsal",
      "npm run public:hosting:bundle",
      "npm run security:headers:check -- <approved-https-public-app-url> --json --output ops/private/production-onboarding/hosted-security-header-audit.json",
      "npm run ops:hosted-audit:apply -- --audit-report ops/private/production-onboarding/hosted-security-header-audit.json",
      "npm run ops:public-env:init -- --base-url <approved-https-public-base-url> --write-env",
      "npm run ops:go-live:env:apply -- --incident-owner-ref <pseudonymous-incident-owner-reference>",
      "npm run ops:go-live:check",
      "npm run ops:handoff:bundle",
      "npm run ops:action-plan",
      "npm run ops:release-dossier",
    ],
    baseActions: [
      "Run npm run ops:go-live:rehearsal to verify the internal gate wiring before collecting real launch approvals.",
      "Build the production static hosting bundle with npm run public:hosting:bundle.",
      "Deploy dist/static-hosting-bundle/site to Cloudflare Pages, Netlify, or another approved _headers-capable host.",
      "Run hosted security header audit against the approved HTTPS public app URL and apply it with npm run ops:hosted-audit:apply.",
      "Apply approved go-live flags and the pseudonymous incident owner reference with npm run ops:go-live:env:apply.",
      "Set only approval states and setting-presence values in production env; do not put raw contacts or victim indicators into reports.",
      "Confirm server runtime, storage, desktop publish, onboarding, and private approvals are all READY.",
      "Archive the handoff bundle and action plan with the private release evidence packet.",
      "Build npm run ops:release-dossier so external reviewers receive a redacted evidence manifest before launch approval.",
    ],
    completionCriteria: [
      "Operational go-live status is READY.",
      "The redacted handoff bundle, action plan, release dossier, and private approval records are archived together.",
    ],
  },
];

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizePathForReport(root, value) {
  return path.relative(root, value).replace(/\\/g, "/");
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(filePath, value) {
  writeFileSync(filePath, value, "utf8");
}

export function redactOperationalText(value, root = repoRoot) {
  const rootPath = path.resolve(root);
  return String(value || "")
    .replaceAll(rootPath, "[REDACTED_REPO_ROOT]")
    .replaceAll(rootPath.replace(/\\/g, "/"), "[REDACTED_REPO_ROOT]")
    .replace(/https?:\/\/[^\s)]+/gi, "[REDACTED_URL]")
    .replace(/\b(?:t\.me|telegram\.me|discord\.gg|discord\.com\/invite)\/[^\s)]+/gi, "[REDACTED_INVITE]")
    .replace(/\b[a-z2-7]{16,56}\.onion\b/gi, "[REDACTED_ONION]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]")
    .replace(/\b(?:(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{8,}|github_pat_[A-Za-z0-9_]{8,}|(?:sk-proj|sk)-[A-Za-z0-9_\-]{8,})\b/g, "[REDACTED_TOKEN]")
    .replace(/\b(?:\+?\d{1,3}[-.\s]?)?(?:0\d{1,2}[-.\s]?)?\d{3,4}[-.\s]?\d{4}\b/g, "[REDACTED_PHONE]");
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function phaseForAction(action) {
  const text = String(action || "").toLowerCase();
  if (text.includes("onboarding") || text.includes("checklist") || text.includes("storage decision")) {
    return "production-onboarding";
  }
  if (text.includes("storage") || text.includes("audit ledger") || text.includes("account registry")) {
    return "server-storage";
  }
  if (
    text.includes("trusted key") ||
    text.includes("public key") ||
    text.includes("server runtime") ||
    text.includes("server deployment") ||
    text.includes("jium_server_routes") ||
    text.includes("session secret") ||
    text.includes("origin")
  ) {
    return "server-runtime";
  }
  if (
    text.includes("desktop") ||
    text.includes("installer") ||
    text.includes("update feed") ||
    text.includes("signed") ||
    text.includes("github release") ||
    text.includes("publishing") ||
    text.includes("release assets") ||
    text.includes("uploading release assets")
  ) {
    return "desktop-release";
  }
  if (
    text.includes("ops:public-env:init") ||
    text.includes("public:hosting:bundle") ||
    text.includes("static hosting") ||
    text.includes("_headers-capable") ||
    text.includes("security:headers:check") ||
    text.includes("hosted security header audit") ||
    text.includes("jium_hosted_security_header_audit_report") ||
    text.includes("ops:go-live:env:apply") ||
    text.includes("jium_go_live_approval") ||
    text.includes("go-live approval flags") ||
    text.includes("incident owner reference") ||
    text.includes("public app") ||
    text.includes("privacy notice") ||
    text.includes("public, privacy, and support routes")
  ) {
    return "go-live";
  }
  if (
    text.includes("approval records") ||
    text.includes("approval record") ||
    text.includes("approved pseudonymous record") ||
    text.includes("release evidence") ||
    text.includes("legal") ||
    text.includes("data retention") ||
    text.includes("support") ||
    text.includes("incident")
  ) {
    return "approval-records";
  }
  if (text.includes("go-live") || text.includes("production launch")) {
    return "go-live";
  }
  return "go-live";
}

function statusForGates(gates) {
  if (!gates.length) {
    return "READY";
  }
  return gates.some((gate) => gate.status !== "READY" || gate.errorCount > 0) ? "BLOCKED" : "READY";
}

function reportRefsForPhase(summary, gateIds) {
  const reportKeys = gateIds.flatMap((gateId) => REPORT_REFS_BY_GATE[gateId] || []);
  return unique(reportKeys.map((key) => summary.reports?.[key]).filter(Boolean));
}

function actionStatus(phaseStatus) {
  return phaseStatus === "READY" ? "DONE" : "TODO";
}

function actionPriority(phaseStatus, order) {
  if (phaseStatus === "READY") {
    return "P3";
  }
  return order <= 2 ? "P0" : "P1";
}

function actionEntry({ phaseId, phaseStatus, action, order, source, root, evidenceTarget, verificationCommands, reportRefs }) {
  const safeAction = redactOperationalText(action, root);
  return {
    id: `${phaseId}-${String(order).padStart(2, "0")}-${slugify(safeAction) || "action"}`,
    order,
    status: actionStatus(phaseStatus),
    priority: actionPriority(phaseStatus, order),
    source,
    action: safeAction,
    evidenceTarget: redactOperationalText(evidenceTarget, root),
    verificationCommands: verificationCommands.map((command) => redactOperationalText(command, root)),
    reportRefs,
    safetyBoundary: "Do not record raw URLs, contacts, secrets, tokens, certificate material, victim indicators, invite links, onion addresses, emails, phone numbers, or private storage paths in this action plan.",
  };
}

function assertSummaryShape(summary) {
  if (!summary || typeof summary !== "object") {
    throw new Error("Operational handoff summary is missing or invalid.");
  }
  if (summary.schema !== "jium-operational-handoff-bundle-v1") {
    throw new Error("Unsupported operational handoff summary schema.");
  }
  if (!Array.isArray(summary.gates)) {
    throw new Error("Operational handoff summary has no gates array.");
  }
}

function buildPhases(summary, { root = repoRoot } = {}) {
  const gateById = new Map(summary.gates.map((gate) => [gate.id, gate]));
  const routedActions = new Map(PHASE_BLUEPRINTS.map((phase) => [phase.id, []]));

  for (const action of summary.nextActions || []) {
    const phaseId = phaseForAction(action);
    routedActions.get(phaseId)?.push(action);
  }

  return PHASE_BLUEPRINTS.map((phase, phaseIndex) => {
    const gates = phase.gateIds.map((gateId) => gateById.get(gateId)).filter(Boolean);
    const status = statusForGates(gates);
    const reportRefs = reportRefsForPhase(summary, phase.gateIds);
    const dynamicActions = unique((routedActions.get(phase.id) || []).map((action) => redactOperationalText(action, root)));
    const allActions = unique([...phase.baseActions, ...dynamicActions]);
    return {
      id: phase.id,
      order: phaseIndex + 1,
      title: phase.title,
      status,
      ownerRole: phase.ownerRole,
      objective: phase.objective,
      gates: gates.map((gate) => ({
        id: gate.id,
        status: gate.status,
        errorCount: gate.errorCount,
      })),
      reportRefs,
      actions: allActions.map((action, actionIndex) =>
        actionEntry({
          phaseId: phase.id,
          phaseStatus: status,
          action,
          order: actionIndex + 1,
          source: actionIndex < phase.baseActions.length ? "phase-runbook" : "handoff-next-action",
          root,
          evidenceTarget: phase.evidenceTarget,
          verificationCommands: phase.verificationCommands,
          reportRefs,
        }),
      ),
      completionCriteria: phase.completionCriteria,
    };
  });
}

function summarizePlan(phases) {
  const actions = phases.flatMap((phase) => phase.actions);
  return {
    phaseCount: phases.length,
    actionCount: actions.length,
    todoActionCount: actions.filter((action) => action.status === "TODO").length,
    doneActionCount: actions.filter((action) => action.status === "DONE").length,
    blockedPhaseCount: phases.filter((phase) => phase.status === "BLOCKED").length,
    readyPhaseCount: phases.filter((phase) => phase.status === "READY").length,
  };
}

export async function loadOperationalHandoffSummary({
  root = repoRoot,
  env = process.env,
  platform = process.platform,
  generatedAt,
  summary,
  summaryPath,
} = {}) {
  if (summary) {
    assertSummaryShape(summary);
    return summary;
  }
  if (summaryPath) {
    const loaded = readJson(path.resolve(root, summaryPath));
    assertSummaryShape(loaded);
    return loaded;
  }
  const bundle = await buildOperationalHandoffBundle({ root, env, platform, generatedAt });
  assertSummaryShape(bundle.summary);
  return bundle.summary;
}

export async function buildOperationalActionPlan({
  root = repoRoot,
  env = process.env,
  platform = process.platform,
  generatedAt = new Date().toISOString(),
  summary,
  summaryPath,
} = {}) {
  const handoffSummary = await loadOperationalHandoffSummary({ root, env, platform, generatedAt, summary, summaryPath });
  const phases = buildPhases(handoffSummary, { root });
  const planSummary = summarizePlan(phases);
  return {
    schema: "jium-operational-action-plan-v1",
    generatedAt,
    status: planSummary.blockedPhaseCount === 0 ? "READY" : "BLOCKED",
    source: {
      schema: handoffSummary.schema,
      generatedAt: handoffSummary.generatedAt,
      status: handoffSummary.status,
      version: handoffSummary.version,
      commit: handoffSummary.commit,
      platform: handoffSummary.platform,
    },
    summary: planSummary,
    phases,
    runOrder: phases.map((phase) => ({
      order: phase.order,
      phaseId: phase.id,
      status: phase.status,
      ownerRole: phase.ownerRole,
      verificationCommands: unique(phase.actions.flatMap((action) => action.verificationCommands)),
    })),
    safetyNotes: [
      "This action plan is a redacted operator checklist generated from the operational handoff summary.",
      "It does not replace legal, institution, release-signing, update-hosting, support, incident-response, or go-live approval.",
      "Do not add raw URLs, support contacts, incident owner names, secrets, tokens, certificate material, victim indicators, invite links, onion addresses, emails, phone numbers, or private storage paths to this plan.",
    ],
  };
}

export function formatOperationalActionPlanMarkdown(plan) {
  const lines = [
    "# JiumAI Operational Action Plan",
    "",
    `- Generated at: ${plan.generatedAt}`,
    `- Status: ${plan.status}`,
    `- Source status: ${plan.source.status}`,
    `- Version: ${plan.source.version || "MISSING"}`,
    `- Commit: ${plan.source.commit || "MISSING"}`,
    `- Open actions: ${plan.summary.todoActionCount}`,
    `- Completed actions: ${plan.summary.doneActionCount}`,
    "",
    "## Run Order",
    ...plan.runOrder.map((entry) => `- ${entry.order}. ${entry.phaseId} (${entry.ownerRole}): ${entry.status}`),
    "",
  ];

  for (const phase of plan.phases) {
    lines.push(
      `## ${phase.order}. ${phase.title}`,
      "",
      `- Status: ${phase.status}`,
      `- Owner role: ${phase.ownerRole}`,
      `- Objective: ${phase.objective}`,
      `- Gates: ${phase.gates.map((gate) => `${gate.id}=${gate.status}/${gate.errorCount}`).join(", ") || "None"}`,
      `- Reports: ${phase.reportRefs.join(", ") || "None"}`,
      "",
      "### Actions",
      ...phase.actions.map(
        (action) =>
          `- ${action.status} ${action.priority} ${action.id}: ${action.action}\n  Evidence: ${action.evidenceTarget}\n  Verify: ${action.verificationCommands.map((command) => `\`${command}\``).join("; ")}`,
      ),
      "",
      "### Completion Criteria",
      ...phase.completionCriteria.map((criterion) => `- ${criterion}`),
      "",
    );
  }

  lines.push("## Safety Notes", ...plan.safetyNotes.map((note) => `- ${note}`), "");
  return `${lines.join("\n")}\n`;
}

export function writeOperationalActionPlanFiles({
  root = repoRoot,
  plan,
  outputPath = "",
  format = "markdown",
} = {}) {
  if (!plan) {
    throw new Error("Operational action plan is required.");
  }
  const bundleDir = path.join(root, OPERATIONAL_HANDOFF_BUNDLE_DIR);
  mkdirSync(bundleDir, { recursive: true });
  const jsonPath = path.join(bundleDir, OPERATIONAL_ACTION_PLAN_JSON);
  const markdownPath = path.join(bundleDir, OPERATIONAL_ACTION_PLAN_MARKDOWN);
  writeJson(jsonPath, plan);
  writeText(markdownPath, formatOperationalActionPlanMarkdown(plan));

  if (outputPath) {
    const resolvedOutput = path.resolve(root, outputPath);
    mkdirSync(path.dirname(resolvedOutput), { recursive: true });
    writeText(
      resolvedOutput,
      format === "json" ? `${JSON.stringify(plan, null, 2)}\n` : formatOperationalActionPlanMarkdown(plan),
    );
  }

  return {
    jsonPath,
    markdownPath,
    jsonPathRelative: normalizePathForReport(root, jsonPath),
    markdownPathRelative: normalizePathForReport(root, markdownPath),
  };
}

function parseCliArgs(argv) {
  const args = {
    format: "text",
    root: repoRoot,
    summaryPath: "",
    outputPath: "",
    platform: process.platform,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") {
      args.format = "json";
    } else if (arg === "--markdown" || arg === "--md") {
      args.format = "markdown";
    } else if (arg === "--root") {
      args.root = path.resolve(argv[index + 1] || args.root);
      index += 1;
    } else if (arg.startsWith("--root=")) {
      args.root = path.resolve(arg.slice("--root=".length));
    } else if (arg === "--summary") {
      args.summaryPath = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--summary=")) {
      args.summaryPath = arg.slice("--summary=".length);
    } else if (arg === "--no-build") {
      args.summaryPath = args.summaryPath || path.join(OPERATIONAL_HANDOFF_BUNDLE_DIR, "operational-handoff-summary.json");
    } else if (arg === "--output") {
      args.outputPath = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--output=")) {
      args.outputPath = arg.slice("--output=".length);
    } else if (arg === "--platform") {
      args.platform = argv[index + 1] || args.platform;
      index += 1;
    }
  }
  return args;
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || "")) {
  const args = parseCliArgs(process.argv.slice(2));
  try {
    const plan = await buildOperationalActionPlan({
      root: args.root,
      platform: args.platform,
      summaryPath: args.summaryPath,
    });
    const written = writeOperationalActionPlanFiles({
      root: args.root,
      plan,
      outputPath: args.outputPath,
      format: args.format === "json" ? "json" : "markdown",
    });
    if (!args.outputPath) {
      if (args.format === "json") {
        console.log(JSON.stringify(plan, null, 2));
      } else {
        console.log(formatOperationalActionPlanMarkdown(plan));
        console.log(`Operational action plan written: ${written.markdownPathRelative}`);
      }
    } else {
      console.log(`Operational action plan written: ${args.outputPath}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
