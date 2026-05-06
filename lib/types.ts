export type CaseType =
  | "PERSONAL_INFO_EXPOSURE"
  | "SELF_POST_DELETE"
  | "SEARCH_RESULT_REMOVAL"
  | "ACCOUNT_DELETE"
  | "CREDENTIAL_LEAK"
  | "DIGITAL_SEX_CRIME"
  | "DEFAMATION_PRIVACY"
  | "IMPERSONATION"
  | "UNKNOWN";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type DeletionChance =
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "SPECIALIST_REQUIRED"
  | "LEGAL_REVIEW_REQUIRED"
  | "NOT_SUPPORTED";

export type CaseStatus =
  | "DRAFT"
  | "READY"
  | "REQUESTED"
  | "WAITING_RESPONSE"
  | "NEEDS_MORE_INFO"
  | "PLATFORM_RESPONDED"
  | "USER_VERIFIED"
  | "REAPPEARED"
  | "CLOSED";

export type SensitivityLevel = "NORMAL" | "SENSITIVE" | "CRITICAL";

export type StorageMode = "LOCAL_FIRST" | "SERVER_OPT_IN";

export type CaseInput = {
  situation: string;
  title: string;
  description: string;
  targetUrl?: string;
  platform?: string;
  keywords?: string;
  exposedInfo: string[];
  urgent: boolean;
  helperMode: "self" | "guardian" | "supporter";
};

export type CaseClassification = {
  caseType: CaseType;
  riskLevel: RiskLevel;
  deletionChance: DeletionChance;
  sensitivityLevel: SensitivityLevel;
  recommendedRoute: string[];
  immediateActions: string[];
  evidenceChecklist: string[];
  followUpDays: number[];
  safetyNote?: string;
  reason: string;
  legalDisclaimer: string;
  specialistFirst: boolean;
};

export type RequestDraftOutput = {
  title: string;
  body: string;
  checklist: string[];
  recipientType:
    | "PLATFORM_ADMIN"
    | "SEARCH_ENGINE"
    | "PUBLIC_AGENCY"
    | "POLICE"
    | "LEGAL_SUPPORT"
    | "SELF_CHECKLIST";
};

export type SavedCase = {
  id: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  storageMode: StorageMode;
  input: CaseInput;
  redactedPreview: string;
  classification: CaseClassification;
  draft: RequestDraftOutput;
  status: CaseStatus;
  verifiedByUserAt?: string;
  notes: string[];
};
