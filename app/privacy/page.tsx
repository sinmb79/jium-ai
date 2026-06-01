import { FileText, LockKeyhole, ShieldCheck } from "lucide-react";
import { HomeLink, QuickExit } from "@/components/QuickExit";
import { appPath } from "@/lib/navigation";

export default function PrivacyPage() {
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
          <span className="eyebrow">운영 개인정보 안내</span>
          <h1 style={{ fontSize: "clamp(2rem, 4vw, 3.4rem)", maxWidth: "16ch" }}>개인정보와 사건자료 보호</h1>
          <p className="lead">
            지움AI는 피해자의 기기 안에서 먼저 정리하고, 필요한 경우에만 검토된 자료를 공식기관 제출 형태로
            묶도록 설계됩니다. 공개 페이지와 공개 리포트에는 사건 원문이나 민감 식별자를 저장하지 않습니다.
          </p>
        </div>

        <div className="resource-grid">
          <article className="resource-card">
            <span className="badge badge-green">
              <LockKeyhole size={14} aria-hidden="true" />
              기본 원칙
            </span>
            <h2 style={{ fontSize: "1.08rem" }}>로컬 우선 정리</h2>
            <p>
              피해 설명, 증거 메모, 제출 초안은 사용자의 장치에서 먼저 처리합니다. 운영 서버는 기관 승인,
              보존정책, 접근권한, 감사기록이 준비된 경우에만 사용합니다.
            </p>
          </article>

          <article className="resource-card">
            <span className="badge badge-low">
              <FileText size={14} aria-hidden="true" />
              수집 제한
            </span>
            <h2 style={{ fontSize: "1.08rem" }}>공개 리포트 금지 항목</h2>
            <p>
              원본 피해자료, 비밀방 초대 링크, 토큰, 연락처, 주민등록번호, 계정 비밀번호, 암호화폐 지갑주소,
              사설 저장소 경로는 공개 보고서와 배포 산출물에 포함하지 않습니다.
            </p>
          </article>

          <article className="resource-card">
            <span className="badge badge-medium">제출 전 검토</span>
            <h2 style={{ fontSize: "1.08rem" }}>공식기관 제출 중심</h2>
            <p>
              삭제요청서, 수사협조 요청서, 상담용 요약문은 사용자가 검토한 뒤 공식기관 제출 경로로 직접
              전달하는 것을 기본값으로 둡니다.
            </p>
          </article>

          <article className="resource-card">
            <span className="badge badge-high">보존과 삭제</span>
            <h2 style={{ fontSize: "1.08rem" }}>최소 보존</h2>
            <p>
              운영 환경에서는 사건별 보존기간, 삭제요청 절차, 감사 열람 권한을 별도 승인해야 하며, 승인 전에는
              go-live가 차단됩니다.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
