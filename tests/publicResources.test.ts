import { describe, expect, it } from "vitest";
import { getResourcesForCase } from "@/lib/publicResources";

describe("getResourcesForCase", () => {
  it("디지털성범죄 사건은 공식기관을 먼저 배치한다", () => {
    const resources = getResourcesForCase("DIGITAL_SEX_CRIME");
    expect(resources[0]?.kind).toBe("OFFICIAL");
    expect(resources.map((resource) => resource.id)).toEqual(expect.arrayContaining(["d4u", "ecrm", "kcsc", "legal-aid"]));
  });

  it("개인정보 침해 사건은 KISA와 온라인피해365센터를 포함한다", () => {
    const resources = getResourcesForCase("PERSONAL_INFO_EXPOSURE");
    expect(resources.map((resource) => resource.id)).toEqual(expect.arrayContaining(["privacy-kisa", "online365"]));
  });

  it("민간 법률 플랫폼은 유료 가능 선택지로만 표시한다", () => {
    const resources = getResourcesForCase("DEFAMATION_PRIVACY");
    const privateLegal = resources.filter((resource) => resource.kind === "PRIVATE_LEGAL");
    expect(privateLegal.length).toBeGreaterThan(0);
    expect(privateLegal.every((resource) => resource.cost === "유료 가능")).toBe(true);
  });
});
