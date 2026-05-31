"use client";

import { Database, Lock, ShieldCheck, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  buildAuthorizedFeedSummary,
  importAuthorizedFeedBundleForOperator,
  loadAuthorizedFeedIndicators,
  saveAuthorizedFeedIndicators,
  type AuthorizedFeedBundle,
  type AuthorizedFeedIndicator,
} from "@/lib/authorizedIntelligenceFeed";
import {
  authorizedFeedAccessBoundaryText,
  authorizedFeedSessionStatus,
  canUseAuthorizedFeedCapability,
  openAuthorizedFeedOperatorSession,
  type AuthorizedFeedOperatorSession,
} from "@/lib/authorizedFeedAccess";

function countEntries(values: Record<string, number>) {
  return Object.entries(values)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
}

export function AuthorizedFeedPanel() {
  const [indicators, setIndicators] = useState<AuthorizedFeedIndicator[]>([]);
  const [session, setSession] = useState<AuthorizedFeedOperatorSession | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [bundleText, setBundleText] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setIndicators(loadAuthorizedFeedIndicators());
  }, []);

  const summary = useMemo(() => buildAuthorizedFeedSummary(indicators), [indicators]);
  const canImport = canUseAuthorizedFeedCapability(session, "AUTHORIZED_FEED_IMPORT");

  function openSession() {
    try {
      setSession(openAuthorizedFeedOperatorSession(passphrase));
      setPassphrase("");
      setMessage("제한 피드 운영자 세션을 열었습니다. 원문 지표는 여전히 저장할 수 없습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "운영자 세션을 열지 못했습니다.");
    }
  }

  function lockSession() {
    setSession(null);
    setPassphrase("");
    setMessage("제한 피드 운영자 세션을 잠갔습니다.");
  }

  function importBundle() {
    try {
      const parsed = JSON.parse(bundleText) as AuthorizedFeedBundle;
      const next = importAuthorizedFeedBundleForOperator(parsed, session, indicators);
      const saved = saveAuthorizedFeedIndicators(next);
      setIndicators(saved);
      setBundleText("");
      setMessage(`승인 피드 ${saved.length}건을 제한 저장소에 반영했습니다. 화면에는 집계만 표시합니다.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "승인 피드를 가져오지 못했습니다.");
    }
  }

  function purgeExpired() {
    try {
      const saved = saveAuthorizedFeedIndicators(indicators);
      setIndicators(saved);
      setMessage(`만료된 제한 지표를 정리했습니다. 현재 ${saved.length}건이 남아 있습니다.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "만료 지표를 정리하지 못했습니다.");
    }
  }

  return (
    <div className="panel panel-tight authorized-feed-panel">
      <div className="trace-header">
        <span className="eyebrow">
          <Database size={15} aria-hidden="true" /> 제한 지능 피드
        </span>
        <span className={canImport ? "badge badge-green" : "badge badge-low"}>{authorizedFeedSessionStatus(session)}</span>
      </div>
      <p className="small muted">{authorizedFeedAccessBoundaryText()}</p>

      <div className="submission-summary-grid">
        <div className="submission-summary-item">제한 지표 {summary.total}건</div>
        <div className="submission-summary-item">30일 내 만료 {summary.expiringWithin30Days}건</div>
        <div className="submission-summary-item">출처 유형 {Object.keys(summary.bySourceType).length}종</div>
        <div className="submission-summary-item">권한 수준 {Object.keys(summary.byAccessLevel).length}종</div>
      </div>

      {summary.total ? (
        <div className="authorized-feed-summary">
          <div>
            <strong>경로 패턴 집계</strong>
            <ul className="action-list compact-list">
              {countEntries(summary.byRoutePattern).map(([id, count]) => (
                <li key={id}>
                  {id}: {count}건
                </li>
              ))}
            </ul>
          </div>
          <div>
            <strong>홍보면 패턴 집계</strong>
            <ul className="action-list compact-list">
              {countEntries(summary.byPromotionSurface).map(([id, count]) => (
                <li key={id}>
                  {id}: {count}건
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <div className="authorized-feed-gate">
        <label className="field">
          <span className="label-row">
            운영자 확인 문장 <span className="hint">16자 이상</span>
          </span>
          <input
            className="input"
            type="password"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
            placeholder="승인 피드 담당자 확인용 긴 문장"
            autoComplete="off"
          />
        </label>
        <div className="button-row">
          <button className="btn btn-secondary" type="button" onClick={openSession}>
            <ShieldCheck size={16} aria-hidden="true" />
            운영자 세션 열기
          </button>
          <button className="btn btn-ghost" type="button" onClick={lockSession}>
            <Lock size={16} aria-hidden="true" />
            세션 잠금
          </button>
        </div>
      </div>

      <label className="field">
        <span className="label-row">
          승인 피드 JSON <span className="hint">원문 URL·초대링크 저장 금지</span>
        </span>
        <textarea
          className="textarea textarea-compact"
          value={bundleText}
          onChange={(event) => setBundleText(event.target.value)}
          placeholder='{"version":"jium-authorized-feed-v1","sourceName":"...","indicators":[]}'
        />
      </label>

      <div className="button-row">
        <button className="btn btn-primary" type="button" disabled={!canImport || !bundleText.trim()} onClick={importBundle}>
          <Upload size={16} aria-hidden="true" />
          제한 피드 가져오기
        </button>
        <button className="btn btn-secondary" type="button" disabled={!canImport} onClick={purgeExpired}>
          만료 지표 정리
        </button>
      </div>

      {message ? <p className="small muted">{message}</p> : null}
    </div>
  );
}
