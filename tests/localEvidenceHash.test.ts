import { describe, expect, it } from "vitest";
import { averageHashFromGrayValues, bytesToHex, formatFileSize } from "@/lib/localEvidenceHash";

describe("local evidence hash helpers", () => {
  it("formats bytes and hex deterministically", () => {
    expect(bytesToHex(new Uint8Array([0, 15, 255]))).toBe("000fff");
    expect(formatFileSize(1536)).toBe("1.5 KB");
  });

  it("creates a stable perceptual average hash from 64 gray values", () => {
    const values = Array.from({ length: 64 }, (_, index) => (index < 32 ? 10 : 240));

    expect(averageHashFromGrayValues(values)).toBe("ahash-00000000ffffffff");
  });
});
