import type { ServiceIntegration } from "@/lib/types";
import type { SubmissionPacket } from "@/lib/submissionPacket";

export type SubmissionConnectorAction = {
  id: string;
  title: string;
  url: string;
  mode: "USER_CONFIRMED_EXTERNAL_FORM" | "PHONE_OR_COUNSELING" | "LEGAL_REVIEW_FIRST";
  targetName: string;
  prepItems: string[];
  handoffSummary: string;
  authorityBoundary: string;
};

function modeForService(service: ServiceIntegration): SubmissionConnectorAction["mode"] {
  if (service.kind === "PRIVATE_LEGAL" || service.cost === "유료 가능") {
    return "LEGAL_REVIEW_FIRST";
  }
  if (service.phone && service.handoffMode.includes("상담")) {
    return "PHONE_OR_COUNSELING";
  }
  return "USER_CONFIRMED_EXTERNAL_FORM";
}

export function buildSubmissionConnectorActions(packet: SubmissionPacket): SubmissionConnectorAction[] {
  return packet.agencyTargets.map((service) => ({
    id: `connector-${service.id}`,
    title: `${service.name} 제출 준비`,
    url: service.url,
    mode: modeForService(service),
    targetName: service.name,
    prepItems: service.prepItems,
    handoffSummary: `${service.useWhen} ${service.handoffMode}`,
    authorityBoundary:
      "지움AI는 자동 제출하지 않습니다. 사용자가 제출 전 패킷 내용을 확인하고, 플랫폼 로그·IP·가입자·결제 정보는 수사기관 또는 법원 절차로 요청해야 합니다.",
  }));
}

export function connectorActionsToMarkdown(actions: SubmissionConnectorAction[]) {
  if (!actions.length) {
    return "- 공식 제출 커넥터 후보가 없습니다.";
  }
  return actions
    .map(
      (action, index) => `${index + 1}. ${action.title}
   - 방식: ${action.mode}
   - 링크: ${action.url}
   - 준비물: ${action.prepItems.join(", ")}
   - 인계 요약: ${action.handoffSummary}
   - 경계: ${action.authorityBoundary}`,
    )
    .join("\n\n");
}
