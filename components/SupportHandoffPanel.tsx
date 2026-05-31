"use client";

import { Download, KeyRound, UsersRound } from "lucide-react";
import { useState } from "react";
import { appendCaseAudit } from "@/lib/caseStorage";
import { downloadFile, downloadTextFile } from "@/lib/export";
import {
  buildSupportHandoffArchive,
  formatSupportHandoffInstruction,
  serializeSupportHandoffArchive,
  type SupportHandoffRole,
} from "@/lib/supportHandoff";
import type { SavedCase } from "@/lib/types";

const roleOptions: { value: SupportHandoffRole; label: string }[] = [
  { value: "COUNSELOR", label: "상담자" },
  { value: "SUPPORTER", label: "피해자 지원자" },
  { value: "INVESTIGATOR", label: "수사·심의 담당자" },
];

function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+/g, "-").slice(0, 64) || "case";
}

export function SupportHandoffPanel({ savedCase }: { savedCase: SavedCase }) {
  const [recipientRole, setRecipientRole] = useState<SupportHandoffRole>("COUNSELOR");
  const [validHours, setValidHours] = useState(72);
  const [accessCode, setAccessCode] = useState("");
  const [accessCodeHint, setAccessCodeHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const canExport = accessCode.trim().length >= 12 && !busy;

  async function exportHandoff() {
    if (!canExport) {
      setMessage("접근 코드는 12자 이상으로 입력해야 합니다.");
      return;
    }

    setBusy(true);
    try {
      const archive = await buildSupportHandoffArchive(savedCase, accessCode.trim(), {
        recipientRole,
        validHours,
        accessCodeHint: accessCodeHint.trim() || undefined,
      });
      const filenameBase = `jium-ai-support-handoff-${safeName(savedCase.id)}`;
      downloadFile(`${filenameBase}.jiumhandoff.json`, serializeSupportHandoffArchive(archive), "application/json;charset=utf-8");
      downloadTextFile(`${filenameBase}-instruction.md`, formatSupportHandoffInstruction(archive));
      appendCaseAudit(savedCase.id, "SUPPORT_HANDOFF_EXPORTED", "지원자·상담자용 암호화 읽기전용 전달 파일 생성");
      setMessage("암호화 전달 파일과 안내 메모를 저장했습니다. 파일과 접근 코드는 서로 다른 채널로 전달하세요.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "지원자 전달 파일을 만들지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="trace-section" aria-labelledby="support-handoff-title">
      <h3 id="support-handoff-title">
        <UsersRound size={17} aria-hidden="true" /> 지원자 읽기전용 전달
      </h3>
      <p className="muted small">
        상담자나 지원자가 사건을 검토해야 할 때, 읽기전용 패킷을 접근 코드로 암호화한 `.jiumhandoff.json` 파일로 전달합니다. 파일과 접근 코드는 서로 다른 채널로 공유해야 합니다.
      </p>

      <div className="two-col">
        <label className="field">
          <span className="label-row">
            수신 역할 <span className="hint">권한 범위 표시용</span>
          </span>
          <select className="select" value={recipientRole} onChange={(event) => setRecipientRole(event.target.value as SupportHandoffRole)}>
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label-row">
            유효 시간 <span className="hint">1~336시간</span>
          </span>
          <input className="input" min={1} max={336} type="number" value={validHours} onChange={(event) => setValidHours(Number(event.target.value) || 72)} />
        </label>
      </div>

      <label className="field">
        <span className="label-row">
          접근 코드 <span className="hint">12자 이상, 파일과 별도 전달</span>
        </span>
        <input
          className="input"
          type="password"
          autoComplete="new-password"
          value={accessCode}
          onChange={(event) => setAccessCode(event.target.value)}
          placeholder="상담자에게 별도 전달할 긴 문장"
        />
      </label>

      <label className="field">
        <span className="label-row">
          코드 힌트 <span className="hint">선택, 코드 자체 금지</span>
        </span>
        <input className="input" value={accessCodeHint} onChange={(event) => setAccessCodeHint(event.target.value)} placeholder="예: 전화로 공유한 문장" />
      </label>

      <div className="notice notice-safe">
        <KeyRound size={18} aria-hidden="true" />
        <div>
          <strong>전달 원칙</strong>
          피해물 원본, 신분증 원본, 비밀번호는 포함하지 않습니다. 만료 후에는 새 파일과 새 접근 코드를 만들어야 합니다.
        </div>
      </div>

      <div className="button-row">
        <button className="btn btn-secondary" type="button" disabled={!canExport} onClick={exportHandoff}>
          <Download size={16} aria-hidden="true" />
          전달 파일 저장
        </button>
      </div>
      {message ? <p className="small muted">{message}</p> : null}
    </section>
  );
}
