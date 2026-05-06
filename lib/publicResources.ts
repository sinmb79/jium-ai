import type { CaseType } from "@/lib/types";

export type PublicResource = {
  id: string;
  name: string;
  category: CaseType | "ALL";
  description: string;
  url: string;
  caution: string;
  cost: "무료" | "상담 필요";
  phone?: string;
};

export const PUBLIC_RESOURCES: PublicResource[] = [
  {
    id: "eraser",
    name: "개인정보 포털 지우개 서비스",
    category: "SELF_POST_DELETE",
    description: "아동·청소년 시기에 작성한 개인정보 포함 게시물의 삭제 또는 검색 배제를 도와주는 공식 서비스",
    url: "https://www.privacy.go.kr/front/contents/cntntsView.do?contsNo=260",
    caution: "작성 시기, 신청 연령, 개인정보 포함 여부에 따라 대상이 달라질 수 있습니다.",
    cost: "무료",
  },
  {
    id: "privacy-withdrawal",
    name: "개인정보 포털 웹사이트 회원탈퇴",
    category: "ACCOUNT_DELETE",
    description: "더 이상 이용하지 않는 웹사이트의 회원탈퇴 신청을 지원하는 공식 서비스",
    url: "https://www.privacy.go.kr",
    caution: "모든 사이트가 대상은 아닙니다. 일부 사이트는 직접 탈퇴해야 합니다.",
    cost: "무료",
  },
  {
    id: "kidc",
    name: "털린 내 정보 찾기",
    category: "CREDENTIAL_LEAK",
    description: "계정정보가 불법 유통되는지 공식 경로에서 확인할 수 있는 서비스",
    url: "https://kidc.eprivacy.go.kr/intro/service.do",
    caution: "지움AI에는 비밀번호를 입력하지 마세요. 공식 사이트에서만 확인하세요.",
    cost: "무료",
  },
  {
    id: "d4u",
    name: "중앙디지털성범죄피해자지원센터",
    category: "DIGITAL_SEX_CRIME",
    description: "디지털 성범죄 피해 상담, 삭제지원, 유포 모니터링, 수사·법률·의료 연계 지원",
    url: "https://d4u.stop.or.kr/main",
    caution: "피해물 원본을 지움AI에 올리지 말고 전문기관 안내에 따라 최소 정보만 정리하세요.",
    cost: "무료",
    phone: "02-735-8994",
  },
  {
    id: "women-1366",
    name: "여성긴급전화 1366",
    category: "DIGITAL_SEX_CRIME",
    description: "긴급 상담과 지역 지원기관 연결을 받을 수 있는 24시간 상담 창구",
    url: "https://www.women1366.kr",
    caution: "위협이 진행 중이면 안전한 장소에서 연락하거나 주변 도움을 먼저 요청하세요.",
    cost: "무료",
    phone: "1366",
  },
  {
    id: "privacy-kisa",
    name: "KISA 개인정보침해 신고센터",
    category: "PERSONAL_INFO_EXPOSURE",
    description: "개인정보 침해 신고와 상담을 지원하는 공식 창구",
    url: "https://privacy.kisa.or.kr",
    caution: "신고 전 URL, 캡처 보유 여부, 침해 내용, 요청 이력을 정리하세요.",
    cost: "무료",
  },
  {
    id: "ecrm",
    name: "경찰청 사이버범죄 신고시스템",
    category: "DIGITAL_SEX_CRIME",
    description: "사이버범죄 피해 신고를 접수할 수 있는 경찰청 공식 경로",
    url: "https://ecrm.police.go.kr",
    caution: "긴급한 신변 위협이 있으면 112가 우선입니다.",
    cost: "무료",
  },
  {
    id: "legal-aid",
    name: "대한법률구조공단",
    category: "DEFAMATION_PRIVACY",
    description: "법률 상담과 구조 제도 확인을 위한 공공 법률지원 경로",
    url: "https://www.klac.or.kr",
    caution: "삭제 가능성보다 사실관계와 법적 쟁점을 먼저 정리하세요.",
    cost: "상담 필요",
  },
];

export function getResourcesForCase(caseType: CaseType) {
  const targeted = PUBLIC_RESOURCES.filter((resource) => resource.category === caseType || resource.category === "ALL");
  if (targeted.length) {
    return targeted;
  }
  return PUBLIC_RESOURCES.filter((resource) => ["privacy-kisa", "legal-aid"].includes(resource.id));
}
