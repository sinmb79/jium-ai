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

export type MonitoringPlan = {
  title: string;
  safeQueries: string[];
  manualCheckTargets: string[];
  cadence: string[];
  boundaries: string[];
};

export type AttributionGuidance = {
  title: string;
  whatYouCanRecord: string[];
  whatNotToDo: string[];
  officialProcess: string[];
};

export type LegalSupportPack = {
  title: string;
  policeReport: RequestDraftOutput;
  criminalComplaintPrep: RequestDraftOutput;
  legalAidMemo: RequestDraftOutput;
};

export type ServiceIntegration = {
  id: string;
  name: string;
  kind: "OFFICIAL" | "PUBLIC_LEGAL" | "PRIVATE_LEGAL";
  cost: "무료" | "상담 필요" | "유료 가능";
  url: string;
  phone?: string;
  useWhen: string;
  handoffMode: string;
  prepItems: string[];
  privacyNote: string;
};

export type DigitalSexCrimePatternResponse = {
  id: string;
  crimeType: string;
  riskSignals: string[];
  requiredMeasures: string[];
  responseSteps: string[];
  evidenceToKeep: string[];
  helperActions: string[];
  preventionForOthers: string[];
  doNotDo: string[];
  primaryRoutes: string[];
};

export type PreventionGuidance = {
  title: string;
  summary: string;
  patterns: DigitalSexCrimePatternResponse[];
  survivorSupportProtocol: string[];
  communityPrevention: string[];
};

export type ResponsePack = {
  monitoringPlan: MonitoringPlan;
  takedownSequence: string[];
  attributionGuidance: AttributionGuidance;
  legalSupport: LegalSupportPack;
  serviceIntegrations: ServiceIntegration[];
  preventionGuidance: PreventionGuidance;
  automationBoundary: {
    automatedByJium: string[];
    requiresUserConfirmation: string[];
    requiresOfficialAuthority: string[];
  };
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
  responsePack: ResponsePack;
  status: CaseStatus;
  verifiedByUserAt?: string;
  notes: string[];
};
