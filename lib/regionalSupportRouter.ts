import type { CaseType } from "@/lib/types";

export type SupportRegionId =
  | "SEOUL"
  | "BUSAN"
  | "DAEGU"
  | "INCHEON"
  | "GWANGJU"
  | "DAEJEON"
  | "ULSAN"
  | "SEJONG"
  | "GYEONGGI"
  | "GANGWON"
  | "CHUNGBUK"
  | "CHUNGNAM"
  | "JEONBUK"
  | "JEONNAM"
  | "GYEONGBUK"
  | "GYEONGNAM"
  | "JEJU";

export type RegionalSupportCenter = {
  regionId: SupportRegionId;
  regionName: string;
  centerName: string;
  operatingOrganization: string;
  sourceNote: string;
};

export type RegionalSupportRoute = {
  caseType: CaseType;
  selectedRegion?: SupportRegionId;
  selectedRegionName?: string;
  primaryCenter?: RegionalSupportCenter;
  centralRoutes: {
    name: string;
    phone?: string;
    url?: string;
    useWhen: string;
  }[];
  recommendedOrder: string[];
  prepItems: string[];
  safetyBoundary: string[];
  source: {
    title: string;
    url: string;
    checkedAt: string;
  };
};

export const REGIONAL_SUPPORT_SOURCE = {
  title: "중앙디지털성범죄피해자지원센터 지역 디성센터 현황",
  url: "https://d4u.stop.or.kr/about/region/center",
  checkedAt: "2026-06-01",
} as const;

export const REGIONAL_SUPPORT_CENTERS: RegionalSupportCenter[] = [
  {
    regionId: "SEOUL",
    regionName: "서울",
    centerName: "서울디지털성범죄피해자지원센터",
    operatingOrganization: "서울디지털성범죄안심지원센터",
    sourceNote: "D4U 2025 리플릿 기준 지역 디성센터",
  },
  {
    regionId: "BUSAN",
    regionName: "부산",
    centerName: "부산디지털성범죄피해자지원센터",
    operatingOrganization: "부산여성폭력방지종합지원센터(이젠센터)",
    sourceNote: "D4U 2025 리플릿 기준 지역 디성센터",
  },
  {
    regionId: "DAEGU",
    regionName: "대구",
    centerName: "대구디지털성범죄피해자지원센터",
    operatingOrganization: "(사)대구여성의전화 부설 여성인권상담소 피어라",
    sourceNote: "D4U 2025 리플릿 기준 지역 디성센터",
  },
  {
    regionId: "INCHEON",
    regionName: "인천",
    centerName: "인천디지털성범죄피해자지원센터",
    operatingOrganization: "인천디지털성범죄예방대응센터",
    sourceNote: "D4U 2025 리플릿 기준 지역 디성센터",
  },
  {
    regionId: "GWANGJU",
    regionName: "광주",
    centerName: "광주디지털성범죄피해자지원센터",
    operatingOrganization: "광주YWCA통합상담지원센터",
    sourceNote: "D4U 2025 리플릿 기준 지역 디성센터",
  },
  {
    regionId: "DAEJEON",
    regionName: "대전",
    centerName: "대전디지털성범죄피해자지원센터",
    operatingOrganization: "대전YWCA성폭력가정폭력상담소",
    sourceNote: "D4U 2025 리플릿 기준 지역 디성센터",
  },
  {
    regionId: "ULSAN",
    regionName: "울산",
    centerName: "울산디지털성범죄피해자지원센터",
    operatingOrganization: "동구 가정ㆍ성폭력통합상담소",
    sourceNote: "D4U 2025 리플릿 기준 지역 디성센터",
  },
  {
    regionId: "SEJONG",
    regionName: "세종",
    centerName: "세종디지털성범죄피해자지원센터",
    operatingOrganization: "종촌종합복지센터 가정·성폭력상담소",
    sourceNote: "D4U 2025 리플릿 기준 지역 디성센터",
  },
  {
    regionId: "GYEONGGI",
    regionName: "경기",
    centerName: "경기디지털성범죄피해자지원센터",
    operatingOrganization: "경기도디지털성범죄피해자원스톱지원센터",
    sourceNote: "D4U 2025 리플릿 기준 지역 디성센터",
  },
  {
    regionId: "GANGWON",
    regionName: "강원",
    centerName: "강원디지털성범죄피해자지원센터",
    operatingOrganization: "원주가정폭력·성폭력통합상담소",
    sourceNote: "D4U 2025 리플릿 기준 지역 디성센터",
  },
  {
    regionId: "CHUNGBUK",
    regionName: "충북",
    centerName: "충북디지털성범죄피해자지원센터",
    operatingOrganization: "청주YWCA여성종합상담소",
    sourceNote: "D4U 2025 리플릿 기준 지역 디성센터",
  },
  {
    regionId: "CHUNGNAM",
    regionName: "충남",
    centerName: "충남디지털성범죄피해자지원센터",
    operatingOrganization: "여성긴급전화1366충남센터",
    sourceNote: "D4U 2025 리플릿 기준 지역 디성센터",
  },
  {
    regionId: "JEONBUK",
    regionName: "전북",
    centerName: "전북디지털성범죄피해자지원센터",
    operatingOrganization: "(사)성폭력예방치료센터 부설 전주성폭력상담소",
    sourceNote: "D4U 2025 리플릿 기준 지역 디성센터",
  },
  {
    regionId: "JEONNAM",
    regionName: "전남",
    centerName: "전남디지털성범죄피해자지원센터",
    operatingOrganization: "(사)행복누리 부설 목포여성상담센터",
    sourceNote: "D4U 2025 리플릿 기준 지역 디성센터",
  },
  {
    regionId: "GYEONGBUK",
    regionName: "경북",
    centerName: "경북디지털성범죄피해자지원센터",
    operatingOrganization: "(사)포항여성회 부설 경북여성통합상담소",
    sourceNote: "D4U 2025 리플릿 기준 지역 디성센터",
  },
  {
    regionId: "GYEONGNAM",
    regionName: "경남",
    centerName: "경남디지털성범죄피해자지원센터",
    operatingOrganization: "(사)경남여성회 부설 경남성폭력·가정폭력통합상담소",
    sourceNote: "D4U 2025 리플릿 기준 지역 디성센터",
  },
  {
    regionId: "JEJU",
    regionName: "제주",
    centerName: "제주디지털성범죄피해자지원센터",
    operatingOrganization: "제주YWCA 가정폭력·성폭력 통합상담소",
    sourceNote: "D4U 2025 리플릿 기준 지역 디성센터",
  },
];

const REGION_ALIASES: Record<string, SupportRegionId> = {
  서울: "SEOUL",
  서울시: "SEOUL",
  "서울특별시": "SEOUL",
  부산: "BUSAN",
  부산시: "BUSAN",
  "부산광역시": "BUSAN",
  대구: "DAEGU",
  "대구광역시": "DAEGU",
  인천: "INCHEON",
  "인천광역시": "INCHEON",
  광주: "GWANGJU",
  "광주광역시": "GWANGJU",
  대전: "DAEJEON",
  "대전광역시": "DAEJEON",
  울산: "ULSAN",
  "울산광역시": "ULSAN",
  세종: "SEJONG",
  "세종특별자치시": "SEJONG",
  경기: "GYEONGGI",
  경기도: "GYEONGGI",
  강원: "GANGWON",
  강원도: "GANGWON",
  "강원특별자치도": "GANGWON",
  충북: "CHUNGBUK",
  충청북도: "CHUNGBUK",
  충남: "CHUNGNAM",
  충청남도: "CHUNGNAM",
  전북: "JEONBUK",
  전라북도: "JEONBUK",
  "전북특별자치도": "JEONBUK",
  전남: "JEONNAM",
  전라남도: "JEONNAM",
  경북: "GYEONGBUK",
  경상북도: "GYEONGBUK",
  경남: "GYEONGNAM",
  경상남도: "GYEONGNAM",
  제주: "JEJU",
  제주도: "JEJU",
  "제주특별자치도": "JEJU",
};

export function normalizeSupportRegion(regionText?: string): SupportRegionId | undefined {
  const normalized = (regionText || "").trim();
  if (!normalized) {
    return undefined;
  }
  if (REGIONAL_SUPPORT_CENTERS.some((center) => center.regionId === normalized)) {
    return normalized as SupportRegionId;
  }
  return REGION_ALIASES[normalized];
}

export function getRegionalSupportCenter(regionText?: string) {
  const regionId = normalizeSupportRegion(regionText);
  return REGIONAL_SUPPORT_CENTERS.find((center) => center.regionId === regionId);
}

export function buildRegionalSupportRoute(options: { caseType: CaseType; regionText?: string; urgent?: boolean }): RegionalSupportRoute {
  const primaryCenter = getRegionalSupportCenter(options.regionText);
  const centralRoutes = [
    {
      name: "여성긴급전화 1366",
      phone: "1366",
      url: "https://www.women1366.kr",
      useWhen: options.urgent ? "긴급 불안, 협박, 야간 상담, 즉시 연결이 필요할 때" : "가까운 상담·보호 연계가 필요할 때",
    },
    {
      name: "중앙디지털성범죄피해자지원센터",
      phone: "02-735-8994",
      url: "https://d4u.stop.or.kr/main",
      useWhen: "상담, 삭제지원, 유포 모니터링, 수사·법률·의료 연계를 묶어 확인할 때",
    },
  ];
  const recommendedOrder = [
    options.urgent ? "긴급 위험이 있으면 112 또는 1366으로 즉시 안전을 먼저 확보" : "현재 위험과 노출 범위를 3~5문장으로 정리",
    primaryCenter ? `${primaryCenter.regionName} 지역 후보: ${primaryCenter.centerName}에 상담 가능 여부 확인` : "지역을 모르면 중앙디지털성범죄피해자지원센터 또는 1366에 먼저 문의",
    "지움AI 제출 패킷에서 URL, 게시 위치, 발견·캡처 시각, 접수번호를 확인",
    "피해물 원본은 지움AI에 보관하지 않고 기관 안내에 따라 최소 범위로만 제출",
  ];

  if (options.caseType !== "DIGITAL_SEX_CRIME") {
    recommendedOrder.unshift("디지털성범죄로 확정되지 않은 사건은 온라인피해365센터·KISA·경찰 경로와 함께 검토");
  }

  return {
    caseType: options.caseType,
    selectedRegion: primaryCenter?.regionId,
    selectedRegionName: primaryCenter?.regionName,
    primaryCenter,
    centralRoutes,
    recommendedOrder,
    prepItems: [
      "피해 유형과 긴급 위험 여부",
      "URL 또는 플랫폼명, 게시 위치, 발견 시각",
      "삭제요청·신고 접수번호와 처리 결과",
      "재유포·협박·결제 요구·폐쇄형 채널 유도 단서",
      "피해자가 원하는 조치와 연락 가능한 안전한 방법",
    ],
    safetyBoundary: [
      "지움AI는 상담기관에 자동 제출하지 않습니다.",
      "피해물 원본, 신분증 원본, 비밀번호는 지움AI에 저장하지 않습니다.",
      "폐쇄형 방 입장, 구매, 잠입, IP 역추적은 피해자 직접 수행 대상이 아닙니다.",
      "센터명과 연락 경로는 제출 전 공식 사이트에서 다시 확인합니다.",
    ],
    source: REGIONAL_SUPPORT_SOURCE,
  };
}

export function formatRegionalSupportRoute(route: RegionalSupportRoute) {
  return [
    "# 지역 디지털성범죄 피해지원 라우팅 메모",
    "",
    `사건 유형: ${route.caseType}`,
    `선택 지역: ${route.selectedRegionName || "미선택"}`,
    `지역 후보: ${route.primaryCenter ? `${route.primaryCenter.centerName} / ${route.primaryCenter.operatingOrganization}` : "중앙 경로 우선"}`,
    "",
    "## 중앙 경로",
    ...route.centralRoutes.map((item) => `- ${item.name}${item.phone ? ` / ${item.phone}` : ""}${item.url ? ` / ${item.url}` : ""}: ${item.useWhen}`),
    "",
    "## 권장 순서",
    ...route.recommendedOrder.map((item) => `- ${item}`),
    "",
    "## 상담 전 준비 항목",
    ...route.prepItems.map((item) => `- ${item}`),
    "",
    "## 안전 경계",
    ...route.safetyBoundary.map((item) => `- ${item}`),
    "",
    `출처: ${route.source.title}`,
    `확인일: ${route.source.checkedAt}`,
    `출처 URL: ${route.source.url}`,
    "",
  ].join("\n");
}
