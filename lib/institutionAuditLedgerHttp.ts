import { buildInstitutionAuditLedgerReportFromRecords } from "@/lib/institutionAuditLedgerReport";
import type { InstitutionAuditLedgerRecord } from "@/lib/institutionAuditLedger";
import {
  createInstitutionAuditEvent,
  emitInstitutionAuditEvent,
  type InstitutionAuditSink,
} from "@/lib/institutionAuditLog";
import { readInstitutionSessionTokenFromCookie } from "@/lib/institutionSessionCookie";
import { verifyInstitutionSessionFromCookieToken } from "@/lib/institutionLogin";
import {
  requireInstitutionCapability,
  type InstitutionAccountSession,
} from "@/lib/institutionAuth";
import type { InstitutionSessionTokenKey } from "@/lib/institutionSessionToken";

type GuardResult = {
  status: number;
  errorCode: string;
  headers?: HeadersInit;
};

export type InstitutionAuditLedgerSummaryHttpConfig = {
  tokenKeys: readonly InstitutionSessionTokenKey[];
  secureCookies: boolean;
  allowedOrigins?: readonly string[];
  readAuditRecords: () => Promise<InstitutionAuditLedgerRecord[]>;
  auditSink?: InstitutionAuditSink;
  requestId?: string;
  now?: number;
};

function jsonResponse(status: number, body: unknown, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

function methodGuard(request: Request): GuardResult | null {
  if (request.method !== "GET") {
    return { status: 405, errorCode: "METHOD_NOT_ALLOWED", headers: { Allow: "GET" } };
  }
  return null;
}

function originGuard(request: Request, allowedOrigins: readonly string[] = []): GuardResult | null {
  if (!allowedOrigins.length) {
    return null;
  }
  const origin = request.headers.get("Origin");
  if (!origin) {
    return { status: 403, errorCode: "ORIGIN_REQUIRED" };
  }
  if (!allowedOrigins.includes(origin)) {
    return { status: 403, errorCode: "ORIGIN_NOT_ALLOWED" };
  }
  return null;
}

function safeRequestId(request: Request, config: InstitutionAuditLedgerSummaryHttpConfig) {
  return config.requestId || request.headers.get("X-Request-Id") || `audit-ledger-view-${config.now ?? Date.now()}`;
}

async function auditLedgerView(
  request: Request,
  config: InstitutionAuditLedgerSummaryHttpConfig,
  outcome: "SUCCESS" | "DENIED",
  details: { reasonCode?: string; session?: InstitutionAccountSession } = {},
) {
  await emitInstitutionAuditEvent(
    config.auditSink,
    createInstitutionAuditEvent(
      {
        eventType: outcome === "SUCCESS" ? "INSTITUTION_AUDIT_LEDGER_VIEWED" : "INSTITUTION_AUDIT_LEDGER_VIEW_DENIED",
        outcome,
        reasonCode: details.reasonCode,
        requestId: safeRequestId(request, config),
        originClassification: config.allowedOrigins?.includes(request.headers.get("Origin") || "")
          ? "ALLOWED"
          : request.headers.get("Origin")
            ? "REJECTED"
            : config.allowedOrigins?.length
              ? "MISSING"
              : "NOT_CONFIGURED",
        organizationName: details.session?.organizationName,
        subjectId: details.session?.subjectId,
        role: details.session?.role,
        capabilityIds: details.session?.capabilityIds,
        evidenceAccessScope: details.session?.evidenceAccessScope,
        sessionExpiresAt: details.session?.expiresAt,
      },
      config.now ?? Date.now(),
    ),
  );
}

function publicReport(report: Awaited<ReturnType<typeof buildInstitutionAuditLedgerReportFromRecords>>) {
  return {
    verification: report.verification,
    firstRecordedAt: report.firstRecordedAt,
    lastRecordedAt: report.lastRecordedAt,
    byEventType: report.byEventType,
    byOutcome: report.byOutcome,
    byOriginClassification: report.byOriginClassification,
    byOrganization: report.byOrganization,
    recentRecords: report.recentRecords.map((record) => ({
      sequence: record.sequence,
      recordedAt: record.recordedAt,
      eventType: record.event.eventType,
      outcome: record.event.outcome,
      reasonCode: record.event.reasonCode,
      originClassification: record.event.originClassification,
      organizationName: record.event.organizationName,
      subjectId: record.event.subjectId,
      role: record.event.role,
      evidenceAccessScope: record.event.evidenceAccessScope,
    })),
    safetyNotes: report.safetyNotes,
  };
}

export async function handleInstitutionAuditLedgerSummaryRequest(
  request: Request,
  config: InstitutionAuditLedgerSummaryHttpConfig,
) {
  const guard = methodGuard(request) || originGuard(request, config.allowedOrigins);
  if (guard) {
    await auditLedgerView(request, config, "DENIED", { reasonCode: guard.errorCode });
    return jsonResponse(guard.status, { ok: false, errorCode: guard.errorCode }, guard.headers);
  }

  const token = readInstitutionSessionTokenFromCookie(request.headers.get("Cookie"), config.secureCookies);
  if (!token) {
    await auditLedgerView(request, config, "DENIED", { reasonCode: "INSTITUTION_SESSION_REQUIRED" });
    return jsonResponse(401, { ok: false, errorCode: "INSTITUTION_SESSION_REQUIRED" });
  }

  let session: InstitutionAccountSession;
  try {
    session = await verifyInstitutionSessionFromCookieToken(token, config.tokenKeys, config.now);
    requireInstitutionCapability(session, "INSTITUTION_AUDIT_LEDGER_REVIEW", config.now);
  } catch {
    await auditLedgerView(request, config, "DENIED", { reasonCode: "AUDIT_LEDGER_REVIEW_NOT_ALLOWED" });
    return jsonResponse(403, { ok: false, errorCode: "AUDIT_LEDGER_REVIEW_NOT_ALLOWED" });
  }

  try {
    const records = await config.readAuditRecords();
    const report = await buildInstitutionAuditLedgerReportFromRecords(records);
    await auditLedgerView(request, config, "SUCCESS", { session });
    return jsonResponse(200, { ok: true, report: publicReport(report) });
  } catch {
    await auditLedgerView(request, config, "DENIED", { reasonCode: "AUDIT_LEDGER_STORE_UNAVAILABLE", session });
    return jsonResponse(503, { ok: false, errorCode: "AUDIT_LEDGER_STORE_UNAVAILABLE" });
  }
}
