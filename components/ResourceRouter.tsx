"use client";

import { ExternalLink, Phone } from "lucide-react";
import { getResourcesForCase, RESOURCE_KIND_LABELS } from "@/lib/publicResources";
import type { CaseType } from "@/lib/types";

function kindBadgeClass(kind: ReturnType<typeof getResourcesForCase>[number]["kind"]) {
  if (kind === "OFFICIAL") {
    return "badge badge-green";
  }
  if (kind === "PUBLIC_LEGAL") {
    return "badge badge-low";
  }
  return "badge badge-medium";
}

export function ResourceRouter({ caseType }: { caseType: CaseType }) {
  const resources = getResourcesForCase(caseType);

  return (
    <div className="panel panel-tight card-stack">
      <div>
        <span className="eyebrow">연계 서비스</span>
        <h2>먼저 연결할 곳</h2>
        <p className="muted">공식·무료 경로를 우선 보여주고, 유료 법률 플랫폼은 선택지로만 표시합니다. 링크는 누를 때만 새 창으로 이동합니다.</p>
      </div>
      <div className="resource-grid">
        {resources.map((resource) => (
          <article className="resource-card" key={resource.id}>
            <span className={kindBadgeClass(resource.kind)}>{RESOURCE_KIND_LABELS[resource.kind]}</span>
            <h3>{resource.name}</h3>
            <p>{resource.description}</p>
            <p className="small">
              <strong>연계 방식:</strong> {resource.handoffMode}
            </p>
            <p className="small">
              <strong>비용:</strong> {resource.cost}
            </p>
            {resource.phone ? (
              <p className="small">
                <Phone size={14} aria-hidden="true" /> {resource.phone}
              </p>
            ) : null}
            <p className="small">{resource.caution}</p>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => {
                const ok = window.confirm("외부 공식 사이트로 이동합니다. 피해 URL은 자동으로 전달되지 않습니다.");
                if (ok) {
                  window.open(resource.url, "_blank", "noopener,noreferrer");
                }
              }}
            >
              <ExternalLink size={16} aria-hidden="true" />
              공식 사이트 열기
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
