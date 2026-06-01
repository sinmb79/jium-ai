"use client";

import { AlertTriangle, RotateCcw, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import {
  deviceSafetyChecks,
  deviceSafetyStatusLabel,
  deviceSafetyWarningText,
  evaluateDeviceSafety,
  type DeviceSafetyCheckId,
} from "@/lib/deviceSafety";

type DeviceSafetyPanelProps = {
  compact?: boolean;
};

export function DeviceSafetyPanel({ compact = false }: DeviceSafetyPanelProps) {
  const [checkedIds, setCheckedIds] = useState<Set<DeviceSafetyCheckId>>(new Set());
  const readiness = useMemo(() => evaluateDeviceSafety(checkedIds), [checkedIds]);

  function toggle(id: DeviceSafetyCheckId, checked: boolean) {
    setCheckedIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  function checkAll() {
    setCheckedIds(new Set(deviceSafetyChecks.map((item) => item.id)));
  }

  const badgeClass = readiness.status === "READY" ? "badge badge-green" : readiness.status === "REVIEW" ? "badge badge-medium" : "badge badge-high";

  return (
    <section className="panel panel-tight device-safety-panel" aria-labelledby="device-safety-title">
      <div className="panel-header">
        <div>
          <span className="eyebrow">
            <ShieldCheck size={15} aria-hidden="true" /> 시작 전 안전점검
          </span>
          <h2 id="device-safety-title">기기·브라우저 안전 확인</h2>
          <p>{deviceSafetyWarningText()}</p>
        </div>
        <span className={badgeClass}>{deviceSafetyStatusLabel(readiness.status)}</span>
      </div>

      <div className="vault-session-box" role="status">
        <AlertTriangle size={17} aria-hidden="true" />
        <div>
          <strong>
            필수 {readiness.checkedRequired}/{readiness.requiredTotal} · 권장 {readiness.checkedRecommended}/{readiness.recommendedTotal}
          </strong>
          <span>{readiness.nextActions[0]}</span>
        </div>
      </div>

      <div className={compact ? "device-safety-checks compact-list" : "device-safety-checks"}>
        {deviceSafetyChecks.map((item) => (
          <label className="device-safety-check" key={item.id}>
            <input type="checkbox" checked={checkedIds.has(item.id)} onChange={(event) => toggle(item.id, event.target.checked)} />
            <span>
              <strong>
                {item.label}
                <small>{item.required ? "필수" : "권장"}</small>
              </strong>
              {!compact ? <em>{item.detail}</em> : null}
            </span>
          </label>
        ))}
      </div>

      <div className="button-row">
        <button className="btn btn-secondary" type="button" onClick={checkAll}>
          <ShieldCheck size={16} aria-hidden="true" />
          모두 확인
        </button>
        <button className="btn btn-ghost" type="button" onClick={() => setCheckedIds(new Set())}>
          <RotateCcw size={16} aria-hidden="true" />
          초기화
        </button>
      </div>
    </section>
  );
}
