"use client";

import { Clipboard, ExternalLink, FileWarning, Gavel, Phone, SearchCheck, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { RESOURCE_KIND_LABELS } from "@/lib/publicResources";
import type { ResponsePack } from "@/lib/types";

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="btn btn-secondary"
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
    >
      <Clipboard size={16} aria-hidden="true" />
      {copied ? "복사됨" : label}
    </button>
  );
}

function OpenServiceButton({ url }: { url: string }) {
  return (
    <button
      className="btn btn-secondary"
      type="button"
      onClick={() => {
        const ok = window.confirm("외부 법률·형사 지원 서비스로 이동합니다. 사건 내용과 피해 URL은 자동으로 전달되지 않습니다.");
        if (ok) {
          window.open(url, "_blank", "noopener,noreferrer");
        }
      }}
    >
      <ExternalLink size={16} aria-hidden="true" />
      서비스 열기
    </button>
  );
}

function kindBadgeClass(kind: ResponsePack["serviceIntegrations"][number]["kind"]) {
  if (kind === "OFFICIAL") {
    return "badge badge-green";
  }
  if (kind === "PUBLIC_LEGAL") {
    return "badge badge-low";
  }
  return "badge badge-medium";
}

export function ResponsePackPanel({ pack }: { pack: ResponsePack }) {
  return (
    <div className="panel panel-tight card-stack">
      <div>
        <span className="eyebrow">토탈 대응 패키지</span>
        <h2>추적, 삭제 요청, 신고, 고소 준비를 한 묶음으로 정리했습니다.</h2>
        <p className="muted">
          지움AI가 자동으로 하는 일은 문서화와 정리입니다. 실제 삭제, 신고 제출, 유출자 특정은 사용자 확인과 공식기관 절차가 필요합니다.
        </p>
      </div>

      <section className="panel panel-tight" style={{ boxShadow: "none" }}>
        <h3>
          <SearchCheck size={18} aria-hidden="true" /> {pack.monitoringPlan.title}
        </h3>
        <div className="two-col">
          <div>
            <strong>안전 검색어</strong>
            <ul className="action-list">
              {pack.monitoringPlan.safeQueries.map((query) => (
                <li key={query}>{query}</li>
              ))}
            </ul>
          </div>
          <div>
            <strong>재확인 주기</strong>
            <ul className="action-list">
              {pack.monitoringPlan.cadence.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="small muted">자동 크롤링·로그인 자동화·우회 접속은 하지 않습니다. 피해 URL은 사용자가 직접 확인합니다.</p>
      </section>

      <section className="panel panel-tight" style={{ boxShadow: "none" }}>
        <h3>
          <FileWarning size={18} aria-hidden="true" /> 삭제 요청 순서
        </h3>
        <ul className="action-list">
          {pack.takedownSequence.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
      </section>

      <section className="panel panel-tight" style={{ boxShadow: "none" }}>
        <h3>
          <ShieldAlert size={18} aria-hidden="true" /> {pack.attributionGuidance.title}
        </h3>
        <div className="two-col">
          <div>
            <strong>기록할 수 있는 단서</strong>
            <ul className="action-list">
              {pack.attributionGuidance.whatYouCanRecord.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <strong>하지 말아야 할 일</strong>
            <ul className="action-list">
              {pack.attributionGuidance.whatNotToDo.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="small muted">{pack.attributionGuidance.officialProcess.join(" ")}</p>
      </section>

      <section className="panel panel-tight" style={{ boxShadow: "none" }}>
        <h3>
          <Gavel size={18} aria-hidden="true" /> 신고·고소·법률상담 문서
        </h3>
        <div className="resource-grid">
          {[pack.legalSupport.policeReport, pack.legalSupport.criminalComplaintPrep, pack.legalSupport.legalAidMemo].map((draft) => (
            <article className="resource-card" key={draft.title}>
              <h3>{draft.title}</h3>
              <p>{draft.checklist.join(", ")}</p>
              <CopyButton text={draft.body} label="본문 복사" />
            </article>
          ))}
        </div>
      </section>

      <section className="panel panel-tight" style={{ boxShadow: "none" }}>
        <h3>
          <ExternalLink size={18} aria-hidden="true" /> 법률·형사 지원 서비스 연계
        </h3>
        <p className="small muted">
          공식·무료 경로를 먼저 배치하고, 유료 법률 플랫폼은 선택지로만 제공합니다. 지움AI는 자동 접수나 대리 제출을 하지 않습니다.
        </p>
        <div className="resource-grid">
          {pack.serviceIntegrations.map((service) => (
            <article className="resource-card" key={service.id}>
              <span className={kindBadgeClass(service.kind)}>{RESOURCE_KIND_LABELS[service.kind]}</span>
              <h3>{service.name}</h3>
              <p>{service.useWhen}</p>
              <p className="small">
                <strong>연계 방식:</strong> {service.handoffMode}
              </p>
              <ul className="action-list small">
                {service.prepItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="small">
                <strong>비용:</strong> {service.cost}
              </p>
              {service.phone ? (
                <p className="small">
                  <Phone size={14} aria-hidden="true" /> {service.phone}
                </p>
              ) : null}
              <p className="small muted">{service.privacyNote}</p>
              <OpenServiceButton url={service.url} />
            </article>
          ))}
        </div>
      </section>

      <section className="notice">
        <ShieldAlert size={20} aria-hidden="true" />
        <div>
          <strong>자동화 경계</strong>
          <p className="small">
            자동 작성: {pack.automationBoundary.automatedByJium.join(", ")}. 사용자 확인 필요:{" "}
            {pack.automationBoundary.requiresUserConfirmation.join(", ")}. 공식권한 필요:{" "}
            {pack.automationBoundary.requiresOfficialAuthority.join(", ")}.
          </p>
        </div>
      </section>
    </div>
  );
}
