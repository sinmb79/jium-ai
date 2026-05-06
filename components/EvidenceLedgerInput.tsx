"use client";

import { Clock, Link, Plus, Trash2, UserRound } from "lucide-react";
import { createEvidenceItem, EVIDENCE_STATUS_LABELS, EVIDENCE_SUBMISSION_TARGETS } from "@/lib/evidence";
import type { EvidenceItem, EvidenceStatus } from "@/lib/types";

type EvidenceLedgerInputProps = {
  items: EvidenceItem[];
  keepExactUrlsForSubmission: boolean;
  onChange: (items: EvidenceItem[]) => void;
  onKeepExactUrlsChange: (value: boolean) => void;
};

export function EvidenceLedgerInput({ items, keepExactUrlsForSubmission, onChange, onKeepExactUrlsChange }: EvidenceLedgerInputProps) {
  function updateItem(id: string, patch: Partial<EvidenceItem>) {
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function addItem() {
    onChange([...items, createEvidenceItem()]);
  }

  function removeItem(id: string) {
    onChange(items.filter((item) => item.id !== id));
  }

  return (
    <section className="evidence-editor" aria-labelledby="evidence-editor-title">
      <div className="evidence-editor-header">
        <div>
          <span className="eyebrow">
            <Link size={15} aria-hidden="true" /> 접근경로
          </span>
          <h3 id="evidence-editor-title">기관 제출용 증거목록</h3>
          <p className="muted small">피해물 원본 대신 URL, 게시 위치, 게시자 단서, 발견 일시만 여러 건으로 정리합니다.</p>
        </div>
        <button className="btn btn-secondary" type="button" onClick={addItem}>
          <Plus size={17} aria-hidden="true" />
          항목 추가
        </button>
      </div>

      {items.length ? (
        <div className="evidence-list">
          {items.map((item, index) => (
            <article className="evidence-row" key={item.id}>
              <div className="evidence-row-title">
                <strong>접근경로 {index + 1}</strong>
                <button className="icon-button" type="button" onClick={() => removeItem(item.id)} aria-label={`접근경로 ${index + 1} 삭제`}>
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>

              <label className="field">
                <span className="label-row">
                  URL <span className="hint">자동 접속 안 함</span>
                </span>
                <input className="input" value={item.url} onChange={(event) => updateItem(item.id, { url: event.target.value })} placeholder="https://example.com/post/123" />
              </label>

              <div className="two-col">
                <label className="field">
                  <span className="label-row">플랫폼/사이트</span>
                  <input className="input" value={item.platform || ""} onChange={(event) => updateItem(item.id, { platform: event.target.value })} placeholder="SNS, 커뮤니티, 검색엔진 등" />
                </label>
                <label className="field">
                  <span className="label-row">게시 위치</span>
                  <input className="input" value={item.location || ""} onChange={(event) => updateItem(item.id, { location: event.target.value })} placeholder="게시판명, 방 이름, 검색결과 위치" />
                </label>
              </div>

              <div className="two-col">
                <label className="field">
                  <span className="label-row">
                    게시자 단서 <UserRound size={15} aria-hidden="true" />
                  </span>
                  <input className="input" value={item.posterId || ""} onChange={(event) => updateItem(item.id, { posterId: event.target.value })} placeholder="ID, 닉네임, 프로필 URL" />
                </label>
                <label className="field">
                  <span className="label-row">
                    발견 일시 <Clock size={15} aria-hidden="true" />
                  </span>
                  <input className="input" type="datetime-local" value={item.foundAt || ""} onChange={(event) => updateItem(item.id, { foundAt: event.target.value })} />
                </label>
              </div>

              <div className="two-col">
                <label className="field">
                  <span className="label-row">제출 대상</span>
                  <select className="select" value={item.submissionTarget || EVIDENCE_SUBMISSION_TARGETS[0]} onChange={(event) => updateItem(item.id, { submissionTarget: event.target.value })}>
                    {EVIDENCE_SUBMISSION_TARGETS.map((target) => (
                      <option key={target} value={target}>
                        {target}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="label-row">처리 상태</span>
                  <select className="select" value={item.status} onChange={(event) => updateItem(item.id, { status: event.target.value as EvidenceStatus })}>
                    {(Object.keys(EVIDENCE_STATUS_LABELS) as EvidenceStatus[]).map((status) => (
                      <option key={status} value={status}>
                        {EVIDENCE_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="field">
                <span className="label-row">메모</span>
                <textarea
                  className="textarea textarea-compact"
                  value={item.notes || ""}
                  onChange={(event) => updateItem(item.id, { notes: event.target.value })}
                  placeholder="접수번호, 삭제요청 이력, 재노출 여부 등"
                />
              </label>

              <label className="check-pill">
                <input type="checkbox" checked={item.capturedByUser} onChange={(event) => updateItem(item.id, { capturedByUser: event.target.checked })} />
                사용자가 직접 캡처를 보유하고 있음
              </label>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-inline">
          <p className="muted">추가한 접근경로가 없습니다. 위의 단일 URL 입력값은 결과 생성 시 기본 접근경로로 정리됩니다.</p>
        </div>
      )}

      <div className="evidence-retention">
        <label className="check-pill">
          <input type="checkbox" checked={keepExactUrlsForSubmission} onChange={(event) => onKeepExactUrlsChange(event.target.checked)} />
          이 개인 기기에 정확한 URL을 기관 제출용으로 보관
        </label>
        <p className="small muted">꺼두면 로컬 보드 저장 시 URL의 도메인만 남기고 경로는 숨깁니다. 제출 전 내보내기 파일에는 현재 입력한 정확한 URL이 포함됩니다.</p>
      </div>
    </section>
  );
}
