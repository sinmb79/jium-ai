import type { CaseClassification, CaseInput, CaseType, DeletionChance, RiskLevel, SensitivityLevel } from "@/lib/types";

type Rule = {
  caseType: CaseType;
  riskLevel: RiskLevel;
  deletionChance: DeletionChance;
  sensitivityLevel: SensitivityLevel;
  keywords: string[];
  route: string[];
  actions: string[];
  evidence: string[];
  reason: string;
  safetyNote?: string;
  specialistFirst?: boolean;
};

const RULES: Rule[] = [
  {
    caseType: "DIGITAL_SEX_CRIME",
    riskLevel: "CRITICAL",
    deletionChance: "SPECIALIST_REQUIRED",
    sensitivityLevel: "CRITICAL",
    keywords: [
      "불법촬영",
      "몰카",
      "딥페이크",
      "합성",
      "지인능욕",
      "성착취",
      "유포 협박",
      "유포협박",
      "나체",
      "성관계 영상",
      "비동의 유포",
      "성적 이미지",
      "온라인 그루밍",
      "그루밍",
      "몸캠피싱",
      "몸캠",
      "추가촬영",
      "성적 괴롭힘",
      "협박",
    ],
    route: ["중앙디지털성범죄피해자지원센터", "여성긴급전화 1366", "경찰청 사이버범죄 신고", "방송통신심의 관련 신고"],
    actions: ["피해 이미지나 영상 원본을 업로드하지 않기", "URL·게시 위치·게시자 ID·발견 일시만 정리하기", "혼자 추가 검색하지 말고 전문기관에 먼저 연결하기"],
    evidence: ["URL", "게시 위치", "게시자 ID 또는 닉네임", "발견 일시", "협박 메시지 존재 여부", "이미 신고한 기관"],
    reason: "유포·협박·성적 이미지 관련 키워드는 2차 피해 위험이 커서 전문기관 연결이 먼저입니다.",
    safetyNote: "원본 피해물은 지움AI에 올리지 마세요. URL과 최소 메타정보만 정리하세요.",
    specialistFirst: true,
  },
  {
    caseType: "CREDENTIAL_LEAK",
    riskLevel: "HIGH",
    deletionChance: "SPECIALIST_REQUIRED",
    sensitivityLevel: "SENSITIVE",
    keywords: ["계정 유출", "비밀번호 유출", "해킹", "다크웹", "로그인 기록", "털린", "접속 기록"],
    route: ["털린 내 정보 찾기", "비밀번호 변경", "2단계 인증 설정", "금융·이메일 계정 우선 점검"],
    actions: ["지움AI에 비밀번호를 입력하지 않기", "공식 유출 확인 서비스에서만 확인하기", "같은 비밀번호를 쓰는 계정부터 모두 변경하기"],
    evidence: ["의심 계정 종류", "이상 로그인 일시", "알림 메일 여부", "피싱 문자/메일 여부"],
    reason: "계정 유출은 삭제보다 추가 침해 차단이 먼저이며, 비밀번호 원문을 어떤 도구에도 입력하면 안 됩니다.",
    safetyNote: "비밀번호는 입력하지 마세요. 유출 확인은 공식 사이트에서만 진행하세요.",
    specialistFirst: true,
  },
  {
    caseType: "ACCOUNT_DELETE",
    riskLevel: "MEDIUM",
    deletionChance: "MEDIUM",
    sensitivityLevel: "NORMAL",
    keywords: ["회원탈퇴", "계정 삭제", "오래된 계정", "가입한 사이트", "탈퇴하고 싶"],
    route: ["개인정보 포털 웹사이트 회원탈퇴", "사이트 직접 탈퇴", "본인확인 자료 최소 준비"],
    actions: ["사이트명과 계정 ID를 정리하기", "비밀번호를 이 서비스에 입력하지 않기", "탈퇴 전 필요한 데이터 백업 여부 확인하기"],
    evidence: ["사이트명", "가입 추정 이메일", "계정 ID", "본인확인 가능 자료"],
    reason: "오래된 계정은 공식 회원탈퇴 또는 개인정보 포털을 통해 직접 처리할 수 있는 경우가 많습니다.",
  },
  {
    caseType: "SELF_POST_DELETE",
    riskLevel: "MEDIUM",
    deletionChance: "MEDIUM",
    sensitivityLevel: "NORMAL",
    keywords: ["내가 쓴 글", "어릴 때", "초등학생 때", "중학생 때", "고등학생 때", "예전에 올린", "흑역사", "어릴때"],
    route: ["지우개 서비스", "플랫폼 직접 삭제 요청", "검색엔진 캐시 삭제 확인"],
    actions: ["작성 당시 나이와 현재 나이 확인하기", "개인정보 포함 여부 확인하기", "URL 또는 검색 키워드 정리하기"],
    evidence: ["작성 시기", "현재 나이대", "개인정보 포함 항목", "URL 또는 검색어"],
    reason: "아동·청소년 시기에 작성한 개인정보 포함 게시물은 공식 지우개 서비스 대상이 될 수 있습니다.",
  },
  {
    caseType: "SEARCH_RESULT_REMOVAL",
    riskLevel: "MEDIUM",
    deletionChance: "MEDIUM",
    sensitivityLevel: "NORMAL",
    keywords: ["검색 결과", "구글에 나와", "네이버에 나와", "캐시", "스니펫", "검색 노출", "검색하면"],
    route: ["검색엔진 삭제 요청", "원본 게시물 삭제 여부 확인", "7일·30일 재확인"],
    actions: ["검색어와 노출 URL을 분리해 적기", "원본 게시물이 삭제되었는지 먼저 확인하기", "캐시/스니펫 삭제 요청서 준비하기"],
    evidence: ["검색어", "검색 결과 URL", "원본 URL", "원본 삭제 여부", "확인 일시"],
    reason: "검색 노출은 원본 게시물과 검색엔진 캐시를 나누어 처리해야 합니다.",
  },
  {
    caseType: "PERSONAL_INFO_EXPOSURE",
    riskLevel: "HIGH",
    deletionChance: "HIGH",
    sensitivityLevel: "SENSITIVE",
    keywords: ["전화번호", "주소", "주민등록", "이메일", "학교", "직장", "얼굴", "실명", "신상", "개인정보", "가족 정보"],
    route: ["게시판 관리자 삭제 요청", "개인정보침해 신고센터", "검색엔진 삭제 요청"],
    actions: ["URL과 노출 항목만 정리하기", "주민등록번호 원문은 입력하지 않기", "관리자용 삭제 요청서를 먼저 보내기"],
    evidence: ["URL", "노출된 정보 종류", "게시 위치", "발견 일시", "관리자에게 보낸 요청 이력"],
    reason: "전화번호·주소·실명 등은 개인정보 노출로 볼 수 있어 삭제 요청과 신고 준비가 가능합니다.",
  },
  {
    caseType: "IMPERSONATION",
    riskLevel: "HIGH",
    deletionChance: "MEDIUM",
    sensitivityLevel: "SENSITIVE",
    keywords: ["사칭", "내 사진으로 계정", "가짜 계정", "도용 계정", "내 이름으로"],
    route: ["플랫폼 사칭 신고", "개인정보침해 신고센터", "필요 시 경찰 상담"],
    actions: ["사칭 계정 URL 정리하기", "내 계정과 다른 점 정리하기", "금전 요구나 협박이 있으면 경찰 상담 준비하기"],
    evidence: ["사칭 계정 URL", "프로필 캡처 보유 여부", "도용된 이름/사진", "피해 메시지 여부"],
    reason: "사칭은 개인정보 침해와 2차 피해가 함께 발생할 수 있어 플랫폼 신고와 공식 상담을 병행해야 합니다.",
  },
  {
    caseType: "DEFAMATION_PRIVACY",
    riskLevel: "MEDIUM",
    deletionChance: "LEGAL_REVIEW_REQUIRED",
    sensitivityLevel: "SENSITIVE",
    keywords: ["명예훼손", "모욕", "허위사실", "사생활", "비방", "악성 댓글"],
    route: ["플랫폼 신고", "법률구조공단 또는 변호사 상담", "공익성 여부 확인"],
    actions: ["표현 내용과 사실관계를 분리하기", "공익적 비판인지 확인하기", "삭제 보장보다 법률 검토를 먼저 받기"],
    evidence: ["게시물 URL", "문제 표현", "사실과 다른 부분", "피해 내용", "작성자와의 관계"],
    reason: "명예훼손·사생활 침해는 표현의 자유와 충돌할 수 있어 법률 검토가 필요합니다.",
  },
];

export function classifyCase(input: string | CaseInput): CaseClassification {
  const text = typeof input === "string" ? input : [input.situation, input.title, input.description, input.keywords, input.platform, input.exposedInfo.join(" ")].join(" ");
  const normalized = text.toLocaleLowerCase("ko-KR");
  const urgent = typeof input === "string" ? false : input.urgent;
  const matched = RULES.find((rule) => rule.keywords.some((keyword) => normalized.includes(keyword.toLocaleLowerCase("ko-KR"))));

  if (!matched) {
    return buildClassification({
      caseType: "UNKNOWN",
      riskLevel: urgent ? "MEDIUM" : "LOW",
      deletionChance: "LOW",
      sensitivityLevel: urgent ? "SENSITIVE" : "NORMAL",
      keywords: [],
      route: ["상황을 조금 더 구체적으로 정리", "공식기관 상담 검토"],
      actions: ["URL이 있으면 문자열로만 적기", "비밀번호와 주민등록번호는 입력하지 않기", "피해 유형을 다시 선택하기"],
      evidence: ["발견 일시", "게시 위치", "피해 내용", "이미 한 조치"],
      reason: "입력만으로는 사건 유형을 확정하기 어렵습니다. 그래도 안전 원칙에 따라 최소 정보로 정리할 수 있습니다.",
    });
  }

  const escalated = urgent && matched.riskLevel !== "CRITICAL";
  return buildClassification({
    ...matched,
    riskLevel: escalated ? "HIGH" : matched.riskLevel,
    reason: escalated ? `${matched.reason} 사용자가 긴급 상황으로 표시했기 때문에 우선순위를 높였습니다.` : matched.reason,
  });
}

function buildClassification(rule: Rule): CaseClassification {
  return {
    caseType: rule.caseType,
    riskLevel: rule.riskLevel,
    deletionChance: rule.deletionChance,
    sensitivityLevel: rule.sensitivityLevel,
    recommendedRoute: rule.route,
    immediateActions: rule.actions,
    evidenceChecklist: rule.evidence,
    followUpDays: [7, 30, 90],
    safetyNote: rule.safetyNote,
    reason: rule.reason,
    legalDisclaimer: "지움AI는 법률 대리인이나 삭제 대행업체가 아닙니다. 실제 처리 결과는 플랫폼, 검색엔진, 기관, 법적 판단에 따라 달라질 수 있습니다.",
    specialistFirst: Boolean(rule.specialistFirst),
  };
}
