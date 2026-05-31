import { detectDigitalCrimeRoutePatterns } from "@/lib/digitalCrimeRouteKnowledge";
import { getEvidenceLedger } from "@/lib/evidence";
import { CASE_TYPE_LABELS } from "@/lib/labels";
import type { CaseClassification, CaseInput, EvidenceItem, TraceSignalSeverity } from "@/lib/types";

export type DiscoveryAuthority = "VICTIM_SAFE" | "SUPPORTER_SAFE" | "OFFICIAL_ONLY" | "SPECIALIST_ONLY";

export type DiscoveryResearchQuery = {
  id: string;
  query: string;
  purpose: string;
  authority: DiscoveryAuthority;
  boundary: string;
};

export type DiscoveryMatchChannel = {
  id: string;
  label: string;
  authority: DiscoveryAuthority;
  severity: TraceSignalSeverity;
  inputSignals: string[];
  matchingApproach: string[];
  expectedOutput: string[];
  officialHandoff: string[];
  safetyBoundary: string;
};

export type DiscoveryResearchPlan = {
  title: string;
  summary: string;
  generatedAt: string;
  safeQueries: DiscoveryResearchQuery[];
  matchChannels: DiscoveryMatchChannel[];
  evidenceGaps: string[];
  officialPreservationRequests: string[];
  expertLessons: string[];
  boundaries: string[];
};

function compact(value?: string) {
  return value?.trim() || "";
}

function unique(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function itemSignals(item: EvidenceItem) {
  return unique([
    item.platform || "",
    item.location || "",
    item.posterId || "",
    item.foundAt ? `발견 ${item.foundAt}` : "",
    item.capturedAt ? `기록 ${item.capturedAt}` : "",
    item.evidenceHash ? "증거 해시 보유" : "",
    item.hashSource || "",
    item.notes || "",
  ]).slice(0, 8);
}

function makeQuery(id: string, query: string, purpose: string, authority: DiscoveryAuthority = "VICTIM_SAFE"): DiscoveryResearchQuery {
  return {
    id,
    query,
    purpose,
    authority,
    boundary: "사용자가 직접 확인하고, 피해물 원본을 열람·다운로드·재공유하지 않는 범위에서만 사용합니다.",
  };
}

function buildSafeQueries(input: CaseInput, evidenceItems: EvidenceItem[]) {
  const seeds = unique([
    compact(input.keywords),
    compact(input.platform),
    compact(input.title),
    ...evidenceItems.flatMap((item) => [compact(item.posterId), compact(item.platform), compact(item.location), compact(item.url)]),
  ]).slice(0, 8);

  const queries = seeds.flatMap((seed, index) => {
    const items = [makeQuery(`seed-${index}`, seed, "피해자가 이미 알고 있는 단서가 공개 검색·플랫폼 검색에 남아 있는지 확인")];
    if (seed.includes(" ") && seed.length <= 80) {
      items.push(makeQuery(`exact-${index}`, `"${seed}"`, "동일 문구·별칭의 재게시 또는 검색 잔존 여부 확인"));
    }
    return items;
  });

  if (input.exposedInfo.length) {
    queries.push(
      makeQuery(
        "exposed-info-template",
        "[피해자 식별어] [노출 정보 일부]",
        "전화번호·이메일·닉네임처럼 피해자가 직접 알고 있는 최소 식별어 조합으로 공개 노출 여부 확인",
      ),
    );
  }

  return queries.length ? queries.slice(0, 12) : [makeQuery("starter", "[닉네임 또는 게시자 단서] [플랫폼명]", "최초 단서가 부족할 때 공개 검색용 기본 템플릿")];
}

function buildEvidenceGaps(evidenceItems: EvidenceItem[]) {
  const gaps = new Set<string>();
  if (!evidenceItems.length) {
    gaps.add("기관 제출을 위해 최소 1개 이상의 URL, 게시 위치, 발견 일시 또는 제보 출처가 필요합니다.");
    return Array.from(gaps);
  }
  if (!evidenceItems.some((item) => compact(item.foundAt))) {
    gaps.add("발견 일시가 없으면 전파 순서를 가설로만 표시해야 합니다.");
  }
  if (!evidenceItems.some((item) => compact(item.capturedAt))) {
    gaps.add("캡처/기록 일시가 없으면 증거 보존 시점을 별도로 설명해야 합니다.");
  }
  if (!evidenceItems.some((item) => compact(item.evidenceHash))) {
    gaps.add("이미지·영상·파일을 직접 제출해야 하는 경우 기관 안내에 따라 해시 또는 포렌식 보존값을 추가해야 합니다.");
  }
  if (!evidenceItems.some((item) => compact(item.posterId))) {
    gaps.add("관찰된 ID·닉네임이 없으면 로그 보존 요청의 대상 플랫폼과 URL 중심으로 정리해야 합니다.");
  }
  return Array.from(gaps);
}

function buildMatchChannels(input: CaseInput, classification: CaseClassification, evidenceItems: EvidenceItem[]): DiscoveryMatchChannel[] {
  const routeMatches = detectDigitalCrimeRoutePatterns(evidenceItems);
  const channels: DiscoveryMatchChannel[] = [
    {
      id: "text-keyword-alias",
      label: "단어·키워드·별칭 매칭",
      authority: "VICTIM_SAFE",
      severity: classification.riskLevel === "CRITICAL" ? "HIGH" : "MEDIUM",
      inputSignals: unique([input.keywords || "", input.platform || "", ...evidenceItems.flatMap((item) => [item.posterId || "", item.location || ""])]).slice(0, 8),
      matchingApproach: ["동일 문구, 별칭, 게시판명, 검색 스니펫을 분리해 비교", "발견 일시 기준으로 원점 후보와 재유포 후보를 나눔", "확인된 사실과 추정을 별도 열에 기록"],
      expectedOutput: ["재게시 후보 URL", "검색 잔존 후보", "동일 별칭 반복 여부", "공식 신고·삭제 요청 대상"],
      officialHandoff: ["플랫폼 신고", "중앙디지털성범죄피해자지원센터", "경찰 ECRM"],
      safetyBoundary: "성적 피해물 원본을 검색어로 노출하거나 주변인에게 확인 요청하지 않습니다.",
    },
    {
      id: "personal-info-variant",
      label: "개인정보 변형 매칭",
      authority: "VICTIM_SAFE",
      severity: "HIGH",
      inputSignals: input.exposedInfo.length ? input.exposedInfo : ["노출 정보 미입력"],
      matchingApproach: ["전화번호 일부, 이메일 일부, 닉네임처럼 피해자가 이미 알고 있는 값만 사용", "주소·주민번호·비밀번호 원문은 입력·저장 금지", "검색 결과 제목·스니펫·캐시 여부만 기록"],
      expectedOutput: ["개인정보 노출 위치", "검색엔진 캐시·스니펫 잔존", "KISA·온라인피해365 상담 대상"],
      officialHandoff: ["KISA 개인정보침해 신고센터", "온라인피해365센터", "플랫폼 개인정보 신고"],
      safetyBoundary: "민감 식별번호와 비밀번호는 지움AI에 넣지 않고, 기관 안내에 따라 별도 제출합니다.",
    },
    {
      id: "visual-fingerprint",
      label: "이미지·영상 지문 매칭",
      authority: "SPECIALIST_ONLY",
      severity: "HIGH",
      inputSignals: evidenceItems.some((item) => item.evidenceHash || item.hashSource) ? evidenceItems.flatMap(itemSignals).slice(0, 8) : ["해시 또는 안전한 시각 지문 미입력"],
      matchingApproach: ["피해물 원본 대신 사용자 기기 또는 기관 안내로 생성한 해시·pHash·썸네일 지문을 사용", "공개 역이미지 검색에 성적 피해물을 업로드하지 않음", "동일·유사 이미지 후보는 기관 또는 플랫폼 신뢰안전팀 권한으로 확인"],
      expectedOutput: ["해시값", "해시 생성 출처", "유사 이미지 후보의 공식 확인 필요성", "반복 유포 여부"],
      officialHandoff: ["중앙디지털성범죄피해자지원센터 삭제지원", "수사기관 포렌식 검토", "플랫폼 신뢰안전팀 해시 매칭"],
      safetyBoundary: "성적 이미지·영상 자체를 AI 서비스나 공개 검색엔진에 업로드하지 않습니다.",
    },
    {
      id: "platform-log-preservation",
      label: "플랫폼 로그·IP 보존 요청 단서",
      authority: "OFFICIAL_ONLY",
      severity: "CRITICAL",
      inputSignals: evidenceItems.flatMap(itemSignals).slice(0, 10),
      matchingApproach: ["URL, 계정, 게시 시각, 접수번호를 묶어 로그 보존 필요성을 표시", "IP·가입자·결제 정보는 피해자가 직접 조회하지 않음", "수사기관 또는 법원 절차로 플랫폼 협조 요청"],
      expectedOutput: ["보존 요청 대상 URL·계정·시간", "게시자 단서", "반복 게시 또는 협박 정황", "수사기관 제출 메모"],
      officialHandoff: ["경찰 ECRM", "수사기관 상담", "변호사 또는 법률구조 상담"],
      safetyBoundary: "지움AI는 IP 추적, 계정 침입, 신원 단정을 수행하지 않습니다.",
    },
  ];

  routeMatches.forEach((match) => {
    channels.push({
      id: `route-${match.id}`,
      label: match.label,
      authority: match.accessLevel === "PUBLIC_GUIDANCE" ? "VICTIM_SAFE" : match.accessLevel === "RESTRICTED_CASE_INDICATOR" ? "SUPPORTER_SAFE" : "OFFICIAL_ONLY",
      severity: match.riskLevel,
      inputSignals: match.matchedEvidenceIds,
      matchingApproach: [match.intelligenceValue, match.handoffQuestion],
      expectedOutput: match.evidenceToRecord,
      officialHandoff: match.officialHandoff,
      safetyBoundary: match.doNotDo.join(" / "),
    });
  });

  return channels;
}

export function buildDiscoveryResearchPlan(input: CaseInput, classification: CaseClassification, generatedAt = new Date().toISOString()): DiscoveryResearchPlan {
  const evidenceItems = getEvidenceLedger(input);
  const matchChannels = buildMatchChannels(input, classification, evidenceItems);

  return {
    title: "초기피해 기반 리서치·매칭 계획",
    summary: `${CASE_TYPE_LABELS[classification.caseType]} 사건의 최초 피해사실을 기준으로 공개 영역은 피해자가 확인하고, 폐쇄형·다크웹·결제·로그 단서는 수사기관 인계로 분리합니다.`,
    generatedAt,
    safeQueries: buildSafeQueries(input, evidenceItems),
    matchChannels,
    evidenceGaps: buildEvidenceGaps(evidenceItems),
    officialPreservationRequests: [
      "플랫폼에는 게시물 URL, 계정/별칭, 발견·게시 추정 시각, 신고 접수번호를 기준으로 로그 보존 필요성을 전달합니다.",
      "IP, 가입자 정보, 접속 로그, 결제·암호화폐 흐름은 수사기관 또는 법원의 적법 절차로 확보해야 합니다.",
      "폐쇄형 메신저, 디스코드 비공개 서버, 다크웹, 유료방 신호는 피해자 직접 확인 대상이 아니라 긴급 인계 신호입니다.",
      "삭제 요청과 증거보전 요청을 분리해, 삭제 후에도 재유포·가해자 특정 수사가 이어질 수 있게 합니다.",
    ],
    expertLessons: [
      "법무부 디지털성범죄 등 대응 TF 자료는 다크웹, 디스코드 등 플랫폼 확장, 암호화폐 결합으로 범죄가 음성화·다양화된다고 본다.",
      "Project ReSET 사례는 24시간 모니터링, 증거 채증 후 경찰 제공, 자체 챗봇과 피해자·주변인 안내, 활동가 워크숍이 함께 돌아가야 한다는 점을 보여준다.",
      "추적단불꽃의 n번방 공론화 사례는 공개 제보·관찰 단서라도 시간순으로 축적하고 언론·수사·지원기관으로 연결할 때 사회적 개입이 가능함을 보여준다.",
      "INTERPOL의 피해자 식별 모델은 이미지·영상 분석이 전문 수사관과 승인된 분석가의 협업 영역이며, 증거에서 출발해 피해자 보호와 가해자 검거로 이어져야 한다고 설명한다.",
      "NIST 디지털 포렌식 지침은 수집·검사·분석·보고 과정에서 무결성과 법률 검토를 강조한다. 지움AI는 법률 판단 대신 보존·보고 구조를 만든다.",
    ],
    boundaries: [
      "불법 사이트 자동 접속, 계정 생성, 잠입, 초대코드 구매, 피해물 다운로드를 하지 않습니다.",
      "피해물 원본을 AI 모델·공개 검색엔진·주변인에게 업로드하거나 공유하지 않습니다.",
      "게시자 실명, 주소, 직장 등 신원은 단정하지 않고 관찰 ID와 근거만 기록합니다.",
      "암호화폐 지갑·결제 식별자는 이미 받은 협박 메시지에 있는 경우만 기록하고, 거래나 접촉을 시도하지 않습니다.",
      "공동 학습에는 피해자 원문, 정확 URL, 방 이름, 초대 링크가 아니라 비식별 패턴·위험도·근거 ID만 남깁니다.",
    ],
  };
}
