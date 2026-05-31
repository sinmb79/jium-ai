import { DIGITAL_CRIME_ROUTE_PATTERNS } from "@/lib/digitalCrimeRouteKnowledge";
import { PROMOTION_SURFACE_PATTERNS } from "@/lib/promotionSurfaceIntelligence";
import { canUseAuthorizedFeedCapability, type AuthorizedFeedOperatorSession } from "@/lib/authorizedFeedAccess";
import type { TraceSignalSeverity } from "@/lib/types";

const AUTHORIZED_FEED_STORAGE_KEY = "jium-ai.authorized-intel-feed.v1";
const SAFE_DIGEST_PATTERN = /^(sha256-[a-f0-9]{64}|ahash-[a-f0-9]{16})$/;
const UNSAFE_RAW_MARKERS = ["http://", "https://", "discord.gg/", "t.me/", "telegram.me/", ".onion", "@", "010-"];
const SOURCE_TYPES: AuthorizedFeedSourceType[] = ["OFFICIAL_PUBLIC_NOTICE", "AUTHORIZED_PARTNER_FEED", "PLATFORM_TRANSPARENCY"];
const ACCESS_LEVELS: AuthorizedFeedAccessLevel[] = ["RESTRICTED_CASE_INDICATOR", "AUTHORIZED_INTEL_ONLY"];
const INDICATOR_KINDS: AuthorizedFeedIndicatorKind[] = [
  "ROUTE_PATTERN",
  "PROMOTION_SURFACE",
  "HASH_DIGEST",
  "VISUAL_FINGERPRINT",
  "PLATFORM_PRESERVATION_HINT",
];

export type AuthorizedFeedSourceType = "OFFICIAL_PUBLIC_NOTICE" | "AUTHORIZED_PARTNER_FEED" | "PLATFORM_TRANSPARENCY";

export type AuthorizedFeedAccessLevel = "RESTRICTED_CASE_INDICATOR" | "AUTHORIZED_INTEL_ONLY";

export type AuthorizedFeedIndicatorKind =
  | "ROUTE_PATTERN"
  | "PROMOTION_SURFACE"
  | "HASH_DIGEST"
  | "VISUAL_FINGERPRINT"
  | "PLATFORM_PRESERVATION_HINT";

export type AuthorizedFeedConfidence = "LOW" | "MEDIUM" | "HIGH";

export type AuthorizedFeedAuditAction = "IMPORTED" | "VIEWED_SUMMARY" | "PURGED_EXPIRED" | "REJECTED";

export type AuthorizedFeedAuditEntry = {
  at: string;
  action: AuthorizedFeedAuditAction;
  actor: "SYSTEM" | "AUTHORIZED_OPERATOR";
  summary: string;
};

export type AuthorizedFeedIndicator = {
  id: string;
  kind: AuthorizedFeedIndicatorKind;
  label: string;
  publicSummary: string;
  sourceName: string;
  sourceType: AuthorizedFeedSourceType;
  sourceDate: string;
  lastCheckedAt: string;
  expiresAt: string;
  accessLevel: AuthorizedFeedAccessLevel;
  confidence: AuthorizedFeedConfidence;
  riskLevel: TraceSignalSeverity;
  routePatternId?: string;
  promotionSurfaceId?: string;
  indicatorDigest?: string;
  signalTags: string[];
  allowedUses: string[];
  prohibitedUses: string[];
  officialHandoff: string[];
  auditLog: AuthorizedFeedAuditEntry[];
};

export type AuthorizedFeedBundle = {
  version: "jium-authorized-feed-v1";
  generatedAt: string;
  sourceName: string;
  sourceType: AuthorizedFeedSourceType;
  authorizationRef: string;
  indicators: Array<Omit<AuthorizedFeedIndicator, "auditLog" | "sourceName" | "sourceType">>;
};

export type AuthorizedFeedValidationResult = {
  valid: boolean;
  errors: string[];
};

export type AuthorizedFeedSummary = {
  total: number;
  bySourceType: Record<string, number>;
  byRoutePattern: Record<string, number>;
  byPromotionSurface: Record<string, number>;
  byAccessLevel: Record<string, number>;
  expiringWithin30Days: number;
};

function routePatternExists(id?: string) {
  return Boolean(id && DIGITAL_CRIME_ROUTE_PATTERNS.some((pattern) => pattern.id === id));
}

function promotionSurfaceExists(id?: string) {
  return Boolean(id && PROMOTION_SURFACE_PATTERNS.some((pattern) => pattern.id === id));
}

function compactList(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).slice(0, 20);
}

function parseDate(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function unsafeAuthorizedFeedMarkers(value: unknown) {
  const serialized = JSON.stringify(value).toLowerCase();
  return UNSAFE_RAW_MARKERS.filter((marker) => serialized.includes(marker));
}

export function validateAuthorizedFeedIndicator(indicator: AuthorizedFeedIndicator): AuthorizedFeedValidationResult {
  const errors: string[] = [];

  if (!indicator.id.trim()) {
    errors.push("id is required");
  }
  if (!indicator.sourceName.trim()) {
    errors.push("sourceName is required");
  }
  if (!SOURCE_TYPES.includes(indicator.sourceType)) {
    errors.push("sourceType must be official, platform transparency, or an authorized partner feed");
  }
  if (!ACCESS_LEVELS.includes(indicator.accessLevel)) {
    errors.push("accessLevel must be restricted or authorized-only");
  }
  if (!INDICATOR_KINDS.includes(indicator.kind)) {
    errors.push("kind is not supported");
  }
  if (!indicator.publicSummary.trim()) {
    errors.push("publicSummary is required");
  }
  if (indicator.routePatternId && !routePatternExists(indicator.routePatternId)) {
    errors.push(`unknown routePatternId: ${indicator.routePatternId}`);
  }
  if (indicator.promotionSurfaceId && !promotionSurfaceExists(indicator.promotionSurfaceId)) {
    errors.push(`unknown promotionSurfaceId: ${indicator.promotionSurfaceId}`);
  }
  if (!indicator.routePatternId && !indicator.promotionSurfaceId && !indicator.indicatorDigest) {
    errors.push("one of routePatternId, promotionSurfaceId, or indicatorDigest is required");
  }
  if (indicator.indicatorDigest && !SAFE_DIGEST_PATTERN.test(indicator.indicatorDigest)) {
    errors.push("indicatorDigest must be sha256-hex or ahash-hex and must not contain a raw indicator");
  }
  if (unsafeAuthorizedFeedMarkers(indicator).length) {
    errors.push("raw URLs, handles, invite links, phone numbers, or onion addresses are not allowed in authorized feed storage");
  }

  const sourceDate = parseDate(indicator.sourceDate);
  const lastCheckedAt = parseDate(indicator.lastCheckedAt);
  const expiresAt = parseDate(indicator.expiresAt);
  if (!Number.isFinite(sourceDate)) {
    errors.push("sourceDate must be an ISO date");
  }
  if (!Number.isFinite(lastCheckedAt)) {
    errors.push("lastCheckedAt must be an ISO date");
  }
  if (!Number.isFinite(expiresAt)) {
    errors.push("expiresAt must be an ISO date");
  }
  if (Number.isFinite(lastCheckedAt) && Number.isFinite(expiresAt) && expiresAt <= lastCheckedAt) {
    errors.push("expiresAt must be later than lastCheckedAt");
  }
  if (!indicator.allowedUses.length) {
    errors.push("allowedUses must describe at least one permitted use");
  }
  if (!indicator.prohibitedUses.length) {
    errors.push("prohibitedUses must describe at least one prohibited use");
  }
  if (!indicator.officialHandoff.length) {
    errors.push("officialHandoff must include at least one agency or platform handoff route");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function normalizeAuthorizedFeedIndicator(indicator: AuthorizedFeedIndicator): AuthorizedFeedIndicator {
  return {
    ...indicator,
    id: indicator.id.trim(),
    label: indicator.label.trim(),
    publicSummary: indicator.publicSummary.trim(),
    sourceName: indicator.sourceName.trim(),
    sourceDate: new Date(indicator.sourceDate).toISOString(),
    lastCheckedAt: new Date(indicator.lastCheckedAt).toISOString(),
    expiresAt: new Date(indicator.expiresAt).toISOString(),
    indicatorDigest: indicator.indicatorDigest?.trim(),
    signalTags: compactList(indicator.signalTags),
    allowedUses: compactList(indicator.allowedUses),
    prohibitedUses: compactList(indicator.prohibitedUses),
    officialHandoff: compactList(indicator.officialHandoff),
    auditLog: indicator.auditLog.slice(-50),
  };
}

export function importAuthorizedFeedBundle(bundle: AuthorizedFeedBundle, importedAt = new Date().toISOString()) {
  if (bundle.version !== "jium-authorized-feed-v1") {
    throw new Error("Unsupported authorized feed version");
  }
  if (!bundle.authorizationRef.trim()) {
    throw new Error("authorizationRef is required");
  }
  if (unsafeAuthorizedFeedMarkers({ sourceName: bundle.sourceName, authorizationRef: bundle.authorizationRef }).length) {
    throw new Error("Authorized feed bundle provenance must not contain raw operational indicators");
  }

  return bundle.indicators.map((indicator) => {
    const fullIndicator: AuthorizedFeedIndicator = {
      ...indicator,
      sourceName: bundle.sourceName,
      sourceType: bundle.sourceType,
      auditLog: [
        {
          at: importedAt,
          action: "IMPORTED",
          actor: "AUTHORIZED_OPERATOR",
          summary: `Imported from ${bundle.sourceName} (${bundle.authorizationRef})`,
        },
      ],
    };
    const validation = validateAuthorizedFeedIndicator(fullIndicator);
    if (!validation.valid) {
      throw new Error(`Invalid authorized feed indicator ${indicator.id}: ${validation.errors.join("; ")}`);
    }
    return normalizeAuthorizedFeedIndicator(fullIndicator);
  });
}

export function mergeAuthorizedFeedIndicators(existing: AuthorizedFeedIndicator[], incoming: AuthorizedFeedIndicator[]) {
  const byId = new Map<string, AuthorizedFeedIndicator>();
  existing.forEach((indicator) => byId.set(indicator.id, normalizeAuthorizedFeedIndicator(indicator)));
  incoming.forEach((indicator) => byId.set(indicator.id, normalizeAuthorizedFeedIndicator(indicator)));
  return Array.from(byId.values()).sort((a, b) => b.lastCheckedAt.localeCompare(a.lastCheckedAt));
}

export function importAuthorizedFeedBundleForOperator(
  bundle: AuthorizedFeedBundle,
  session: AuthorizedFeedOperatorSession | null | undefined,
  existing: AuthorizedFeedIndicator[] = [],
  importedAt = new Date().toISOString(),
  now = Date.now(),
) {
  if (!canUseAuthorizedFeedCapability(session, "AUTHORIZED_FEED_IMPORT", now)) {
    throw new Error("Authorized operator session is required to import restricted intelligence feeds");
  }
  return mergeAuthorizedFeedIndicators(existing, importAuthorizedFeedBundle(bundle, importedAt));
}

export function purgeExpiredAuthorizedIndicators(indicators: AuthorizedFeedIndicator[], now = new Date().toISOString()) {
  const nowTime = Date.parse(now);
  return indicators
    .filter((indicator) => Date.parse(indicator.expiresAt) > nowTime)
    .map((indicator) => normalizeAuthorizedFeedIndicator(indicator));
}

export function buildAuthorizedFeedSummary(indicators: AuthorizedFeedIndicator[], now = new Date().toISOString()): AuthorizedFeedSummary {
  const nowTime = Date.parse(now);
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  return indicators.reduce<AuthorizedFeedSummary>(
    (summary, indicator) => {
      summary.total += 1;
      summary.bySourceType[indicator.sourceType] = (summary.bySourceType[indicator.sourceType] || 0) + 1;
      summary.byAccessLevel[indicator.accessLevel] = (summary.byAccessLevel[indicator.accessLevel] || 0) + 1;
      if (indicator.routePatternId) {
        summary.byRoutePattern[indicator.routePatternId] = (summary.byRoutePattern[indicator.routePatternId] || 0) + 1;
      }
      if (indicator.promotionSurfaceId) {
        summary.byPromotionSurface[indicator.promotionSurfaceId] = (summary.byPromotionSurface[indicator.promotionSurfaceId] || 0) + 1;
      }
      const expiresAt = Date.parse(indicator.expiresAt);
      if (Number.isFinite(expiresAt) && expiresAt > nowTime && expiresAt - nowTime <= thirtyDaysMs) {
        summary.expiringWithin30Days += 1;
      }
      return summary;
    },
    { total: 0, bySourceType: {}, byRoutePattern: {}, byPromotionSurface: {}, byAccessLevel: {}, expiringWithin30Days: 0 },
  );
}

export function unsafeAuthorizedFeedStorageMarkers(indicators: AuthorizedFeedIndicator[]) {
  return unsafeAuthorizedFeedMarkers(indicators);
}

export function loadAuthorizedFeedIndicators(): AuthorizedFeedIndicator[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const parsed = JSON.parse(window.localStorage.getItem(AUTHORIZED_FEED_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? purgeExpiredAuthorizedIndicators(parsed as AuthorizedFeedIndicator[]) : [];
  } catch {
    return [];
  }
}

export function saveAuthorizedFeedIndicators(indicators: AuthorizedFeedIndicator[], now = new Date().toISOString()) {
  if (typeof window === "undefined") {
    return [];
  }
  const normalized = purgeExpiredAuthorizedIndicators(indicators, now).map((indicator) => {
    const validation = validateAuthorizedFeedIndicator(indicator);
    if (!validation.valid) {
      throw new Error(`Invalid authorized feed indicator ${indicator.id}: ${validation.errors.join("; ")}`);
    }
    return normalizeAuthorizedFeedIndicator(indicator);
  });
  if (unsafeAuthorizedFeedStorageMarkers(normalized).length) {
    throw new Error("Authorized feed storage contains raw operational indicators");
  }
  const next = normalized.slice(0, 500);
  window.localStorage.setItem(AUTHORIZED_FEED_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function clearAuthorizedFeedIndicators() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(AUTHORIZED_FEED_STORAGE_KEY);
  }
}
