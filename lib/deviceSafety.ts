export const compromisedDeviceRisks = [
  "악성 브라우저 확장프로그램",
  "원격제어 프로그램 또는 화면공유 세션",
  "키로거, 스틸러, 악성코드 감염 의심",
  "공용 PC, PC방, 학교·회사 공용 계정",
  "가해자나 제3자가 접근할 수 있는 기기",
  "브라우저 동기화, 자동완성, 클립보드 기록 노출",
] as const;

export const safeDeviceChecklist = [
  "가능하면 본인만 쓰는 최신 OS 개인 기기에서 진행",
  "브라우저 확장프로그램을 비활성화하거나 새 프로필·시크릿 창 사용",
  "원격제어, 화면공유, 녹화 프로그램 종료",
  "Windows 보안 또는 신뢰하는 백신으로 빠른 검사 후 진행",
  "공용 Wi-Fi보다 신뢰 가능한 네트워크 사용",
  "고위험이 의심되면 암호화 보관함을 열지 말고 기관·상담자에게 안전 기기 도움 요청",
] as const;

export type DeviceSafetyCheckId =
  | "personal-device"
  | "extensions-disabled"
  | "remote-access-closed"
  | "attacker-no-access"
  | "malware-scan"
  | "trusted-network"
  | "clipboard-sync-limited";

export type DeviceSafetyCheck = {
  id: DeviceSafetyCheckId;
  label: string;
  detail: string;
  required: boolean;
};

export type DeviceSafetyReadinessStatus = "BLOCKED" | "REVIEW" | "READY";

export type DeviceSafetyReadiness = {
  status: DeviceSafetyReadinessStatus;
  checkedRequired: number;
  requiredTotal: number;
  checkedRecommended: number;
  recommendedTotal: number;
  missingRequired: DeviceSafetyCheck[];
  missingRecommended: DeviceSafetyCheck[];
  nextActions: string[];
};

export const deviceSafetyChecks: DeviceSafetyCheck[] = [
  {
    id: "personal-device",
    label: "본인만 쓰는 기기",
    detail: "공용 PC, 학교·회사 공용 계정, PC방 기기에서는 피해 내용을 입력하지 않습니다.",
    required: true,
  },
  {
    id: "extensions-disabled",
    label: "확장프로그램 격리",
    detail: "브라우저 확장프로그램을 끄거나 새 프로필·시크릿 창에서 진행합니다.",
    required: true,
  },
  {
    id: "remote-access-closed",
    label: "원격제어 종료",
    detail: "원격제어, 화면공유, 녹화 프로그램을 종료하고 화면 노출을 줄입니다.",
    required: true,
  },
  {
    id: "attacker-no-access",
    label: "가해자 접근 차단",
    detail: "가해자나 제3자가 기기, 계정, 클라우드 동기화에 접근할 수 없는지 확인합니다.",
    required: true,
  },
  {
    id: "malware-scan",
    label: "빠른 악성코드 검사",
    detail: "Windows 보안 또는 신뢰하는 보안 도구로 빠른 검사를 실행합니다.",
    required: false,
  },
  {
    id: "trusted-network",
    label: "신뢰 가능한 네트워크",
    detail: "공용 Wi-Fi 대신 신뢰 가능한 네트워크에서 진행합니다.",
    required: false,
  },
  {
    id: "clipboard-sync-limited",
    label: "동기화·클립보드 주의",
    detail: "브라우저 자동완성, 클립보드 기록, 계정 동기화 노출을 줄입니다.",
    required: false,
  },
];

export function deviceSafetyWarningText() {
  return "이 기기가 감염됐거나 악성 확장프로그램이 있으면 암호화 전후의 평문과 패스프레이즈가 노출될 수 있습니다.";
}

export function evaluateDeviceSafety(checkedIds: Iterable<DeviceSafetyCheckId>): DeviceSafetyReadiness {
  const checked = new Set(checkedIds);
  const required = deviceSafetyChecks.filter((item) => item.required);
  const recommended = deviceSafetyChecks.filter((item) => !item.required);
  const missingRequired = required.filter((item) => !checked.has(item.id));
  const missingRecommended = recommended.filter((item) => !checked.has(item.id));
  const checkedRequired = required.length - missingRequired.length;
  const checkedRecommended = recommended.length - missingRecommended.length;
  const status: DeviceSafetyReadinessStatus =
    missingRequired.length === 0 ? "READY" : checkedRequired >= Math.ceil(required.length / 2) ? "REVIEW" : "BLOCKED";

  const nextActions =
    status === "READY"
      ? missingRecommended.length
        ? ["민감한 입력 전 권장 점검을 추가로 확인하세요.", "고위험이 의심되면 암호화 보관함을 열지 말고 안전한 기기로 옮기세요."]
        : ["민감한 입력과 암호화 보관을 진행할 수 있습니다.", "패스프레이즈와 제출자료는 지움AI 밖에 평문으로 남기지 마세요."]
      : missingRequired.slice(0, 3).map((item) => item.detail);

  return {
    status,
    checkedRequired,
    requiredTotal: required.length,
    checkedRecommended,
    recommendedTotal: recommended.length,
    missingRequired,
    missingRecommended,
    nextActions,
  };
}

export function deviceSafetyStatusLabel(status: DeviceSafetyReadinessStatus) {
  if (status === "READY") {
    return "진행 가능";
  }
  if (status === "REVIEW") {
    return "추가 확인";
  }
  return "중지 권장";
}
