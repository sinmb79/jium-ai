"use client";

import { Clipboard, Download } from "lucide-react";
import { useState } from "react";
import type { RequestDraftOutput, SavedCase } from "@/lib/types";
import { downloadTextFile, savedCaseToMarkdown } from "@/lib/export";

export function RequestDraft({ draft, savedCase }: { draft: RequestDraftOutput; savedCase?: SavedCase }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="panel panel-tight card-stack">
      <div>
        <span className="eyebrow">복사 가능한 문서</span>
        <h2>{draft.title}</h2>
        <p className="muted">이 문서는 사용자가 직접 제출하기 위한 초안입니다. 삭제 결과를 보장하지 않습니다.</p>
      </div>
      <div className="draft-box" aria-label="요청서 초안">
        {draft.body}
      </div>
      <div className="button-row">
        <button
          className="btn btn-primary"
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(draft.body);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }}
        >
          <Clipboard size={17} aria-hidden="true" />
          {copied ? "복사됨" : "요청서 복사"}
        </button>
        {savedCase ? (
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => downloadTextFile(`jium-ai-${savedCase.id}.md`, savedCaseToMarkdown(savedCase))}
          >
            <Download size={17} aria-hidden="true" />
            저장 없이 내려받기
          </button>
        ) : null}
      </div>
    </div>
  );
}
