import { CaseBoard } from "@/components/CaseBoard";
import { HomeLink, QuickExit } from "@/components/QuickExit";

export default function DashboardPage() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-mark">지</span>
          <span>지움AI</span>
        </a>
        <div className="topbar-actions">
          <HomeLink />
          <QuickExit />
        </div>
      </header>
      <section className="container dashboard">
        <CaseBoard />
      </section>
    </main>
  );
}
