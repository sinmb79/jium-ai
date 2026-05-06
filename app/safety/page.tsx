import { AlertTriangle, CheckCircle2, Phone, ShieldAlert } from "lucide-react";
import { HomeLink, QuickExit } from "@/components/QuickExit";
import { appPath } from "@/lib/navigation";

export default function SafetyPage() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href={appPath("/")}>
          <span className="brand-mark">
            <ShieldAlert size={19} aria-hidden="true" />
          </span>
          <span>지움AI 긴급 안전</span>
        </a>
        <div className="topbar-actions">
          <HomeLink />
          <QuickExit />
        </div>
      </header>
      <section className="container dashboard card-stack">
        <div className="notice notice-critical">
          <AlertTriangle size={22} aria-hidden="true" />
          <div>
            <strong>피해 이미지나 영상 원본을 업로드하지 마세요.</strong>
            지움AI는 피해물을 보관하거나 분석하지 않습니다. URL, 게시 위치, 게시자 ID, 발견 일시처럼 최소 정보만 정리하세요.
          </div>
        </div>
        <div className="panel panel-tight">
          <span className="eyebrow">혼자 감당하지 않아도 됩니다</span>
          <h1 style={{ fontSize: "clamp(2.2rem, 5vw, 4rem)", maxWidth: "13ch" }}>위험한 사건은 전문기관 연결이 먼저입니다.</h1>
          <p className="lead">딥페이크, 불법촬영, 비동의 유포, 유포 협박, 스토킹, 아동 피해가 의심되면 앱 안에서 해결하려 하지 말고 공식 상담 경로를 먼저 사용하세요.</p>
        </div>
        <div className="result-grid">
          <div className="panel panel-tight">
            <h2>지금 정리할 정보</h2>
            <ul className="action-list">
              {["URL", "게시 위치", "게시자 ID 또는 닉네임", "발견 일시", "유포 협박 메시지 여부", "이미 신고한 기관"].map((item) => (
                <li key={item}>
                  <CheckCircle2 size={16} aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="panel panel-tight">
            <h2>먼저 연락할 곳</h2>
            <ul className="action-list">
              <li>
                <Phone size={16} aria-hidden="true" />
                여성긴급전화 1366
              </li>
              <li>
                <Phone size={16} aria-hidden="true" />
                중앙디지털성범죄피해자지원센터 02-735-8994
              </li>
              <li>
                <Phone size={16} aria-hidden="true" />
                긴급 신변 위협 112
              </li>
            </ul>
            <div className="button-row" style={{ marginTop: "1rem" }}>
              <a className="btn btn-primary" href="https://d4u.stop.or.kr/main" target="_blank" rel="noreferrer">
                센터 사이트 열기
              </a>
              <a className="btn btn-secondary" href={appPath("/")}>
                최소 정보만 정리하기
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
