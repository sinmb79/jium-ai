import { describe, expect, it } from "vitest";
import { buildSubmissionConnectorActions, connectorActionsToMarkdown } from "@/lib/submissionConnectors";
import type { SubmissionPacket } from "@/lib/submissionPacket";

const packet = {
  agencyTargets: [
    {
      id: "d4u",
      name: "중앙디지털성범죄피해자지원센터",
      kind: "OFFICIAL",
      cost: "무료",
      url: "https://d4u.stop.or.kr/main",
      phone: "02-735-8994",
      useWhen: "디지털 성범죄 피해 상담이 필요할 때",
      handoffMode: "상담 먼저 연결",
      prepItems: ["URL", "발견 일시"],
      privacyNote: "피해물 원본을 업로드하지 않음",
    },
  ],
} as SubmissionPacket;

describe("submission connectors", () => {
  it("keeps agency handoff as user-confirmed external actions", () => {
    const actions = buildSubmissionConnectorActions(packet);
    const markdown = connectorActionsToMarkdown(actions);

    expect(actions[0]?.mode).toBe("PHONE_OR_COUNSELING");
    expect(actions[0]?.authorityBoundary).toContain("자동 제출하지 않습니다");
    expect(markdown).toContain("중앙디지털성범죄피해자지원센터");
  });
});
