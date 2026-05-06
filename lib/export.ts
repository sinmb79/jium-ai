import { CASE_TYPE_LABELS, DELETION_CHANCE_LABELS, RISK_LABELS, STATUS_LABELS } from "@/lib/labels";
import type { SavedCase } from "@/lib/types";

export function savedCaseToMarkdown(savedCase: SavedCase) {
  const { input, classification, draft } = savedCase;
  return `# 지움AI 사건 정리

생성일: ${new Date(savedCase.createdAt).toLocaleString("ko-KR")}
상태: ${STATUS_LABELS[savedCase.status]}

## 진단

- 사건 유형: ${CASE_TYPE_LABELS[classification.caseType]}
- 위험도: ${RISK_LABELS[classification.riskLevel]}
- 삭제 가능성: ${DELETION_CHANCE_LABELS[classification.deletionChance]}
- 판단 이유: ${classification.reason}

## 지금 할 일

${classification.immediateActions.map((item, index) => `${index + 1}. ${item}`).join("\n")}

## 증거 정리 체크리스트

${classification.evidenceChecklist.map((item) => `- ${item}`).join("\n")}

## 입력 요약

- 제목: ${input.title}
- 플랫폼: ${input.platform || "미입력"}
- URL: ${input.targetUrl || "미입력"}
- 키워드: ${input.keywords || "미입력"}

## 요청서 초안

${draft.body}

---

지움AI는 법률 대리인이나 삭제 대행업체가 아닙니다. 실제 처리 결과는 플랫폼, 검색엔진, 기관, 법적 판단에 따라 달라질 수 있습니다.
`;
}

export function downloadTextFile(filename: string, content: string) {
  if (typeof window === "undefined") {
    return;
  }

  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
