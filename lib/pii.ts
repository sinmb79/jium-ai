export type SensitiveFindingType =
  | "residentRegistrationNumber"
  | "passwordSecret"
  | "cardNumber"
  | "phone"
  | "email"
  | "possibleAddress"
  | "victimMaterial";

export type SensitiveFinding = {
  type: SensitiveFindingType;
  label: string;
  severity: "block" | "warn";
  count: number;
};

const PATTERNS: Array<{
  type: SensitiveFindingType;
  label: string;
  severity: "block" | "warn";
  regex: RegExp;
  replacement: string;
}> = [
  {
    type: "residentRegistrationNumber",
    label: "주민등록번호 형태",
    severity: "block",
    regex: /\b\d{6}\s*-?\s*[1-4]\d{6}\b/g,
    replacement: "[주민등록번호 가림]",
  },
  {
    type: "passwordSecret",
    label: "비밀번호 원문 가능성",
    severity: "block",
    regex: /(비밀번호|패스워드|password|pw)\s*(은|는|:|=)?\s*["']?[^\s"',.]{4,}/gi,
    replacement: "[비밀번호 가림]",
  },
  {
    type: "cardNumber",
    label: "카드번호 형태",
    severity: "block",
    regex: /\b(?:\d{4}[ -]?){3}\d{4}\b|\b\d{4}[ -]?\d{6}[ -]?\d{5}\b/g,
    replacement: "[카드번호 가림]",
  },
  {
    type: "phone",
    label: "전화번호",
    severity: "warn",
    regex: /\b01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}\b/g,
    replacement: "[전화번호 가림]",
  },
  {
    type: "email",
    label: "이메일",
    severity: "warn",
    regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    replacement: "[이메일 가림]",
  },
  {
    type: "possibleAddress",
    label: "주소 가능성",
    severity: "warn",
    regex: /([가-힣A-Za-z0-9]+(시|군|구)\s+[가-힣A-Za-z0-9]+(로|길)\s*\d{1,4})/g,
    replacement: "[주소 가림]",
  },
  {
    type: "victimMaterial",
    label: "피해 이미지/영상 원본 언급",
    severity: "block",
    regex: /(원본\s*)?(영상|사진|이미지|파일)을?\s*(올릴|업로드|첨부|보낼|전송)/g,
    replacement: "[피해물 원본 업로드 금지]",
  },
];

export function maskSensitiveText(text: string) {
  return PATTERNS.reduce((current, pattern) => current.replace(pattern.regex, pattern.replacement), text);
}

export function detectSensitiveInput(text: string): SensitiveFinding[] {
  return PATTERNS.flatMap((pattern) => {
    const matches = text.match(pattern.regex);
    if (!matches?.length) {
      return [];
    }

    return [
      {
        type: pattern.type,
        label: pattern.label,
        severity: pattern.severity,
        count: matches.length,
      },
    ];
  });
}

export function hasBlockingSensitiveInput(text: string) {
  return detectSensitiveInput(text).some((finding) => finding.severity === "block");
}

export function canStoreSafely(text: string) {
  return !hasBlockingSensitiveInput(text);
}
