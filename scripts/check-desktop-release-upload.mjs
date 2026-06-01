#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseDesktopReleaseTag } from "./check-desktop-publish-readiness.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

export const DESKTOP_RELEASE_UPLOAD_SCHEMA = "jium-desktop-release-upload-v1";
export const DESKTOP_RELEASE_UPLOAD_DIR = "dist/desktop-release-upload";
export const DESKTOP_RELEASE_UPLOAD_JSON = "desktop-release-upload-report.json";
export const DESKTOP_RELEASE_UPLOAD_MARKDOWN = "desktop-release-upload-report.md";

const EVIDENCE_ARCHIVE_NAME = "jium-ai-windows-signed-release-evidence.tgz";
const UNSAFE_PATTERNS = [
  { id: "raw-url", label: "Raw URL", regex: /https?:\/\/[^\s")]+/i },
  { id: "raw-invite", label: "Raw invite route", regex: /\b(?:t\.me|telegram\.me|discord\.gg|discord\.com\/invite)\/[^\s")]+/i },
  { id: "raw-onion", label: "Raw onion address", regex: /\b[a-z2-7]{16,56}\.onion\b/i },
  { id: "raw-email", label: "Raw email", regex: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i },
  {
    id: "raw-token",
    label: "Raw token",
    regex: /\b(?:(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{8,}|github_pat_[A-Za-z0-9_]{8,}|(?:sk-proj|sk)-[A-Za-z0-9_\-]{8,})\b/i,
  },
  {
    id: "raw-phone",
    label: "Raw phone number",
    regex: /\b(?:(?:\+82[\s.-]?)?0?1[016789][\s.-]?\d{3,4}[\s.-]?\d{4}|0\d{1,2}[\s.-]\d{3,4}[\s.-]\d{4})\b/,
  },
  {
    id: "raw-path",
    label: "Raw filesystem path",
    regex: /(?:[A-Za-z]:\\|\/(?:Users|home|var|etc|tmp|mnt|opt)\/)[^\s")]+/i,
  },
];

function isPathInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function relativePath(root, target) {
  return path.relative(root, target).replace(/\\/g, "/");
}

function sha256Text(value) {
  return `sha256-${createHash("sha256").update(String(value || "")).digest("hex")}`;
}

function readPackageVersion(root) {
  try {
    return JSON.parse(readFileSync(path.join(root, "package.json"), "utf8").replace(/^\uFEFF/, "")).version || "";
  } catch {
    return "";
  }
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, "utf8");
}

function resolveInsideRepo(root, target, label) {
  const resolved = path.resolve(root, target || "");
  if (!isPathInside(root, resolved)) {
    throw new Error(`${label} path must stay inside the repository`);
  }
  return resolved;
}

function safePrepareReportDir(root) {
  const resolved = path.resolve(root, DESKTOP_RELEASE_UPLOAD_DIR);
  if (!isPathInside(root, resolved) || relativePath(root, resolved) !== DESKTOP_RELEASE_UPLOAD_DIR) {
    throw new Error(`Refusing to clean unsafe desktop release upload directory: ${resolved}`);
  }
  rmSync(resolved, { recursive: true, force: true });
  mkdirSync(resolved, { recursive: true });
  return resolved;
}

function redactText(value, root) {
  return String(value || "")
    .replaceAll(path.resolve(root), "<repo-root>")
    .replace(/https?:\/\/[^\s")]+/gi, "<redacted-url>")
    .replace(/\b(?:t\.me|telegram\.me|discord\.gg|discord\.com\/invite)\/[^\s")]+/gi, "<redacted-invite>")
    .replace(/\b[a-z2-7]{16,56}\.onion\b/gi, "<redacted-onion>")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "<redacted-email>")
    .replace(/\b(?:(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{8,}|github_pat_[A-Za-z0-9_]{8,}|(?:sk-proj|sk)-[A-Za-z0-9_\-]{8,})\b/gi, "<redacted-token>")
    .replace(/\b(?:(?:\+82[\s.-]?)?0?1[016789][\s.-]?\d{3,4}[\s.-]?\d{4}|0\d{1,2}[\s.-]\d{3,4}[\s.-]\d{4})\b/g, "<redacted-phone>")
    .replace(/(?:[A-Za-z]:\\|\/(?:Users|home|var|etc|tmp|mnt|opt)\/)[^\s")]+/gi, "<redacted-path>");
}

function scanReportForLeaks(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  const findings = UNSAFE_PATTERNS.filter((pattern) => pattern.regex.test(text)).map((pattern) => ({
    id: pattern.id,
    label: pattern.label,
  }));
  return {
    status: findings.length ? "BLOCKED" : "PASS",
    checkedPatternCount: UNSAFE_PATTERNS.length,
    findings,
  };
}

function normalizeAsset(asset) {
  const name = String(asset?.name || "").trim();
  return {
    name,
    size: Number.isFinite(Number(asset?.size)) ? Number(asset.size) : 0,
    nameDigest: name ? sha256Text(name) : "",
  };
}

function expectedAssetChecks(assetNames) {
  const checks = [
    {
      id: "windows-installer",
      label: "Windows signed installer asset is uploaded",
      status: assetNames.some((name) => name.toLowerCase().endsWith(".exe")) ? "PASS" : "BLOCKED",
    },
    {
      id: "windows-blockmap",
      label: "Windows blockmap asset is uploaded",
      status: assetNames.some((name) => name.toLowerCase().endsWith(".blockmap")) ? "PASS" : "BLOCKED",
    },
    {
      id: "windows-update-metadata",
      label: "Windows latest.yml update metadata is uploaded",
      status: assetNames.includes("latest.yml") ? "PASS" : "BLOCKED",
    },
    {
      id: "release-evidence-archive",
      label: "Signed release evidence archive is uploaded",
      status: assetNames.includes(EVIDENCE_ARCHIVE_NAME) ? "PASS" : "BLOCKED",
    },
  ];
  return checks;
}

function loadReleaseView({ root, releaseTag, releaseViewJsonPath, runner = spawnSync, env = process.env }) {
  if (releaseViewJsonPath) {
    const resolved = resolveInsideRepo(root, releaseViewJsonPath, "release view json");
    return {
      ok: true,
      source: "FILE",
      value: readJson(resolved),
      errors: [],
    };
  }
  const result = runner("gh", ["release", "view", releaseTag, "--json", "tagName,isDraft,isPrerelease,assets"], {
    cwd: root,
    env,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    return {
      ok: false,
      source: "GH_CLI",
      value: null,
      errors: [redactText(result.stderr || result.stdout || "gh release view failed", root)],
    };
  }
  try {
    return {
      ok: true,
      source: "GH_CLI",
      value: JSON.parse(result.stdout || "{}"),
      errors: [],
    };
  } catch (error) {
    return {
      ok: false,
      source: "GH_CLI",
      value: null,
      errors: [`gh release view output is not valid JSON: ${redactText(error instanceof Error ? error.message : String(error), root)}`],
    };
  }
}

export function buildDesktopReleaseUploadReport({
  root = repoRoot,
  env = process.env,
  releaseTag = env.JIUM_DESKTOP_RELEASE_TAG || "",
  releaseView,
  releaseViewJsonPath = "",
  runner = spawnSync,
  generatedAt = new Date().toISOString(),
} = {}) {
  const resolvedRoot = path.resolve(root);
  const packageVersion = readPackageVersion(resolvedRoot);
  const tag = parseDesktopReleaseTag(releaseTag);
  const errors = [];
  if (!tag.tag) {
    errors.push("desktop release upload tag missing: JIUM_DESKTOP_RELEASE_TAG or --release-tag");
  } else if (!tag.valid) {
    errors.push("desktop release upload tag must use vMAJOR.MINOR.PATCH or vMAJOR.MINOR.PATCH-prerelease format");
  } else if (packageVersion && tag.version !== packageVersion) {
    errors.push(`desktop release upload package version mismatch: package.json ${packageVersion} does not match release tag ${tag.tag}`);
  }

  const releaseSource = releaseView
    ? { ok: true, source: "OBJECT", value: releaseView, errors: [] }
    : tag.tag
      ? loadReleaseView({ root: resolvedRoot, releaseTag: tag.tag, releaseViewJsonPath, runner, env })
      : { ok: false, source: releaseViewJsonPath ? "FILE" : "GH_CLI", value: null, errors: ["release tag is required before loading release assets"] };
  errors.push(...releaseSource.errors);

  const release = releaseSource.value || {};
  if (release.tagName && tag.tag && release.tagName !== tag.tag) {
    errors.push("desktop release upload tag mismatch between requested tag and GitHub release response");
  }
  if (release.isDraft === true) {
    errors.push("desktop release upload target must not be a draft release");
  }
  const assets = Array.isArray(release.assets) ? release.assets.map(normalizeAsset).filter((asset) => asset.name) : [];
  if (!Array.isArray(release.assets) && releaseSource.ok) {
    errors.push("desktop release upload response has no assets array");
  }
  const assetNames = assets.map((asset) => asset.name);
  const checks = [
    {
      id: "release-view",
      label: "GitHub Release asset list is available",
      status: releaseSource.ok ? "PASS" : "BLOCKED",
    },
    {
      id: "release-tag",
      label: "Release tag matches package.json version",
      status: tag.valid && (!packageVersion || tag.version === packageVersion) ? "PASS" : "BLOCKED",
    },
    {
      id: "release-draft-state",
      label: "Target GitHub Release is not draft",
      status: release.isDraft === false ? "PASS" : "BLOCKED",
    },
    ...expectedAssetChecks(assetNames),
  ];
  for (const check of checks) {
    if (check.status !== "PASS" && !errors.some((error) => error.includes(check.id))) {
      errors.push(`desktop release upload ${check.id} check failed`);
    }
  }

  const baseReport = {
    schema: DESKTOP_RELEASE_UPLOAD_SCHEMA,
    generatedAt,
    status: errors.length ? "BLOCKED" : "READY",
    version: packageVersion,
    source: {
      releaseViewSource: releaseSource.source,
      releaseTagStatus: tag.tag ? "SET" : "MISSING",
      releaseTagVersion: tag.version,
      releaseTagDigest: tag.tag ? sha256Text(tag.tag) : "",
      isDraft: release.isDraft === true ? "YES" : release.isDraft === false ? "NO" : "UNKNOWN",
      isPrerelease: release.isPrerelease === true ? "YES" : release.isPrerelease === false ? "NO" : "UNKNOWN",
    },
    summary: {
      assetCount: assets.length,
      expectedAssetCheckCount: checks.length,
      passedCheckCount: checks.filter((check) => check.status === "PASS").length,
      blockedCheckCount: checks.filter((check) => check.status !== "PASS").length,
      evidenceArchiveStatus: assetNames.includes(EVIDENCE_ARCHIVE_NAME) ? "PRESENT" : "MISSING",
      installerAssetCount: assetNames.filter((name) => name.toLowerCase().endsWith(".exe")).length,
      blockmapAssetCount: assetNames.filter((name) => name.toLowerCase().endsWith(".blockmap")).length,
      updateMetadataAssetCount: assetNames.filter((name) => name === "latest.yml").length,
    },
    assets: assets.map((asset) => ({
      name: asset.name,
      size: asset.size,
      nameDigest: asset.nameDigest,
    })),
    checks,
    errors: errors.map((error) => redactText(error, resolvedRoot)),
    nextActions: errors.length
      ? [
          "Run the Desktop Signed Release workflow publish job with the approved tag after signed artifacts and evidence archive are ready.",
          "Rerun npm run desktop:release-upload:check after the GitHub Release upload completes.",
        ]
      : [
          "Archive this upload verification report with the private desktop publish approval record and operational launch receipt.",
          "Rerun npm run desktop:publish:check and npm run ops:go-live:check before final production approval.",
        ],
    safetyNotes: [
      "This report stores release tag status, asset names, sizes, counts, and SHA-256 digests only.",
      "It does not store GitHub token values, repository URL values, asset download URLs, update endpoint values, certificate material, victim indicators, invite links, onion addresses, emails, or phone numbers.",
      "A READY result verifies uploaded release assets; it does not replace legal, institution, incident-response, or go-live approval.",
    ],
  };
  const leakScan = scanReportForLeaks(baseReport);
  return {
    ...baseReport,
    status: leakScan.status === "PASS" ? baseReport.status : "BLOCKED",
    leakScan,
    errors: [
      ...baseReport.errors,
      ...leakScan.findings.map((finding) => `desktop release upload report contains unsafe ${finding.label}`),
    ],
  };
}

export function writeDesktopReleaseUploadReportFiles({
  root = repoRoot,
  report,
  outputPath = "",
  format = "markdown",
} = {}) {
  const resolvedRoot = path.resolve(root);
  const reportDir = safePrepareReportDir(resolvedRoot);
  const jsonPath = path.join(reportDir, DESKTOP_RELEASE_UPLOAD_JSON);
  const markdownPath = path.join(reportDir, DESKTOP_RELEASE_UPLOAD_MARKDOWN);
  writeJson(jsonPath, report);
  writeText(markdownPath, formatDesktopReleaseUploadMarkdown(report));
  if (outputPath) {
    const resolvedOutput = resolveInsideRepo(resolvedRoot, outputPath, "output");
    writeText(
      resolvedOutput,
      format === "json" ? `${JSON.stringify(report, null, 2)}\n` : formatDesktopReleaseUploadMarkdown(report),
    );
  }
  return {
    reportDir,
    reportDirRelative: relativePath(resolvedRoot, reportDir),
    jsonPath,
    markdownPath,
    jsonPathRelative: relativePath(resolvedRoot, jsonPath),
    markdownPathRelative: relativePath(resolvedRoot, markdownPath),
  };
}

export function formatDesktopReleaseUploadMarkdown(report) {
  const lines = [
    "# JiumAI Desktop Release Upload Verification",
    "",
    `- Generated at: ${report.generatedAt}`,
    `- Status: ${report.status}`,
    `- Version: ${report.version || "MISSING"}`,
    `- Release tag: ${report.source.releaseTagStatus}`,
    `- Release tag version: ${report.source.releaseTagVersion || "MISSING"}`,
    `- Release view source: ${report.source.releaseViewSource}`,
    `- Draft: ${report.source.isDraft}`,
    `- Prerelease: ${report.source.isPrerelease}`,
    `- Assets: ${report.summary.assetCount}`,
    `- Checks: ${report.summary.passedCheckCount}/${report.summary.expectedAssetCheckCount}`,
    `- Evidence archive: ${report.summary.evidenceArchiveStatus}`,
    `- Leak scan: ${report.leakScan.status}`,
    "",
    "## Assets",
    ...(report.assets.length ? report.assets.map((asset) => `- ${asset.name}: ${asset.size} bytes, ${asset.nameDigest}`) : ["- None"]),
    "",
    "## Checks",
    ...report.checks.map((check) => `- ${check.status} ${check.id}: ${check.label}`),
    "",
    "## Errors",
    ...(report.errors.length ? report.errors.map((error) => `- ${error}`) : ["- None"]),
    "",
    "## Next Actions",
    ...report.nextActions.map((action) => `- ${action}`),
    "",
    "## Safety Notes",
    ...report.safetyNotes.map((note) => `- ${note}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseCliArgs(argv) {
  const args = {
    root: repoRoot,
    releaseTag: "",
    releaseViewJsonPath: "",
    outputPath: "",
    format: "text",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      args.root = path.resolve(argv[index + 1] || args.root);
      index += 1;
    } else if (arg.startsWith("--root=")) {
      args.root = path.resolve(arg.slice("--root=".length));
    } else if (arg === "--release-tag") {
      args.releaseTag = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--release-tag=")) {
      args.releaseTag = arg.slice("--release-tag=".length);
    } else if (arg === "--release-view-json") {
      args.releaseViewJsonPath = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--release-view-json=")) {
      args.releaseViewJsonPath = arg.slice("--release-view-json=".length);
    } else if (arg === "--output") {
      args.outputPath = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--output=")) {
      args.outputPath = arg.slice("--output=".length);
    } else if (arg === "--json") {
      args.format = "json";
    } else if (arg === "--markdown" || arg === "--md") {
      args.format = "markdown";
    }
  }
  return args;
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || "")) {
  const args = parseCliArgs(process.argv.slice(2));
  try {
    if (args.outputPath) {
      resolveInsideRepo(args.root, args.outputPath, "output");
    }
    if (args.releaseViewJsonPath) {
      resolveInsideRepo(args.root, args.releaseViewJsonPath, "release view json");
    }
    const report = buildDesktopReleaseUploadReport({
      root: args.root,
      releaseTag: args.releaseTag || process.env.JIUM_DESKTOP_RELEASE_TAG || "",
      releaseViewJsonPath: args.releaseViewJsonPath,
    });
    const written = writeDesktopReleaseUploadReportFiles({
      root: args.root,
      report,
      outputPath: args.outputPath,
      format: args.format === "json" ? "json" : "markdown",
    });
    if (args.format === "json") {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(formatDesktopReleaseUploadMarkdown(report));
    }
    console.log(`Desktop release upload verification written: ${args.outputPath || written.reportDirRelative}`);
    if (report.status === "BLOCKED") {
      process.exit(1);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
