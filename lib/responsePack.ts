import { CASE_TYPE_LABELS } from "@/lib/labels";
import { getResourcesForCase } from "@/lib/publicResources";
import type { CaseClassification, CaseInput, RequestDraftOutput, ResponsePack, ServiceIntegration } from "@/lib/types";

function compactList(items: Array<string | undefined>) {
  return items.filter((item): item is string => Boolean(item && item.trim()));
}

function quote(value: string | undefined, fallback: string) {
  return value?.trim() ? value.trim() : fallback;
}

export function generateResponsePack(input: CaseInput, classification: CaseClassification): ResponsePack {
  return {
    monitoringPlan: generateMonitoringPlan(input, classification),
    takedownSequence: generateTakedownSequence(classification),
    attributionGuidance: generateAttributionGuidance(input),
    legalSupport: {
      title: "신고·고소·법률상담 준비 패키지",
      policeReport: generatePoliceReportDraft(input, classification),
      criminalComplaintPrep: generateCriminalComplaintPrep(input, classification),
      legalAidMemo: generateLegalAidMemo(input, classification),
    },
    serviceIntegrations: generateServiceIntegrations(classification),
    automationBoundary: {
      automatedByJium: [
        "사건 유형 분류",
        "민감정보 마스킹",
        "안전한 검색어와 재확인 계획 생성",
        "삭제 요청서·신고서·고소 상담자료 초안 작성",
        "로컬 사건 보드와 문서 내보내기",
      ],
      requiresUserConfirmation: [
        "외부 사이트 접속",
        "공식기관 신고 제출",
        "플랫폼 삭제 요청 제출",
        "수사기관에 증거 제출",
        "변호사 또는 법률구조기관 상담 신청",
      ],
      requiresOfficialAuthority: [
        "게시자 신원 확인",
        "IP·로그·결제정보 조회",
        "압수수색·통신자료 확인",
        "형사 처벌 판단",
        "플랫폼 강제 삭제 또는 접속 차단",
      ],
    },
  };
}

function generateServiceIntegrations(classification: CaseClassification): ServiceIntegration[] {
  return getResourcesForCase(classification.caseType)
    .filter((resource) =>
      [
        "d4u",
        "women-1366",
        "online365",
        "privacy-kisa",
        "ecrm",
        "kcsc",
        "legal-aid",
        "my-lawyer",
        "lawtalk",
        "lawandgood",
      ].includes(resource.id),
    )
    .map(({ id, name, kind, cost, url, phone, useWhen, handoffMode, prepItems, privacyNote }) => ({
      id,
      name,
      kind,
      cost,
      url,
      phone,
      useWhen,
      handoffMode,
      prepItems,
      privacyNote,
    }));
}

function generateMonitoringPlan(input: CaseInput, classification: CaseClassification) {
  const baseQueries = compactList([
    input.keywords,
    input.platform && input.keywords ? `${input.platform} ${input.keywords}` : undefined,
    input.exposedInfo.includes("전화번호") ? "\"전화번호\" \"이름\"" : undefined,
    classification.caseType === "DIGITAL_SEX_CRIME" ? "[피해자 이름/닉네임] [유포자 ID]" : undefined,
    classification.caseType === "SEARCH_RESULT_REMOVAL" ? `cache:${quote(input.targetUrl, "[원본 URL]")}` : undefined,
  ]);

  return {
    title: "안전 추적 계획",
    safeQueries: baseQueries.length ? baseQueries : ["[이름/닉네임]", "[플랫폼명] [게시물 제목]", "[검색 결과에 보인 문구]"],
    manualCheckTargets: [
      "원본 게시물 URL",
      "검색엔진 결과",
      "플랫폼 신고함 또는 고객센터 답변",
      "동일 문구 재게시 여부",
      "공식기관 접수 진행 상황",
    ],
    cadence: ["접수 당일 1회", "7일 후 재확인", "30일 후 재확인", "90일 후 재확인", "재노출 발견 시 새 사건으로 기록"],
    boundaries: [
      "지움AI는 피해 URL을 자동 방문하지 않습니다.",
      "로그인 자동화, 무단 크롤링, 우회 접속은 하지 않습니다.",
      "피해물을 다시 내려받거나 공유하지 않습니다.",
      "검색 결과는 사용자가 직접 확인하고 필요한 최소 정보만 기록합니다.",
    ],
  };
}

function generateTakedownSequence(classification: CaseClassification) {
  if (classification.caseType === "DIGITAL_SEX_CRIME") {
    return [
      "원본 피해물 업로드 없이 URL·게시 위치·게시자 ID만 정리",
      "중앙디지털성범죄피해자지원센터 또는 1366 상담 접수",
      "전문기관 안내에 따라 삭제지원·수사·법률 연계 진행",
      "플랫폼 신고와 경찰 신고는 상담기관 안내에 맞춰 제출",
      "재유포 의심은 새 URL과 발견 일시만 추가 기록",
    ];
  }

  if (classification.caseType === "CREDENTIAL_LEAK") {
    return [
      "비밀번호를 지움AI에 입력하지 않기",
      "공식 유출 확인 서비스에서 확인",
      "같은 비밀번호를 쓰는 계정부터 변경",
      "2단계 인증과 로그인 세션 로그아웃",
      "계정 도용 피해가 있으면 경찰청 사이버범죄 신고 준비",
    ];
  }

  return [
    "대상 URL과 노출 항목 정리",
    "플랫폼 관리자에게 삭제 또는 비공개 요청",
    "원본 조치 후 검색엔진 캐시/스니펫 제거 요청",
    "응답이 없거나 보완 요청이 오면 사건 보드 상태 변경",
    "재노출 발견 시 새 URL을 기록하고 추가 요청",
  ];
}

function generateAttributionGuidance(input: CaseInput) {
  return {
    title: "유출자 특정 단서 정리",
    whatYouCanRecord: [
      "게시자 ID, 닉네임, 프로필 URL",
      "게시물 URL과 발견 일시",
      "협박 메시지 존재 여부와 받은 시각",
      "금전 요구, 추가 유포 협박, 연락 수단",
      "동일 문구나 동일 계정의 반복 게시 정황",
    ],
    whatNotToDo: [
      "상대방 실명·주소·직장 등 신상정보를 사적으로 캐내기",
      "해킹, 비밀번호 추측, 계정 침입 시도",
      "피해물을 내려받아 주변에 확인 요청하기",
      "확실하지 않은 사람을 범인으로 단정해 공개하기",
      "보복성 연락이나 협박",
    ],
    officialProcess: [
      "지움AI는 유출자를 특정하지 않고 단서만 정리합니다.",
      "플랫폼 로그, IP, 가입 정보 확인은 수사기관 또는 법원의 절차가 필요합니다.",
      `현재 입력된 단서: ${quote(input.platform, "[플랫폼 미입력]")} / ${quote(input.targetUrl, "[URL 미입력]")} / ${quote(input.keywords, "[키워드 미입력]")}`,
      "신고서에는 '의심 단서'와 '확인된 사실'을 분리해 적습니다.",
    ],
  };
}

function generatePoliceReportDraft(input: CaseInput, classification: CaseClassification): RequestDraftOutput {
  return {
    title: "경찰청 사이버범죄 신고 준비서",
    recipientType: "POLICE",
    checklist: ["피해자 기본정보", "피해 발생 일시", "URL/플랫폼", "게시자 ID/닉네임", "협박 메시지 여부", "피해 내용", "증거 보유 현황"],
    body: `
경찰청 사이버범죄 신고 준비서

사건 유형:
${CASE_TYPE_LABELS[classification.caseType]}

피해 내용:
${input.description}

확인된 URL 또는 게시 위치:
${input.targetUrl || "[URL 미입력]"}

플랫폼:
${input.platform || "[플랫폼 미입력]"}

게시자 ID·닉네임·연락 수단 등 의심 단서:
${input.keywords || "[확인된 단서만 입력. 추정은 추정이라고 표시]"}

긴급성:
${input.urgent ? "현재 협박 또는 긴급 위험이 있습니다." : "현재 입력상 즉시 신변 위협 여부는 명확하지 않습니다."}

요청 취지:
1. 피해 게시물 및 재유포 정황 확인
2. 게시자 또는 유포자 특정에 필요한 수사 검토
3. 추가 유포 또는 협박 방지를 위한 조치
4. 필요한 경우 피해자 보호 및 전문기관 연계

주의:
이 문서는 신고 준비를 돕는 초안입니다. 실제 신고 전 확인된 사실과 추정을 분리하고, 수사기관 안내에 따라 증거를 제출하세요.
`.trim(),
  };
}

function generateCriminalComplaintPrep(input: CaseInput, classification: CaseClassification): RequestDraftOutput {
  return {
    title: "형사 고소 상담 준비자료",
    recipientType: "LEGAL_SUPPORT",
    checklist: ["고소인 정보", "피고소인 또는 성명불상자", "피해 사실", "증거 목록", "처벌 의사", "긴급 보호 필요성"],
    body: `
형사 고소 상담 준비자료

고소 대상:
${input.keywords ? `확인된 단서: ${input.keywords}` : "성명불상자 또는 확인 필요"}

사건 개요:
${input.description}

관련 URL/플랫폼:
${input.targetUrl || "[URL 미입력]"}
${input.platform || "[플랫폼 미입력]"}

피해 유형:
${CASE_TYPE_LABELS[classification.caseType]}

증거 목록 초안:
${classification.evidenceChecklist.map((item) => `- ${item}`).join("\n")}

처벌 및 조치 요청 취지:
1. 게시 또는 유포 행위자 확인
2. 추가 유포 방지
3. 피해 게시물 삭제 또는 접속 차단 연계
4. 협박·스토킹·성범죄 등 관련 범죄 성립 여부 검토

주의:
고소장 제출 여부와 죄명 판단은 변호사, 법률구조기관, 수사기관 상담을 통해 확인해야 합니다. 지움AI는 법률 자문을 제공하지 않습니다.
`.trim(),
  };
}

function generateLegalAidMemo(input: CaseInput, classification: CaseClassification): RequestDraftOutput {
  return {
    title: "무료 법률상담 메모",
    recipientType: "LEGAL_SUPPORT",
    checklist: ["상담 목표", "사건 요약", "증거 보유 여부", "신고 여부", "원하는 조치", "경제적 지원 필요 여부"],
    body: `
무료 법률상담 메모

상담 목표:
- 삭제 요청만으로 충분한지
- 형사 신고 또는 고소가 필요한지
- 손해배상, 접근금지, 피해자 보호 조치가 가능한지
- 무료 법률구조 또는 전문기관 연계가 가능한지

사건 요약:
${input.description}

분류:
${CASE_TYPE_LABELS[classification.caseType]}

위험도:
${classification.riskLevel}

준비한 자료:
${classification.evidenceChecklist.map((item) => `- ${item}`).join("\n")}

원하는 조치:
1. 게시물 삭제 또는 비공개
2. 검색 노출 제거
3. 유포자 또는 게시자 확인 절차 상담
4. 신고·고소 가능성 검토
5. 추가 피해 방지

주의:
상담 시 피해물 원본을 무리하게 전송하지 말고, 기관 또는 변호사의 안내에 따라 필요한 범위만 제출하세요.
`.trim(),
  };
}
