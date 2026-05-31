import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EncryptedVaultPanel } from "@/components/EncryptedVaultPanel";
import { classifyCase } from "@/lib/classifier";
import { clearEncryptedVault } from "@/lib/encryptedCaseStorage";
import { generateRequestDraft } from "@/lib/requestTemplates";
import { generateResponsePack } from "@/lib/responsePack";
import type { CaseInput, SavedCase } from "@/lib/types";

const input: CaseInput = {
  situation: "개인정보가 노출됐어요",
  title: "암호화 잠금 테스트",
  description: "공개 게시글에 개인정보가 노출됐습니다.",
  targetUrl: "https://example.com/private/vault",
  platform: "Example",
  keywords: "alias",
  evidenceItems: [],
  exposedInfo: ["이메일"],
  urgent: false,
  helperMode: "self",
};

function savedCase(): SavedCase {
  const classification = classifyCase(input);
  return {
    id: "case-vault-lock",
    createdAt: "2026-05-31T00:00:00.000Z",
    updatedAt: "2026-05-31T00:00:00.000Z",
    expiresAt: "2026-08-31T00:00:00.000Z",
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

describe("EncryptedVaultPanel", () => {
  beforeEach(() => {
    clearEncryptedVault();
    vi.useRealTimers();
  });

  it("clears decrypted cases and passphrase when the user locks the vault", async () => {
    render(<EncryptedVaultPanel currentCase={savedCase()} />);

    fireEvent.click(screen.getByLabelText("이 기기의 확장프로그램·원격제어·악성코드 위험을 확인했습니다"));
    fireEvent.change(screen.getByPlaceholderText("기관 제출 전까지 기억할 긴 문장"), { target: { value: "long passphrase for vault" } });
    fireEvent.click(screen.getByText("암호화 보관"));

    expect(await screen.findByText("암호화 잠금 테스트")).toBeInTheDocument();
    expect(screen.getByText(/열림 · 자동 잠금까지/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("지금 잠금"));

    await waitFor(() => expect(screen.queryByText("암호화 잠금 테스트")).not.toBeInTheDocument());
    expect(screen.getByText("잠김 · 복호화 목록 없음")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("기관 제출 전까지 기억할 긴 문장")).toHaveValue("");
  });
});
