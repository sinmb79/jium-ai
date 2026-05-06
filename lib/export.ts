import { CASE_TYPE_LABELS, DELETION_CHANCE_LABELS, RISK_LABELS, STATUS_LABELS } from "@/lib/labels";
import { formatEvidenceLedgerForDocument } from "@/lib/evidence";
import { RESOURCE_KIND_LABELS } from "@/lib/publicResources";
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
- 정확한 URL 로컬 보관: ${input.keepExactUrlsForSubmission ? "사용자 선택으로 보관" : "로컬 저장 시 경로 숨김"}

## 접근경로 증거목록

${formatEvidenceLedgerForDocument(input)}

## 요청서 초안

${draft.body}

## 토탈 대응 패키지

### 안전 추적 계획

${savedCase.responsePack.monitoringPlan.safeQueries.map((item) => `- 검색어: ${item}`).join("\n")}

${savedCase.responsePack.monitoringPlan.cadence.map((item) => `- ${item}`).join("\n")}

### 삭제 요청 순서

${savedCase.responsePack.takedownSequence.map((item, index) => `${index + 1}. ${item}`).join("\n")}

### 피해자 삭제지원 실행 계획

${savedCase.responsePack.victimDeletionPlan.summary}

첫 원칙: ${savedCase.responsePack.victimDeletionPlan.firstPrinciple}

직접 요청 가능 여부: ${savedCase.responsePack.victimDeletionPlan.directRequestAllowed ? "직접 요청 가능" : "전문기관 우선"}

${savedCase.responsePack.victimDeletionPlan.urgentWarning ? `긴급 안내: ${savedCase.responsePack.victimDeletionPlan.urgentWarning}\n` : ""}

${savedCase.responsePack.victimDeletionPlan.steps
  .map(
    (step, index) => `${index + 1}. ${step.title}
   - 주체: ${step.actor}
   - 시점: ${step.timing}
   - 사용자 행동: ${step.userAction.join(" / ")}
   - 준비물: ${step.requiredMaterials.join(", ")}
   - 확인 신호: ${step.successSignal}
   - 다음 상태: ${STATUS_LABELS[step.nextStatus]}`,
  )
  .join("\n\n")}

격상 신호:
${savedCase.responsePack.victimDeletionPlan.escalationTriggers.map((item) => `- ${item}`).join("\n")}

기록 원칙:
${savedCase.responsePack.victimDeletionPlan.recordKeeping.map((item) => `- ${item}`).join("\n")}

경계:
${savedCase.responsePack.victimDeletionPlan.boundaries.map((item) => `- ${item}`).join("\n")}

삭제지원 요청용 접근경로 요약:
${savedCase.responsePack.victimDeletionPlan.copyableNotice.body}

### 안전한 개입 선택지

${savedCase.responsePack.interventionChoices
  .map(
    (choice, index) => `${index + 1}. ${choice.title}
   - 구분: ${choice.category}
   - 위험 수준: ${choice.riskLevel}
   - 사용 시점: ${choice.whenToUse}
   - 지움AI가 돕는 일: ${choice.howJiumHelps.join(" / ")}
   - 사용자 행동: ${choice.userAction.join(" / ")}
   - 법적 주의: ${choice.legalRiskNotice}
   - 연결 경로: ${choice.relatedResources.join(", ")}`,
  )
  .join("\n\n")}

### 유출자 특정 단서 정리

${savedCase.responsePack.attributionGuidance.whatYouCanRecord.map((item) => `- ${item}`).join("\n")}

주의: 지움AI는 유출자를 특정하지 않습니다. 신원 확인은 수사기관 또는 법원의 절차가 필요합니다.

### 범죄유형별 피해 확산 방지 매트릭스

${savedCase.responsePack.preventionGuidance.summary}

### 주요 사례에서 배운 대응 원칙

${savedCase.responsePack.preventionGuidance.caseStudyLessons
  .map(
    (lesson, index) => `${index + 1}. ${lesson.title}
   - 위험 신호: ${lesson.riskPattern}
   - 왜 중요한가: ${lesson.whyItMatters}
   - 처리 원칙: ${lesson.responsePrinciples.join(" / ")}
   - 피해자 구제: ${lesson.rescueActions.join(" / ")}
   - 재발 방지: ${lesson.preventionActions.join(" / ")}
   - 하지 말아야 할 일: ${lesson.doNotDo.join(" / ")}
   - 기준: ${lesson.sourceNote}`,
  )
  .join("\n\n")}

${savedCase.responsePack.preventionGuidance.patterns
  .map(
    (pattern, index) => `${index + 1}. ${pattern.crimeType}
   - 필요한 조치: ${pattern.requiredMeasures.join(" / ")}
   - 대응 순서: ${pattern.responseSteps.join(" / ")}
   - 보관할 최소 단서: ${pattern.evidenceToKeep.join(", ")}
   - 도와주는 사람이 할 일: ${pattern.helperActions.join(" / ")}
   - 우선 연결: ${pattern.primaryRoutes.join(", ")}
   - 하지 말아야 할 일: ${pattern.doNotDo.join(", ")}`,
  )
  .join("\n\n")}

피해자를 도울 때:
${savedCase.responsePack.preventionGuidance.survivorSupportProtocol.map((item) => `- ${item}`).join("\n")}

추가 피해자를 막기 위해:
${savedCase.responsePack.preventionGuidance.communityPrevention.map((item) => `- ${item}`).join("\n")}

### 경찰 신고 준비서

${savedCase.responsePack.legalSupport.policeReport.body}

### 형사 고소 상담 준비자료

${savedCase.responsePack.legalSupport.criminalComplaintPrep.body}

### 법률·형사 지원 서비스 연계

${savedCase.responsePack.serviceIntegrations
  .map(
    (service, index) => `${index + 1}. ${service.name}
   - 구분: ${RESOURCE_KIND_LABELS[service.kind]}
   - 비용: ${service.cost}
   - 링크: ${service.url}
   - 사용 시점: ${service.useWhen}
   - 연계 방식: ${service.handoffMode}
   - 준비물: ${service.prepItems.join(", ")}
   - 주의: ${service.privacyNote}`,
  )
  .join("\n\n")}

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
