import { CASE_TYPE_LABELS } from "@/lib/labels";
import { getResourcesForCase } from "@/lib/publicResources";
import type {
  CaseClassification,
  CaseInput,
  CaseStudyLesson,
  DigitalSexCrimePatternResponse,
  InterventionChoice,
  PreventionGuidance,
  RequestDraftOutput,
  ResponsePack,
  ServiceIntegration,
} from "@/lib/types";

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
    interventionChoices: generateInterventionChoices(classification),
    attributionGuidance: generateAttributionGuidance(input),
    legalSupport: {
      title: "신고·고소·법률상담 준비 패키지",
      policeReport: generatePoliceReportDraft(input, classification),
      criminalComplaintPrep: generateCriminalComplaintPrep(input, classification),
      legalAidMemo: generateLegalAidMemo(input, classification),
    },
    serviceIntegrations: generateServiceIntegrations(classification),
    preventionGuidance: generatePreventionGuidance(input, classification),
    automationBoundary: {
      automatedByJium: [
        "사건 유형 분류",
        "민감정보 마스킹",
        "안전한 검색어와 재확인 계획 생성",
        "범죄 양상별 대응 매트릭스 생성",
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

function generateInterventionChoices(classification: CaseClassification): InterventionChoice[] {
  if (classification.caseType === "DIGITAL_SEX_CRIME") {
    return [
      {
        id: "digital-sex-crime-specialist-first",
        title: "전문기관 상담·삭제지원 연결",
        category: "OFFICIAL_SAFE",
        riskLevel: "낮음",
        whenToUse: "불법촬영, 비동의 유포, 유포협박, 딥페이크, 몸캠피싱, 그루밍이 의심될 때",
        howJiumHelps: ["URL·게시 위치·발견 일시 중심으로 상담 준비자료를 정리", "피해물 원본 업로드 없이 신고·삭제지원 경로를 분리", "7일·30일·90일 재확인 계획 생성"],
        userAction: ["중앙디지털성범죄피해자지원센터 또는 1366에 먼저 연결", "긴급 신변 위협이 있으면 112 우선", "상담원 안내 전에는 피해물을 다시 내려받지 않기"],
        legalRiskNotice: "전문기관 상담과 공식 신고는 안전한 첫 조치입니다. 다만 제출 자료 범위는 기관 안내에 따르세요.",
        relatedResources: ["중앙디지털성범죄피해자지원센터", "여성긴급전화 1366", "경찰청 ECRM", "방송미디어통신심의위원회"],
      },
      {
        id: "digital-sex-crime-legal-consult",
        title: "경찰 신고·고소 상담 준비",
        category: "LEGAL_REVIEW",
        riskLevel: "상담 필요",
        whenToUse: "협박, 금전 요구, 반복 유포, 미성년자 피해, 가해자 처벌 의사가 있을 때",
        howJiumHelps: ["경찰 신고 준비서와 형사 고소 상담자료 초안 작성", "확인된 사실과 의심 단서를 분리", "무료 법률상담 메모 생성"],
        userAction: ["신고 전 사실과 추정을 나누어 확인", "피해물 원본 제출은 수사기관·전문기관 안내에 따르기", "가족·학교·직장 공유 범위는 상담 후 결정"],
        legalRiskNotice: "고소, 죄명, 증거 제출 범위는 변호사·수사기관 상담이 필요합니다. 지움AI는 법률 판단을 대신하지 않습니다.",
        relatedResources: ["경찰청 ECRM", "대한법률구조공단", "대한변협 나의 변호사"],
      },
      {
        id: "digital-sex-crime-prohibited-access",
        title: "초대코드 요청·회원가입·피해물 다운로드",
        category: "PROHIBITED",
        riskLevel: "금지",
        whenToUse: "하지 말아야 할 행동입니다.",
        howJiumHelps: ["안전 추적 계획에서 자동 접속·크롤링·우회 접속 제외", "금지 행동을 대응 패키지와 내보내기 문서에 표시"],
        userAction: ["불법 사이트에 가입하지 않기", "초대코드나 링크를 공유하지 않기", "피해물을 내려받거나 재생하지 않기"],
        legalRiskNotice: "피해 촬영물 소지·저장·시청·공유는 2차 피해를 키우고 법적 위험을 만들 수 있습니다.",
        relatedResources: ["중앙디지털성범죄피해자지원센터", "방송미디어통신심의위원회"],
      },
      {
        id: "digital-sex-crime-prohibited-contact",
        title: "가해자와 직접 협상·송금·보복 연락",
        category: "PROHIBITED",
        riskLevel: "금지",
        whenToUse: "하지 말아야 할 행동입니다.",
        howJiumHelps: ["협박 대응 문서에서 직접 협상을 배제", "112·ECRM·상담기관 연결 순서 제시"],
        userAction: ["돈이나 추가 자료를 보내지 않기", "직접 만나 해결하려 하지 않기", "보복성 공개글이나 신상 공개를 하지 않기"],
        legalRiskNotice: "직접 협상은 추가 협박과 증거 훼손 위험이 큽니다. 보복성 신상 공개도 별도 법적 문제가 될 수 있습니다.",
        relatedResources: ["112", "경찰청 ECRM", "여성긴급전화 1366"],
      },
    ];
  }

  if (classification.caseType === "CREDENTIAL_LEAK") {
    return [
      {
        id: "credential-official-check",
        title: "공식 유출 확인·비밀번호 변경",
        category: "OFFICIAL_SAFE",
        riskLevel: "낮음",
        whenToUse: "계정정보 유출, 이상 로그인, 다크웹 유통이 의심될 때",
        howJiumHelps: ["비밀번호를 입력하지 않는 대응 체크리스트 생성", "우선 변경할 계정과 2단계 인증 항목 정리"],
        userAction: ["공식 사이트에서만 유출 여부 확인", "같은 비밀번호를 쓰는 계정부터 변경", "모르는 로그인 세션 로그아웃"],
        legalRiskNotice: "공식 서비스 외의 링크에 비밀번호를 입력하지 마세요.",
        relatedResources: ["털린 내 정보 찾기", "KISA 개인정보침해 신고센터"],
      },
      {
        id: "credential-legal-review",
        title: "계정 침입·금전 피해 신고 상담",
        category: "LEGAL_REVIEW",
        riskLevel: "상담 필요",
        whenToUse: "계정 도용, 금전 피해, 사칭, 협박이 함께 발생했을 때",
        howJiumHelps: ["피해 일시와 로그인 기록을 상담용으로 정리", "ECRM 신고 준비서 초안 생성"],
        userAction: ["피해 입증자료를 보존", "금융 피해가 있으면 은행·수사기관 안내 확인", "비밀번호 원문은 어떤 문서에도 적지 않기"],
        legalRiskNotice: "형사처벌과 피해회복 가능성은 수사기관·법률상담을 통해 확인해야 합니다.",
        relatedResources: ["경찰청 ECRM", "대한법률구조공단"],
      },
      {
        id: "credential-prohibited-secret-sharing",
        title: "비밀번호·인증번호 공유",
        category: "PROHIBITED",
        riskLevel: "금지",
        whenToUse: "하지 말아야 할 행동입니다.",
        howJiumHelps: ["비밀번호, 주민등록번호, 카드번호 감지 시 결과 생성과 저장 차단"],
        userAction: ["비밀번호, OTP, 복구코드, 인증번호를 입력하지 않기", "캡처해서 상담글에 올리지 않기"],
        legalRiskNotice: "비밀값을 공유하면 추가 침해와 책임 소재 혼선이 생길 수 있습니다.",
        relatedResources: ["털린 내 정보 찾기", "KISA 개인정보침해 신고센터"],
      },
    ];
  }

  if (classification.caseType === "DEFAMATION_PRIVACY") {
    return [
      {
        id: "defamation-platform-request",
        title: "플랫폼 신고·삭제 요청",
        category: "OFFICIAL_SAFE",
        riskLevel: "낮음",
        whenToUse: "사생활 정보, 모욕 표현, 허위 사실 게시물이 플랫폼에 남아 있을 때",
        howJiumHelps: ["문제 표현과 피해 내용을 분리", "플랫폼 제출용 요청서 초안 생성"],
        userAction: ["문제 표현, URL, 작성자 ID, 발견 일시를 정리", "플랫폼 정책에 맞춰 직접 제출"],
        legalRiskNotice: "표현물 삭제 가능성은 플랫폼 정책과 법적 판단에 따라 달라질 수 있습니다.",
        relatedResources: ["온라인피해365센터", "플랫폼 신고"],
      },
      {
        id: "defamation-legal-review",
        title: "명예훼손·모욕·사생활 침해 법률상담",
        category: "LEGAL_REVIEW",
        riskLevel: "상담 필요",
        whenToUse: "고소, 손해배상, 접근금지, 반복 게시 대응을 검토할 때",
        howJiumHelps: ["무료 법률상담 메모 생성", "확인된 사실과 의견·추정을 분리"],
        userAction: ["공익적 비판 가능성과 사실관계를 상담 전 정리", "삭제 보장 문구를 기대하지 않기"],
        legalRiskNotice: "명예훼손·모욕은 표현의 자유와 충돌할 수 있어 법률 검토가 필요합니다.",
        relatedResources: ["대한법률구조공단", "대한변협 나의 변호사"],
      },
      {
        id: "defamation-prohibited-retaliation",
        title: "상대 신상 공개·맞대응 게시",
        category: "PROHIBITED",
        riskLevel: "금지",
        whenToUse: "하지 말아야 할 행동입니다.",
        howJiumHelps: ["유출자 특정 단서와 사적 신상털이를 분리", "공식 절차가 필요한 영역을 표시"],
        userAction: ["상대방 실명·주소·직장 추적 또는 공개 금지", "확실하지 않은 사람을 범인으로 단정하지 않기"],
        legalRiskNotice: "보복성 공개와 신상털이는 별도 개인정보 침해·명예훼손 위험을 만들 수 있습니다.",
        relatedResources: ["온라인피해365센터", "대한법률구조공단"],
      },
    ];
  }

  return [
    {
      id: "general-official-request",
      title: "플랫폼·공식기관 직접 요청",
      category: "OFFICIAL_SAFE",
      riskLevel: "낮음",
      whenToUse: "게시물 삭제, 검색 노출 제거, 계정 탈퇴, 개인정보 침해 상담이 필요할 때",
      howJiumHelps: ["사건 유형 분류", "요청서 초안 생성", "공식기관과 무료 경로 우선 정렬"],
      userAction: ["문서를 검토한 뒤 사용자가 직접 제출", "URL은 자동 전달하지 않고 필요한 곳에만 직접 입력"],
      legalRiskNotice: "삭제 성공은 보장되지 않지만 공식 요청은 가장 안전한 시작점입니다.",
      relatedResources: classification.recommendedRoute,
    },
    {
      id: "general-legal-review",
      title: "공공 법률상담 또는 변호사 상담",
      category: "LEGAL_REVIEW",
      riskLevel: "상담 필요",
      whenToUse: "법적 책임, 고소, 손해배상, 게시자 특정 절차가 필요할 때",
      howJiumHelps: ["상담용 사건 요약과 질문 목록 생성", "확인 사실과 추정을 나누어 정리"],
      userAction: ["무료 법률구조 가능성부터 확인", "유료 상담 전 비용과 비밀유지 조건 확인"],
      legalRiskNotice: "법률 판단과 대리 행위는 지움AI가 대신하지 않습니다.",
      relatedResources: ["대한법률구조공단", "대한변협 나의 변호사"],
    },
    {
      id: "general-prohibited-automation",
      title: "자동 대량 신고·로그인 자동화·무단 크롤링",
      category: "PROHIBITED",
      riskLevel: "금지",
      whenToUse: "하지 말아야 할 행동입니다.",
      howJiumHelps: ["링크 미리보기, 자동 URL fetch, 로그인 자동화를 배제", "수동 확인과 공식 제출 흐름만 안내"],
      userAction: ["정부·플랫폼 사이트 로그인 정보를 앱에 입력하지 않기", "피해 URL을 자동 수집하거나 반복 접속하지 않기"],
      legalRiskNotice: "자동화된 접근은 약관 위반, 증거 훼손, 피해 확산, 법적 위험으로 이어질 수 있습니다.",
      relatedResources: ["온라인피해365센터", "KISA 개인정보침해 신고센터"],
    },
  ];
}

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword.toLocaleLowerCase("ko-KR")));
}

function generatePreventionGuidance(input: CaseInput, classification: CaseClassification): PreventionGuidance {
  const text = [input.situation, input.title, input.description, input.platform, input.keywords, input.exposedInfo.join(" ")]
    .join(" ")
    .toLocaleLowerCase("ko-KR");
  const patterns = buildDigitalSexCrimePatterns();
  const matchedPatterns = patterns.filter((pattern) => includesAny(text, pattern.riskSignals.map((signal) => signal.split(":")[0])));
  const shouldShowAllCorePatterns = classification.caseType === "DIGITAL_SEX_CRIME" && matchedPatterns.length === 0;
  const selectedPatterns = shouldShowAllCorePatterns ? patterns.slice(0, 4) : matchedPatterns;
  const lessons = buildCaseStudyLessons();

  return {
    title: "범죄유형별 피해 확산 방지 매트릭스",
    summary:
      classification.caseType === "DIGITAL_SEX_CRIME"
        ? "과거 디지털성범죄 양상을 피해자 대응 언어로 바꾸었습니다. 범행 방법을 자세히 설명하지 않고, 위험 신호와 필요한 조치만 보여줍니다."
        : "디지털성범죄로 확정되지 않은 사건도 유포·협박·사칭 위험이 있으면 같은 안전 원칙으로 대응합니다.",
    patterns: selectedPatterns.length ? selectedPatterns : [buildGeneralOnlineAbusePattern()],
    caseStudyLessons:
      classification.caseType === "DIGITAL_SEX_CRIME"
        ? lessons
        : lessons.filter((lesson) => includesAny(text, [lesson.id, ...lesson.title.split(" "), ...lesson.riskPattern.split(" ")])),
    survivorSupportProtocol: [
      "피해자에게 원본을 보여달라고 요구하지 않습니다.",
      "피해자가 안전한 기기와 장소에서 상담·신고할 수 있게 돕습니다.",
      "사실 확인보다 안정, 휴식, 동행, 연락 차단이 먼저입니다.",
      "피해자의 동의 없이 가족·학교·직장·SNS에 알리지 않습니다.",
      "증거 정리는 URL, 계정명, 발견 일시, 협박 메시지 존재 여부처럼 최소 정보 중심으로 합니다.",
      "미성년자 또는 신변 위협이 있으면 112, 1366, 중앙디지털성범죄피해자지원센터 연결을 우선합니다.",
    ],
    communityPrevention: [
      "성적 이미지 합성·유포 의심 게시물을 발견하면 소비하거나 공유하지 않고 신고합니다.",
      "피해자 신상 추측, 링크 재공유, 단체방 전달을 막는 안내문을 즉시 배포합니다.",
      "학교·단체·직장은 피해자 조사보다 보호조치, 게시물 차단, 2차 가해 금지를 먼저 공지합니다.",
      "플랫폼 신고 결과와 재유포 여부를 7일·30일·90일 단위로 확인합니다.",
      "피해자를 탓하는 질문 대신 '무엇을 함께 처리하면 되는지'를 묻습니다.",
      "초대코드, 링크, 포인트 보상형 공유를 발견하면 참여하지 말고 공식 신고 경로로 넘깁니다.",
    ],
  };
}

function buildCaseStudyLessons(): CaseStudyLesson[] {
  return [
    {
      id: "nth-room",
      title: "n번방·박사방형 조직적 성착취",
      riskPattern: "협박, 심리적 지배, 미성년자 피해, 역할분담, 유료화·조직화, 폐쇄형 채팅방 확산",
      whyItMatters:
        "정부 대책은 n번방·박사방을 계기로 디지털성범죄를 중대범죄로 보고 무관용, 아동·청소년 보호, 사각지대 해소, 사회적 인식 전환을 함께 추진했습니다.",
      responsePrinciples: [
        "피해자를 설득하거나 추궁하지 않고 즉시 안전 확보와 상담 연결을 우선합니다.",
        "협박 메시지, 계정, 송금 요구, 방 이름 같은 단서만 정리하고 피해물 원본은 다루지 않습니다.",
        "수사, 삭제지원, 법률, 의료·심리 지원을 하나의 흐름으로 묶어 진행합니다.",
      ],
      rescueActions: [
        "112, 1366, 중앙디지털성범죄피해자지원센터 중 하나로 즉시 연결",
        "피해자 동의 없이 가족·학교·직장에 알리지 않기",
        "고소장·신고서에는 확인된 사실과 추정을 분리",
        "미성년자는 보호자 동의 전이라도 전문기관 상담 가능 여부 확인",
      ],
      preventionActions: [
        "학교·단체에 '피해물 열람·저장·전달 금지' 원칙을 먼저 공지",
        "청소년에게 비밀 유지 요구, 선물·돈 제안, 만남 요구를 위험 신호로 교육",
        "가해자 신상털이가 아니라 공식 신고와 피해자 보호로 대응",
      ],
      doNotDo: ["피해물 확인 요청", "가해자와 직접 협상", "단체방 잠입·함정 대화 시도", "피해자 이름을 넣은 공개 신고 독려"],
      sourceNote: "2020년 관계부처 합동 디지털 성범죄 근절대책과 중앙디지털성범죄피해자지원센터 지원 체계를 기준으로 정리",
    },
    {
      id: "closed-illegal-site",
      title: "놀쟈.com류 폐쇄형 불법촬영물 유통 사이트",
      riskPattern: "초대코드, 포인트·등급 보상, 반복 접속, 불법촬영물·성착취물 중심 게시판, 도메인 변경, 이용자 가담",
      whyItMatters:
        "공개 법률가이드들은 이런 유형을 단순 시청 문제가 아니라 폐쇄형 유통망과 이용자 활동이 결합되는 구조로 설명합니다. 피해자 구제에서는 사이트 접속보다 유통 차단과 신고 연결이 먼저입니다.",
      responsePrinciples: [
        "사이트에 가입하거나 반복 접속하지 않고, 이미 확인한 URL·게시 위치·발견 일시만 기록합니다.",
        "초대코드나 링크를 공유하지 않습니다. 공유 자체가 확산에 기여할 수 있습니다.",
        "피해자라면 중앙센터 삭제지원과 방심위 1377, 수사를 원하면 ECRM 흐름으로 분리합니다.",
      ],
      rescueActions: [
        "불법 사이트 링크를 주변에 확인 요청하지 않기",
        "피해자가 특정되는 제목·닉네임·게시 위치를 최소 단서로 정리",
        "1377 디지털성범죄 민원 또는 중앙센터 상담으로 삭제·차단 지원 연결",
        "협박·금전 요구·아동청소년 피해가 있으면 경찰 신고 준비",
      ],
      preventionActions: [
        "커뮤니티에 초대코드·가입 링크 게시 금지 규칙 고정",
        "포인트나 등급을 얻기 위한 공유가 범죄 확산이라는 안내",
        "운영자에게 불법촬영물 신고·삭제 요청 절차와 보존 범위를 분리해 안내",
      ],
      doNotDo: ["초대코드 요청·공유", "회원가입 후 내부 검색", "피해물 다운로드", "링크를 단체방에 뿌려 신고 독려"],
      sourceNote: "놀쟈.com 관련 공개 법률가이드와 디지털성범죄 원스톱 신고 ARS 안내를 피해자 안전 기준으로 재구성",
    },
    {
      id: "support-gap",
      title: "피해지원 공백을 줄이는 원스톱 연결",
      riskPattern: "어디에 신고해야 할지 몰라 시간이 지체됨, 삭제·수사·법률·심리 지원이 흩어짐, 재유포 추적 피로",
      whyItMatters:
        "중앙디지털성범죄피해자지원센터는 상담, 삭제지원, 유포 모니터링, 수사·법률·의료 연계를 통합지원하고, 1377 ARS는 삭제·차단, 상담, 수사 요청 기관으로 연결합니다.",
      responsePrinciples: [
        "한 번에 모든 절차를 끝내려 하지 않고 상담 접수, 삭제지원, 수사, 법률상담을 순서화합니다.",
        "피해자가 직접 반복 검색하지 않도록 조력자가 URL 목록과 접수번호만 관리합니다.",
        "접수 후 7일·30일·90일 재확인으로 재유포를 새 사건으로 분리합니다.",
      ],
      rescueActions: [
        "중앙센터 02-735-8994 또는 1366으로 상담 시작",
        "1377에서 디지털성범죄 민원 선택 후 삭제·차단 또는 수사 연결",
        "법률구조공단 132 또는 피해자 국선변호사 등 무료 법률지원 검토",
      ],
      preventionActions: [
        "학교·기관 내 담당자를 정해 피해자에게 기관을 전전하게 하지 않기",
        "공용 문서에는 피해자 식별 정보를 빼고 접수번호 중심으로 관리",
        "재유포 발견자는 피해자에게 링크를 보내지 말고 담당 조력자에게 최소 정보만 전달",
      ],
      doNotDo: ["피해자에게 여러 기관에 반복 설명 요구", "피해 사실을 내부 공유방에 상세 전파", "삭제 결과를 보장한다고 말하기"],
      sourceNote: "중앙디지털성범죄피해자지원센터, 여성가족부 특별지원단, 1377 원스톱 신고 안내를 기준으로 정리",
    },
  ];
}

function buildDigitalSexCrimePatterns(): DigitalSexCrimePatternResponse[] {
  return [
    {
      id: "non-consensual-filming",
      crimeType: "불법촬영 의심",
      riskSignals: ["불법촬영: 촬영 동의가 없거나 몰래 촬영된 정황", "몰카: 숨겨진 촬영 또는 공공장소 촬영 의심", "촬영: 촬영물 존재를 뒤늦게 알게 된 경우"],
      requiredMeasures: [
        "피해물 원본을 지움AI에 업로드하지 않기",
        "촬영 장소·시각·상대방 단서를 최소한으로 정리하기",
        "중앙디지털성범죄피해자지원센터 또는 경찰 상담 연결",
        "신체·주거·학교·직장 안전 위협이 있으면 112 우선",
      ],
      responseSteps: [
        "안전한 장소로 이동하고 신뢰할 수 있는 사람 한 명에게 동행을 요청합니다.",
        "URL이 없더라도 촬영 정황, 장소, 날짜, 상대방 단서를 시간순으로 적습니다.",
        "피해물 확인을 위해 다시 내려받거나 주변에 보내지 않습니다.",
        "전문기관 상담 후 삭제지원, 수사, 의료·심리 지원 여부를 결정합니다.",
      ],
      evidenceToKeep: ["촬영 의심 장소와 시각", "상대방 계정 또는 연락 수단", "협박 또는 암시 메시지", "이미 신고한 기관과 접수번호"],
      helperActions: ["피해자 진술을 대신 판단하지 않기", "이동·통화·기관 상담 동행", "피해물 확인 요청 금지", "가해 의심자와 직접 대면하지 않기"],
      preventionForOthers: ["불법촬영 의심 장소는 관리자·기관에 즉시 알리기", "동일 장소 피해 가능성이 있으면 공식기관 안내문 배포", "피해자 이름이 드러나는 단체방 대화 중단"],
      doNotDo: ["피해물을 재생·저장·전달하기", "가해 의심자를 사적으로 추적하기", "피해자에게 왜 거기 있었는지 묻기"],
      primaryRoutes: ["중앙디지털성범죄피해자지원센터", "경찰청 ECRM", "여성긴급전화 1366"],
    },
    {
      id: "non-consensual-distribution",
      crimeType: "비동의 유포·재유포",
      riskSignals: ["유포: 동의 없이 게시·공유된 정황", "재유포: 삭제 후 다시 올라온 정황", "공유: 지인·단체방·SNS 전달 정황"],
      requiredMeasures: [
        "URL, 게시 위치, 발견 일시를 표로 정리",
        "플랫폼 삭제 요청과 중앙디지털성범죄피해자지원센터 삭제지원 연결",
        "삭제가 지연되면 방송미디어통신심의위원회 신고 검토",
        "재유포는 새 사건으로 기록해 모니터링 주기에 포함",
      ],
      responseSteps: [
        "같은 게시물을 반복 열람하지 말고 URL과 화면 위치만 기록합니다.",
        "플랫폼 신고, 전문기관 삭제지원, 심의 요청을 순서대로 진행합니다.",
        "삭제 또는 차단 조치 안내를 받은 뒤에도 동일 키워드와 계정 단서를 7일·30일·90일에 재확인합니다.",
        "주변인에게 링크 공유 중단 요청 문구를 전달합니다.",
      ],
      evidenceToKeep: ["게시물 URL", "게시자 ID·닉네임", "발견 일시", "플랫폼 신고 접수번호", "재유포 URL 목록"],
      helperActions: ["링크를 열어보자는 제안 막기", "신고 문구 작성 돕기", "재유포 발견 시 새 URL만 전달받기", "피해자 대신 단체방 확산 중단 요청"],
      preventionForOthers: ["단체방에서 링크·파일 재전송 금지 공지", "게시자를 태그하거나 조롱하지 않고 플랫폼 신고", "학교·직장에는 피해자 식별 없이 2차 가해 금지 안내"],
      doNotDo: ["삭제 확인을 위해 여러 사람에게 열람 요청", "피해자 이름과 함께 신고 독려 게시", "가해자 추정 신상 공개"],
      primaryRoutes: ["중앙디지털성범죄피해자지원센터", "방송미디어통신심의위원회", "플랫폼 신고"],
    },
    {
      id: "distribution-threat",
      crimeType: "유포협박·갈취",
      riskSignals: ["협박: 유포하겠다는 말이나 압박", "금전: 돈·상품권·코인 요구", "추가촬영: 추가 사진·영상 요구", "성행위: 만남 또는 성적 요구"],
      requiredMeasures: [
        "돈이나 추가 자료를 보내지 않기",
        "협박 메시지와 계정 정보를 보존",
        "즉시 112 또는 경찰청 ECRM 신고 준비",
        "중앙디지털성범죄피해자지원센터 상담 연결",
      ],
      responseSteps: [
        "대화를 길게 이어가지 말고 안전한 기기에서 증거를 보존합니다.",
        "금전·추가촬영·만남 요구에는 응하지 않습니다.",
        "가족·학교·직장에 알려질 위험이 있으면 상담기관과 보호 공지 범위를 먼저 정합니다.",
        "긴급 위협이면 112, 상담·삭제지원은 1366 또는 중앙센터로 연결합니다.",
      ],
      evidenceToKeep: ["협박 메시지 원문", "요구 내용", "송금 요구 계좌·연락 수단", "상대 계정 URL", "대화 시각"],
      helperActions: ["피해자가 혼자 응답하지 않게 돕기", "금전 송금 중단", "신뢰 가능한 연락망 정리", "경찰·상담기관 연결 동행"],
      preventionForOthers: ["협박범 요구를 들어주면 멈춘다는 식의 조언 금지", "단체방·지인에게 피해자 비난 금지 안내", "비슷한 협박 메시지를 받은 사람이 있으면 공식 신고로 연결"],
      doNotDo: ["돈 보내기", "추가 촬영물 보내기", "직접 만나 해결하기", "보복 협박"],
      primaryRoutes: ["112", "경찰청 ECRM", "중앙디지털성범죄피해자지원센터", "여성긴급전화 1366"],
    },
    {
      id: "synthetic-deepfake",
      crimeType: "합성·딥페이크 성착취",
      riskSignals: ["딥페이크: 얼굴·신체·음성 합성 의심", "합성: 성적 이미지와 결합된 정황", "지인능욕: 특정인을 겨냥한 합성·모욕 표현"],
      requiredMeasures: [
        "합성물 원본을 재공유하지 않기",
        "URL, 게시자, 제목, 썸네일 위치 등 최소 단서 정리",
        "방송미디어통신심의위원회 또는 중앙센터 신고",
        "학교·직장·커뮤니티 내 2차 가해 차단 공지 검토",
      ],
      responseSteps: [
        "합성 여부를 스스로 검증하려고 파일을 퍼뜨리지 않습니다.",
        "피해자 식별 정보와 게시 위치를 분리해 기록합니다.",
        "디지털성범죄정보 신고와 플랫폼 삭제 요청을 병행합니다.",
        "미성년자 관련이면 보호자·학교보다 전문기관과 먼저 대응 범위를 정합니다.",
      ],
      evidenceToKeep: ["URL", "게시 제목 또는 방 이름", "게시자 ID", "발견 일시", "피해자 신상 노출 여부"],
      helperActions: ["합성물을 확인해달라는 요청 거절", "신고 화면까지 동행", "피해자 신상 언급 차단", "학교·직장 대응문 초안 작성 지원"],
      preventionForOthers: ["합성물 제작·요청·공유도 피해를 키운다는 안내", "커뮤니티 신고 규칙 고정 공지", "피해자 이름 검색·조롱 금지"],
      doNotDo: ["합성물 진위 판별을 위해 주변에 보내기", "피해자 사진을 더 수집하기", "가해자 추정 계정에 공개 댓글로 대응"],
      primaryRoutes: ["방송미디어통신심의위원회 1377", "중앙디지털성범죄피해자지원센터", "경찰청 ECRM"],
    },
    {
      id: "online-grooming",
      crimeType: "온라인 그루밍·미성년자 유인",
      riskSignals: ["그루밍: 친밀감을 이용한 통제 정황", "미성년: 아동·청소년 피해 가능성", "비밀: 주변에 말하지 말라는 압박", "만남: 오프라인 만남 요구"],
      requiredMeasures: [
        "피해자를 비난하지 않고 즉시 안전한 어른·기관 연결",
        "대화 삭제 전에 상담기관 또는 경찰 안내 확인",
        "오프라인 만남 중단과 위치 안전 확보",
        "미성년자는 보호자 동의 없이도 전문기관 상담 가능 여부 확인",
      ],
      responseSteps: [
        "피해자가 스스로 말할 수 있도록 대화를 끊지 않고 안전을 먼저 확인합니다.",
        "상대방과 직접 논쟁하거나 함정 대화를 시도하지 않습니다.",
        "대화 기록, 계정, 만남 요구 시각을 정리합니다.",
        "1366, 중앙센터, 경찰 상담을 통해 신고와 보호조치를 정합니다.",
      ],
      evidenceToKeep: ["상대 계정", "대화 시각", "만남 요구", "비밀 유지 요구", "성적 요구 또는 압박 여부"],
      helperActions: ["혼내지 않기", "기기 압수보다 안전한 상담 연결", "보호자·학교 통보 범위는 피해자 안전 기준으로 결정", "전문기관 동행"],
      preventionForOthers: ["청소년 대상 비밀 대화·선물·만남 요구 위험 신호 교육", "피해 고백 시 처벌보다 보호가 먼저라는 원칙 공유", "학교 단위 익명 상담 경로 공지"],
      doNotDo: ["피해자를 꾸짖어 침묵하게 만들기", "가해 의심자에게 직접 연락", "대화방 잠입·함정수사 흉내"],
      primaryRoutes: ["여성긴급전화 1366", "중앙디지털성범죄피해자지원센터", "경찰청 ECRM"],
    },
    {
      id: "sexual-harassment-doxxing",
      crimeType: "사이버 성적 괴롭힘·신상노출",
      riskSignals: ["성적 괴롭힘: 성적 모욕·조롱", "신상: 개인정보와 성적 내용 결합", "조리돌림: 다수 참여 괴롭힘", "악성댓글: 반복적 성적 모욕"],
      requiredMeasures: [
        "문제 표현, URL, 작성자, 게시 시각을 정리",
        "플랫폼 신고와 개인정보침해 신고센터 상담 병행",
        "피해자 신상 추가 노출을 막는 공지 또는 차단 요청",
        "반복·집단 괴롭힘이면 경찰·법률 상담 검토",
      ],
      responseSteps: [
        "모욕 표현을 반복해서 읽지 않도록 한 사람이 대신 정리합니다.",
        "성적 내용과 개인정보 노출 항목을 나누어 기록합니다.",
        "플랫폼 삭제 요청 후 KISA, 온라인피해365센터, 법률 상담 경로를 선택합니다.",
        "2차 가해 댓글은 별도 URL로 누적 기록합니다.",
      ],
      evidenceToKeep: ["게시 URL", "문제 표현", "개인정보 노출 항목", "작성자 ID", "반복 게시 정황"],
      helperActions: ["대신 캡처·목록화하되 원본 공유 금지", "피해자에게 댓글을 읽게 하지 않기", "차단·신고 버튼 위치 안내", "상담 문서 정리"],
      preventionForOthers: ["피해자 실명 언급 금지", "댓글 캡처 재게시 금지", "커뮤니티 운영자에게 즉시 삭제·차단 요청"],
      doNotDo: ["악성 댓글에 공개적으로 맞대응", "피해자 신상 확인 질문", "조롱성 캡처 공유"],
      primaryRoutes: ["KISA 개인정보침해 신고센터", "온라인피해365센터", "대한법률구조공단"],
    },
  ];
}

function buildGeneralOnlineAbusePattern(): DigitalSexCrimePatternResponse {
  return {
    id: "general-online-abuse",
    crimeType: "디지털 피해 가능성 확인 필요",
    riskSignals: ["불명확: 아직 유형이 확정되지 않음"],
    requiredMeasures: ["URL과 피해 설명만 최소 정리", "비밀번호·주민등록번호·피해물 원본 입력 금지", "온라인피해365센터 또는 관련 공식기관 상담"],
    responseSteps: ["피해 유형을 성급히 단정하지 않습니다.", "확인된 사실과 추정을 분리합니다.", "공식 상담에서 어느 기관으로 갈지 확인합니다."],
    evidenceToKeep: ["발견 일시", "게시 위치", "상대 계정", "피해 내용", "이미 한 조치"],
    helperActions: ["피해자 말 끊지 않기", "원본 제출 요구하지 않기", "상담 연결 동행"],
    preventionForOthers: ["링크 재공유 금지", "피해자 실명 언급 금지", "공식 신고 경로 안내"],
    doNotDo: ["무단 추적", "신상 공개", "피해물 확인 요청"],
    primaryRoutes: ["온라인피해365센터", "KISA 개인정보침해 신고센터", "대한법률구조공단"],
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
