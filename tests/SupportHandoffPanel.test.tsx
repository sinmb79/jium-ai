import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SupportHandoffPanel } from "@/components/SupportHandoffPanel";
import { classifyCase } from "@/lib/classifier";
import { generateRequestDraft } from "@/lib/requestTemplates";
import { generateResponsePack } from "@/lib/responsePack";
import type { CaseInput, SavedCase } from "@/lib/types";

const input: CaseInput = {
  situation: "디지털 성범죄 피해",
  title: "지원자 전달 UI 테스트",
  description: "상담자에게 읽기전용 파일을 전달해야 합니다.",
  targetUrl: "https://example.com/support-ui",
  platform: "Example Forum",
  keywords: "alias",
  evidenceItems: [],
  exposedInfo: ["성적 이미지/영상 관련"],
  urgent: true,
  helperMode: "self",
};

function savedCase(): SavedCase {
  const classification = classifyCase(input);
  return {
    id: "case-support-ui",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    expiresAt: "2026-09-01T00:00:00.000Z",
    storageMode: "LOCAL_FIRST",
    input,
    redactedPreview: "",
    classification,
    draft: generateRequestDraft(input, classification),
    responsePack: generateResponsePack(input, classification),
    status: "READY",
    notes: [],
  };
}

describe("SupportHandoffPanel", () => {
  beforeEach(() => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:jium-support-handoff");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  });

  it("requires a long access code and exports an encrypted handoff file", async () => {
    render(<SupportHandoffPanel savedCase={savedCase()} />);

    expect(screen.getByText("지원자 읽기전용 전달")).toBeInTheDocument();
    expect(screen.getByText("전달 파일 저장")).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("상담자에게 별도 전달할 긴 문장"), {
      target: { value: "long support access code" },
    });
    fireEvent.change(screen.getByPlaceholderText("예: 전화로 공유한 문장"), {
      target: { value: "전화로 공유" },
    });
    fireEvent.click(screen.getByText("전달 파일 저장"));

    await waitFor(() => expect(screen.getByText(/암호화 전달 파일/)).toBeInTheDocument());
    expect(URL.createObjectURL).toHaveBeenCalled();
  });
});
