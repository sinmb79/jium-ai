"use client";

import { AlertTriangle, Brain, CheckCircle2, Database, EyeOff, FileText, Lock, RefreshCw, ShieldCheck } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { classifyCase } from "@/lib/classifier";
import { upsertCase } from "@/lib/caseStorage";
import { CASE_TYPE_LABELS } from "@/lib/labels";
import { detectSensitiveInput, maskSensitiveText } from "@/lib/pii";
import { generateRequestDraft } from "@/lib/requestTemplates";
import type { CaseInput, SavedCase } from "@/lib/types";
import { DeletionChanceBadge, RiskBadge } from "@/components/RiskBadge";
import { SafetyNotice } from "@/components/SafetyNotice";
import { RequestDraft } from "@/components/RequestDraft";
import { ResourceRouter } from "@/components/ResourceRouter";
import { QuickExit } from "@/components/QuickExit";

const situationChoices = [
  {
    id: "personal",
    title: "개인정보가 노출됐어요",
    desc: "전화번호, 주소, 실명, 학교, 직장 정보",
    starter: "제 전화번호와 이름이 커뮤니티에 올라갔어요.",
  },
  {
    id: "old-post",
    title: "예전 게시물을 지우고 싶어요",
    desc: "어릴 때 쓴 글, 사진, 검색 노출",
    starter: "중학생 때 쓴 글이 검색 결과에 계속 나와요.",
  },
  {
    id: "search",
    title: "검색 결과에 계속 떠요",
    desc: "삭제된 글, 캐시, 스니펫 문제",
    starter: "원본 글은 지웠는데 검색 결과에 계속 보여요.",
  },
  {
    id: "urgent",
    title: "긴급한 유포/협박 피해예요",
    desc: "딥페이크, 불법촬영, 유포 협박",
    starter: "딥페이크 영상이 퍼졌고 유포 협박을 받고 있어요.",
  },
];

const exposedOptions = ["이름", "전화번호", "주소", "이메일", "얼굴 사진", "학교", "직장", "가족 정보", "계정 ID", "성적 이미지/영상 관련", "기타"];

const defaultInput: CaseInput = {
  situation: "",
  title: "",
  description: "",
  targetUrl: "",
  platform: "",
  keywords: "",
  exposedInfo: [],
  urgent: false,
  helperMode: "self",
};

export function JiumApp() {
  const [input, setInput] = useState<CaseInput>(defaultInput);
  const [savedCase, setSavedCase] = useState<SavedCase | null>(null);
  const [stored, setStored] = useState(false);
  const combinedText = [input.title, input.description, input.targetUrl, input.platform, input.keywords, input.exposedInfo.join(" ")].join("\n");
  const findings = useMemo(() => detectSensitiveInput(combinedText), [combinedText]);
  const classification = useMemo(() => (input.description ? classifyCase(input) : null), [input]);
  const draft = useMemo(() => (classification ? generateRequestDraft(input, classification) : null), [classification, input]);

  function chooseSituation(choice: (typeof situationChoices)[number]) {
    setInput((current) => ({
      ...current,
      situation: choice.title,
      title: current.title || choice.title,
      description: current.description || choice.starter,
      urgent: choice.id === "urgent" ? true : current.urgent,
    }));
  }

  function buildSavedCase(): SavedCase | null {
    if (!classification || !draft) {
      return null;
    }

    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + 90);
    return {
      id: savedCase?.id || `case-${now.getTime()}`,
      createdAt: savedCase?.createdAt || now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      storageMode: "LOCAL_FIRST",
      input,
      redactedPreview: maskSensitiveText(combinedText),
      classification,
      draft,
      status: "READY",
      notes: [],
    };
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = buildSavedCase();
    setSavedCase(next);
    setStored(false);
    setTimeout(() => document.getElementById("result")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  const isCritical = classification?.riskLevel === "CRITICAL";
  const hasBlockingFinding = findings.some((finding) => finding.severity === "block");

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="지움AI 홈">
          <span className="brand-mark">
            <ShieldCheck size={19} aria-hidden="true" />
          </span>
          <span>지움AI</span>
        </a>
        <nav className="topbar-actions" aria-label="주요 이동">
          <a className="btn btn-ghost" href="/dashboard">
            사건 보드
          </a>
          <a className="btn btn-ghost" href="/resources">
            공식기관
          </a>
          <a className="btn btn-ghost" href="/safety">
            긴급 안전
          </a>
          <QuickExit />
        </nav>
      </header>

      <section className="container hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <Lock size={15} aria-hidden="true" /> 무료·로컬 우선 권리구제 도우미
          </span>
          <h1>혼자 지우려 애쓰지 않게.</h1>
          <p className="lead">
            지움AI는 삭제를 대신하지 않습니다. 대신 개인정보 노출, 오래된 게시물, 검색 노출, 계정 유출, 유포 피해 상황에서 직접 요청할 문서와 공식 경로를 준비합니다.
          </p>
          <div className="hero-points" aria-label="핵심 원칙">
            <div className="hero-point">
              <CheckCircle2 size={18} aria-hidden="true" />
              <span>API 키 없이도 rule-based 모드로 핵심 진단이 작동합니다.</span>
            </div>
            <div className="hero-point">
              <EyeOff size={18} aria-hidden="true" />
              <span>비밀번호, 주민등록번호, 피해물 원본은 저장하거나 요구하지 않습니다.</span>
            </div>
            <div className="hero-point">
              <Database size={18} aria-hidden="true" />
              <span>사건 보드는 서버가 아니라 이 브라우저에만 저장됩니다.</span>
            </div>
            <div className="hero-point">
              <Brain size={18} aria-hidden="true" />
              <span>유료 AI API는 나중에 켤 수 있지만, 기본값은 안전한 무료 모드입니다.</span>
            </div>
          </div>
        </div>

        <form className="panel intake-panel" onSubmit={handleSubmit}>
          <div className="panel-header">
            <div>
              <h2>3분 진단</h2>
              <p>상황을 고르고 필요한 정보만 적으세요. URL은 자동으로 열지 않습니다.</p>
            </div>
          </div>
          <div className="form-body">
            <div className="choice-grid" role="list" aria-label="상황 선택">
              {situationChoices.map((choice) => (
                <button
                  className={`choice-card ${input.situation === choice.title ? "is-selected" : ""}`}
                  key={choice.id}
                  type="button"
                  onClick={() => chooseSituation(choice)}
                >
                  <span className="choice-title">{choice.title}</span>
                  <span className="choice-desc">{choice.desc}</span>
                </button>
              ))}
            </div>

            <SafetyNotice findings={findings} critical={isCritical} />

            <label className="field">
              <span className="label-row">
                제목 <span className="hint">필수</span>
              </span>
              <input className="input" value={input.title} onChange={(event) => setInput({ ...input, title: event.target.value })} placeholder="예: 커뮤니티 전화번호 노출" required />
            </label>

            <label className="field">
              <span className="label-row">
                피해 설명 <span className="hint">비밀번호·주민등록번호·피해물 원본 금지</span>
              </span>
              <textarea
                className="textarea"
                value={input.description}
                onChange={(event) => setInput({ ...input, description: event.target.value })}
                placeholder="무슨 일이 있었는지 짧게 적어주세요. 잘 모르겠으면 그대로 '잘 모르겠어요'라고 적어도 됩니다."
                required
              />
            </label>

            <div className="two-col">
              <label className="field">
                <span className="label-row">
                  URL <span className="hint">선택, 자동 접속 안 함</span>
                </span>
                <input className="input" value={input.targetUrl} onChange={(event) => setInput({ ...input, targetUrl: event.target.value })} placeholder="https://example.com/post/123" />
              </label>
              <label className="field">
                <span className="label-row">
                  플랫폼 <span className="hint">선택</span>
                </span>
                <input className="input" value={input.platform} onChange={(event) => setInput({ ...input, platform: event.target.value })} placeholder="커뮤니티, SNS, 검색엔진 등" />
              </label>
            </div>

            <label className="field">
              <span className="label-row">
                검색 키워드/단서 <span className="hint">선택</span>
              </span>
              <input className="input" value={input.keywords} onChange={(event) => setInput({ ...input, keywords: event.target.value })} placeholder="검색어, 닉네임, 게시자 ID 등" />
            </label>

            <fieldset className="field">
              <legend className="label-row">노출된 정보</legend>
              <div className="checkbox-grid">
                {exposedOptions.map((option) => (
                  <label className="check-pill" key={option}>
                    <input
                      type="checkbox"
                      checked={input.exposedInfo.includes(option)}
                      onChange={(event) => {
                        setInput((current) => ({
                          ...current,
                          exposedInfo: event.target.checked ? [...current.exposedInfo, option] : current.exposedInfo.filter((item) => item !== option),
                        }));
                      }}
                    />
                    {option}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="two-col">
              <label className="check-pill">
                <input type="checkbox" checked={input.urgent} onChange={(event) => setInput({ ...input, urgent: event.target.checked })} />
                지금 위험하거나 협박을 받고 있어요
              </label>
              <label className="field">
                <span className="hint">도움 방식</span>
                <select className="select" value={input.helperMode} onChange={(event) => setInput({ ...input, helperMode: event.target.value as CaseInput["helperMode"] })}>
                  <option value="self">본인이 직접</option>
                  <option value="guardian">보호자가 함께</option>
                  <option value="supporter">신뢰하는 사람이 도움</option>
                </select>
              </label>
            </div>

            {findings.length ? (
              <div className="panel panel-tight" style={{ boxShadow: "none" }}>
                <strong>AI 전송 전 마스킹 미리보기</strong>
                <p className="muted small">현재 MVP는 외부 AI로 보내지 않지만, 유료 API를 켤 때도 아래처럼 가린 텍스트만 전송합니다.</p>
                <div className="draft-box">{maskSensitiveText(combinedText)}</div>
              </div>
            ) : null}

            <div className="button-row">
              <button className="btn btn-primary" type="submit">
                <FileText size={17} aria-hidden="true" />
                결과와 요청서 만들기
              </button>
              <a className="btn btn-secondary" href="/safety">
                <AlertTriangle size={17} aria-hidden="true" />
                긴급 안전 안내
              </a>
            </div>
          </div>
        </form>
      </section>

      {savedCase ? (
        <section className="container result-section" id="result">
          <div className="panel panel-tight">
            <div className="badge-row">
              <RiskBadge risk={savedCase.classification.riskLevel} />
              <DeletionChanceBadge chance={savedCase.classification.deletionChance} />
              <span className="badge badge-green">{CASE_TYPE_LABELS[savedCase.classification.caseType]}</span>
              <span className="badge badge-low">AI_MODE=off</span>
            </div>
            <h2 style={{ marginTop: "1rem" }}>오늘 할 일부터 정리했습니다.</h2>
            <p className="muted">{savedCase.classification.reason}</p>
          </div>

          <div className="result-grid">
            <div className="card-stack">
              <div className="panel panel-tight">
                <span className="eyebrow">지금 바로 할 일</span>
                <ul className="action-list">
                  {savedCase.classification.immediateActions.map((item) => (
                    <li key={item}>
                      <CheckCircle2 size={16} aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <RequestDraft draft={savedCase.draft} savedCase={savedCase} />
            </div>

            <div className="card-stack">
              <div className="panel panel-tight">
                <span className="eyebrow">증거 정리</span>
                <ul className="action-list">
                  {savedCase.classification.evidenceChecklist.map((item) => (
                    <li key={item}>
                      <FileText size={16} aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
                <div style={{ marginTop: "1rem" }}>
                  <span className="eyebrow">재확인</span>
                  <ul className="action-list">
                    {savedCase.classification.followUpDays.map((day) => (
                      <li key={day}>
                        <RefreshCw size={16} aria-hidden="true" />
                        {day}일 후 같은 검색어와 URL로 재확인
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="panel panel-tight">
                <span className="eyebrow">로컬 보드</span>
                <p className="muted">저장하면 이 브라우저에만 남습니다. 공용 PC에서는 저장하지 않는 편이 안전합니다.</p>
                <div className="button-row">
                  <button
                    className="btn btn-primary"
                    type="button"
                    disabled={hasBlockingFinding}
                    onClick={() => {
                      upsertCase(savedCase);
                      setStored(true);
                    }}
                    title={hasBlockingFinding ? "차단 수준 민감정보를 먼저 가려야 합니다." : "현재 브라우저에만 저장합니다."}
                  >
                    <Database size={17} aria-hidden="true" />
                    {stored ? "저장됨" : "로컬 보드에 저장"}
                  </button>
                  <a className="btn btn-secondary" href="/dashboard">
                    사건 보드 보기
                  </a>
                </div>
                {hasBlockingFinding ? <p className="small muted">비밀번호, 주민등록번호, 카드번호, 피해물 원본 언급은 저장 전에 제거하세요.</p> : null}
              </div>
            </div>
          </div>

          <ResourceRouter caseType={savedCase.classification.caseType} />
        </section>
      ) : null}

      <footer className="footer">
        <div className="container">
          <p>22B Labs · 제4의 길 (The 4th Path). 지움AI는 무료 권리구제 준비 도구이며 법률 대리나 삭제 대행을 하지 않습니다.</p>
        </div>
      </footer>
    </main>
  );
}
