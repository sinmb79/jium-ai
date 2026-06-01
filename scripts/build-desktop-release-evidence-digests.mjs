#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { updateFeedMetadataName } from "./check-desktop-update-feed.mjs";
import { DESKTOP_RELEASE_BUNDLE_DIR } from "./build-desktop-release-bundle.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

export const DESKTOP_RELEASE_EVIDENCE_DIGESTS_SCHEMA = "jium-desktop-release-evidence-digests-v1";
export const DESKTOP_RELEASE_EVIDENCE_DIGESTS_DIR = "dist/desktop-release-evidence-digests";
export const DESKTOP_RELEASE_EVIDENCE_DIGESTS_JSON = "desktop-release-evidence-digests.json";
export const DESKTOP_RELEASE_EVIDENCE_DIGESTS_MARKDOWN = "desktop-release-evidence-digests.md";

const RELEASE_BUNDLE_EVIDENCE_FILES = [
  {
    role: "release-summary-json",
    file: `${DESKTOP_RELEASE_BUNDLE_DIR}/desktop-release-candidate-summary.json`,
  },
  {
    role: "release-summary-markdown",
    file: `${DESKTOP_RELEASE_BUNDLE_DIR}/desktop-release-candidate-summary.md`,
  },
];

const TEXT_EXTENSIONS = new Set([".json", ".md", ".txt", ".yml", ".yaml"]);

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
  {
    id: "private-key",
    label: "Private key material",
    regex: /-----BEGIN (?:RSA |EC |OPENSSH |)?PRIVATE KEY-----|\b"(?:d|p|q|dp|dq|qi|oth|k)"\s*:/i,
  },
  {
    id: "certificate-secret",
    label: "Certificate or signing secret",
    regex: /\b(?:CSC_LINK|CSC_KEY_PASSWORD|APPLE_API_KEY|AZURE_KEY_VAULT_CLIENT_SECRET)\s*=/i,
  },
];

function isPathInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function safePrepareDigestDir(root, digestDir) {
  const resolved = path.resolve(root, digestDir);
  if (!isPathInside(root, resolved) || path.relative(root, resolved).replace(/\\/g, "/") !== DESKTOP_RELEASE_EVIDENCE_DIGESTS_DIR) {
    throw new Error(`Refusing to clean unsafe desktop release evidence digest directory: ${resolved}`);
  }
  rmSync(resolved, { recursive: true, force: true });
  mkdirSync(resolved, { recursive: true });
  return resolved;
}

function readPackageVersion(root) {
  try {
    return JSON.parse(readFileSync(path.join(root, "package.json"), "utf8").replace(/^\uFEFF/, "")).version || "";
  } catch {
    return "";
  }
}

function sha256Buffer(buffer) {
  return `sha256-${createHash("sha256").update(buffer).digest("hex")}`;
}

function sha256Text(value) {
  return `sha256-${createHash("sha256").update(String(value || "")).digest("hex")}`;
}

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, "utf8");
}

function listFiles(dir) {
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

function platformInstallerMatcher(platform) {
  if (platform === "darwin") {
    return (fileName) => /\.(?:dmg|zip)$/i.test(fileName);
  }
  if (platform === "linux") {
    return (fileName) => /\.appimage$/i.test(fileName);
  }
  return (fileName) => /\.exe$/i.test(fileName);
}

function buildPlatformArtifactDescriptors({ root, feedDir, platform }) {
  const resolvedFeedDir = path.resolve(feedDir);
  const files = listFiles(resolvedFeedDir);
  const installer = files.find(platformInstallerMatcher(platform)) || "";
  const blockmap = files.find((fileName) => /\.blockmap$/i.test(fileName)) || "";
  const metadata = updateFeedMetadataName(platform);

  const descriptors = [
    {
      role: "installer",
      fileName: installer || (platform === "darwin" ? "*.dmg|*.zip" : platform === "linux" ? "*.AppImage" : "*.exe"),
      resolved: installer ? path.join(resolvedFeedDir, installer) : "",
      missingError: "desktop release installer artifact missing",
    },
    {
      role: "update-metadata",
      fileName: metadata,
      resolved: path.join(resolvedFeedDir, metadata),
      missingError: `desktop release update metadata missing: ${metadata}`,
    },
  ];

  if (platform === "win32") {
    descriptors.splice(1, 0, {
      role: "blockmap",
      fileName: blockmap || "*.blockmap",
      resolved: blockmap ? path.join(resolvedFeedDir, blockmap) : "",
      missingError: "desktop release blockmap artifact missing",
    });
  }

  return descriptors.map((descriptor) => ({
    ...descriptor,
    source: "desktop-feed",
    root,
  }));
}

function releaseBundleDescriptors(root) {
  return RELEASE_BUNDLE_EVIDENCE_FILES.map((entry) => ({
    ...entry,
    source: "release-bundle",
    fileName: path.basename(entry.file),
    resolved: path.resolve(root, entry.file),
    missingError: `desktop release bundle evidence missing: ${path.basename(entry.file)}`,
    root,
  }));
}

function slugFileId(role, fileName) {
  return `${role}-${fileName}`
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 96) || "desktop-release-evidence-file";
}

function shouldScanText(fileName) {
  return TEXT_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

function scanUnsafeText(text, fileName) {
  return UNSAFE_PATTERNS.filter((pattern) => pattern.regex.test(text)).map((pattern) => ({
    fileName,
    id: pattern.id,
    label: pattern.label,
  }));
}

function evidenceReportForDescriptor(root, descriptor) {
  const findings = [];
  const errors = [];
  if (!descriptor.resolved) {
    errors.push(`${descriptor.fileName}: ${descriptor.missingError}`);
    return {
      errors,
      file: {
        id: slugFileId(descriptor.role, descriptor.fileName),
        role: descriptor.role,
        source: descriptor.source,
        fileName: descriptor.fileName,
        status: "BLOCKED",
        bytes: 0,
        digest: "",
        contentScan: "NOT_RUN",
        unsafeFindings: [{ fileName: descriptor.fileName, id: "missing-file", label: "Missing file" }],
      },
      findings: [],
    };
  }
  if (!isPathInside(root, descriptor.resolved)) {
    errors.push(`${descriptor.fileName}: evidence file path must stay inside the repository`);
    return {
      errors,
      file: {
        id: slugFileId(descriptor.role, descriptor.fileName),
        role: descriptor.role,
        source: descriptor.source,
        fileName: descriptor.fileName,
        status: "BLOCKED",
        bytes: 0,
        digest: "",
        contentScan: "NOT_RUN",
        unsafeFindings: [{ fileName: descriptor.fileName, id: "unsafe-path", label: "Unsafe path" }],
      },
      findings: [],
    };
  }
  if (!existsSync(descriptor.resolved)) {
    errors.push(`${descriptor.fileName}: ${descriptor.missingError}`);
    return {
      errors,
      file: {
        id: slugFileId(descriptor.role, descriptor.fileName),
        role: descriptor.role,
        source: descriptor.source,
        fileName: descriptor.fileName,
        status: "BLOCKED",
        bytes: 0,
        digest: "",
        contentScan: "NOT_RUN",
        unsafeFindings: [{ fileName: descriptor.fileName, id: "missing-file", label: "Missing file" }],
      },
      findings: [],
    };
  }

  const buffer = readFileSync(descriptor.resolved);
  if (shouldScanText(descriptor.fileName)) {
    findings.push(...scanUnsafeText(buffer.toString("utf8").replace(/^\uFEFF/, ""), descriptor.fileName));
  }
  return {
    errors,
    file: {
      id: slugFileId(descriptor.role, descriptor.fileName),
      role: descriptor.role,
      source: descriptor.source,
      fileName: descriptor.fileName,
      status: findings.length ? "BLOCKED" : "READY",
      bytes: statSync(descriptor.resolved).size,
      digest: findings.length ? "" : sha256Buffer(buffer),
      contentScan: shouldScanText(descriptor.fileName) ? "TEXT_SCANNED" : "BINARY_HASH_ONLY",
      unsafeFindings: findings,
    },
    findings,
  };
}

export async function buildDesktopReleaseEvidenceDigests({
  root = repoRoot,
  feedDir = path.join(root, "dist", "desktop"),
  platform = process.platform,
  generatedAt = new Date().toISOString(),
} = {}) {
  const resolvedRoot = path.resolve(root);
  const resolvedFeedDir = path.resolve(feedDir);
  const errors = [];
  if (!isPathInside(resolvedRoot, resolvedFeedDir)) {
    errors.push("desktop release feed directory must stay inside the repository");
  }
  if (!existsSync(resolvedFeedDir)) {
    errors.push("desktop release feed directory missing");
  }

  const descriptorErrors = errors.length
    ? []
    : [
        ...buildPlatformArtifactDescriptors({ root: resolvedRoot, feedDir: resolvedFeedDir, platform }),
        ...releaseBundleDescriptors(resolvedRoot),
      ].map((descriptor) => evidenceReportForDescriptor(resolvedRoot, descriptor));

  errors.push(...descriptorErrors.flatMap((entry) => entry.errors));
  const files = descriptorErrors.map((entry) => entry.file);
  const unsafeFindings = descriptorErrors.flatMap((entry) => entry.findings);
  const safeFileDigests = files
    .filter((file) => file.status === "READY")
    .map((file) => `${file.source}:${file.role}:${file.fileName}:${file.bytes}:${file.digest}`)
    .sort();
  const aggregateDigest = errors.length || unsafeFindings.length || safeFileDigests.length !== files.length
    ? ""
    : sha256Text(safeFileDigests.join("\n"));

  const report = {
    schema: DESKTOP_RELEASE_EVIDENCE_DIGESTS_SCHEMA,
    generatedAt,
    status: aggregateDigest ? "READY" : "BLOCKED",
    version: readPackageVersion(resolvedRoot),
    platform,
    summary: {
      fileCount: files.length,
      readyFileCount: files.filter((file) => file.status === "READY").length,
      unsafeFindingCount: unsafeFindings.length,
      errorCount: errors.length,
    },
    aggregateDigest,
    files,
    errors,
    nextActions: aggregateDigest
      ? [
          "Archive this aggregateDigest with the signed desktop release evidence packet.",
          "Run npm run desktop:publish:check -- --feed-dir <signed-release-folder> before GitHub Release upload.",
          "Attach the digest manifest with the private release approval record.",
        ]
      : [
          "Rebuild signed installer artifacts, update metadata, and desktop release bundle before creating the digest.",
          "Remove raw URLs, contacts, tokens, certificate secrets, private paths, or private key material from text evidence files.",
          "Run npm run desktop:release:bundle and then rebuild this digest manifest.",
        ],
    safetyNotes: [
      "This manifest stores file names, roles, byte counts, SHA-256 digests, unsafe pattern IDs, and counts only.",
      "Binary installer artifacts are hashed but not text-scanned.",
      "It does not store file contents, feed directories, update endpoint values, GitHub tokens, certificate material, victim indicators, invite links, onion addresses, emails, phone numbers, or private storage paths.",
      "The aggregate digest proves the exact reviewed desktop release evidence files; it is not legal, institution, signing, or go-live approval.",
    ],
  };

  return {
    valid: report.status === "READY",
    report,
  };
}

export function formatDesktopReleaseEvidenceDigestsMarkdown(report) {
  const lines = [
    "# JiumAI Desktop Release Evidence Digests",
    "",
    `- Generated at: ${report.generatedAt}`,
    `- Status: ${report.status}`,
    `- Version: ${report.version || "MISSING"}`,
    `- Platform: ${report.platform}`,
    `- Files: ${report.summary.readyFileCount}/${report.summary.fileCount}`,
    `- Unsafe findings: ${report.summary.unsafeFindingCount}`,
    `- Aggregate digest: ${report.aggregateDigest || "BLOCKED"}`,
    "",
    "## Files",
    ...report.files.map(
      (file) =>
        `- ${file.status} ${file.source}/${file.role}/${file.fileName}: ${file.bytes} bytes, ${file.digest || "digest blocked"}, scan=${file.contentScan}, findings=${file.unsafeFindings.length}`,
    ),
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

export function writeDesktopReleaseEvidenceDigestFiles({
  root = repoRoot,
  report,
  outputPath = "",
  format = "markdown",
} = {}) {
  if (!report) {
    throw new Error("Desktop release evidence digest report is required.");
  }
  if (outputPath) {
    const resolvedOutput = path.resolve(root, outputPath);
    if (!isPathInside(root, resolvedOutput)) {
      throw new Error("output path must stay inside the repository");
    }
  }

  const digestDir = safePrepareDigestDir(root, DESKTOP_RELEASE_EVIDENCE_DIGESTS_DIR);
  const jsonPath = path.join(digestDir, DESKTOP_RELEASE_EVIDENCE_DIGESTS_JSON);
  const markdownPath = path.join(digestDir, DESKTOP_RELEASE_EVIDENCE_DIGESTS_MARKDOWN);
  writeJson(jsonPath, report);
  writeText(markdownPath, formatDesktopReleaseEvidenceDigestsMarkdown(report));

  if (outputPath) {
    writeText(
      path.resolve(root, outputPath),
      format === "json" ? `${JSON.stringify(report, null, 2)}\n` : formatDesktopReleaseEvidenceDigestsMarkdown(report),
    );
  }

  return {
    digestDir,
    digestDirRelative: path.relative(root, digestDir).replace(/\\/g, "/"),
    jsonPath,
    markdownPath,
    jsonPathRelative: path.relative(root, jsonPath).replace(/\\/g, "/"),
    markdownPathRelative: path.relative(root, markdownPath).replace(/\\/g, "/"),
  };
}

function parseCliArgs(argv) {
  const args = {
    root: repoRoot,
    feedDir: "",
    platform: process.platform,
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
    } else if (arg === "--feed-dir") {
      args.feedDir = path.resolve(argv[index + 1] || "");
      index += 1;
    } else if (arg.startsWith("--feed-dir=")) {
      args.feedDir = path.resolve(arg.slice("--feed-dir=".length));
    } else if (arg === "--platform") {
      args.platform = argv[index + 1] || args.platform;
      index += 1;
    } else if (arg.startsWith("--platform=")) {
      args.platform = arg.slice("--platform=".length);
    } else if (arg === "--json") {
      args.format = "json";
    } else if (arg === "--markdown" || arg === "--md") {
      args.format = "markdown";
    } else if (arg === "--output") {
      args.outputPath = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--output=")) {
      args.outputPath = arg.slice("--output=".length);
    } else if (!arg.startsWith("-") && !args.feedDir) {
      args.feedDir = path.resolve(arg);
    }
  }
  return args;
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || "")) {
  const args = parseCliArgs(process.argv.slice(2));
  try {
    if (args.outputPath && !isPathInside(args.root, path.resolve(args.root, args.outputPath))) {
      throw new Error("output path must stay inside the repository");
    }
    const result = await buildDesktopReleaseEvidenceDigests({
      root: args.root,
      feedDir: args.feedDir || path.join(args.root, "dist", "desktop"),
      platform: args.platform,
    });
    const written = writeDesktopReleaseEvidenceDigestFiles({
      root: args.root,
      report: result.report,
      outputPath: args.outputPath,
      format: args.format === "json" ? "json" : "markdown",
    });
    if (!args.outputPath) {
      if (args.format === "json") {
        console.log(JSON.stringify(result.report, null, 2));
      } else {
        console.log(formatDesktopReleaseEvidenceDigestsMarkdown(result.report));
        console.log(`Desktop release evidence digests written: ${written.markdownPathRelative}`);
      }
    } else {
      console.log(`Desktop release evidence digests written: ${args.outputPath}`);
    }
    if (!result.valid) {
      process.exit(1);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
