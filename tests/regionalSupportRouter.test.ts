import { describe, expect, it } from "vitest";
import {
  buildRegionalSupportRoute,
  formatRegionalSupportRoute,
  getRegionalSupportCenter,
  normalizeSupportRegion,
  REGIONAL_SUPPORT_CENTERS,
} from "@/lib/regionalSupportRouter";

describe("regional support router", () => {
  it("routes Korean region aliases to official regional support center candidates", () => {
    expect(normalizeSupportRegion("서울특별시")).toBe("SEOUL");
    expect(normalizeSupportRegion("부산")).toBe("BUSAN");
    expect(getRegionalSupportCenter("경기")?.centerName).toContain("경기디지털성범죄피해자지원센터");
    expect(REGIONAL_SUPPORT_CENTERS.length).toBeGreaterThanOrEqual(17);
  });

  it("builds an urgent digital sex crime route with central and regional handoff order", () => {
    const route = buildRegionalSupportRoute({ caseType: "DIGITAL_SEX_CRIME", regionText: "서울", urgent: true });

    expect(route.primaryCenter?.centerName).toContain("서울디지털성범죄피해자지원센터");
    expect(route.centralRoutes.map((item) => item.phone)).toEqual(expect.arrayContaining(["1366", "02-735-8994"]));
    expect(route.recommendedOrder.join(" ")).toContain("112 또는 1366");
    expect(route.safetyBoundary.join(" ")).toContain("자동 제출하지 않습니다");
  });

  it("falls back to central routes when region is unknown and keeps raw case details out of the memo", () => {
    const route = buildRegionalSupportRoute({ caseType: "PERSONAL_INFO_EXPOSURE", regionText: "미상" });
    const markdown = formatRegionalSupportRoute(route);

    expect(route.primaryCenter).toBeUndefined();
    expect(markdown).toContain("중앙디지털성범죄피해자지원센터");
    expect(markdown).toContain("온라인피해365센터");
    expect(markdown).not.toContain("example.com");
    expect(markdown).not.toContain("010-");
  });
});
