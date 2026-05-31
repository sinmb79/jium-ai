import { getEvidenceLedger } from "@/lib/evidence";
import type { CaseInput, EvidenceItem, TraceSignalSeverity } from "@/lib/types";

export type PromotionSurfaceAccessLevel = "PUBLIC_SURFACE" | "RESTRICTED_HINT" | "OFFICIAL_ONLY";

export type PromotionSurfacePattern = {
  id: string;
  label: string;
  surfaceKind: string;
  riskLevel: TraceSignalSeverity;
  publicDescriptor: string;
  safeSignals: string[];
  evidenceToRecord: string[];
  doNotDo: string[];
  officialHandoff: string[];
  accessLevel: PromotionSurfaceAccessLevel;
  intelligenceValue: string;
  handoffQuestion: string;
};

export type PromotionSurfaceMatch = PromotionSurfacePattern & {
  matchedEvidenceIds: string[];
};

export type PromotionSurfacePlan = {
  title: string;
  summary: string;
  matches: PromotionSurfaceMatch[];
  routeSeeds: string[];
  safeCollectionChecklist: string[];
  officialEscalationTriggers: string[];
  boundaries: string[];
};

export const PROMOTION_SURFACE_BOUNDARIES = [
  "홍보글 루트는 실제 범죄 사이트·초대링크·방 이름의 공개 디렉터리가 아닙니다.",
  "피해자가 이미 본 공개 글, 검색 스니펫, 프로필, 댓글, 제보 메시지의 관찰값만 기록합니다.",
  "비공개방 내부 확인, 구매, 초대 요청, 잠입, 피해물 다운로드는 수사기관 또는 전문기관 권한 영역입니다.",
  "루트 학습에는 정확 URL, 초대링크, 지갑 주소 원문, 계정 핸들을 저장하지 않고 표면 유형과 패턴 ID만 저장합니다.",
];

export const PROMOTION_SURFACE_PATTERNS: PromotionSurfacePattern[] = [
  {
    id: "public-teaser-post",
    label: "공개 게시판 티저/모집글 표면",
    surfaceKind: "PUBLIC_POSTING_SURFACE",
    riskLevel: "HIGH",
    publicDescriptor: "공개 커뮤니티, 익명 게시판, 댓글형 게시판에 남는 모집·홍보·재업로드 암시 글",
    safeSignals: ["초대", "모집", "문의", "재업", "재공유", "링크", "자료", "판매", "open chat", "invite", "reupload", "dm"],
    evidenceToRecord: ["게시글 제목 또는 스니펫", "게시판/카테고리명", "작성 시각 또는 발견 시각", "관찰된 닉네임", "삭제/신고 상태"],
    doNotDo: ["댓글로 접촉하지 않기", "초대 요청하지 않기", "피해물 확인 링크를 열람·공유하지 않기"],
    officialHandoff: ["중앙디지털성범죄피해자지원센터", "플랫폼 신고", "경찰 ECRM"],
    accessLevel: "PUBLIC_SURFACE",
    intelligenceValue: "비공개방 내부가 닫혀 있어도 공개 모집 표면은 유입 경로와 시간선을 보여주는 단서가 됩니다.",
    handoffQuestion: "이 공개 글이 특정 비공개방, 유료 접근, 재유포 또는 결제 요구로 이어진다는 문구가 있습니까?",
  },
  {
    id: "social-profile-linkhub",
    label: "SNS 프로필·링크허브 표면",
    surfaceKind: "PROFILE_AND_LINK_HUB",
    riskLevel: "HIGH",
    publicDescriptor: "공개 프로필, 상태 메시지, 링크 모음, 소개글, 고정 게시물에서 비공개 채널로 유도하는 표면",
    safeSignals: ["프로필", "bio", "link in bio", "linktree", "링크모음", "고정글", "문의는", "dm", "오픈채팅", "서버"],
    evidenceToRecord: ["프로필 표시명", "프로필 URL 또는 플랫폼명", "링크 설명 문구", "고정글·소개글 캡처 시각", "계정 신고 상태"],
    doNotDo: ["DM 보내지 않기", "링크허브의 의심 링크를 끝까지 따라가지 않기", "피해자 식별 정보를 댓글로 남기지 않기"],
    officialHandoff: ["플랫폼 신고", "D4U 삭제지원", "수사기관 로그 보존 요청"],
    accessLevel: "PUBLIC_SURFACE",
    intelligenceValue: "SNS 프로필은 여러 폐쇄형 채널의 입구가 될 수 있어 플랫폼 간 이동 경로를 설명합니다.",
    handoffQuestion: "프로필 또는 링크허브가 다른 플랫폼, 결제, 초대방, 파일공유로 이동시키는 구조입니까?",
  },
  {
    id: "comment-reply-recruitment",
    label: "댓글·답글 모집 표면",
    surfaceKind: "COMMENT_RECRUITMENT",
    riskLevel: "HIGH",
    publicDescriptor: "공개 게시물 아래 댓글, 답글, 인용글에서 비공개 채널·DM·결제로 유도하는 표면",
    safeSignals: ["댓글", "답글", "멘션", "인용", "reply", "comment", "dm", "쪽지", "문의", "입장"],
    evidenceToRecord: ["원 게시물 URL 또는 위치", "댓글 작성자 표시명", "댓글 시각", "유도 문구", "신고/삭제 전후 상태"],
    doNotDo: ["댓글 작성자에게 직접 연락하지 않기", "가해자 추정 신상 공개하지 않기", "대화 유도·함정 대화 시도하지 않기"],
    officialHandoff: ["플랫폼 댓글 신고", "ECRM", "법률 상담"],
    accessLevel: "PUBLIC_SURFACE",
    intelligenceValue: "댓글 표면은 검색엔진에 잘 잡히지 않아도 원 게시물과 유입 문구를 연결하는 증거가 됩니다.",
    handoffQuestion: "댓글이 공개 글에서 비공개 대화·초대·결제로 이동하도록 유도합니까?",
  },
  {
    id: "payment-or-price-signal",
    label: "결제·가격·암호화폐 유도 표면",
    surfaceKind: "PAYMENT_RECRUITMENT",
    riskLevel: "CRITICAL",
    publicDescriptor: "가격, 유료방, 암호화폐, 기프트카드, 지갑, 입금 요구를 암시하는 공개 또는 제보 기반 표면",
    safeSignals: ["가격", "유료", "결제", "입금", "코인", "암호화폐", "지갑", "gift card", "wallet", "usdt", "btc", "paid"],
    evidenceToRecord: ["결제 요구 문구", "금액·통화 단위", "이미 받은 지갑/계좌 식별자의 존재 여부", "요구 시각", "협박·유포 맥락"],
    doNotDo: ["돈 보내지 않기", "거래해 증거를 만들지 않기", "지갑 주소 소유자를 사적으로 추적하지 않기"],
    officialHandoff: ["경찰 ECRM", "수사기관 결제흐름 보존 요청", "법률 상담"],
    accessLevel: "OFFICIAL_ONLY",
    intelligenceValue: "결제 표면은 단순 삭제요청을 넘어 유포협박·영리 목적·조직적 유통 가능성을 보여줍니다.",
    handoffQuestion: "결제 요구가 이미 피해자에게 노출되었고, 거래 없이 보존 가능한 문구·시각·식별자가 있습니까?",
  },
  {
    id: "platform-migration-signal",
    label: "플랫폼 이동·비공개방 유도 표면",
    surfaceKind: "CROSS_PLATFORM_MIGRATION",
    riskLevel: "CRITICAL",
    publicDescriptor: "공개 표면에서 디스코드, 텔레그램, 오픈채팅, 비공개 서버, 초대방 등으로 이동시키는 신호",
    safeSignals: ["디스코드", "텔레그램", "오픈채팅", "서버", "채널", "비공개", "private server", "telegram", "discord", "invite"],
    evidenceToRecord: ["이동을 유도한 공개 글 또는 메시지", "이미 보이는 서버/채널명", "초대 주장 문구", "발견 시각", "제보 출처"],
    doNotDo: ["비공개방 입장하지 않기", "초대코드 요청하지 않기", "방 내부 자료 확보를 시도하지 않기"],
    officialHandoff: ["D4U 긴급 상담", "경찰 ECRM", "플랫폼 신뢰안전팀"],
    accessLevel: "OFFICIAL_ONLY",
    intelligenceValue: "플랫폼 이동 신호는 공개 홍보면과 폐쇄형 유통 공간 사이의 연결고리입니다.",
    handoffQuestion: "공개 표면이 특정 폐쇄형 채널로 이동하라고 유도한다는 관찰값이 있습니까?",
  },
  {
    id: "file-preview-or-linkdrop",
    label: "파일 미리보기·링크드롭 표면",
    surfaceKind: "FILE_LINK_SURFACE",
    riskLevel: "HIGH",
    publicDescriptor: "파일공유 미리보기, 링크드롭, 압축파일명, 썸네일, 비밀번호 요구 화면 같은 외부 입구 표면",
    safeSignals: ["파일", "다운", "압축", "비번", "미리보기", "썸네일", "drive", "cloud", "zip", "password", "preview"],
    evidenceToRecord: ["공유 페이지 제목", "보이는 파일명 또는 폴더명", "비밀번호 요구 여부", "업로더 표시명", "신고 결과"],
    doNotDo: ["파일 다운로드하지 않기", "비밀번호 요청하지 않기", "새 공유 링크 만들지 않기"],
    officialHandoff: ["플랫폼 abuse report", "D4U 삭제지원", "수사기관"],
    accessLevel: "RESTRICTED_HINT",
    intelligenceValue: "파일 표면은 피해물이 공개 게시글에서 폐쇄형 재배포로 넘어간 흔적을 설명합니다.",
    handoffQuestion: "파일 내용 확인 없이 제목·썸네일·비밀번호 화면만으로 유통 정황을 기록할 수 있습니까?",
  },
  {
    id: "search-cache-snippet",
    label: "검색 스니펫·캐시 잔존 표면",
    surfaceKind: "SEARCH_INDEX_SURFACE",
    riskLevel: "MEDIUM",
    publicDescriptor: "원본 삭제 후에도 검색 결과 제목, 스니펫, 썸네일, 캐시 흔적으로 남는 표면",
    safeSignals: ["검색", "스니펫", "캐시", "썸네일", "색인", "cache", "snippet", "thumbnail", "indexed"],
    evidenceToRecord: ["검색어", "검색엔진명", "결과 제목·스니펫", "캐시/썸네일 여부", "확인 일시"],
    doNotDo: ["피해물 미리보기를 반복 열람하지 않기", "검색어를 공개 공유하지 않기", "새 아카이브를 만들지 않기"],
    officialHandoff: ["검색엔진 삭제요청", "D4U 모니터링", "방송미디어통신심의위원회"],
    accessLevel: "PUBLIC_SURFACE",
    intelligenceValue: "검색 표면은 원본 삭제 뒤에도 피해가 지속되는 이유와 재확인 주기를 보여줍니다.",
    handoffQuestion: "원본은 사라졌지만 제목·스니펫·썸네일에 피해 단서가 남아 있습니까?",
  },
];

function compact(value?: string) {
  return value?.trim() || "";
}

function evidenceText(item: EvidenceItem) {
  return [
    item.url,
    item.platform,
    item.location,
    item.posterId,
    item.notes,
    item.submissionTarget,
    item.hashSource,
    item.fileName,
    ...(item.requestLogs || []).map((log) => [log.target, log.channel, log.receiptId, log.notes].filter(Boolean).join(" ")),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function routeSeedText(input: CaseInput, evidenceItems: EvidenceItem[]) {
  return Array.from(
    new Set(
      [
        compact(input.platform),
        compact(input.keywords),
        ...evidenceItems.flatMap((item) => [compact(item.platform), compact(item.location), compact(item.posterId)]),
      ].filter(Boolean),
    ),
  ).slice(0, 8);
}

export function detectPromotionSurfaceRoutes(evidenceItems: EvidenceItem[]): PromotionSurfaceMatch[] {
  return PROMOTION_SURFACE_PATTERNS.flatMap((pattern) => {
    const matchedEvidenceIds = evidenceItems
      .filter((item) => {
        const haystack = evidenceText(item);
        return pattern.safeSignals.some((signal) => haystack.includes(signal.toLowerCase()));
      })
      .map((item) => item.id);

    if (!matchedEvidenceIds.length) {
      return [];
    }
    return [{ ...pattern, matchedEvidenceIds }];
  });
}

export function buildPromotionSurfacePlan(input: CaseInput): PromotionSurfacePlan {
  const evidenceItems = getEvidenceLedger(input);
  const matches = detectPromotionSurfaceRoutes(evidenceItems);
  return {
    title: "비공개방 유입면·홍보글 루트 분석",
    summary:
      "비공개방 자체에 접근하지 않고, 공개 홍보면·프로필·댓글·검색 스니펫·결제 요구·플랫폼 이동 신호를 사건별 단서로 정리합니다.",
    matches,
    routeSeeds: routeSeedText(input, evidenceItems),
    safeCollectionChecklist: [
      "공개 표면의 제목, 스니펫, 작성 시각, 표시명, 플랫폼명만 기록합니다.",
      "비공개방 입장, 초대 요청, 결제, 다운로드 없이 이미 보이는 단서만 남깁니다.",
      "동일 문구·동일 닉네임·동일 결제 요구·동일 썸네일 지문이 반복되는지 사건 안에서 비교합니다.",
      "발견되지 않은 루트는 '미발견'이 아니라 '공식기관 모니터링 또는 로그 보존 필요'로 분리합니다.",
    ],
    officialEscalationTriggers: [
      "유료방, 암호화폐, 기프트카드, 입금 요구가 확인됨",
      "공개 글이 디스코드·텔레그램·비공개 서버·초대방으로 이동을 유도함",
      "파일공유 미리보기나 비밀번호 요구 화면이 피해물 유통과 연결됨",
      "삭제 후 재업로드 홍보글이나 동일 별칭 반복이 관찰됨",
    ],
    boundaries: PROMOTION_SURFACE_BOUNDARIES,
  };
}

export function unsafePromotionSurfaceMarkers() {
  const serialized = JSON.stringify(PROMOTION_SURFACE_PATTERNS).toLowerCase();
  return ["http://", "https://", "discord.gg/", "t.me/", "telegram.me/", ".onion"].filter((marker) => serialized.includes(marker));
}
