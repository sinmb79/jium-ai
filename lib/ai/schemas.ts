import { z } from "zod";

export const CaseClassificationSchema = z.object({
  caseType: z.enum([
    "PERSONAL_INFO_EXPOSURE",
    "SELF_POST_DELETE",
    "SEARCH_RESULT_REMOVAL",
    "ACCOUNT_DELETE",
    "CREDENTIAL_LEAK",
    "DIGITAL_SEX_CRIME",
    "DEFAMATION_PRIVACY",
    "IMPERSONATION",
    "UNKNOWN",
  ]),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  deletionChance: z.enum(["HIGH", "MEDIUM", "LOW", "SPECIALIST_REQUIRED", "LEGAL_REVIEW_REQUIRED", "NOT_SUPPORTED"]),
  recommendedRoute: z.array(z.string()),
  immediateActions: z.array(z.string()),
  evidenceChecklist: z.array(z.string()),
  followUpDays: z.array(z.number()),
  safetyNote: z.string().optional(),
  reason: z.string(),
  legalDisclaimer: z.string(),
  specialistFirst: z.boolean(),
  sensitivityLevel: z.enum(["NORMAL", "SENSITIVE", "CRITICAL"]),
});

export const RequestDraftSchema = z.object({
  title: z.string(),
  body: z.string(),
  checklist: z.array(z.string()),
  recipientType: z.enum(["PLATFORM_ADMIN", "SEARCH_ENGINE", "PUBLIC_AGENCY", "POLICE", "LEGAL_SUPPORT", "SELF_CHECKLIST"]),
});
