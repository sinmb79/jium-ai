import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { DELETION_CHANCE_LABELS, RISK_LABELS } from "@/lib/labels";
import type { DeletionChance, RiskLevel } from "@/lib/types";

export function RiskBadge({ risk }: { risk: RiskLevel }) {
  const className = risk === "CRITICAL" ? "badge badge-critical" : risk === "HIGH" ? "badge badge-high" : risk === "MEDIUM" ? "badge badge-medium" : "badge badge-low";
  const Icon = risk === "CRITICAL" || risk === "HIGH" ? ShieldAlert : CheckCircle2;
  return (
    <span className={className}>
      <Icon size={15} aria-hidden="true" />
      위험도 {RISK_LABELS[risk]}
    </span>
  );
}

export function DeletionChanceBadge({ chance }: { chance: DeletionChance }) {
  const className = chance === "SPECIALIST_REQUIRED" || chance === "LEGAL_REVIEW_REQUIRED" ? "badge badge-high" : chance === "HIGH" ? "badge badge-green" : "badge badge-medium";
  return (
    <span className={className}>
      <AlertTriangle size={15} aria-hidden="true" />
      {DELETION_CHANCE_LABELS[chance]}
    </span>
  );
}
