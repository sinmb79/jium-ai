#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

export function updateFeedMetadataName(platform = process.platform) {
  if (platform === "darwin") {
    return "latest-mac.yml";
  }
  if (platform === "linux") {
    return "latest-linux.yml";
  }
  return "latest.yml";
}

function cleanYamlValue(value) {
  const trimmed = String(value || "").trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseElectronUpdaterYaml(text) {
  const result = { version: "", path: "", sha512: "", releaseDate: "", files: [] };
  let currentFile = null;
  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const line = rawLine.replace(/\t/g, "  ");
    const topMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (topMatch) {
      const [, key, value] = topMatch;
      if (key in result && key !== "files") {
        result[key] = cleanYamlValue(value);
      }
      currentFile = null;
      continue;
    }
    const fileStart = line.match(/^\s*-\s+url:\s*(.*)$/);
    if (fileStart) {
      currentFile = { url: cleanYamlValue(fileStart[1]), sha512: "", size: 0 };
      result.files.push(currentFile);
      continue;
    }
    const fileField = line.match(/^\s+([A-Za-z0-9_-]+):\s*(.*)$/);
    if (fileField && currentFile) {
      const [, key, value] = fileField;
      if (key === "sha512") {
        currentFile.sha512 = cleanYamlValue(value);
      } else if (key === "size") {
        currentFile.size = Number(cleanYamlValue(value));
      }
    }
  }
  return result;
}

function readJsonSafe(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function isPathInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function sha512FileBase64(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha512");
    const stream = createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("base64")));
  });
}

export async function validateDesktopUpdateFeed({ root = repoRoot, feedDir = path.join(root, "dist", "desktop"), platform = process.platform } = {}) {
  const errors = [];
  const packageJson = readJsonSafe(path.join(root, "package.json")) || {};
  const expectedVersion = packageJson.version || "";
  const metadataName = updateFeedMetadataName(platform);
  const resolvedFeedDir = path.resolve(feedDir);
  const metadataPath = path.join(resolvedFeedDir, metadataName);
  let metadata = { version: "", path: "", sha512: "", releaseDate: "", files: [] };
  if (!existsSync(resolvedFeedDir)) {
    errors.push("desktop update feed directory missing");
  }
  if (!existsSync(metadataPath)) {
    errors.push(`desktop update metadata missing: ${metadataName}`);
  } else {
    metadata = parseElectronUpdaterYaml(readFileSync(metadataPath, "utf8"));
  }

  if (metadata.version !== expectedVersion) {
    errors.push(`desktop update metadata version mismatch: expected ${expectedVersion || "package version"} got ${metadata.version || "missing"}`);
  }
  if (!metadata.path) {
    errors.push("desktop update metadata missing path");
  }
  if (!metadata.sha512) {
    errors.push("desktop update metadata missing sha512");
  }
  if (!metadata.releaseDate) {
    errors.push("desktop update metadata missing releaseDate");
  }
  if (!metadata.files.length) {
    errors.push("desktop update metadata missing files list");
  }

  const artifacts = [];
  for (const file of metadata.files) {
    const url = file.url || "";
    if (!url) {
      errors.push("desktop update file entry missing url");
      continue;
    }
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url) || path.isAbsolute(url) || url.includes("..")) {
      errors.push(`desktop update file entry must be a relative artifact path: ${url}`);
      continue;
    }
    const artifactPath = path.resolve(resolvedFeedDir, url);
    if (!isPathInside(resolvedFeedDir, artifactPath)) {
      errors.push(`desktop update artifact escapes feed directory: ${url}`);
      continue;
    }
    if (!existsSync(artifactPath)) {
      errors.push(`desktop update artifact missing: ${url}`);
      continue;
    }
    const bytes = statSync(artifactPath).size;
    const actualSha512 = await sha512FileBase64(artifactPath);
    if (!file.sha512) {
      errors.push(`desktop update artifact sha512 missing: ${url}`);
    } else if (file.sha512 !== actualSha512) {
      errors.push(`desktop update artifact sha512 mismatch: ${url}`);
    }
    if (!Number.isFinite(file.size) || file.size <= 0) {
      errors.push(`desktop update artifact size missing: ${url}`);
    } else if (file.size !== bytes) {
      errors.push(`desktop update artifact size mismatch: ${url}`);
    }
    artifacts.push({
      path: url,
      bytes,
      sha512Status: file.sha512 === actualSha512 ? "MATCH" : "MISMATCH",
      sizeStatus: file.size === bytes ? "MATCH" : "MISMATCH",
    });
  }

  if (metadata.path && !artifacts.some((artifact) => artifact.path === metadata.path)) {
    errors.push("desktop update metadata path is not present in files list");
  }

  return {
    valid: errors.length === 0,
    errors,
    platform,
    metadata: {
      file: metadataName,
      version: metadata.version,
      path: metadata.path,
      releaseDate: metadata.releaseDate,
      fileCount: metadata.files.length,
    },
    artifacts,
  };
}

export function buildDesktopUpdateFeedReport(validation, options = {}) {
  return {
    generatedAt: options.generatedAt || new Date().toISOString(),
    status: validation.valid ? "READY" : "BLOCKED",
    platform: validation.platform,
    metadata: validation.metadata,
    artifacts: validation.artifacts,
    errors: [...validation.errors],
    nextActions: validation.errors.length
      ? ["Rebuild signed desktop artifacts and upload the generated metadata and artifacts from the same build."]
      : ["Publish the metadata and artifacts together on the approved HTTPS generic update endpoint."],
    safetyNotes: [
      "This report stores artifact names, sizes, checksum match status, version, and release date only.",
      "It does not store the update server URL, signing certificate path, certificate hash, team ID, signing key ID, victim indicators, raw URLs, invite links, onion addresses, emails, or phone numbers.",
      "For generic electron-updater hosting, upload metadata and artifacts together; do not mix files from different builds.",
    ],
  };
}

export function formatDesktopUpdateFeedMarkdown(report) {
  const lines = [
    "# JiumAI Desktop Update Feed Report",
    "",
    `- Generated at: ${report.generatedAt}`,
    `- Status: ${report.status}`,
    `- Platform: ${report.platform}`,
    `- Metadata: ${report.metadata.file}`,
    `- Version: ${report.metadata.version || "MISSING"}`,
    `- Path: ${report.metadata.path || "MISSING"}`,
    `- Release date: ${report.metadata.releaseDate || "MISSING"}`,
    `- File count: ${report.metadata.fileCount}`,
    "",
    "## Artifacts",
    ...(report.artifacts.length
      ? report.artifacts.map((artifact) => `- ${artifact.path}: ${artifact.bytes} bytes, sha512 ${artifact.sha512Status}, size ${artifact.sizeStatus}`)
      : ["- None"]),
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
  const args = { format: "text", outputPath: "", feedDir: "", platform: process.platform };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") {
      args.format = "json";
    } else if (arg === "--markdown" || arg === "--md") {
      args.format = "markdown";
    } else if (arg === "--feed-dir") {
      args.feedDir = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--feed-dir=")) {
      args.feedDir = arg.slice("--feed-dir=".length);
    } else if (arg === "--platform") {
      args.platform = argv[index + 1] || args.platform;
      index += 1;
    } else if (arg === "--output") {
      args.outputPath = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--output=")) {
      args.outputPath = arg.slice("--output=".length);
    } else if (!arg.startsWith("-") && !args.feedDir) {
      args.feedDir = arg;
    }
  }
  return args;
}

function writeOutput(content, outputPath) {
  if (!outputPath) {
    console.log(content);
    return;
  }
  mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
  writeFileSync(outputPath, content, "utf8");
  console.log(`Desktop update feed report written: ${outputPath}`);
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || "")) {
  const args = parseCliArgs(process.argv.slice(2));
  try {
    const validation = await validateDesktopUpdateFeed({
      feedDir: args.feedDir ? path.resolve(args.feedDir) : undefined,
      platform: args.platform,
    });
    const report = buildDesktopUpdateFeedReport(validation);
    const content = args.format === "json" ? JSON.stringify(report, null, 2) : formatDesktopUpdateFeedMarkdown(report);
    writeOutput(content, args.outputPath);
    if (!validation.valid) {
      process.exit(1);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
