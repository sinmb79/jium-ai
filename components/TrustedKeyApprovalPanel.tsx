"use client";

import { Download, KeyRound, RefreshCw, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import type { TrustedAuthorizedFeedKey } from "@/lib/authorizedFeedSignature";
import { TRUSTED_AUTHORIZED_FEED_KEYS } from "@/lib/authorizedFeedTrustedKeys";
import {
  buildTrustedKeyRegistryPatch,
  reviewTrustedAuthorizedFeedKeyCandidate,
  type TrustedKeyApprovalReview,
} from "@/lib/trustedKeyApproval";
import {
  buildTrustedKeyRetirementPatch,
  parseTrustedKeyRegistryText,
  reviewTrustedKeyLifecycle,
  type TrustedKeyLifecycleReview,
} from "@/lib/trustedKeyLifecycle";
import { downloadTextFile } from "@/lib/export";

type TrustedKeyApprovalPanelProps = {
  trustedFeedKeys?: TrustedAuthorizedFeedKey[];
};

const sample = {
  keyId: "partner-key-2026-06",
  issuerName: "승인 기관명",
  algorithm: "RSASSA-PKCS1-v1_5",
  publicKeyJwk: {
    kty: "RSA",
    n: "...",
    e: "AQAB",
    use: "sig",
  },
  validFrom: "2026-06-01T00:00:00.000Z",
  validUntil: "2027-06-01T00:00:00.000Z",
};

function statusLabel(status: TrustedKeyApprovalReview["status"]) {
  if (status === "READY_FOR_APPROVAL") {
    return "승인 검토 가능";
  }
  if (status === "NEEDS_REVIEW") {
    return "보강 후 검토";
  }
  return "등록 차단";
}

function lifecycleLabel(status: string) {
  const labels: Record<string, string> = {
    ACTIVE: "활성",
    EXPIRING_SOON: "곧 만료",
    NO_EXPIRY: "만료일 없음",
    NOT_YET_ACTIVE: "활성 전",
    EXPIRED: "만료",
  };
  return labels[status] || status;
}

export function TrustedKeyApprovalPanel({ trustedFeedKeys = TRUSTED_AUTHORIZED_FEED_KEYS }: TrustedKeyApprovalPanelProps = {}) {
  const [candidateText, setCandidateText] = useState("");
  const [review, setReview] = useState<TrustedKeyApprovalReview | null>(null);
  const [registryPatch, setRegistryPatch] = useState("");
  const [registryText, setRegistryText] = useState("");
  const [lifecycle, setLifecycle] = useState<TrustedKeyLifecycleReview | null>(null);
  const [retireKeyId, setRetireKeyId] = useState("");
  const [retireAt, setRetireAt] = useState(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
  const [retirePatch, setRetirePatch] = useState("");
  const [message, setMessage] = useState("");
  const lifecycleKeys = useMemo(() => {
    if (!registryText.trim()) {
      return trustedFeedKeys;
    }
    try {
      return parseTrustedKeyRegistryText(registryText);
    } catch {
      return trustedFeedKeys;
    }
  }, [registryText, trustedFeedKeys]);

  async function reviewCandidate() {
    try {
      const parsed = JSON.parse(candidateText) as unknown;
      const nextReview = await reviewTrustedAuthorizedFeedKeyCandidate(parsed, trustedFeedKeys);
      setReview(nextReview);
      if (nextReview.status === "BLOCKED") {
        setRegistryPatch("");
        setMessage("후보 공개키가 운영 registry에 들어갈 수 없습니다.");
        return;
      }
      setRegistryPatch(buildTrustedKeyRegistryPatch(parsed as TrustedAuthorizedFeedKey, trustedFeedKeys));
      setMessage("공개키 후보 검토가 끝났습니다. fingerprint와 checklist를 별도 승인 기록에 남기세요.");
    } catch (error) {
      setReview(null);
      setRegistryPatch("");
      setMessage(error instanceof Error ? error.message : "공개키 후보를 검토하지 못했습니다.");
    }
  }

  async function reviewRegistryLifecycle() {
    try {
      const keys = registryText.trim() ? parseTrustedKeyRegistryText(registryText) : trustedFeedKeys;
      const nextLifecycle = await reviewTrustedKeyLifecycle(keys);
      setLifecycle(nextLifecycle);
      setRetirePatch("");
      setMessage(nextLifecycle.errors.length ? "공개키 수명주기에서 운영 차단 항목이 있습니다." : "공개키 수명주기 검토가 끝났습니다.");
    } catch (error) {
      setLifecycle(null);
      setRetirePatch("");
      setMessage(error instanceof Error ? error.message : "공개키 수명주기를 검토하지 못했습니다.");
    }
  }

  function createRetirementPatch() {
    try {
      const patch = buildTrustedKeyRetirementPatch(retireKeyId.trim(), lifecycleKeys, retireAt.trim());
      setRetirePatch(patch);
      setMessage("공개키 폐기 patch를 만들었습니다. 반영 전 활성 공개키가 남는지 readiness로 확인하세요.");
    } catch (error) {
      setRetirePatch("");
      setMessage(error instanceof Error ? error.message : "공개키 폐기 patch를 만들지 못했습니다.");
    }
  }

  return (
    <div className="panel panel-tight trusted-key-panel">
      <div className="trace-header">
        <span className="eyebrow">
          <KeyRound size={15} aria-hidden="true" /> 기관 공개키 승인
        </span>
        <span className={review?.status === "READY_FOR_APPROVAL" ? "badge badge-green" : "badge badge-medium"}>
          {review ? statusLabel(review.status) : `${trustedFeedKeys.length}개 등록`}
        </span>
      </div>
      <p className="small muted">운영 공개키 후보를 검토하고 registry 반영용 JSON을 만듭니다. 개인키는 입력하지 않습니다.</p>

      <div className="trusted-key-review">
        <label className="field">
          <span className="label-row">
            현재 registry JSON <span className="hint">선택 입력 · 비우면 번들 registry 사용</span>
          </span>
          <textarea
            className="textarea textarea-compact"
            value={registryText}
            onChange={(event) => {
              setRegistryText(event.target.value);
              setLifecycle(null);
              setRetirePatch("");
            }}
            placeholder='{"version":"jium-authorized-feed-trusted-keys-v1","keys":[]}'
          />
        </label>
        <div className="button-row">
          <button className="btn btn-secondary" type="button" onClick={() => void reviewRegistryLifecycle()}>
            <RefreshCw size={16} aria-hidden="true" />
            registry 수명주기 검토
          </button>
        </div>
        {lifecycle ? (
          <>
            <div className="submission-summary-grid">
              <div className="submission-summary-item">활성 {lifecycle.activeCount}개</div>
              <div className="submission-summary-item">곧 만료 {lifecycle.expiringSoonCount}개</div>
              <div className="submission-summary-item">만료 {lifecycle.expiredCount}개</div>
              <div className="submission-summary-item">만료일 없음 {lifecycle.noExpiryCount}개</div>
            </div>
            {lifecycle.errors.length ? (
              <ul className="action-list compact-list">
                {lifecycle.errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            ) : null}
            {lifecycle.warnings.length ? (
              <ul className="action-list compact-list">
                {lifecycle.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
            <ul className="action-list compact-list">
              {lifecycle.entries.map((entry) => (
                <li key={entry.keyId}>
                  {entry.keyId} · {entry.issuerName} · {lifecycleLabel(entry.status)}
                  {typeof entry.daysUntilExpiry === "number" ? ` · 만료 ${entry.daysUntilExpiry}일` : ""}
                </li>
              ))}
            </ul>
            <div className="two-col">
              <label className="field">
                <span className="label-row">폐기 keyId</span>
                <input className="input" value={retireKeyId} onChange={(event) => setRetireKeyId(event.target.value)} placeholder="partner-key-..." />
              </label>
              <label className="field">
                <span className="label-row">폐기 시각 ISO</span>
                <input
                  className="input"
                  value={retireAt}
                  onChange={(event) => setRetireAt(event.target.value)}
                  placeholder="2026-06-02T00:00:00.000Z"
                />
              </label>
            </div>
            <div className="button-row">
              <button className="btn btn-secondary" type="button" disabled={!retireKeyId.trim()} onClick={createRetirementPatch}>
                <RefreshCw size={16} aria-hidden="true" />
                폐기 patch 생성
              </button>
              <button
                className="btn btn-secondary"
                type="button"
                disabled={!retirePatch}
                onClick={() => downloadTextFile("trusted-authorized-feed-keys-retire.patch.json", retirePatch)}
              >
                <Download size={16} aria-hidden="true" />
                폐기 patch 저장
              </button>
            </div>
          </>
        ) : null}
      </div>

      <label className="field">
        <span className="label-row">
          공개키 후보 JSON <span className="hint">JWK public key only</span>
        </span>
        <textarea
          className="textarea textarea-compact"
          value={candidateText}
          onChange={(event) => setCandidateText(event.target.value)}
          placeholder={JSON.stringify(sample)}
        />
      </label>
      <div className="button-row">
        <button className="btn btn-secondary" type="button" disabled={!candidateText.trim()} onClick={reviewCandidate}>
          <ShieldCheck size={16} aria-hidden="true" />
          공개키 검토
        </button>
        <button
          className="btn btn-secondary"
          type="button"
          disabled={!registryPatch}
          onClick={() => downloadTextFile("trusted-authorized-feed-keys.patch.json", registryPatch)}
        >
          <Download size={16} aria-hidden="true" />
          registry patch
        </button>
      </div>

      {review ? (
        <div className="trusted-key-review">
          <div className="submission-summary-grid">
            <div className="submission-summary-item">기관 {review.issuerName || "미확인"}</div>
            <div className="submission-summary-item">keyId {review.keyId || "미확인"}</div>
            <div className="submission-summary-item">상태 {statusLabel(review.status)}</div>
            <div className="submission-summary-item">fingerprint {review.fingerprint || "산출 전"}</div>
          </div>
          {review.errors.length ? (
            <ul className="action-list compact-list">
              {review.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          ) : null}
          {review.warnings.length ? (
            <ul className="action-list compact-list">
              {review.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
          <ul className="action-list compact-list">
            {review.checklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {registryPatch ? (
        <label className="field">
          <span className="label-row">
            registry patch JSON <span className="hint">PR 또는 관리자 검토용</span>
          </span>
          <textarea className="textarea textarea-compact" value={registryPatch} readOnly />
        </label>
      ) : null}

      {message ? <p className="small muted">{message}</p> : null}
    </div>
  );
}
