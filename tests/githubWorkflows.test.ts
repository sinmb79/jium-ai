import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("GitHub Actions security gates", () => {
  it("runs security checks before GitHub Pages deploy build", () => {
    const workflow = readFileSync(".github/workflows/deploy-pages.yml", "utf8");
    const secretIndex = workflow.indexOf("npm run security:secrets");
    const auditIndex = workflow.indexOf("npm run security:audit");
    const typecheckIndex = workflow.indexOf("npm run typecheck");
    const buildIndex = workflow.indexOf("npm run build");

    expect(secretIndex).toBeGreaterThan(0);
    expect(auditIndex).toBeGreaterThan(secretIndex);
    expect(typecheckIndex).toBeGreaterThan(auditIndex);
    expect(buildIndex).toBeGreaterThan(typecheckIndex);
    expect(workflow).toContain("enablement: true");
  });

  it("has a pull request quality gate with the same security checks", () => {
    const workflow = readFileSync(".github/workflows/quality-gate.yml", "utf8");

    expect(workflow).toContain("pull_request:");
    expect(workflow).toContain("npm run security:secrets");
    expect(workflow).toContain("npm run security:audit");
    expect(workflow).toContain("npm run typecheck");
    expect(workflow).toContain("npm test");
    expect(workflow).toContain("npm run build");
  });
});
