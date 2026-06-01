import { describe, expect, it } from "vitest";
import {
  compromisedDeviceRisks,
  deviceSafetyStatusLabel,
  deviceSafetyWarningText,
  evaluateDeviceSafety,
  safeDeviceChecklist,
} from "@/lib/deviceSafety";

describe("device safety guidance", () => {
  it("warns that compromised browsers can expose plaintext and passphrases", () => {
    expect(deviceSafetyWarningText()).toContain("평문");
    expect(deviceSafetyWarningText()).toContain("패스프레이즈");
    expect(compromisedDeviceRisks).toEqual(expect.arrayContaining(["악성 브라우저 확장프로그램", "원격제어 프로그램 또는 화면공유 세션"]));
  });

  it("recommends safer device checks before opening encrypted evidence", () => {
    expect(safeDeviceChecklist.join("\n")).toContain("새 프로필");
    expect(safeDeviceChecklist.join("\n")).toContain("암호화 보관함을 열지 말고");
  });

  it("classifies readiness from required and recommended checks", () => {
    const blocked = evaluateDeviceSafety([]);
    const review = evaluateDeviceSafety(["personal-device", "extensions-disabled"]);
    const ready = evaluateDeviceSafety(["personal-device", "extensions-disabled", "remote-access-closed", "attacker-no-access"]);

    expect(blocked.status).toBe("BLOCKED");
    expect(review.status).toBe("REVIEW");
    expect(ready.status).toBe("READY");
    expect(ready.missingRequired).toHaveLength(0);
    expect(deviceSafetyStatusLabel("READY")).toBe("진행 가능");
  });
});
