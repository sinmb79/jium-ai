import { describe, expect, it } from "vitest";
import { createStoredZip, crc32 } from "@/lib/zip";

function ascii(bytes: Uint8Array) {
  return new TextDecoder().decode(bytes);
}

describe("zip writer", () => {
  it("creates a stored zip with local and central directory records", () => {
    const zip = createStoredZip(
      [
        { name: "hello.txt", content: "hello" },
        { name: "folder/checklist.txt", content: "check" },
      ],
      new Date("2026-05-31T00:00:00.000Z"),
    );

    expect(zip[0]).toBe(0x50);
    expect(zip[1]).toBe(0x4b);
    expect(zip[2]).toBe(0x03);
    expect(zip[3]).toBe(0x04);
    expect(ascii(zip)).toContain("hello.txt");
    expect(ascii(zip)).toContain("folder/checklist.txt");
    expect(zip.at(-22)).toBe(0x50);
    expect(zip.at(-21)).toBe(0x4b);
    expect(zip.at(-20)).toBe(0x05);
    expect(zip.at(-19)).toBe(0x06);
  });

  it("calculates known CRC-32 values", () => {
    expect(crc32(new TextEncoder().encode("hello")).toString(16)).toBe("3610a686");
  });
});
