import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { clearCases } from "@/lib/caseStorage";
import { clearEncryptedVault } from "@/lib/encryptedCaseStorage";
import { CaseBoard } from "@/components/CaseBoard";

describe("CaseBoard", () => {
  beforeEach(() => {
    clearCases();
    clearEncryptedVault();
  });

  it("keeps encrypted vault import/export available even when the normal board is empty", () => {
    render(<CaseBoard />);

    expect(screen.getByText("아직 저장한 사건이 없습니다.")).toBeInTheDocument();
    expect(screen.getByText("암호화 보관함")).toBeInTheDocument();
    expect(screen.getByText(".jiumcase 가져오기")).toBeInTheDocument();
    expect(screen.getByText("제한 지능 피드")).toBeInTheDocument();
    expect(screen.getByText("제한 피드 가져오기")).toBeDisabled();
  });
});
