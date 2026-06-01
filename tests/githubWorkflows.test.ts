import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("GitHub Actions security gates", () => {
  it("runs security checks before GitHub Pages deploy build", () => {
    const workflow = readFileSync(".github/workflows/deploy-pages.yml", "utf8");
    const headersIndex = workflow.indexOf("npm run security:headers");
    const xssIndex = workflow.indexOf("npm run security:xss");
    const authIndex = workflow.indexOf("npm run security:auth");
    const feedsIndex = workflow.indexOf("npm run security:feeds");
    const deploymentIndex = workflow.indexOf("npm run security:deployment");
    const secretIndex = workflow.indexOf("npm run security:secrets");
    const auditIndex = workflow.indexOf("npm run security:audit");
    const typecheckIndex = workflow.indexOf("npm run typecheck");
    const buildIndex = workflow.indexOf("npm run build");

    expect(headersIndex).toBeGreaterThan(0);
    expect(xssIndex).toBeGreaterThan(headersIndex);
    expect(authIndex).toBeGreaterThan(xssIndex);
    expect(feedsIndex).toBeGreaterThan(authIndex);
    expect(deploymentIndex).toBeGreaterThan(feedsIndex);
    expect(secretIndex).toBeGreaterThan(deploymentIndex);
    expect(auditIndex).toBeGreaterThan(secretIndex);
    expect(typecheckIndex).toBeGreaterThan(auditIndex);
    expect(buildIndex).toBeGreaterThan(typecheckIndex);
    expect(workflow).toContain("enablement: true");
    expect(workflow).toContain("uses: actions/checkout@v6");
    expect(workflow).toContain("uses: actions/setup-node@v6");
    expect(workflow).toContain("uses: actions/configure-pages@v6");
    expect(workflow).toContain("uses: actions/upload-pages-artifact@v5");
    expect(workflow).toContain("uses: actions/deploy-pages@v5");
    expect(workflow).toContain("GITHUB_PAGES: \"true\"");
    expect(workflow).not.toContain("FORCE_JAVASCRIPT_ACTIONS_TO_NODE24");
  });

  it("has a pull request quality gate with the same security checks", () => {
    const workflow = readFileSync(".github/workflows/quality-gate.yml", "utf8");

    expect(workflow).toContain("pull_request:");
    expect(workflow).toContain("npm run security:headers");
    expect(workflow).toContain("npm run security:xss");
    expect(workflow).toContain("npm run security:auth");
    expect(workflow).toContain("npm run security:feeds");
    expect(workflow).toContain("npm run security:deployment");
    expect(workflow).toContain("npm run security:secrets");
    expect(workflow).toContain("npm run security:audit");
    expect(workflow).toContain("npm run typecheck");
    expect(workflow).toContain("npm test");
    expect(workflow).toContain("npm run build");
    expect(workflow).toContain("uses: actions/checkout@v6");
    expect(workflow).toContain("uses: actions/setup-node@v6");
    expect(workflow).not.toContain("FORCE_JAVASCRIPT_ACTIONS_TO_NODE24");
  });

  it("has a manual desktop release candidate workflow with evidence artifacts", () => {
    const workflow = readFileSync(".github/workflows/desktop-release-candidate.yml", "utf8");

    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("release_channel:");
    expect(workflow).toContain("update_url:");
    expect(workflow).toContain("runs-on: windows-latest");
    expect(workflow).toContain("uses: actions/checkout@v6");
    expect(workflow).toContain("uses: actions/setup-node@v6");
    expect(workflow).toContain("node-version: 24");
    expect(workflow).toContain("npm run security:secrets");
    expect(workflow).toContain("npm run typecheck");
    expect(workflow).toContain("tests/desktopReleaseBundle.test.ts");
    expect(workflow).toContain("npm run desktop:package:dir");
    expect(workflow).toContain("npm run desktop:release:bundle");
    expect(workflow).toContain("uses: actions/upload-artifact@v7");
    expect(workflow).toContain("dist/desktop-release-bundle");
    expect(workflow).toContain("dist/desktop/win-unpacked");
    expect(workflow).not.toContain("WINDOWS_SIGNING_CERT_PATH");
    expect(workflow).not.toContain("WINDOWS_SIGNING_CERT_PASSWORD");
  });

  it("has a manual signed desktop release workflow guarded by signing preflight", () => {
    const workflow = readFileSync(".github/workflows/desktop-signed-release.yml", "utf8");

    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("release_tag:");
    expect(workflow).toContain("default: v0.3.100");
    expect(workflow).toContain("publish_to_github_release:");
    expect(workflow).toContain("publish_approval:");
    expect(workflow).toContain("runs-on: windows-latest");
    expect(workflow).toContain("JIUM_DESKTOP_RELEASE_CHANNEL: ${{ inputs.release_channel }}");
    expect(workflow).toContain("JIUM_DESKTOP_UPDATE_URL: ${{ inputs.update_url }}");
    expect(workflow).toContain("JIUM_DESKTOP_RELEASE_TAG: ${{ inputs.release_tag }}");
    expect(workflow).toContain("JIUM_DESKTOP_PUBLISH_APPROVAL: ${{ inputs.publish_approval }}");
    expect(workflow).toContain("CSC_LINK: ${{ secrets.JIUM_WINDOWS_CSC_LINK }}");
    expect(workflow).toContain("CSC_KEY_PASSWORD: ${{ secrets.JIUM_WINDOWS_CSC_KEY_PASSWORD }}");
    expect(workflow).toContain("npm run desktop:signing-secrets:check");
    expect(workflow).toContain("npm run desktop:release:check");
    expect(workflow).toContain("npm run desktop:package:signed");
    expect(workflow).toContain("npm run desktop:update-feed:check -- --feed-dir ./dist/desktop");
    expect(workflow).toContain("npm run desktop:release:bundle");
    expect(workflow).toContain("npm run desktop:release:digest-evidence -- --feed-dir ./dist/desktop");
    expect(workflow).toContain("npm run desktop:publish:candidate -- --feed-dir ./dist/desktop");
    expect(workflow).toContain("uses: actions/upload-artifact@v7");
    expect(workflow).toContain("uses: actions/download-artifact@v7");
    expect(workflow).toContain("contents: write");
    expect(workflow).toContain("npm run desktop:publish:check -- --feed-dir ./dist/desktop");
    expect(workflow).toContain("gh release view \"$JIUM_DESKTOP_RELEASE_TAG\"");
    expect(workflow).toContain("gh release upload \"$JIUM_DESKTOP_RELEASE_TAG\"");
    expect(workflow).toContain("dist/desktop/latest.yml");
    expect(workflow).toContain("dist/desktop-release-bundle");
    expect(workflow).toContain("dist/desktop-release-evidence-digests");
    expect(workflow).toContain("dist/desktop-publish-candidate");
    expect(workflow).toContain("path: dist");
    expect(workflow).toContain("desktop-release-bundle desktop-release-evidence-digests desktop-publish-candidate");
    expect(workflow).not.toContain("JIUM_WINDOWS_CSC_KEY_PASSWORD=");
    expect(workflow).not.toContain("WINDOWS_SIGNING_CERT_PASSWORD");
  });
});
