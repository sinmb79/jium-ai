import { ExternalLink, ShieldCheck } from "lucide-react";
import { PUBLIC_RESOURCES } from "@/lib/publicResources";
import { HomeLink, QuickExit } from "@/components/QuickExit";
import { appPath } from "@/lib/navigation";

export default function ResourcesPage() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href={appPath("/")}>
          <span className="brand-mark">
            <ShieldCheck size={19} aria-hidden="true" />
          </span>
          <span>지움AI</span>
        </a>
        <div className="topbar-actions">
          <HomeLink />
          <QuickExit />
        </div>
      </header>
      <section className="container dashboard card-stack">
        <div className="panel panel-tight">
          <span className="eyebrow">공식기관</span>
          <h1 style={{ fontSize: "clamp(2.2rem, 5vw, 4rem)", maxWidth: "12ch" }}>비용 없이 먼저 연결할 곳</h1>
          <p className="lead">지움AI는 피해 URL을 자동으로 접속하거나 기관에 전달하지 않습니다. 필요한 자료를 정리한 뒤, 사용자가 직접 공식 경로로 이동합니다.</p>
        </div>
        <div className="resource-grid">
          {PUBLIC_RESOURCES.map((resource) => (
            <article className="resource-card" key={resource.id}>
              <h2 style={{ fontSize: "1.08rem" }}>{resource.name}</h2>
              <p>{resource.description}</p>
              <p className="small">
                <strong>비용:</strong> {resource.cost}
              </p>
              <p className="small">{resource.caution}</p>
              <a className="btn btn-secondary" href={resource.url} target="_blank" rel="noreferrer">
                <ExternalLink size={16} aria-hidden="true" />
                공식 사이트 열기
              </a>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
