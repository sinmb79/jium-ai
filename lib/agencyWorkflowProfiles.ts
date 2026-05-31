import { getEvidenceLedger } from "@/lib/evidence";
import type { CaseClassification, CaseInput, CaseType, EvidenceItem, ResponsePack } from "@/lib/types";

export type AgencyWorkflowKind = "VICTIM_SUPPORT" | "POLICE_REPORT" | "PRIVACY_REPORT" | "CONTENT_REVIEW" | "ONLINE_HARM_HUB" | "LEGAL_SUPPORT";

export type AgencyWorkflowProfile = {
  id: string;
  name: string;
  kind: AgencyWorkflowKind;
  priority: number;
  url: string;
  phone?: string;
  caseTypes: Array<CaseType | "ALL">;
  useWhen: string;
  urgentTriggers: string[];
  requiredCaseFacts: string[];
  evidenceChecklist: string[];
  submissionSteps: string[];
  doNotSend: string[];
  lawfulAuthorityBoundary: string;
  privacyNotice: string;
  followUpRecords: string[];
  sourceNote: string;
};

export type AgencyReadinessStatus = "READY_TO_SUBMIT" | "NEEDS_REVIEW" | "MISSING_CORE";

export type AgencyReadinessItem = {
  id: string;
  label: string;
  status: "READY" | "MISSING" | "NEEDS_REVIEW";
  detail: string;
};

export type AgencyWorkflowReadiness = {
  profileId: string;
  score: number;
  status: AgencyReadinessStatus;
  readyItems: AgencyReadinessItem[];
  missingItems: AgencyReadinessItem[];
  reviewItems: AgencyReadinessItem[];
  warnings: string[];
  nextAction: string;
};

export type AgencyWorkflowRecommendation = {
  profile: AgencyWorkflowProfile;
  readiness: AgencyWorkflowReadiness;
  whyThisAgency: string;
};

export type AgencyWorkflowPlan = {
  generatedAt: string;
  summary: string;
  recommendations: AgencyWorkflowRecommendation[];
  safetyBoundary: string[];
};

export const AGENCY_WORKFLOW_PROFILES: AgencyWorkflowProfile[] = [
  {
    id: "d4u",
    name: "중앙디지털성범죄피해자지원센터",
    kind: "VICTIM_SUPPORT",
    priority: 10,
    url: "https://d4u.stop.or.kr/main",
    phone: "02-735-8994",
    caseTypes: ["DIGITAL_SEX_CRIME"],
    useWhen: "불법촬영, 비동의 유포, 유포 협박, 딥페이크 등 디지털 성범죄 피해가 의심될 때 가장 먼저 상담과 삭제지원을 연결합니다.",
    urgentTriggers: ["유포 협박", "재유포 확산", "피해자 신상정보 동시 노출", "아동·청소년 피해", "자해 위험 또는 신변 위협"],
    requiredCaseFacts: ["피해 유형", "최초 발견 시각", "게시 위치 또는 플랫폼", "협박·금전 요구 여부", "이미 요청한 삭제·신고 이력"],
    evidenceChecklist: ["URL 또는 플랫폼명", "게시 위치 설명", "발견·캡처 시각", "캡처 보유 여부", "증거 해시 또는 메타데이터 지문", "가해자 별칭·연락 단서"],
    submissionSteps: [
      "지움AI 제출 패킷에서 사건 요약과 증거 체인 매니페스트를 확인합니다.",
      "원본 피해물을 다시 내려받거나 전송하지 말고, URL·위치·시각·캡처 보유 여부를 먼저 상담에 전달합니다.",
      "상담 안내에 따라 삭제지원, 유포 모니터링, 수사·법률·의료 연계를 분리해 진행합니다.",
      "접수번호와 안내받은 다음 조치를 증거 장부 요청 이력에 추가합니다.",
    ],
    doNotSend: ["피해물 원본 파일을 임의 공유", "폐쇄형 채널 접근 시도", "가해자에게 직접 협상", "비밀번호·인증번호"],
    lawfulAuthorityBoundary: "플랫폼 로그, IP, 가입자 정보, 결제 흐름은 전문기관 연계 후 수사기관 또는 법원 절차로 요청해야 합니다.",
    privacyNotice: "상담 전 지움AI에는 정확 신분증, 계정 비밀번호, 원본 피해물을 보관하지 않는 흐름을 유지합니다.",
    followUpRecords: ["상담 일시", "접수번호", "삭제지원 접수 여부", "모니터링 요청 범위", "연계 기관", "다음 연락 예정일"],
    sourceNote: "공식 사이트: d4u.stop.or.kr",
  },
  {
    id: "ecrm",
    name: "경찰청 사이버범죄 신고시스템",
    kind: "POLICE_REPORT",
    priority: 20,
    url: "https://ecrm.police.go.kr",
    phone: "112 / 182",
    caseTypes: ["DIGITAL_SEX_CRIME", "CREDENTIAL_LEAK", "IMPERSONATION", "DEFAMATION_PRIVACY", "PERSONAL_INFO_EXPOSURE"],
    useWhen: "수사를 원하거나 협박, 금전 요구, 사칭, 계정침해, 반복 유포처럼 범죄성이 강한 단서가 있을 때 신고 준비 자료로 사용합니다.",
    urgentTriggers: ["현재 협박 또는 신변 위협", "금전 요구", "피해자 신상 공개", "가해자 연락 지속", "계정 침해 또는 추가 범행 가능성"],
    requiredCaseFacts: ["피해자 진술 요약", "피해 일시와 장소", "가해자 별칭·계정 단서", "피해 과정", "증빙자료 목록"],
    evidenceChecklist: ["URL·플랫폼", "발견·캡처 시각", "대화·협박 메시지 보유 여부", "계정·별칭 단서", "증거 해시", "기존 신고·삭제 요청 이력"],
    submissionSteps: [
      "제출 패킷에서 사실과 추정을 분리해 경찰 신고 준비서를 확인합니다.",
      "ECRM 사전 접수 화면에는 피해자가 확인한 사실, 증거 목록, 원하는 조치를 중심으로 입력합니다.",
      "긴급 신변 위험이 있으면 온라인 접수보다 112 또는 가까운 경찰관서가 우선입니다.",
      "접수 후 사건번호, 담당 관서, 보강 요청을 지움AI 증거 장부에 기록합니다.",
    ],
    doNotSend: ["추정 신원을 사실처럼 단정", "불법 접속으로 얻은 자료", "피해물 원본의 불필요한 재전송", "수사권한이 필요한 IP 역추적 시도 결과"],
    lawfulAuthorityBoundary: "IP, 가입자 정보, 결제·암호화폐 흐름, 서버 로그 보존은 경찰 수사 절차로 요청해야 합니다.",
    privacyNotice: "주민등록번호, 주소 등 고위험 개인정보는 공식 신고 화면 또는 경찰 안내에 따라 필요한 범위에서만 입력합니다.",
    followUpRecords: ["접수번호", "담당 관서", "담당자 연락", "보강 제출일", "압수·보존 요청 여부", "삭제 조치와 수사 조치 분리 기록"],
    sourceNote: "공식 사이트: ecrm.police.go.kr",
  },
  {
    id: "privacy-kisa",
    name: "KISA 개인정보침해 신고센터",
    kind: "PRIVACY_REPORT",
    priority: 30,
    url: "https://privacy.kisa.or.kr",
    phone: "118",
    caseTypes: ["PERSONAL_INFO_EXPOSURE", "CREDENTIAL_LEAK", "IMPERSONATION"],
    useWhen: "주민번호, 연락처, 주소, 계정정보, 사진 등 개인정보 침해·유출이 핵심일 때 신고와 상담을 준비합니다.",
    urgentTriggers: ["신분증·주민번호 노출", "계정정보 유출", "2차 사기 가능성", "대량 재게시", "사업자 삭제 불응"],
    requiredCaseFacts: ["침해된 개인정보 종류", "게시 위치 또는 사업자", "노출 시각", "삭제 요청 이력", "피해 확산 정황"],
    evidenceChecklist: ["URL 또는 화면 위치", "노출된 정보 종류", "캡처 보유 여부", "사업자·플랫폼명", "요청 이력", "접수번호"],
    submissionSteps: [
      "개인정보 종류와 노출 위치를 분리해 신고 요약을 만듭니다.",
      "사업자 또는 플랫폼에 이미 요청한 내용과 답변을 증거 장부에 정리합니다.",
      "KISA 공식 신고·상담 경로에서 필요한 개인정보만 입력합니다.",
      "접수번호와 추가 제출 요청을 제출 버전 비교에 남깁니다.",
    ],
    doNotSend: ["비밀번호·인증번호", "신분증 전체 사본의 불필요한 보관", "피해와 무관한 가족 개인정보", "원본 피해물 재배포"],
    lawfulAuthorityBoundary: "사업자 보유 로그와 가입자 정보 확인은 공식 신고·수사 절차에 따라야 합니다.",
    privacyNotice: "고위험 식별자료는 지움AI 로컬 보관함에도 최소화하고, 필요하면 기관 제출 직전에 별도로 준비합니다.",
    followUpRecords: ["상담·신고 접수번호", "사업자 답변", "삭제 또는 차단 처리일", "추가 피해 확인일", "재노출 여부"],
    sourceNote: "공식 사이트: privacy.kisa.or.kr",
  },
  {
    id: "kcsc",
    name: "방송미디어통신심의위원회 신고",
    kind: "CONTENT_REVIEW",
    priority: 40,
    url: "https://www.kocsc.or.kr",
    phone: "1377",
    caseTypes: ["DIGITAL_SEX_CRIME", "DEFAMATION_PRIVACY", "SEARCH_RESULT_REMOVAL", "IMPERSONATION"],
    useWhen: "플랫폼 삭제 요청만으로 해결되지 않거나 불법·권리침해 정보의 삭제·접속차단 심의가 필요할 때 사용합니다.",
    urgentTriggers: ["불법촬영물·허위영상물 유포", "피해자 신상정보 동시 게시", "반복 재게시", "해외 사이트 또는 삭제 불응", "검색 노출 확산"],
    requiredCaseFacts: ["문제 URL", "권리침해 또는 불법성 소명", "삭제 요청 이력", "캡처 보유 여부", "피해자와 게시물의 관련성"],
    evidenceChecklist: ["URL별 캡처", "게시 위치", "검색결과 위치", "삭제 요청·답변 이력", "증거 체인 지문", "재노출 확인 기록"],
    submissionSteps: [
      "URL별로 게시 위치, 발견 시각, 캡처 시각을 분리합니다.",
      "삭제 요청 이력이 있으면 접수번호와 답변을 함께 제출합니다.",
      "심의 대상이 디지털성범죄라면 D4U 상담과 수사 신고 여부를 병행 검토합니다.",
      "삭제·차단 후에도 재노출 여부를 별도 증거로 계속 기록합니다.",
    ],
    doNotSend: ["불필요한 원본 피해물", "확인되지 않은 가해자 실명 단정", "비공개방 접근 시도 내역", "무관한 제3자 개인정보"],
    lawfulAuthorityBoundary: "심의·삭제·차단 요청과 형사 수사는 다른 절차이므로 경찰 신고와 심의 요청을 혼동하지 않도록 분리합니다.",
    privacyNotice: "심의 요청에는 URL, 위치, 캡처 설명 중심으로 제출하고 원본 공유는 공식 안내가 있을 때만 제한적으로 합니다.",
    followUpRecords: ["심의 신청일", "접수번호", "삭제·차단 결정", "플랫폼 처리일", "재노출 확인일", "경찰 또는 전문기관 병행 여부"],
    sourceNote: "공식 사이트: kocsc.or.kr",
  },
  {
    id: "online365",
    name: "온라인피해365센터",
    kind: "ONLINE_HARM_HUB",
    priority: 50,
    url: "https://www.helpos.kr",
    phone: "142-235",
    caseTypes: ["ALL"],
    useWhen: "피해 유형이 복합적이거나 어느 기관으로 가야 할지 확신이 없을 때 1차 상담과 기관 연계를 받습니다.",
    urgentTriggers: ["피해 유형이 여러 개", "삭제·수사·개인정보 이슈가 섞임", "가족 또는 대리 지원 필요", "담당 기관 선택이 어려움"],
    requiredCaseFacts: ["피해 내용 요약", "발생 일시", "플랫폼 또는 URL", "이미 연락한 기관", "원하는 조치"],
    evidenceChecklist: ["피해 요약", "URL·플랫폼", "캡처 보유 여부", "긴급성", "기존 접수번호", "추가 상담 질문"],
    submissionSteps: [
      "지움AI 사건 요약을 상담용으로 복사합니다.",
      "피해 유형이 섞인 부분을 상담 질문으로 정리합니다.",
      "상담 결과 안내받은 기관, 준비물, 기한을 사건 노트에 기록합니다.",
      "다음 제출 전 제출 버전을 저장해 상담 전후 변화를 비교합니다.",
    ],
    doNotSend: ["계정 비밀번호", "인증번호", "피해물 원본 공개 전송", "민간 상담글에 민감정보 전체 공개"],
    lawfulAuthorityBoundary: "온라인피해365는 기관 연계와 상담 창구이며, 수사권한이 필요한 자료는 경찰·법원 절차로 분리해야 합니다.",
    privacyNotice: "상담에는 필요한 범위의 요약을 먼저 사용하고, 민감 원문은 기관 안내에 따라 별도 제출합니다.",
    followUpRecords: ["상담 접수일", "안내받은 기관", "상담 요약", "추가 제출물", "후속 기한"],
    sourceNote: "공식 사이트: helpos.kr",
  },
  {
    id: "legal-aid",
    name: "대한법률구조공단",
    kind: "LEGAL_SUPPORT",
    priority: 70,
    url: "https://www.klac.or.kr",
    phone: "132",
    caseTypes: ["DIGITAL_SEX_CRIME", "DEFAMATION_PRIVACY", "PERSONAL_INFO_EXPOSURE", "IMPERSONATION", "UNKNOWN"],
    useWhen: "고소, 손해배상, 접근금지, 피해자 보호, 민간 서비스 비용 부담을 상담해야 할 때 사용합니다.",
    urgentTriggers: ["가해자 특정 후 법적 조치 필요", "합의·협박 연락", "민사·형사 절차 병행", "비용 부담 문제"],
    requiredCaseFacts: ["사건 요약", "증거 목록", "상대방 단서", "원하는 법적 조치", "이미 접수한 기관"],
    evidenceChecklist: ["증거 체인", "삭제·신고 이력", "상대방 단서", "피해 지속성", "상담 질문", "기한"],
    submissionSteps: [
      "지움AI의 형사고소 상담 메모와 제출 패킷을 상담자료로 정리합니다.",
      "원하는 조치를 삭제, 수사, 손해배상, 보호조치로 나눕니다.",
      "상담 후 필요한 보강 증거와 기한을 사건 노트에 기록합니다.",
    ],
    doNotSend: ["피해물 원본의 공개 상담글 업로드", "상대방 개인정보 과다 노출", "확인되지 않은 주장", "비밀번호·인증번호"],
    lawfulAuthorityBoundary: "법률상담은 수사기관 제출을 대체하지 않으며, 긴급 범죄 신고는 경찰 절차가 우선입니다.",
    privacyNotice: "상담 예약 단계에서는 사실관계와 증거 보유 여부만 공유하고 민감 원본은 안전한 제출 채널을 확인한 뒤 전달합니다.",
    followUpRecords: ["상담일", "상담기관", "권고 조치", "필요 서류", "기한", "대리인 선임 여부"],
    sourceNote: "공식 사이트: klac.or.kr",
  },
];

function compact(value?: string) {
  return value?.trim() || "";
}

function hasCaseType(profile: AgencyWorkflowProfile, caseType: CaseType) {
  return profile.caseTypes.includes("ALL") || profile.caseTypes.includes(caseType);
}

function evidenceHasAccessPath(item: EvidenceItem) {
  return Boolean(compact(item.url) || compact(item.platform) || compact(item.location));
}

function readinessItem(id: string, label: string, status: AgencyReadinessItem["status"], detail: string): AgencyReadinessItem {
  return { id, label, status, detail };
}

function anyEvidence(items: EvidenceItem[], predicate: (item: EvidenceItem) => boolean) {
  return items.some(predicate);
}

function allEvidenceWithPath(items: EvidenceItem[], predicate: (item: EvidenceItem) => boolean) {
  const pathItems = items.filter(evidenceHasAccessPath);
  return pathItems.length > 0 && pathItems.every(predicate);
}

function partialStatus(items: EvidenceItem[], predicate: (item: EvidenceItem) => boolean): AgencyReadinessItem["status"] {
  if (!items.length) {
    return "MISSING";
  }
  if (allEvidenceWithPath(items, predicate)) {
    return "READY";
  }
  return anyEvidence(items, predicate) ? "NEEDS_REVIEW" : "MISSING";
}

function statusDetail(status: AgencyReadinessItem["status"], ready: string, partial: string, missing: string) {
  if (status === "READY") {
    return ready;
  }
  return status === "NEEDS_REVIEW" ? partial : missing;
}

function caseTypeReason(profile: AgencyWorkflowProfile, classification: CaseClassification) {
  if (profile.caseTypes.includes("ALL")) {
    return "피해 유형이 복합적이거나 기관 선택이 어려울 때 상담 허브로 적합합니다.";
  }
  if (profile.caseTypes.includes(classification.caseType)) {
    return `${classification.caseType} 유형의 공식 처리 경로에 포함됩니다.`;
  }
  return "응답 패킷의 기관 후보 또는 보조 법률지원 경로로 포함되었습니다.";
}

function selectedProfileIds(classification: CaseClassification, responsePack?: ResponsePack) {
  const ids = new Set<string>();
  AGENCY_WORKFLOW_PROFILES.filter((profile) => hasCaseType(profile, classification.caseType)).forEach((profile) => ids.add(profile.id));

  (responsePack?.serviceIntegrations || []).forEach((service) => {
    if (AGENCY_WORKFLOW_PROFILES.some((profile) => profile.id === service.id)) {
      ids.add(service.id);
    }
    if (service.id === "privacy-kisa") {
      ids.add("privacy-kisa");
    }
  });

  if (classification.caseType === "DIGITAL_SEX_CRIME") {
    ids.add("d4u");
    ids.add("ecrm");
    ids.add("kcsc");
  }
  if (classification.caseType === "PERSONAL_INFO_EXPOSURE" || classification.caseType === "CREDENTIAL_LEAK") {
    ids.add("privacy-kisa");
  }
  if (classification.riskLevel === "HIGH" || classification.riskLevel === "CRITICAL" || classification.specialistFirst) {
    ids.add("online365");
  }
  ids.add("online365");

  return ids;
}

export function buildAgencyWorkflowReadiness(input: CaseInput, profile: AgencyWorkflowProfile): AgencyWorkflowReadiness {
  const items = getEvidenceLedger(input);
  const hasDescription = Boolean(compact(input.description) || compact(input.situation) || compact(input.title));
  const hasExposureType = input.exposedInfo.length > 0 || /개인정보|영상|이미지|사진|협박|사칭|계정|유출/.test([input.description, input.situation, input.title].join(" "));
  const hasAccess = anyEvidence(items, evidenceHasAccessPath);
  const foundStatus = partialStatus(items, (item) => Boolean(compact(item.foundAt)));
  const capturedStatus = partialStatus(items, (item) => Boolean(compact(item.capturedAt)));
  const captureMethodStatus = partialStatus(items, (item) => Boolean(item.captureMethod && item.captureMethod !== "UNKNOWN"));
  const hashStatus = partialStatus(items, (item) => Boolean(compact(item.evidenceHash) || compact(item.metadataFingerprint)));
  const hasRequestLog = anyEvidence(items, (item) => Boolean(item.requestLogs?.length || compact(item.submissionTarget)));
  const hasActorClue = anyEvidence(items, (item) => Boolean(compact(item.posterId) || compact(item.notes)));
  const hasUrl = anyEvidence(items, (item) => Boolean(compact(item.url)));

  const checks: AgencyReadinessItem[] = [
    readinessItem(
      "case-summary",
      "피해사실 요약",
      hasDescription ? "READY" : "MISSING",
      hasDescription ? "사건 설명 또는 제목이 입력되어 있습니다." : "기관 제출 전에 피해 사실을 3~5문장으로 정리해야 합니다.",
    ),
    readinessItem(
      "exposure-type",
      "피해 유형·노출 정보",
      hasExposureType ? "READY" : "MISSING",
      hasExposureType ? "노출 정보 또는 피해 유형 단서가 있습니다." : "어떤 정보·이미지·계정·권리가 침해됐는지 선택하거나 설명하세요.",
    ),
    readinessItem(
      "access-path",
      "URL·플랫폼·게시 위치",
      hasAccess ? "READY" : "MISSING",
      hasAccess ? "최소 1개 접근경로가 증거 장부에 있습니다." : "기관이 확인할 수 있는 URL, 플랫폼명, 게시 위치 중 하나 이상이 필요합니다.",
    ),
    readinessItem("found-at", "발견 일시", foundStatus, statusDetail(foundStatus, "접근경로별 발견 시각이 기록되어 있습니다.", "일부 접근경로의 발견 시각을 더 보강하면 좋습니다.", "최초 발견 일시를 기록하세요.")),
    readinessItem(
      "captured-at",
      "캡처·기록 일시",
      capturedStatus,
      statusDetail(capturedStatus, "접근경로별 캡처 또는 기록 시각이 있습니다.", "일부 접근경로의 캡처 시각을 보강하세요.", "삭제·차단 전후를 입증할 캡처 또는 기록 시각이 필요합니다."),
    ),
    readinessItem(
      "capture-method",
      "기록 방식",
      captureMethodStatus,
      statusDetail(captureMethodStatus, "기록 방식이 분류되어 있습니다.", "일부 접근경로의 기록 방식을 확인하세요.", "사용자 캡처, 검색결과, 플랫폼 회신 등 기록 방식을 선택하세요."),
    ),
    readinessItem(
      "integrity",
      "증거 지문·해시",
      hashStatus,
      statusDetail(hashStatus, "증거 해시 또는 메타데이터 지문이 있습니다.", "일부 증거의 해시 또는 지문 보강이 필요합니다.", "가능하면 파일 해시 또는 메타데이터 지문을 남겨 무결성을 보강하세요."),
    ),
    readinessItem(
      "identity-private",
      "피해자 본인확인 정보",
      "NEEDS_REVIEW",
      "지움AI에는 보관하지 말고 공식 기관 양식 또는 상담 안내에 따라 별도로 입력합니다.",
    ),
  ];

  if (profile.id === "d4u") {
    checks.push(
      readinessItem(
        "d4u-urgent-context",
        "협박·재유포·긴급성",
        input.urgent || /협박|재유포|금전|딥페이크|불법촬영/.test([input.description, input.situation, input.keywords].join(" ")) ? "READY" : "NEEDS_REVIEW",
        "긴급 위험이 없더라도 상담 시 협박·재유포·신상노출 여부를 확인해야 합니다.",
      ),
    );
  }

  if (profile.id === "ecrm") {
    checks.push(
      readinessItem(
        "actor-clue",
        "가해자 별칭·계정 단서",
        hasActorClue ? "READY" : "NEEDS_REVIEW",
        hasActorClue ? "별칭, 계정, 메모 단서가 있습니다." : "확인된 별칭·계정·연락 단서가 없으면 사실대로 '미상'으로 두고 수사기관 확인 요청으로 분리합니다.",
      ),
      readinessItem(
        "request-history",
        "기존 신고·삭제 요청 이력",
        hasRequestLog ? "READY" : "NEEDS_REVIEW",
        hasRequestLog ? "제출 대상 또는 요청 이력이 기록되어 있습니다." : "아직 접수 전이면 제출 후 접수번호와 요청 이력을 이어서 기록하세요.",
      ),
    );
  }

  if (profile.id === "privacy-kisa") {
    checks.push(
      readinessItem(
        "privacy-data-kind",
        "침해 개인정보 종류",
        input.exposedInfo.length ? "READY" : "MISSING",
        input.exposedInfo.length ? `노출 정보 ${input.exposedInfo.length}개가 선택되어 있습니다.` : "연락처, 주소, 계정정보, 신분증 등 침해된 개인정보 종류를 선택하세요.",
      ),
    );
  }

  if (profile.id === "kcsc") {
    checks.push(
      readinessItem(
        "url-by-url",
        "URL별 심의 대상 정리",
        hasUrl ? "READY" : "MISSING",
        hasUrl ? "심의 요청에 사용할 URL 단서가 있습니다." : "접속차단·심의 요청에는 가능한 한 문제 URL이 필요합니다.",
      ),
      readinessItem(
        "platform-request-log",
        "플랫폼 삭제 요청 이력",
        hasRequestLog ? "READY" : "NEEDS_REVIEW",
        hasRequestLog ? "제출 대상 또는 요청 이력이 기록되어 있습니다." : "삭제 요청 전이라면 우선 요청 여부를 검토하고, 불응·재노출 시 기록하세요.",
      ),
    );
  }

  const readyItems = checks.filter((item) => item.status === "READY");
  const missingItems = checks.filter((item) => item.status === "MISSING");
  const reviewItems = checks.filter((item) => item.status === "NEEDS_REVIEW");
  const weighted = checks.reduce((score, item) => score + (item.status === "READY" ? 1 : item.status === "NEEDS_REVIEW" ? 0.5 : 0), 0);
  const score = Math.round((weighted / Math.max(checks.length, 1)) * 100);
  const missingCore = missingItems.some((item) => ["case-summary", "exposure-type", "access-path", "privacy-data-kind", "url-by-url"].includes(item.id));
  const status: AgencyReadinessStatus = missingCore ? "MISSING_CORE" : score >= 78 ? "READY_TO_SUBMIT" : "NEEDS_REVIEW";

  return {
    profileId: profile.id,
    score,
    status,
    readyItems,
    missingItems,
    reviewItems,
    warnings: [
      "피해물 원본은 지움AI에 업로드하지 말고 기관 안내에 따라 최소 범위로만 제출하세요.",
      "IP, 가입자 정보, 결제·암호화폐 흐름, 서버 로그는 피해자가 직접 확인할 대상이 아니라 공식 수사·심의 절차 요청사항입니다.",
      "폐쇄형 메신저방, 다크웹, 유료방은 피해자가 접근하지 않고 공개 홍보면·제보 단서만 기록합니다.",
    ],
    nextAction:
      status === "MISSING_CORE"
        ? "핵심 사실과 접근경로를 먼저 보강한 뒤 제출 패킷을 다시 생성하세요."
        : status === "READY_TO_SUBMIT"
          ? "제출 전 원문과 민감정보 범위를 확인하고 공식 화면 또는 상담 경로로 이동하세요."
          : "보강 항목을 확인한 뒤 상담 또는 공식 신고 화면에서 부족한 내용은 '미상'으로 분리해 제출하세요.",
  };
}

export function buildAgencyWorkflowPlan(input: CaseInput, classification: CaseClassification, responsePack?: ResponsePack, generatedAt = new Date().toISOString()): AgencyWorkflowPlan {
  const ids = selectedProfileIds(classification, responsePack);
  const recommendations = AGENCY_WORKFLOW_PROFILES.filter((profile) => ids.has(profile.id))
    .sort((left, right) => left.priority - right.priority)
    .slice(0, 5)
    .map((profile) => ({
      profile,
      readiness: buildAgencyWorkflowReadiness(input, profile),
      whyThisAgency: caseTypeReason(profile, classification),
    }));

  const firstReady = recommendations.find((item) => item.readiness.status === "READY_TO_SUBMIT");
  const firstMissing = recommendations.find((item) => item.readiness.status === "MISSING_CORE");

  return {
    generatedAt,
    summary: firstReady
      ? `${firstReady.profile.name} 제출 준비도가 가장 높습니다. 공식 제출 전 민감 원문과 원본 피해물 취급 범위만 다시 확인하세요.`
      : firstMissing
        ? `${firstMissing.profile.name} 제출 전 핵심 사실 보강이 필요합니다. URL·게시 위치·피해 유형을 먼저 채우세요.`
        : "기관 제출 전 일부 보강 항목이 남아 있습니다. 상담 경로를 먼저 열어 부족한 항목은 미상으로 분리해 설명하세요.",
    recommendations,
    safetyBoundary: [
      "자동 제출하지 않습니다. 사용자가 패킷을 확인한 뒤 공식 기관 화면 또는 상담 채널에서 직접 제출합니다.",
      "실제 범죄 사이트 목록, 비공개방 주소, 초대 링크, 다크웹 주소는 제품 기본 데이터로 제공하지 않습니다.",
      "비식별 패턴 학습은 기관·전문가 검증 데이터 또는 사용자가 직접 확인한 공개 표면 단서만 사용합니다.",
    ],
  };
}

export function agencyWorkflowPlanToMarkdown(plan: AgencyWorkflowPlan) {
  return `### 기관별 제출 워크플로·준비도

생성일: ${new Date(plan.generatedAt).toLocaleString("ko-KR")}

요약: ${plan.summary}

${plan.recommendations
  .map(
    ({ profile, readiness }, index) => `${index + 1}. ${profile.name}
   - 준비도: ${readiness.score}점 / ${readiness.status}
   - 링크: ${profile.url}${profile.phone ? ` / 전화: ${profile.phone}` : ""}
   - 사용 시점: ${profile.useWhen}
   - 추천 이유: ${profile.sourceNote}
   - 다음 행동: ${readiness.nextAction}
   - 제출 순서:
${profile.submissionSteps.map((step) => `     - ${step}`).join("\n")}
   - 보강 필요:
${readiness.missingItems.length ? readiness.missingItems.map((item) => `     - ${item.label}: ${item.detail}`).join("\n") : "     - 핵심 누락 항목 없음"}
   - 제출 전 확인:
${readiness.reviewItems.length ? readiness.reviewItems.map((item) => `     - ${item.label}: ${item.detail}`).join("\n") : "     - 추가 확인 항목 없음"}
   - 보내지 않을 것:
${profile.doNotSend.map((item) => `     - ${item}`).join("\n")}
   - 후속 기록:
${profile.followUpRecords.map((item) => `     - ${item}`).join("\n")}`,
  )
  .join("\n\n")}

안전 경계:
${plan.safetyBoundary.map((item) => `- ${item}`).join("\n")}
`;
}
