import { savedCaseToMarkdown } from "@/lib/export";
import { escapeHtml } from "@/lib/htmlEscape";
import type { SavedCase } from "@/lib/types";

export function buildReadOnlyPacketMarkdown(savedCase: SavedCase) {
  const audit = savedCase.auditLog?.length
    ? savedCase.auditLog.map((entry) => `- ${entry.at} · ${entry.action} · ${entry.summary}`).join("\n")
    : "- 감사로그 없음";

  return `${savedCaseToMarkdown(savedCase)}

## 담당자용 감사로그

${audit}

## 읽기전용 안내

- 이 패킷은 사건 담당자 검토용입니다.
- 수정 기능, 자동 제출, 외부 사이트 자동 접속 기능이 없습니다.
- 원문 피해물 파일은 포함하지 않습니다.
`;
}

export function buildReadOnlyPacketHtml(savedCase: SavedCase) {
  const markdown = buildReadOnlyPacketMarkdown(savedCase);
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>지움AI 읽기전용 패킷</title>
  <style>
    body { margin: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #fbfaf6; color: #17211d; }
    main { max-width: 960px; margin: 0 auto; padding: 32px 20px 56px; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; border: 1px solid #ddd8cc; border-radius: 8px; background: #fff; padding: 20px; line-height: 1.6; }
    .banner { border: 1px solid #b9ded4; border-radius: 8px; background: #eef9f6; padding: 14px 16px; margin-bottom: 16px; font-weight: 700; }
  </style>
</head>
<body>
  <main>
    <div class="banner">지움AI 읽기전용 담당자 패킷 · 원문 피해물 파일 없음 · 자동 제출 없음</div>
    <pre>${escapeHtml(markdown)}</pre>
  </main>
</body>
</html>`;
}

export function openReadOnlyPacket(savedCase: SavedCase) {
  if (typeof window === "undefined") {
    return;
  }
  const blob = new Blob([buildReadOnlyPacketHtml(savedCase)], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
