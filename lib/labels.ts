import type { CaseStatus, CaseType, DeletionChance, RiskLevel } from "@/lib/types";

export const CASE_TYPE_LABELS: Record<CaseType, string> = {
  PERSONAL_INFO_EXPOSURE: "개인정보 노출",
  SELF_POST_DELETE: "자기 게시물 삭제",
  SEARCH_RESULT_REMOVAL: "검색 노출 제거",
  ACCOUNT_DELETE: "계정 탈퇴",
  CREDENTIAL_LEAK: "계정정보 유출 의심",
  DIGITAL_SEX_CRIME: "디지털 성범죄/유포 피해",
  DEFAMATION_PRIVACY: "명예훼손/사생활 침해",
  IMPERSONATION: "사칭",
  UNKNOWN: "추가 확인 필요",
};

export const RISK_LABELS: Record<RiskLevel, string> = {
  LOW: "낮음",
  MEDIUM: "중간",
  HIGH: "높음",
  CRITICAL: "긴급",
};

export const DELETION_CHANCE_LABELS: Record<DeletionChance, string> = {
  HIGH: "가능성 높음",
  MEDIUM: "제한적 가능",
  LOW: "낮음",
  SPECIALIST_REQUIRED: "전문기관 우선",
  LEGAL_REVIEW_REQUIRED: "법률 검토 필요",
  NOT_SUPPORTED: "지원 범위 아님",
};

export const STATUS_LABELS: Record<CaseStatus, string> = {
  DRAFT: "작성 중",
  READY: "준비 완료",
  REQUESTED: "사용자가 요청 보냄",
  WAITING_RESPONSE: "답변 대기",
  NEEDS_MORE_INFO: "보완 요청",
  PLATFORM_RESPONDED: "기관/플랫폼 응답",
  USER_VERIFIED: "사용자 직접 확인",
  REAPPEARED: "재노출 의심",
  CLOSED: "종료",
};
