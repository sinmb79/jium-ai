import { ClipboardList, Link } from "lucide-react";
import { countEvidenceUrls, EVIDENCE_CAPTURE_METHOD_LABELS, EVIDENCE_STATUS_LABELS, getEvidenceLedger } from "@/lib/evidence";
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
                  <dt>기록 일시</dt>
                  <dd>{item.capturedAt || "미입력"}</dd>
                </div>
                <div>
                  <dt>기록 방식</dt>
                  <dd>{EVIDENCE_CAPTURE_METHOD_LABELS[item.captureMethod || "UNKNOWN"]}</dd>
                </div>
                <div>
                  <dt>증거 해시</dt>
                  <dd>{item.evidenceHash || "미입력"}</dd>
                </div>
                <div>
                  <dt>메타 지문</dt>
                  <dd>{item.metadataFingerprint || "생성 전"}</dd>
                </div>
                <div>
                  <dt>제출 대상</dt>
                  <dd>{item.submissionTarget || "전문기관 상담 후 결정"}</dd>
                </div>
              </dl>
              {item.requestLogs?.length ? (
                <ul className="action-list compact-list" aria-label="요청 이력">
                  {item.requestLogs.map((log) => (
                    <li key={log.id}>
                      {log.target || "대상 미입력"} · {log.receiptId || "접수번호 없음"} · {log.requestedAt || "시각 미입력"}
                    </li>
                  ))}
                </ul>
              ) : null}
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
