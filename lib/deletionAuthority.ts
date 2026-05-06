import type { CaseClassification, CaseInput, DeletionAuthorityAssessment, DeletionAuthorityContext } from "@/lib/types";

export const DELETION_AUTHORITY_LABELS: Record<DeletionAuthorityContext, string> = {
  OWN_ACCOUNT: "내 계정 또는 내가 올린 게시물",
  ADMIN_AUTHORITY: "내가 관리자인 페이지",
  AUTHORIZED_REPRESENTATIVE: "피해자의 동의를 받은 대리인",
  SUBJECT_ONLY: "사진 속 당사자이지만 게시자는 아님",
  UNCLEAR: "권한이 불명확함",
};

const OWNED_ALLOWED_ACTIONS = [
  "삭제 전 URL, 게시 위치, 발견 일시를 먼저 기록",
  "본인 계정 또는 관리자 화면에서 직접 삭제",
  "삭제 후 같은 URL과 검색어로 사용자 직접 확인",
];

const REQUEST_ALLOWED_ACTIONS = [
  "플랫폼 관리자에게 삭제 또는 비공개 요청",
  "검색엔진 캐시·스니펫 제거 요청",
  "무응답, 거절, 재노출 시 공식기관 상담으로 격상",
];

const BASE_BLOCKED_ACTIONS = [
  "타인 계정에 로그인하거나 비밀번호를 추측하는 행위",
  "자동 클릭, 자동 신고, 무단 크롤링, 우회 접속",
  "삭제 권한이 확인되지 않은 게시물의 직접 삭제 실행",
];

export function evaluateDeletionAuthority(input: CaseInput, classification: CaseClassification): DeletionAuthorityAssessment {
  const context = input.deletionAuthority || "UNCLEAR";
  const contextLabel = DELETION_AUTHORITY_LABELS[context];

  if (classification.caseType === "DIGITAL_SEX_CRIME") {
    return {
      title: "삭제 권한 판정",
      context,
      contextLabel,
      decision: "SPECIALIST_FIRST",
      directDeletionAllowed: false,
      summary: "성적 이미지·영상·딥페이크·유포협박 사건은 게시물 소유권보다 피해 확산 방지가 먼저입니다. 직접 삭제 실행보다 전문기관 삭제지원과 심의·수사 경로를 우선합니다.",
      allowedActions: ["접근경로 증거목록 정리", "중앙디지털성범죄피해자지원센터 또는 1366 상담", "상담기관 안내에 따른 플랫폼 삭제지원·접속차단 요청"],
      blockedActions: [...BASE_BLOCKED_ACTIONS, "피해물 원본 다운로드·재생·재전송", "가해자와 직접 협상하거나 송금"],
      verificationQuestions: ["신변 위협이나 유포 협박이 진행 중인가?", "미성년자 피해 또는 미성년자 시기 촬영물인가?", "전문기관에 제출할 URL·게시 위치·발견 일시를 기록했는가?"],
      warning: "피해자가 원해도 앱이 직접 삭제를 실행하지 않습니다. 피해물 원본을 다시 다루는 순간 2차 피해가 커질 수 있습니다.",
    };
  }

  if (classification.caseType === "DEFAMATION_PRIVACY" && context !== "OWN_ACCOUNT" && context !== "ADMIN_AUTHORITY") {
    return {
      title: "삭제 권한 판정",
      context,
      contextLabel,
      decision: "LEGAL_REVIEW_REQUIRED",
      directDeletionAllowed: false,
      summary: "명예훼손·사생활 침해 주장은 표현의 자유, 공익성, 사실관계와 충돌할 수 있어 직접 삭제 실행 대상이 아닙니다. 법률 검토와 플랫폼 정책 절차가 먼저입니다.",
      allowedActions: ["문제 표현과 사실관계 분리", "플랫폼 신고 또는 권리침해 신고", "법률구조기관 또는 변호사 상담 준비"],
      blockedActions: [...BASE_BLOCKED_ACTIONS, "비판글·리뷰·공익 제보를 권한 없이 삭제하려는 시도", "상대방 신상 공개나 보복 게시"],
      verificationQuestions: ["해당 글이 소비자 리뷰, 공익 제보, 언론 보도에 해당할 가능성이 있는가?", "문제 표현과 사실이 다른 부분을 분리했는가?", "법률상담 전 삭제 가능성을 단정하지 않았는가?"],
      warning: "지움AI는 비판이나 공익 기록을 지우는 평판관리 도구가 아닙니다.",
    };
  }

  if (context === "OWN_ACCOUNT" || context === "ADMIN_AUTHORITY") {
    return {
      title: "삭제 권한 판정",
      context,
      contextLabel,
      decision: "DIRECT_DELETE_ALLOWED",
      directDeletionAllowed: true,
      summary: "본인 계정 또는 관리자 권한이 확인된 경우에만 직접 삭제 실행이 가능한 상태로 봅니다. 그래도 삭제 전 증거 보존과 삭제 후 사용자 확인은 분리해야 합니다.",
      allowedActions: OWNED_ALLOWED_ACTIONS,
      blockedActions: BASE_BLOCKED_ACTIONS,
      verificationQuestions: ["현재 로그인한 계정이 게시물 작성자 또는 관리자 계정인가?", "플랫폼 화면이나 API가 삭제 권한을 실제로 보여주는가?", "삭제 전 URL과 발견 일시를 기록했는가?"],
    };
  }

  if (context === "AUTHORIZED_REPRESENTATIVE") {
    return {
      title: "삭제 권한 판정",
      context,
      contextLabel,
      decision: "REQUEST_ONLY",
      directDeletionAllowed: false,
      summary: "대리인은 피해자 동의와 관계 증빙으로 삭제 요청을 도울 수 있지만, 플랫폼 권한이 확인되지 않으면 직접 삭제 실행은 허용하지 않습니다.",
      allowedActions: ["피해자 동의 범위 확인", "위임 또는 관계 증빙 자료를 별도 안전 채널로 준비", ...REQUEST_ALLOWED_ACTIONS],
      blockedActions: [...BASE_BLOCKED_ACTIONS, "피해자 동의 없이 가족·학교·직장·SNS에 공유"],
      verificationQuestions: ["피해자가 요청 범위에 동의했는가?", "대리 권한을 소명할 자료가 있는가?", "피해자의 의사와 다른 삭제·공유를 하지 않는가?"],
      warning: "대리 지원은 피해자의 통제권을 대신 빼앗는 방식이 되면 안 됩니다.",
    };
  }

  if (context === "SUBJECT_ONLY") {
    return {
      title: "삭제 권한 판정",
      context,
      contextLabel,
      decision: "REQUEST_ONLY",
      directDeletionAllowed: false,
      summary: "사진 속 인물 또는 개인정보 주체라는 사실만으로 해당 페이지를 직접 삭제할 권한이 생기지는 않습니다. 이 경우 안전한 경로는 삭제 요청과 공식기관 격상입니다.",
      allowedActions: REQUEST_ALLOWED_ACTIONS,
      blockedActions: BASE_BLOCKED_ACTIONS,
      verificationQuestions: ["내가 게시물 작성자나 관리자 계정에 접근할 권한이 있는가?", "플랫폼 신고 또는 권리침해 요청 경로가 있는가?", "삭제 요청 전 URL과 발견 일시를 기록했는가?"],
      warning: "내 사진이라는 주장과 삭제 실행 권한은 다릅니다.",
    };
  }

  return {
    title: "삭제 권한 판정",
    context,
    contextLabel,
    decision: "REQUEST_ONLY",
    directDeletionAllowed: false,
    summary: "삭제 권한이 확인되지 않았습니다. 지움AI는 이 상태에서 직접 삭제 실행을 허용하지 않고, 요청서 생성과 공식기관 연결만 제공합니다.",
    allowedActions: REQUEST_ALLOWED_ACTIONS,
    blockedActions: BASE_BLOCKED_ACTIONS,
    verificationQuestions: ["게시물 작성자 또는 관리자 권한을 확인할 수 있는가?", "피해자는 사진 속 당사자인가, 게시물 소유자인가?", "권한 확인 전 직접 삭제를 시도하지 않았는가?"],
    warning: "권한 불명확 상태에서 직접 삭제를 열면 타인의 게시물·리뷰·증거 삭제로 악용될 수 있습니다.",
  };
}
