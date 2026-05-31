import { agencyWorkflowPlanToMarkdown } from "@/lib/agencyWorkflowProfiles";
import { escapeHtml } from "@/lib/htmlEscape";
import { buildReadOnlyPacketHtml } from "@/lib/readOnlyPacket";
import { buildSubmissionPacket, submissionPacketWithEvidenceToMarkdown, type SubmissionPacket } from "@/lib/submissionPacket";
import { buildSubmissionPacketSnapshot } from "@/lib/submissionVersioning";
import { createStoredZip, type ZipTextFile } from "@/lib/zip";
import type { SavedCase } from "@/lib/types";

export const SUBMISSION_PACKAGE_VERSION = "1.0.0";

function filenameSafe(value: string) {
  return value.replace(/[^a-zA-Z0-9가-힣._-]+/g, "-").replace(/-+/g, "-").slice(0, 80) || "case";
}

export function buildEvidenceChainManifest(savedCase: SavedCase, packet: SubmissionPacket) {
  return {
    packageVersion: SUBMISSION_PACKAGE_VERSION,
    generatedAt: packet.generatedAt,
    caseId: savedCase.id,
    caseStatus: savedCase.status,
    storageMode: savedCase.storageMode,
    chain: packet.evidenceChain,
    evidenceSummaries: packet.evidenceSummaries,
    evidenceGaps: packet.evidenceGaps,
    safetyBoundaries: packet.safetyBoundaries,
    lawfulInvestigationMemo: packet.lawfulInvestigationMemo,
    agencyWorkflowPlan: packet.agencyWorkflowPlan,
    note: "피해물 원본 파일은 포함하지 않습니다. URL, 게시 위치, 발견·캡처 시각, 해시와 제출 이력 중심의 제출 패키지입니다.",
  };
}

export function buildSubmissionChecklist(savedCase: SavedCase, packet: SubmissionPacket) {
  const connectorTargets = packet.agencyTargets.map((target) => target.name);
  return `# 지움AI 제출 전 확인 체크리스트

사건 ID: ${savedCase.id}
체인 매니페스트: ${packet.evidenceChain.manifestFingerprint}

## 제출 전 확인

- [ ] 피해 이미지·영상 원본 파일이 ZIP에 포함되지 않았는지 확인
- [ ] URL, 게시 위치, 게시자 단서, 발견·캡처 시각이 정확한지 확인
- [ ] 증거 해시 또는 메타데이터 지문을 확인
- [ ] 접수번호·삭제요청 이력이 있으면 추가
- [ ] 폐쇄형 채널, IP, 가입자 정보, 결제 흐름은 직접 추적하지 않고 공식기관 요청사항으로 분리
- [ ] 공용 PC 또는 의심 기기에서 파일을 열지 않음

## 우선 제출 후보

${connectorTargets.length ? connectorTargets.map((target) => `- ${target}`).join("\n") : "- 사건 유형에 맞는 공식기관 후보를 확인하세요."}

## 보강 필요

${packet.evidenceChain.missingForOperationalUse.length ? packet.evidenceChain.missingForOperationalUse.map((item) => `- ${item}`).join("\n") : "- 운영 제출용 핵심 체인 필드가 입력되어 있습니다."}
`;
}

export function buildSupportHandoffGuide(savedCase: SavedCase) {
  return `# 지움AI 지원자·상담자 읽기전용 전달 안내

사건 ID: ${savedCase.id}

## 언제 사용하나요

- 피해자가 상담자, 가족, 법률지원자, 기관 담당자에게 사건 흐름을 읽기전용으로 보여줘야 할 때
- 원본 피해물이나 편집 가능한 사건 보관함을 공유하지 않고, 제출 전 검토만 받아야 할 때
- 같은 파일을 여러 사람에게 돌리는 대신 수신자별 만료 파일을 따로 만들고 싶을 때

## 만드는 방법

1. 지움AI 제출 패킷 화면에서 "지원자 읽기전용 전달"을 엽니다.
2. 수신 역할, 유효 시간, 12자 이상 접근 코드를 입력합니다.
3. "전달 파일 저장"을 눌러 암호화된 .jiumhandoff.json 파일과 안내 메모를 저장합니다.
4. 파일과 접근 코드는 서로 다른 채널로 전달합니다.

## 안전 경계

- 자동 제출, 자동 신고, 외부 사이트 자동 접속 기능이 아닙니다.
- 피해물 원본, 신분증 원본, 비밀번호를 넣지 않습니다.
- 폐쇄형 방 입장, 구매, 잠입, IP 역추적은 피해자·지원자 직접 수행 대상이 아닙니다.
- 만료 시각이 지나면 새 파일과 새 접근 코드를 만들어야 합니다.
`;
}

export function buildPrintableSubmissionHtml(savedCase: SavedCase, packet = buildSubmissionPacket(savedCase.input, savedCase.classification, savedCase.responsePack)) {
  const markdown = submissionPacketWithEvidenceToMarkdown(savedCase.input, packet);
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>지움AI 제출용 인쇄본</title>
  <style>
    @page { margin: 18mm; }
    body { margin: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #17211d; background: #fff; }
    main { max-width: 960px; margin: 0 auto; padding: 24px; }
    h1 { font-size: 26px; margin: 0 0 8px; }
    .meta { border: 1px solid #d7d2c6; border-radius: 8px; padding: 12px; margin: 16px 0; background: #fbfaf6; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; font: 13px/1.6 ui-monospace, SFMono-Regular, Consolas, monospace; }
    .warning { color: #6f2118; font-weight: 700; }
    @media print { main { padding: 0; } }
  </style>
</head>
<body>
  <main>
    <h1>지움AI 제출용 인쇄본</h1>
    <div class="meta">
      <div>사건 ID: ${escapeHtml(savedCase.id)}</div>
      <div>생성일: ${escapeHtml(new Date(packet.generatedAt).toLocaleString("ko-KR"))}</div>
      <div>체인 매니페스트: ${escapeHtml(packet.evidenceChain.manifestFingerprint)}</div>
      <div class="warning">피해물 원본 파일은 포함하지 않습니다.</div>
    </div>
    <pre>${escapeHtml(markdown)}</pre>
  </main>
</body>
</html>`;
}

export function buildSubmissionPackageFiles(savedCase: SavedCase): ZipTextFile[] {
  const packet = buildSubmissionPacket(savedCase.input, savedCase.classification, savedCase.responsePack);
  const markdown = submissionPacketWithEvidenceToMarkdown(savedCase.input, packet);
  const manifest = buildEvidenceChainManifest(savedCase, packet);
  const versionSnapshot = buildSubmissionPacketSnapshot(savedCase, packet);
  const prefix = filenameSafe(`${savedCase.id}-${packet.evidenceChain.manifestFingerprint}`);

  return [
    {
      name: "00-README.txt",
      content:
        "지움AI 기관 제출 패키지입니다.\n피해물 원본 파일은 포함하지 않습니다.\n제출 전 checklist.txt와 evidence-chain-manifest.json을 확인하세요.\n",
    },
    {
      name: `${prefix}/submission-packet.md`,
      content: markdown,
    },
    {
      name: `${prefix}/printable-submission.html`,
      content: buildPrintableSubmissionHtml(savedCase, packet),
    },
    {
      name: `${prefix}/officer-readonly.html`,
      content: buildReadOnlyPacketHtml(savedCase),
    },
    {
      name: `${prefix}/evidence-chain-manifest.json`,
      content: JSON.stringify(manifest, null, 2),
    },
    {
      name: `${prefix}/submission-version-snapshot.json`,
      content: JSON.stringify(versionSnapshot, null, 2),
    },
    {
      name: `${prefix}/agency-workflow-plan.json`,
      content: JSON.stringify(packet.agencyWorkflowPlan, null, 2),
    },
    {
      name: `${prefix}/agency-workflow-checklist.txt`,
      content: agencyWorkflowPlanToMarkdown(packet.agencyWorkflowPlan),
    },
    {
      name: `${prefix}/support-handoff-guide.txt`,
      content: buildSupportHandoffGuide(savedCase),
    },
    {
      name: `${prefix}/trace-diagram.mmd`,
      content: packet.traceMermaid,
    },
    {
      name: `${prefix}/checklist.txt`,
      content: buildSubmissionChecklist(savedCase, packet),
    },
  ];
}

export function buildSubmissionPackageZip(savedCase: SavedCase, date = new Date()) {
  return createStoredZip(buildSubmissionPackageFiles(savedCase), date);
}
