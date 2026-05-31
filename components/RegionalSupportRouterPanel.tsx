"use client";

import { Download, MapPin, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { downloadTextFile } from "@/lib/export";
import {
  buildRegionalSupportRoute,
  formatRegionalSupportRoute,
  REGIONAL_SUPPORT_CENTERS,
  type SupportRegionId,
} from "@/lib/regionalSupportRouter";
import type { CaseType } from "@/lib/types";
import { ExternalSafeLink } from "@/components/ExternalSafeLink";

export function RegionalSupportRouterPanel({ caseType, urgent }: { caseType: CaseType; urgent?: boolean }) {
  const [regionId, setRegionId] = useState<SupportRegionId | "">("");
  const route = useMemo(() => buildRegionalSupportRoute({ caseType, regionText: regionId || undefined, urgent }), [caseType, regionId, urgent]);
  const markdown = useMemo(() => formatRegionalSupportRoute(route), [route]);

  return (
    <section className="trace-section" aria-labelledby="regional-support-title">
      <h3 id="regional-support-title">
        <MapPin size={17} aria-hidden="true" /> 지역 피해지원 라우팅
      </h3>
      <p className="muted small">
        가까운 지역 디지털성범죄피해자지원센터 후보를 정리하고, 긴급 상담은 1366·중앙디성센터로 먼저 연결합니다. 센터명은 제출 전 공식 경로에서 다시 확인해야 합니다.
      </p>

      <label className="field">
        <span className="label-row">
          지역 선택 <span className="hint">거주지와 다르면 안전하게 상담 가능한 지역을 선택</span>
        </span>
        <select className="select" value={regionId} onChange={(event) => setRegionId(event.target.value as SupportRegionId | "")}>
          <option value="">중앙 경로 우선</option>
          {REGIONAL_SUPPORT_CENTERS.map((center) => (
            <option key={center.regionId} value={center.regionId}>
              {center.regionName}
            </option>
          ))}
        </select>
      </label>

      <div className="submission-summary-grid">
        <div className="submission-summary-item">지역 {route.selectedRegionName || "미선택"}</div>
        <div className="submission-summary-item">중앙 상담 {route.centralRoutes[0]?.phone}</div>
        <div className="submission-summary-item">D4U {route.centralRoutes[1]?.phone}</div>
        <div className="submission-summary-item">출처 {route.source.checkedAt}</div>
      </div>

      {route.primaryCenter ? (
        <div className="notice notice-safe">
          <ShieldCheck size={18} aria-hidden="true" />
          <div>
            <strong>{route.primaryCenter.centerName}</strong>
            <p className="small muted">
              {route.primaryCenter.operatingOrganization} · {route.primaryCenter.sourceNote}
            </p>
          </div>
        </div>
      ) : null}

      <ul className="action-list compact-list">
        {route.recommendedOrder.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <div className="connector-list">
        {route.centralRoutes.map((item) =>
          item.url ? (
            <ExternalSafeLink key={item.name} href={item.url} confirmMessage="공식 상담 경로를 새 창으로 엽니다. 지움AI는 사건 내용이나 URL을 자동 전송하지 않습니다.">
              {item.name}
            </ExternalSafeLink>
          ) : null,
        )}
      </div>

      <div className="button-row">
        <button className="btn btn-secondary" type="button" onClick={() => downloadTextFile("jium-ai-regional-support-route.md", markdown)}>
          <Download size={16} aria-hidden="true" />
          라우팅 메모 저장
        </button>
      </div>
    </section>
  );
}
