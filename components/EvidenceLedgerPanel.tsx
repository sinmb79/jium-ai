import { ClipboardList, Link } from "lucide-react";
import { countEvidenceUrls, EVIDENCE_STATUS_LABELS, getEvidenceLedger } from "@/lib/evidence";
import type { CaseInput } from "@/lib/types";

export function EvidenceLedgerPanel({ input }: { input: CaseInput }) {
  const items = getEvidenceLedger(input);

  return (
    <div className="panel panel-tight evidence-panel">
      <div className="badge-row">
        <span className="eyebrow">
          <ClipboardList size={15} aria-hidden="true" /> 접근경로 증거목록
        </span>
        <span className="badge badge-low">URL {countEvidenceUrls(input)}건</span>
        <span className={input.keepExactUrlsForSubmission ? "badge badge-green" : "badge badge-medium"}>{input.keepExactUrlsForSubmission ? "정확 URL 보관" : "저장 시 경로 숨김"}</span>
      </div>

      {items.length ? (
        <div className="evidence-summary-list">
          {items.map((item, index) => (
            <article className="evidence-summary" key={item.id}>
              <div className="evidence-summary-title">
                <strong>접근경로 {index + 1}</strong>
                <span className="badge badge-green">{EVIDENCE_STATUS_LABELS[item.status]}</span>
              </div>
              <dl>
                <div>
                  <dt>URL</dt>
                  <dd>{item.url || "미입력"}</dd>
                </div>
                <div>
                  <dt>플랫폼</dt>
                  <dd>{item.platform || "미입력"}</dd>
                </div>
                <div>
                  <dt>게시 위치</dt>
                  <dd>{item.location || "미입력"}</dd>
                </div>
                <div>
                  <dt>게시자 단서</dt>
                  <dd>{item.posterId || "미입력"}</dd>
                </div>
                <div>
                  <dt>발견 일시</dt>
                  <dd>{item.foundAt || "미입력"}</dd>
                </div>
                <div>
                  <dt>제출 대상</dt>
                  <dd>{item.submissionTarget || "전문기관 상담 후 결정"}</dd>
                </div>
              </dl>
              {item.notes ? <p className="small muted">{item.notes}</p> : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="notice notice-safe">
          <Link size={18} aria-hidden="true" />
          <div>
            <strong>아직 접근경로가 없습니다.</strong>
            URL, 게시 위치, 게시자 단서, 발견 일시를 확인한 범위에서만 추가하세요.
          </div>
        </div>
      )}
    </div>
  );
}
