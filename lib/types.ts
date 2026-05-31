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

export type EvidenceStatus = "DISCOVERED" | "SUBMITTED" | "IN_REVIEW" | "REMOVED" | "REAPPEARED";

export type EvidenceCaptureMethod =
  | "UNKNOWN"
  | "URL_ONLY"
  | "USER_SCREENSHOT"
  | "SEARCH_RESULT"
  | "PLATFORM_REPORT"
  | "THIRD_PARTY_TIP";

export type EvidenceRequestStatus = "DRAFTED" | "SENT" | "RECEIVED" | "REJECTED" | "ESCALATED";

export type EvidenceRequestLog = {
  id: string;
  target: string;
  requestedAt?: string;
  channel?: string;
  status: EvidenceRequestStatus;
  receiptId?: string;
  notes?: string;
};

export type EvidenceItem = {
  id: string;
  url: string;
  platform?: string;
  location?: string;
  posterId?: string;
  foundAt?: string;
  capturedAt?: string;
  captureMethod?: EvidenceCaptureMethod;
  capturedByUser: boolean;
  evidenceHash?: string;
  hashSource?: string;
  visualFingerprint?: string;
  fileName?: string;
  fileSize?: number;
  fileMimeType?: string;
  fileLastModified?: string;
  metadataFingerprint?: string;
  submissionTarget?: string;
  status: EvidenceStatus;
  requestLogs?: EvidenceRequestLog[];
  notes?: string;
};

export type CaseAuditAction =
  | "CREATED"
  | "STORED"
  | "STATUS_CHANGED"
  | "EXPORTED"
  | "SUBMISSION_PACKET_COPIED"
  | "SUBMISSION_PACKET_DOWNLOADED"
  | "PRE_SUBMISSION_CHECKLIST_EXPORTED"
  | "SUBMISSION_VERSION_SAVED"
  | "SUBMISSION_VERSION_COMPARED"
  | "READONLY_PACKET_OPENED"
  | "SUPPORT_HANDOFF_EXPORTED"
  | "LEARNING_RECORD_SAVED";

export type CaseAuditEntry = {
  id: string;
  at: string;
  action: CaseAuditAction;
  summary: string;
};

export type TraceNodeKind =
  | "CASE"
  | "EVIDENCE"
  | "PLATFORM"
  | "ACTOR_ALIAS"
  | "INFRASTRUCTURE_SIGNAL"
  | "OFFICIAL_ROUTE";

export type TraceEdgeKind =
  | "HAS_EVIDENCE"
  | "HOSTED_ON"
  | "POSTED_BY_ALIAS"
  | "TIME_SEQUENCE"
  | "SHARED_ALIAS"
  | "HAS_SIGNAL"
  | "ESCALATE_TO";

export type TraceConfidence = "OBSERVED" | "INFERRED" | "NEEDS_REVIEW";

export type TraceSignalSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type TraceNode = {
  id: string;
  kind: TraceNodeKind;
  label: string;
  detail?: string;
  occurredAt?: string;
  sourceEvidenceIds: string[];
};

export type TraceEdge = {
  id: string;
  from: string;
  to: string;
  kind: TraceEdgeKind;
  label: string;
  confidence: TraceConfidence;
  reason: string;
  sourceEvidenceIds: string[];
};

export type TraceTimelineEntry = {
  id: string;
  title: string;
  at?: string;
  summary: string;
  evidenceId?: string;
  confidence: TraceConfidence;
};

export type TraceLearningSignal = {
  id: string;
  label: string;
  severity: TraceSignalSeverity;
  matchedEvidenceIds: string[];
  whyItMatters: string;
  nextAction: string;
  learningNote: string;
};

export type TracePatternDefinition = {
  id: string;
  label: string;
  description: string;
  safeSignals: string[];
  prohibitedActions: string[];
  officialHandoff: string[];
};

export type TraceAnalysis = {
  nodes: TraceNode[];
  edges: TraceEdge[];
  timeline: TraceTimelineEntry[];
  learningSignals: TraceLearningSignal[];
  patternDefinitions: TracePatternDefinition[];
  boundaries: string[];
  nextQuestions: string[];
};

export type CaseInput = {
  situation: string;
  title: string;
  description: string;
  targetUrl?: string;
  platform?: string;
  keywords?: string;
  evidenceItems?: EvidenceItem[];
  keepExactUrlsForSubmission?: boolean;
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

export type VictimDeletionStep = {
  id: string;
  title: string;
  actor: "피해자" | "전문기관" | "플랫폼/검색엔진" | "수사·심의기관";
  timing: string;
  userAction: string[];
  requiredMaterials: string[];
  successSignal: string;
  nextStatus: CaseStatus;
};

export type VictimDeletionPlan = {
  title: string;
  summary: string;
  directRequestAllowed: boolean;
  firstPrinciple: string;
  urgentWarning?: string;
  steps: VictimDeletionStep[];
  escalationTriggers: string[];
  recordKeeping: string[];
  boundaries: string[];
  copyableNotice: RequestDraftOutput;
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

export type CaseStudyLesson = {
  id: string;
  title: string;
  riskPattern: string;
  whyItMatters: string;
  responsePrinciples: string[];
  rescueActions: string[];
  preventionActions: string[];
  doNotDo: string[];
  sourceNote: string;
};

export type InterventionChoice = {
  id: string;
  title: string;
  category: "OFFICIAL_SAFE" | "LEGAL_REVIEW" | "PROHIBITED";
  riskLevel: "낮음" | "상담 필요" | "금지";
  whenToUse: string;
  howJiumHelps: string[];
  userAction: string[];
  legalRiskNotice: string;
  relatedResources: string[];
};

export type PreventionGuidance = {
  title: string;
  summary: string;
  patterns: DigitalSexCrimePatternResponse[];
  caseStudyLessons: CaseStudyLesson[];
  survivorSupportProtocol: string[];
  communityPrevention: string[];
};

export type ResponsePack = {
  monitoringPlan: MonitoringPlan;
  takedownSequence: string[];
  victimDeletionPlan: VictimDeletionPlan;
  interventionChoices: InterventionChoice[];
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
  auditLog?: CaseAuditEntry[];
  notes: string[];
};
