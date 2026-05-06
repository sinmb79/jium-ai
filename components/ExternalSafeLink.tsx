"use client";

import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";

type ExternalSafeLinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
  confirmMessage?: string;
  ariaLabel?: string;
  showIcon?: boolean;
};

const DEFAULT_CONFIRM_MESSAGE = "외부 사이트로 이동합니다. 사건 내용과 피해 URL은 자동으로 전달되지 않습니다.";

export function ExternalSafeLink({ href, children, className = "btn btn-secondary", confirmMessage = DEFAULT_CONFIRM_MESSAGE, ariaLabel, showIcon = true }: ExternalSafeLinkProps) {
  return (
    <button
      aria-label={ariaLabel}
      className={className}
      type="button"
      onClick={() => {
        const ok = window.confirm(confirmMessage);
        if (ok) {
          window.open(href, "_blank", "noopener,noreferrer");
        }
      }}
    >
      {showIcon ? <ExternalLink size={16} aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
