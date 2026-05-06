"use client";

import { AlertTriangle, EyeOff, ShieldCheck } from "lucide-react";
import type { SensitiveFinding } from "@/lib/pii";

export function SafetyNotice({ findings, critical }: { findings: SensitiveFinding[]; critical?: boolean }) {
  if (critical) {
    return (
      <div className="notice notice-critical" role="alert">
        <AlertTriangle size={20} aria-hidden="true" />
        <div>
          <strong>긴급 사건은 전문기관 연결이 먼저입니다.</strong>
          피해 이미지나 영상 원본을 올리지 마세요. URL, 게시 위치, 게시자 ID, 발견 일시처럼 최소 정보만 정리하세요.
        </div>
      </div>
    );
  }

  if (findings.length) {
    return (
      <div className="notice" role="alert">
        <EyeOff size={20} aria-hidden="true" />
        <div>
          <strong>민감정보가 감지되었습니다.</strong>
          {findings.map((finding) => finding.label).join(", ")} 항목은 저장하거나 AI로 보내기 전에 가려야 합니다.
        </div>
      </div>
    );
  }

  return (
    <div className="notice notice-safe">
      <ShieldCheck size={20} aria-hidden="true" />
      <div>
        <strong>기본값은 로컬 처리입니다.</strong>
        로그인 없이 진단하고, 서버 저장 없이 요청서를 만들 수 있습니다. 링크 미리보기와 자동 접속은 사용하지 않습니다.
      </div>
    </div>
  );
}
