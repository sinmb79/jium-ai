import { buildEvidenceChainManifest, buildSubmissionChecklist } from "@/lib/submissionPackage";
import { encryptJsonWithPassphrase, decryptJsonWithPassphrase, isEncryptedJsonPayload, type EncryptedJsonPayload } from "@/lib/localCrypto";
import { buildReadOnlyPacketHtml, buildReadOnlyPacketMarkdown } from "@/lib/readOnlyPacket";
import { buildSubmissionPacket } from "@/lib/submissionPacket";
import type { SavedCase } from "@/lib/types";

export type SupportHandoffRole = "SUPPORTER" | "COUNSELOR" | "INVESTIGATOR";

export type SupportHandoffPayload = {
  version: 1;
  kind: "JIUM_SUPPORT_HANDOFF_PAYLOAD";
  generatedAt: string;
  expiresAt: string;
  recipientRole: SupportHandoffRole;
  caseId: string;
  caseStatus: string;
  readOnlyMarkdown: string;
  readOnlyHtml: string;
  evidenceChainManifest: ReturnType<typeof buildEvidenceChainManifest>;
  submissionChecklist: string;
  allowedActions: string[];
  prohibitedActions: string[];
};

export type SupportHandoffArchive = {
  version: 1;
  kind: "JIUM_SUPPORT_HANDOFF_ARCHIVE";
  generatedAt: string;
  expiresAt: string;
  recipientRole: SupportHandoffRole;
  caseId: string;
  manifestFingerprint: string;
  accessCodeHint?: string;
  encrypted: EncryptedJsonPayload;
  warning: string;
  safetyBoundaries: string[];
};

export const SUPPORT_HANDOFF_WARNING =
  "암호화된 지움AI 지원자 전달 파일입니다. 접근 코드는 파일과 다른 안전한 채널로 공유하고, 피해물 원본·신분증 원본·비밀번호는 포함하지 마세요.";

export const SUPPORT_HANDOFF_BOUNDARIES = [
  "읽기 전용 검토와 상담 준비를 위한 파일입니다.",
  "수정 기능, 자동 제출, 외부 사이트 자동 접속 기능이 없습니다.",
  "피해물 원본 파일, 신분증 원본, 비밀번호를 포함하지 않습니다.",
  "폐쇄형 방 입장, 구매, 잠입, IP 역추적은 피해자·지원자 직접 수행 대상이 아닙니다.",
  "만료 시각이 지나면 새 파일과 새 접근 코드를 만들어야 합니다.",
];

const ROLE_LABELS: Record<SupportHandoffRole, string> = {
  SUPPORTER: "피해자 지원자",
  COUNSELOR: "상담자",
  INVESTIGATOR: "수사·심의 담당자",
};

function clampValidHours(hours?: number) {
  if (!Number.isFinite(hours || Number.NaN)) {
    return 72;
  }
  return Math.min(Math.max(Math.floor(hours || 72), 1), 24 * 14);
}

export function buildSupportHandoffPayload(
  savedCase: SavedCase,
  options: { recipientRole?: SupportHandoffRole; generatedAt?: string; expiresAt?: string; validHours?: number } = {},
): SupportHandoffPayload {
  const generatedAt = options.generatedAt || new Date().toISOString();
  const expiresAt = options.expiresAt || new Date(Date.parse(generatedAt) + clampValidHours(options.validHours) * 60 * 60 * 1000).toISOString();
  const recipientRole = options.recipientRole || "COUNSELOR";
  const packet = buildSubmissionPacket(savedCase.input, savedCase.classification, savedCase.responsePack, generatedAt);

  return {
    version: 1,
    kind: "JIUM_SUPPORT_HANDOFF_PAYLOAD",
    generatedAt,
    expiresAt,
    recipientRole,
    caseId: savedCase.id,
    caseStatus: savedCase.status,
    readOnlyMarkdown: buildReadOnlyPacketMarkdown(savedCase),
    readOnlyHtml: buildReadOnlyPacketHtml(savedCase),
    evidenceChainManifest: buildEvidenceChainManifest(savedCase, packet),
    submissionChecklist: buildSubmissionChecklist(savedCase, packet),
    allowedActions: [
      "피해자가 정리한 사실관계와 증거목록 검토",
      "상담·신고 전 보강 항목 확인",
      "공식기관 제출 전 안전 경계 확인",
      "필요 시 피해자에게 추가 확인 질문 정리",
    ],
    prohibitedActions: [
      "파일 내용을 수정해 원본처럼 제출",
      "피해물 원본 재전송 또는 다운로드 요구",
      "폐쇄형 방 입장·구매·잠입",
      "IP·가입자·결제 정보를 직접 추적하거나 신원 단정",
      "피해자 확인 없이 기관 또는 플랫폼에 자동 제출",
    ],
  };
}

export async function buildSupportHandoffArchive(
  savedCase: SavedCase,
  accessCode: string,
  options: { recipientRole?: SupportHandoffRole; generatedAt?: string; expiresAt?: string; validHours?: number; accessCodeHint?: string } = {},
): Promise<SupportHandoffArchive> {
  const payload = buildSupportHandoffPayload(savedCase, options);
  return {
    version: 1,
    kind: "JIUM_SUPPORT_HANDOFF_ARCHIVE",
    generatedAt: payload.generatedAt,
    expiresAt: payload.expiresAt,
    recipientRole: payload.recipientRole,
    caseId: savedCase.id,
    manifestFingerprint: payload.evidenceChainManifest.chain.manifestFingerprint,
    accessCodeHint: options.accessCodeHint,
    encrypted: await encryptJsonWithPassphrase(payload, accessCode),
    warning: SUPPORT_HANDOFF_WARNING,
    safetyBoundaries: SUPPORT_HANDOFF_BOUNDARIES,
  };
}

export function serializeSupportHandoffArchive(archive: SupportHandoffArchive) {
  return JSON.stringify(archive, null, 2);
}

export function parseSupportHandoffArchive(text: string): SupportHandoffArchive {
  const parsed = JSON.parse(text) as Partial<SupportHandoffArchive>;
  if (parsed.version !== 1 || parsed.kind !== "JIUM_SUPPORT_HANDOFF_ARCHIVE" || !parsed.encrypted || !isEncryptedJsonPayload(parsed.encrypted)) {
    throw new Error("Unsupported Jium support handoff archive");
  }

  return {
    version: 1,
    kind: "JIUM_SUPPORT_HANDOFF_ARCHIVE",
    generatedAt: parsed.generatedAt || new Date(0).toISOString(),
    expiresAt: parsed.expiresAt || new Date(0).toISOString(),
    recipientRole: parsed.recipientRole || "COUNSELOR",
    caseId: parsed.caseId || "unknown-case",
    manifestFingerprint: parsed.manifestFingerprint || "JIUM-CHAIN-UNKNOWN",
    accessCodeHint: parsed.accessCodeHint,
    encrypted: parsed.encrypted,
    warning: parsed.warning || SUPPORT_HANDOFF_WARNING,
    safetyBoundaries: parsed.safetyBoundaries || SUPPORT_HANDOFF_BOUNDARIES,
  };
}

export async function decryptSupportHandoffArchive(text: string, accessCode: string, now = Date.now()) {
  const archive = parseSupportHandoffArchive(text);
  const expiresAt = Date.parse(archive.expiresAt);
  if (Number.isFinite(expiresAt) && expiresAt <= now) {
    throw new Error("Support handoff archive is expired");
  }
  return decryptJsonWithPassphrase<SupportHandoffPayload>(archive.encrypted, accessCode);
}

export function formatSupportHandoffInstruction(archive: SupportHandoffArchive) {
  return [
    "# 지움AI 지원자 전달 파일 안내",
    "",
    `사건 ID: ${archive.caseId}`,
    `수신 역할: ${ROLE_LABELS[archive.recipientRole]}`,
    `생성 시각: ${archive.generatedAt}`,
    `만료 시각: ${archive.expiresAt}`,
    `체인 지문: ${archive.manifestFingerprint}`,
    archive.accessCodeHint ? `접근 코드 힌트: ${archive.accessCodeHint}` : "접근 코드 힌트: 별도 안전 채널로 공유",
    "",
    "## 전달 방법",
    "- `.jiumhandoff.json` 파일과 접근 코드를 서로 다른 채널로 전달합니다.",
    "- 접근 코드는 12자 이상이어야 하며, 메신저 단일 대화방에 파일과 함께 남기지 않습니다.",
    "- 수신자는 만료 시각 전까지 읽기 전용 검토만 수행합니다.",
    "",
    "## 안전 경계",
    ...archive.safetyBoundaries.map((item) => `- ${item}`),
    "",
  ].join("\n");
}

