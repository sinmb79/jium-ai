export type LaunchSurfaceLane = {
  phaseId: string;
  title: string;
  ownerRole: string;
  status: string;
  openActionCount: number;
  p0OpenActionCount: number;
  firstAction: string;
  firstVerificationCommand: string;
};

export type LaunchSurfaceSummary = {
  status: "READY" | "EXTERNAL_INPUTS_REQUIRED" | "BLOCKED";
  canLaunchNow: boolean;
  version: string;
  phaseCount: number;
  readyPhaseCount: number;
  blockedPhaseCount: number;
  openActionCount: number;
  p0OpenActionCount: number;
  externalApprovalCommandCount: number;
  verificationCommandCount: number;
};

export type LaunchSurface = {
  source: "DEFAULT_GUIDE" | "LAUNCH_CONSOLE_JSON";
  summary: LaunchSurfaceSummary;
  lanes: LaunchSurfaceLane[];
  operatorRunOrder: LaunchSurfaceLane[];
  externalApprovalQueue: Array<{
    id: string;
    group: string;
    ownerRole: string;
    phaseId: string;
    command: string;
  }>;
  verificationCommands: Array<{
    id: string;
    ownerRole: string;
    phaseId: string;
    command: string;
  }>;
  errors: string[];
};

const unsafePatterns = [
  /https?:\/\/[^\s")]+/i,
  /\b(?:t\.me|telegram\.me|discord\.gg|discord\.com\/invite)\/[^\s")]+/i,
  /\b[a-z2-7]{16,56}\.onion\b/i,
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  /\b(?:(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{8,}|github_pat_[A-Za-z0-9_]{8,}|(?:sk-proj|sk)-[A-Za-z0-9_\-]{8,})\b/i,
  /\b(?:(?:\+82[\s.-]?)?0?1[016789][\s.-]?\d{3,4}[\s.-]?\d{4}|0\d{1,2}[\s.-]\d{3,4}[\s.-]\d{4})\b/,
  /(?:[A-Za-z]:\\|\/(?:Users|home|var|etc|tmp|mnt|opt)\/)[^\s")]+/i,
];

export const UNSAFE_LAUNCH_CONSOLE_IMPORT_ERROR =
  "원문 URL, 연락처, 토큰, 초대 링크, onion 주소, 전화번호, 경로가 포함된 리포트는 표시하지 않습니다.";

export const DEFAULT_LAUNCH_SURFACE: LaunchSurface = {
  source: "DEFAULT_GUIDE",
  summary: {
    status: "EXTERNAL_INPUTS_REQUIRED",
    canLaunchNow: false,
    version: "",
    phaseCount: 6,
    readyPhaseCount: 1,
    blockedPhaseCount: 5,
    openActionCount: 75,
    p0OpenActionCount: 10,
    externalApprovalCommandCount: 0,
    verificationCommandCount: 0,
  },
  lanes: [
    {
      phaseId: "production-onboarding",
      title: "운영 온보딩",
      ownerRole: "OPERATIONS_LEAD",
      status: "BLOCKED",
      openActionCount: 13,
      p0OpenActionCount: 2,
      firstAction: "private onboarding checklist와 storage/public operations 승인 기록을 채웁니다.",
      firstVerificationCommand: "npm run ops:onboarding:check",
    },
    {
      phaseId: "server-runtime",
      title: "기관 서버 런타임",
      ownerRole: "DEPLOYMENT_ADMIN",
      status: "BLOCKED",
      openActionCount: 8,
      p0OpenActionCount: 2,
      firstAction: "trusted institution key와 approved HTTPS origin을 등록합니다.",
      firstVerificationCommand: "npm run security:server-readiness",
    },
    {
      phaseId: "server-storage",
      title: "비공개 서버 저장소",
      ownerRole: "DATA_PROTECTION_OFFICER",
      status: "READY",
      openActionCount: 0,
      p0OpenActionCount: 0,
      firstAction: "repo 외부 저장소 준비가 완료된 단계입니다.",
      firstVerificationCommand: "npm run security:server-storage",
    },
    {
      phaseId: "desktop-release",
      title: "서명 데스크톱 릴리즈",
      ownerRole: "RELEASE_MANAGER",
      status: "BLOCKED",
      openActionCount: 8,
      p0OpenActionCount: 2,
      firstAction: "서명된 installer, blockmap, latest.yml을 만들고 GitHub Release 업로드를 검증합니다.",
      firstVerificationCommand: "npm run desktop:release-upload:check -- --release-tag <approved-release-tag>",
    },
    {
      phaseId: "approval-records",
      title: "법무/운영 승인 기록",
      ownerRole: "LEGAL_REVIEWER",
      status: "BLOCKED",
      openActionCount: 12,
      p0OpenActionCount: 2,
      firstAction: "go-live, legal review, release evidence, data retention, support, incident owner 승인을 기록합니다.",
      firstVerificationCommand: "npm run ops:approvals:check",
    },
    {
      phaseId: "go-live",
      title: "최종 go-live",
      ownerRole: "PROGRAM_OWNER",
      status: "BLOCKED",
      openActionCount: 21,
      p0OpenActionCount: 2,
      firstAction: "승인 플래그와 incident owner를 적용한 뒤 최종 go-live check를 실행합니다.",
      firstVerificationCommand: "npm run ops:go-live:check",
    },
  ],
  operatorRunOrder: [],
  externalApprovalQueue: [],
  verificationCommands: [],
  errors: [],
};

DEFAULT_LAUNCH_SURFACE.operatorRunOrder = DEFAULT_LAUNCH_SURFACE.lanes.filter((lane) => lane.status !== "READY");

function asNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function hasUnsafeText(value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return unsafePatterns.some((pattern) => pattern.test(text || ""));
}

function laneFromConsoleLane(lane: any): LaunchSurfaceLane {
  const firstAction = Array.isArray(lane?.firstActions) ? lane.firstActions[0] : null;
  return {
    phaseId: asString(lane?.phaseId),
    title: asString(lane?.title || lane?.phaseId),
    ownerRole: asString(lane?.ownerRole),
    status: asString(lane?.status || "UNKNOWN"),
    openActionCount: asNumber(lane?.openActionCount),
    p0OpenActionCount: asNumber(lane?.p0OpenActionCount),
    firstAction: asString(firstAction?.action),
    firstVerificationCommand: asString(firstAction?.verificationCommands?.[0] || lane?.verificationCommands?.[0]),
  };
}

function laneFromRunOrder(entry: any, lane?: LaunchSurfaceLane): LaunchSurfaceLane {
  return {
    phaseId: asString(entry?.phaseId),
    title: asString(lane?.title || entry?.phaseId),
    ownerRole: asString(entry?.ownerRole || lane?.ownerRole),
    status: asString(entry?.status || lane?.status || "UNKNOWN"),
    openActionCount: asNumber(lane?.openActionCount),
    p0OpenActionCount: asNumber(lane?.p0OpenActionCount),
    firstAction: asString(entry?.firstAction || lane?.firstAction),
    firstVerificationCommand: asString(entry?.verificationCommands?.[0] || lane?.firstVerificationCommand),
  };
}

export function parseOperationalLaunchConsoleJson(text: string): { surface: LaunchSurface | null; error: string } {
  const trimmed = text.trim();
  if (!trimmed) {
    return { surface: null, error: "" };
  }
  let parsed: any;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { surface: null, error: "JSON 형식이 올바르지 않습니다." };
  }
  if (parsed?.schema !== "jium-operational-launch-console-v1") {
    return { surface: null, error: "operational launch console JSON만 가져올 수 있습니다." };
  }
  if (hasUnsafeText(parsed)) {
    return { surface: null, error: UNSAFE_LAUNCH_CONSOLE_IMPORT_ERROR };
  }
  const lanes: LaunchSurfaceLane[] = Array.isArray(parsed.ownerLanes) ? parsed.ownerLanes.map(laneFromConsoleLane) : [];
  const laneByPhaseId = new Map(lanes.map((lane) => [lane.phaseId, lane]));
  const operatorRunOrder: LaunchSurfaceLane[] = Array.isArray(parsed.nextOperatorRunOrder)
    ? parsed.nextOperatorRunOrder.map((entry: any) => laneFromRunOrder(entry, laneByPhaseId.get(asString(entry?.phaseId))))
    : lanes.filter((lane) => lane.status !== "READY");
  const surface: LaunchSurface = {
    source: "LAUNCH_CONSOLE_JSON",
    summary: {
      status: parsed.launchDecision?.canLaunchNow ? "READY" : parsed.status === "BLOCKED" ? "BLOCKED" : "EXTERNAL_INPUTS_REQUIRED",
      canLaunchNow: Boolean(parsed.launchDecision?.canLaunchNow),
      version: asString(parsed.source?.version),
      phaseCount: asNumber(parsed.summary?.phaseCount || lanes.length),
      readyPhaseCount: asNumber(parsed.summary?.readyPhaseCount),
      blockedPhaseCount: asNumber(parsed.summary?.blockedPhaseCount),
      openActionCount: asNumber(parsed.summary?.openActionCount),
      p0OpenActionCount: asNumber(parsed.summary?.p0OpenActionCount),
      externalApprovalCommandCount: asNumber(parsed.summary?.externalApprovalCommandCount),
      verificationCommandCount: asNumber(parsed.summary?.verificationCommandCount),
    },
    lanes,
    operatorRunOrder,
    externalApprovalQueue: Array.isArray(parsed.externalApprovalQueue) ? parsed.externalApprovalQueue : [],
    verificationCommands: Array.isArray(parsed.verificationCommands) ? parsed.verificationCommands : [],
    errors: Array.isArray(parsed.errors) ? parsed.errors.map(asString).filter(Boolean) : [],
  };
  return { surface, error: "" };
}

export function formatLaunchSurfaceMarkdown(surface: LaunchSurface) {
  const lines = [
    "# Jium AI 운영 런치 콘솔",
    "",
    `- 상태: ${surface.summary.status}`,
    `- 버전: ${surface.summary.version || "미지정"}`,
    `- 단계: ${surface.summary.readyPhaseCount}/${surface.summary.phaseCount} READY`,
    `- 열린 작업: ${surface.summary.openActionCount}`,
    `- P0 작업: ${surface.summary.p0OpenActionCount}`,
    "",
    "## 다음 실행 순서",
    ...(surface.operatorRunOrder.length
      ? surface.operatorRunOrder.map((lane, index) => `${index + 1}. ${lane.phaseId} (${lane.ownerRole}) - ${lane.firstAction || lane.status}`)
      : ["- 없음"]),
    "",
    "## 첫 검증 명령",
    ...surface.operatorRunOrder
      .map((lane) => lane.firstVerificationCommand)
      .filter(Boolean)
      .map((command) => `- ${command}`),
    "",
  ];
  return `${lines.join("\n")}\n`;
}
