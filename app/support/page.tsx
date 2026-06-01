import { LifeBuoy, ShieldAlert, ShieldCheck } from "lucide-react";
import { HomeLink, QuickExit } from "@/components/QuickExit";
import { appPath } from "@/lib/navigation";

export default function SupportPage() {
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
          <span className="eyebrow">운영 지원 경로</span>
          <h1 style={{ fontSize: "clamp(2rem, 4vw, 3.4rem)", maxWidth: "14ch" }}>지원 요청 경로</h1>
          <p className="lead">
            이 공개 페이지에는 피해 URL이나 개인정보를 입력하지 않습니다. 사건자료는 지움AI 안에서 먼저
            정리하고, 운영기관이 지정한 비공개 접수 채널 또는 공식 피해지원기관으로 제출합니다.
          </p>
        </div>

        <div className="resource-grid">
          <article className="resource-card">
            <span className="badge badge-critical">
              <ShieldAlert size={14} aria-hidden="true" />
              긴급 상황
            </span>
            <h2 style={{ fontSize: "1.08rem" }}>즉시 공식기관 연결</h2>
            <p>
              긴급 위험이 있으면 즉시 112 또는 공식 피해지원기관에 연락해야 합니다. 지움AI는 긴급 구조
              서비스를 대신하지 않습니다.
            </p>
          </article>

          <article className="resource-card">
            <span className="badge badge-green">
              <LifeBuoy size={14} aria-hidden="true" />
              비공개 접수
            </span>
            <h2 style={{ fontSize: "1.08rem" }}>운영기관 지정 채널</h2>
            <p>
              운영기관이 지정한 비공개 접수 채널에서만 사건번호, 연락 가능한 별도 식별자, 제출 패킷 접근
              절차를 안내합니다.
            </p>
          </article>

          <article className="resource-card">
            <span className="badge badge-low">자료 준비</span>
            <h2 style={{ fontSize: "1.08rem" }}>제출 패킷 사용</h2>
            <p>
              상담자나 담당자에게는 원본 전체가 아니라 해시, 발견시각, 게시위치, 삭제요청 초안, 기관별 제출
              체크리스트를 묶은 패킷을 전달합니다.
            </p>
          </article>

          <article className="resource-card">
            <span className="badge badge-medium">운영 원칙</span>
            <h2 style={{ fontSize: "1.08rem" }}>공개창 입력 금지</h2>
            <p>
              공개 웹페이지, 이메일 본문, 채팅창에는 피해 원문이나 민감 식별자를 붙여넣지 않는 것을 기본
              원칙으로 둡니다.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
