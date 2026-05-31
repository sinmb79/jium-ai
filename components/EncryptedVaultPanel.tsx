"use client";

import { Clock3, Download, Eye, HardDrive, Lock, ShieldCheck, Trash2, Unlock, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearEncryptedVaultAsync,
  getEncryptedVaultStorageStatus,
  loadEncryptedVault,
  upsertEncryptedCase,
  type EncryptedVaultStorageStatus,
} from "@/lib/encryptedCaseStorage";
import { downloadFile, downloadTextFile, savedCaseToMarkdown } from "@/lib/export";
import { openReadOnlyPacket } from "@/lib/readOnlyPacket";
import { compromisedDeviceRisks, deviceSafetyWarningText, safeDeviceChecklist } from "@/lib/deviceSafety";
import { buildJiumCaseArchive, importJiumCaseArchiveToVault, serializeJiumCaseArchive } from "@/lib/jiumCaseFile";
import { formatVaultRemainingTime, shouldAutoLockVault, vaultAutoLockPolicyText, vaultRemainingLockMs, type VaultSessionState } from "@/lib/vaultSessionSecurity";
import type { SavedCase } from "@/lib/types";

type EncryptedVaultPanelProps = {
  currentCase?: SavedCase;
};

export function EncryptedVaultPanel({ currentCase }: EncryptedVaultPanelProps) {
  const [passphrase, setPassphrase] = useState("");
  const [message, setMessage] = useState("");
  const [cases, setCases] = useState<SavedCase[]>([]);
  const [busy, setBusy] = useState(false);
  const [deviceChecked, setDeviceChecked] = useState(false);
  const [session, setSession] = useState<VaultSessionState>({});
  const [remainingMs, setRemainingMs] = useState(0);
  const [storageStatus, setStorageStatus] = useState<EncryptedVaultStorageStatus | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const vaultExists = storageStatus?.hasVault ?? false;
  const canUsePassphrase = passphrase.length >= 12;
  const isUnlocked = cases.length > 0 && Boolean(session.unlockedAt);

  const refreshStorageStatus = useCallback(async () => {
    setStorageStatus(await getEncryptedVaultStorageStatus());
  }, []);

  const markActivity = useCallback(() => {
    setSession((current) => (current.unlockedAt ? { ...current, lastActivityAt: Date.now() } : current));
  }, []);

  const lockVault = useCallback((reason = "암호화 보관함을 잠갔습니다. 복호화 목록과 패스프레이즈 입력값을 지웠습니다.") => {
    setCases([]);
    setPassphrase("");
    setSession({});
    setRemainingMs(0);
    setMessage(reason);
  }, []);

  useEffect(() => {
    void refreshStorageStatus();
  }, [refreshStorageStatus]);

  useEffect(() => {
    if (!session.unlockedAt) {
      return undefined;
    }

    const tick = () => {
      if (shouldAutoLockVault(session)) {
        lockVault("활동이 없어 암호화 보관함을 자동으로 잠갔습니다. 다시 열려면 패스프레이즈를 입력하세요.");
        return;
      }
      setRemainingMs(vaultRemainingLockMs(session));
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [lockVault, session]);

  useEffect(() => {
    if (!session.unlockedAt) {
      return undefined;
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        lockVault("탭이 숨겨져 암호화 보관함을 잠갔습니다. 공용 화면 노출을 줄이기 위한 보호 조치입니다.");
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [lockVault, session.unlockedAt]);

  function unlockSession(stateCases: SavedCase[], openedMessage: string) {
    const now = Date.now();
    setCases(stateCases);
    setSession({ unlockedAt: now, lastActivityAt: now });
    setRemainingMs(vaultRemainingLockMs({ unlockedAt: now, lastActivityAt: now }));
    setMessage(openedMessage);
    void refreshStorageStatus();
  }

  async function saveCurrentCase() {
    if (!deviceChecked) {
      setMessage("패스프레이즈를 입력하기 전에 이 기기의 확장프로그램·원격제어·악성코드 위험을 먼저 확인하세요.");
      return;
    }
    if (!currentCase || !canUsePassphrase) {
      setMessage("12자 이상의 패스프레이즈가 필요합니다.");
      return;
    }
    setBusy(true);
    try {
      const state = await upsertEncryptedCase(currentCase, passphrase);
      unlockSession(state.cases, "암호화 보관함에 저장하고 잠시 열었습니다. 패스프레이즈는 저장하지 않습니다.");
      await refreshStorageStatus();
    } catch {
      setMessage("암호화 저장에 실패했습니다. 패스프레이즈와 브라우저 보안 환경을 확인하세요.");
    } finally {
      setBusy(false);
    }
  }

  async function openVault() {
    if (!deviceChecked) {
      setMessage("복호화하면 평문 사건 정보가 화면에 나타납니다. 이 기기가 안전한지 먼저 확인하세요.");
      return;
    }
    if (!canUsePassphrase) {
      setMessage("12자 이상의 패스프레이즈가 필요합니다.");
      return;
    }
    setBusy(true);
    try {
      const state = await loadEncryptedVault(passphrase);
      if (state.cases.length) {
        unlockSession(state.cases, `암호화 보관함 ${state.cases.length}건을 열었습니다.`);
      } else {
        setCases([]);
        setSession({});
        setRemainingMs(0);
        setMessage("암호화 보관함이 비어 있습니다.");
      }
      await refreshStorageStatus();
    } catch {
      setCases([]);
      setSession({});
      setRemainingMs(0);
      setMessage("복호화에 실패했습니다. 패스프레이즈가 다르거나 저장본이 손상됐을 수 있습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function clearVault() {
    const ok = window.confirm("암호화 보관함 전체를 삭제합니다. 패스프레이즈가 있어도 복구할 수 없습니다.");
    if (!ok) {
      return;
    }
    setBusy(true);
    try {
      await clearEncryptedVaultAsync();
      lockVault("암호화 보관함을 삭제했습니다.");
      await refreshStorageStatus();
    } finally {
      setBusy(false);
    }
  }

  async function exportVaultFile() {
    if (!deviceChecked || !canUsePassphrase) {
      setMessage("안전 기기 확인과 12자 이상의 패스프레이즈가 필요합니다.");
      return;
    }
    setBusy(true);
    try {
      const state = await loadEncryptedVault(passphrase);
      if (!state.cases.length) {
        setMessage("내보낼 암호화 보관 사건이 없습니다.");
        return;
      }
      const archive = await buildJiumCaseArchive(state.cases, passphrase);
      const day = new Date().toISOString().slice(0, 10);
      downloadFile(`jium-ai-${day}.jiumcase`, serializeJiumCaseArchive(archive), "application/vnd.jium.case+json;charset=utf-8");
      markActivity();
      await refreshStorageStatus();
      setMessage("암호화 사건 파일(.jiumcase)을 내려받았습니다.");
    } catch {
      setMessage("암호화 사건 파일을 만들지 못했습니다. 패스프레이즈를 확인하세요.");
    } finally {
      setBusy(false);
    }
  }

  async function importVaultFile(file?: File) {
    if (!file) {
      return;
    }
    if (!deviceChecked || !canUsePassphrase) {
      setMessage("가져오기 전 안전 기기 확인과 12자 이상의 패스프레이즈가 필요합니다.");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }
    setBusy(true);
    try {
      const state = await importJiumCaseArchiveToVault(await file.text(), passphrase);
      unlockSession(state.cases, `암호화 사건 파일에서 ${state.cases.length}건을 보관함에 반영했습니다.`);
      await refreshStorageStatus();
    } catch {
      setMessage(".jiumcase 파일을 열지 못했습니다. 파일 형식과 패스프레이즈를 확인하세요.");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setBusy(false);
    }
  }

  return (
    <div className="panel panel-tight encrypted-vault-panel" onPointerDown={markActivity} onKeyDown={markActivity} onFocus={markActivity}>
      <div className="trace-header">
        <span className="eyebrow">
          <Lock size={15} aria-hidden="true" /> 암호화 보관함
        </span>
        <span className={vaultExists ? "badge badge-green" : "badge badge-low"}>{vaultExists ? "암호화 저장본 있음" : "암호화 저장본 없음"}</span>
      </div>
      <p className="small muted">
        Web Crypto API의 PBKDF2-SHA-256과 AES-GCM으로 이 브라우저 localStorage에 암호화 저장합니다. 패스프레이즈는 저장하지 않으므로 잊으면 복구할 수 없습니다.
      </p>
      <div className="vault-session-box" role="status">
        <Clock3 size={17} aria-hidden="true" />
        <div>
          <strong>{isUnlocked ? `열림 · 자동 잠금까지 ${formatVaultRemainingTime(remainingMs)}` : "잠김 · 복호화 목록 없음"}</strong>
          <span>{vaultAutoLockPolicyText()}</span>
        </div>
      </div>
      <div className="vault-session-box" role="status">
        <HardDrive size={17} aria-hidden="true" />
        <div>
          <strong>
            {storageStatus
              ? `${storageStatus.label}${storageStatus.providerName ? ` · ${storageStatus.providerName}` : ""}`
              : "보관 backend 확인 중"}
          </strong>
          <span>{storageStatus?.usesPlatformSecretStore ? "OS 보안 저장소 브리지 연결됨" : "브라우저 암호화 보관 모드"}</span>
          {storageStatus?.warnings.slice(0, 1).map((warning) => (
            <span key={warning}>{warning}</span>
          ))}
        </div>
      </div>
      <div className="device-safety-box" role="note">
        <strong>{deviceSafetyWarningText()}</strong>
        <div className="device-safety-grid">
          <div>
            <span className="hint">위험 신호</span>
            <ul className="action-list compact-list">
              {compromisedDeviceRisks.slice(0, 3).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <span className="hint">진행 전 확인</span>
            <ul className="action-list compact-list">
              {safeDeviceChecklist.slice(0, 3).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
        <label className="check-pill">
          <input type="checkbox" checked={deviceChecked} onChange={(event) => setDeviceChecked(event.target.checked)} />
          이 기기의 확장프로그램·원격제어·악성코드 위험을 확인했습니다
        </label>
      </div>
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
          <button className="btn btn-primary" type="button" disabled={busy || !deviceChecked} onClick={() => void saveCurrentCase()}>
            <ShieldCheck size={17} aria-hidden="true" />
            암호화 보관
          </button>
        ) : null}
        <button className="btn btn-secondary" type="button" disabled={busy || !deviceChecked} onClick={() => void openVault()}>
          <Unlock size={17} aria-hidden="true" />
          보관함 열기
        </button>
        {vaultExists ? (
          <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => void clearVault()}>
            <Trash2 size={17} aria-hidden="true" />
            암호화본 삭제
          </button>
        ) : null}
        {isUnlocked ? (
          <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => lockVault()}>
            <Lock size={17} aria-hidden="true" />
            지금 잠금
          </button>
        ) : null}
        <button className="btn btn-secondary" type="button" disabled={busy || !deviceChecked} onClick={() => void exportVaultFile()}>
          <Download size={17} aria-hidden="true" />
          .jiumcase 내보내기
        </button>
        <button className="btn btn-secondary" type="button" disabled={busy || !deviceChecked} onClick={() => fileInputRef.current?.click()}>
          <Upload size={17} aria-hidden="true" />
          .jiumcase 가져오기
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".jiumcase,application/json,application/vnd.jium.case+json"
          hidden
          onChange={(event) => void importVaultFile(event.target.files?.[0])}
        />
      </div>
      {message ? <p className="small muted">{message}</p> : null}
      {cases.length ? (
        <div className="encrypted-case-list">
          {cases.map((item) => (
            <article className="encrypted-case" key={item.id}>
              <strong>{item.input.title || "제목 없음"}</strong>
              <span>{new Date(item.updatedAt).toLocaleString("ko-KR")} · {item.classification.caseType}</span>
              <div className="button-row">
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => {
                    markActivity();
                    downloadTextFile(`jium-ai-encrypted-opened-${item.id}.md`, savedCaseToMarkdown(item));
                  }}
                >
                  <Download size={15} aria-hidden="true" />
                  복호화 내보내기
                </button>
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => {
                    markActivity();
                    openReadOnlyPacket(item);
                  }}
                >
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
