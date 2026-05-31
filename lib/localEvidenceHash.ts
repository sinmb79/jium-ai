export type LocalEvidenceHashResult = {
  sha256: string;
  visualFingerprint?: string;
  fileName: string;
  fileSize: number;
  fileMimeType: string;
  fileLastModified: string;
  hashSource: string;
};

export function bytesToHex(bytes: ArrayBuffer | Uint8Array) {
  const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(array)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "unknown size";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function averageHashFromGrayValues(grayValues: number[]) {
  if (grayValues.length !== 64) {
    throw new Error("averageHashFromGrayValues expects 64 values");
  }
  const average = grayValues.reduce((sum, value) => sum + value, 0) / grayValues.length;
  let bits = "";
  grayValues.forEach((value) => {
    bits += value >= average ? "1" : "0";
  });

  let hex = "";
  for (let index = 0; index < bits.length; index += 4) {
    hex += Number.parseInt(bits.slice(index, index + 4), 2).toString(16);
  }
  return `ahash-${hex}`;
}

async function sha256File(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return `sha256-${bytesToHex(digest)}`;
}

async function visualFingerprintForImage(file: File) {
  if (!file.type.startsWith("image/")) {
    return undefined;
  }

  const image = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = 8;
  canvas.height = 8;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    image.close();
    return undefined;
  }
  context.drawImage(image, 0, 0, 8, 8);
  image.close();

  const data = context.getImageData(0, 0, 8, 8).data;
  const grayValues: number[] = [];
  for (let index = 0; index < data.length; index += 4) {
    grayValues.push(data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114);
  }
  return averageHashFromGrayValues(grayValues);
}

export async function hashLocalEvidenceFile(file: File): Promise<LocalEvidenceHashResult> {
  const sha256 = await sha256File(file);
  const visualFingerprint = await visualFingerprintForImage(file);
  const fileLastModified = new Date(file.lastModified).toISOString();
  const fileMimeType = file.type || "application/octet-stream";

  return {
    sha256,
    visualFingerprint,
    fileName: file.name,
    fileSize: file.size,
    fileMimeType,
    fileLastModified,
    hashSource: `로컬 브라우저 산출 · ${file.name} · ${formatFileSize(file.size)} · 파일 원본은 저장하지 않음`,
  };
}
