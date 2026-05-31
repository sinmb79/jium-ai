"use client";

import { Download, KeyRound, ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { TrustedAuthorizedFeedKey } from "@/lib/authorizedFeedSignature";
import { TRUSTED_AUTHORIZED_FEED_KEYS } from "@/lib/authorizedFeedTrustedKeys";
import {
  buildTrustedKeyRegistryPatch,
  reviewTrustedAuthorizedFeedKeyCandidate,
  type TrustedKeyApprovalReview,
} from "@/lib/trustedKeyApproval";
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

export function TrustedKeyApprovalPanel({ trustedFeedKeys = TRUSTED_AUTHORIZED_FEED_KEYS }: TrustedKeyApprovalPanelProps = {}) {
  const [candidateText, setCandidateText] = useState("");
  const [review, setReview] = useState<TrustedKeyApprovalReview | null>(null);
  const [registryPatch, setRegistryPatch] = useState("");
  const [message, setMessage] = useState("");

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
