"use client";

import { Download, Eye, Lock, ShieldCheck, Trash2, Unlock } from "lucide-react";
import { useMemo, useState } from "react";
import { clearEncryptedVault, hasEncryptedVault, loadEncryptedVault, upsertEncryptedCase } from "@/lib/encryptedCaseStorage";
import { downloadTextFile, savedCaseToMarkdown } from "@/lib/export";
import { openReadOnlyPacket } from "@/lib/readOnlyPacket";
import type { SavedCase } from "@/lib/types";

type EncryptedVaultPanelProps = {
  currentCase?: SavedCase;
};

export function EncryptedVaultPanel({ currentCase }: EncryptedVaultPanelProps) {
  const [passphrase, setPassphrase] = useState("");
  const [message, setMessage] = useState("");
  const [cases, setCases] = useState<SavedCase[]>([]);
  const [busy, setBusy] = useState(false);
  const vaultExists = useMemo(() => hasEncryptedVault(), [message, cases.length]);
  const canUsePassphrase = passphrase.length >= 12;

  async function saveCurrentCase() {
    if (!currentCase || !canUsePassphrase) {
      setMessage("12자 이상의 패스프레이즈가 필요합니다.");
      return;
    }
    setBusy(true);
    try {
      const state = await upsertEncryptedCase(currentCase, passphrase);
      setCases(state.cases);
      setMessage("암호화 보관함에 저장했습니다. 패스프레이즈는 저장하지 않았습니다.");
    } catch {
      setMessage("암호화 저장에 실패했습니다. 패스프레이즈와 브라우저 보안 환경을 확인하세요.");
    } finally {
      setBusy(false);
    }
  }

  async function openVault() {
    if (!canUsePassphrase) {
      setMessage("12자 이상의 패스프레이즈가 필요합니다.");
      return;
    }
    setBusy(true);
    try {
      const state = await loadEncryptedVault(passphrase);
      setCases(state.cases);
      setMessage(state.cases.length ? `암호화 보관함 ${state.cases.length}건을 열었습니다.` : "암호화 보관함이 비어 있습니다.");
    } catch {
      setCases([]);
      setMessage("복호화에 실패했습니다. 패스프레이즈가 다르거나 저장본이 손상됐을 수 있습니다.");
    } finally {
      setBusy(false);
    }
  }

  function clearVault() {
    const ok = window.confirm("암호화 보관함 전체를 삭제합니다. 패스프레이즈가 있어도 복구할 수 없습니다.");
    if (!ok) {
      return;
    }
    clearEncryptedVault();
    setCases([]);
    setMessage("암호화 보관함을 삭제했습니다.");
  }

  return (
    <div className="panel panel-tight encrypted-vault-panel">
      <div className="trace-header">
        <span className="eyebrow">
          <Lock size={15} aria-hidden="true" /> 암호화 보관함
        </span>
        <span className={vaultExists ? "badge badge-green" : "badge badge-low"}>{vaultExists ? "암호화 저장본 있음" : "암호화 저장본 없음"}</span>
      </div>
      <p className="small muted">
        Web Crypto API의 PBKDF2-SHA-256과 AES-GCM으로 이 브라우저 localStorage에 암호화 저장합니다. 패스프레이즈는 저장하지 않으므로 잊으면 복구할 수 없습니다.
      </p>
      <label className="field">
        <span className="label-row">패스프레이즈 <span className="hint">12자 이상</span></span>
        <input
          className="input"
          type="password"
          value={passphrase}
          onChange={(event) => setPassphrase(event.target.value)}
          placeholder="기관 제출 전까지 기억할 긴 문장"
          autoComplete="off"
        />
      </label>
      <div className="button-row">
        {currentCase ? (
          <button className="btn btn-primary" type="button" disabled={busy} onClick={() => void saveCurrentCase()}>
            <ShieldCheck size={17} aria-hidden="true" />
            암호화 보관
          </button>
        ) : null}
        <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => void openVault()}>
          <Unlock size={17} aria-hidden="true" />
          보관함 열기
        </button>
        {vaultExists ? (
          <button className="btn btn-ghost" type="button" disabled={busy} onClick={clearVault}>
            <Trash2 size={17} aria-hidden="true" />
            암호화본 삭제
          </button>
        ) : null}
      </div>
      {message ? <p className="small muted">{message}</p> : null}
      {cases.length ? (
        <div className="encrypted-case-list">
          {cases.map((item) => (
            <article className="encrypted-case" key={item.id}>
              <strong>{item.input.title || "제목 없음"}</strong>
              <span>{new Date(item.updatedAt).toLocaleString("ko-KR")} · {item.classification.caseType}</span>
              <div className="button-row">
                <button className="btn btn-secondary" type="button" onClick={() => downloadTextFile(`jium-ai-encrypted-opened-${item.id}.md`, savedCaseToMarkdown(item))}>
                  <Download size={15} aria-hidden="true" />
                  복호화 내보내기
                </button>
                <button className="btn btn-secondary" type="button" onClick={() => openReadOnlyPacket(item)}>
                  <Eye size={15} aria-hidden="true" />
                  읽기전용 보기
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
