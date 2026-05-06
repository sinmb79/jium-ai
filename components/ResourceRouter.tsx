"use client";

import { ExternalLink, Phone } from "lucide-react";
import { getResourcesForCase } from "@/lib/publicResources";
import type { CaseType } from "@/lib/types";

export function ResourceRouter({ caseType }: { caseType: CaseType }) {
  const resources = getResourcesForCase(caseType);

  return (
    <div className="panel panel-tight card-stack">
      <div>
        <span className="eyebrow">무료 공식 경로</span>
        <h2>먼저 연결할 곳</h2>
        <p className="muted">아래 링크는 자동으로 열거나 미리보지 않습니다. 누를 때만 새 창으로 이동합니다.</p>
      </div>
      <div className="resource-grid">
        {resources.map((resource) => (
          <article className="resource-card" key={resource.id}>
            <h3>{resource.name}</h3>
            <p>{resource.description}</p>
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
