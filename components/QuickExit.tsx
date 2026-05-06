"use client";

import { Home, ShieldOff } from "lucide-react";

export function QuickExit() {
  return (
    <button
      className="btn btn-danger"
      type="button"
      onClick={() => {
        window.location.replace("https://www.google.com/search?q=weather");
      }}
      title="현재 화면을 날씨 검색 화면으로 빠르게 바꿉니다."
    >
      <ShieldOff size={17} aria-hidden="true" />
      빠른 나가기
    </button>
  );
}

export function HomeLink() {
  return (
    <a className="btn btn-secondary" href="/" title="지움AI 첫 화면으로 이동">
      <Home size={17} aria-hidden="true" />
      처음으로
    </a>
  );
}
