import type { ReactElement } from "react";

export function BrandLockup({
  onClick,
}: {
  onClick: () => void;
}): ReactElement {
  return (
    <button
      className="group flex items-center gap-3.5 rounded-[1.05rem] border border-[var(--xidea-border)] bg-[linear-gradient(180deg,#fffdfa_0%,#f7f1e9_100%)] px-3.5 py-2.5 text-left transition-[border-color,background-color,box-shadow,transform] hover:border-[rgba(201,100,66,0.22)] hover:bg-[var(--xidea-white)] hover:shadow-[0_10px_28px_rgba(111,74,53,0.08)]"
      onClick={onClick}
      type="button"
    >
      <svg
        aria-hidden="true"
        className="h-[3.25rem] w-[3.25rem] shrink-0"
        viewBox="0 0 64 64"
      >
        <defs>
          <linearGradient id="xidea-brand-tile" x1="14%" x2="86%" y1="10%" y2="92%">
            <stop offset="0%" stopColor="#ffdcca" />
            <stop offset="42%" stopColor="#f6a57f" />
            <stop offset="100%" stopColor="#c96442" />
          </linearGradient>
          <radialGradient id="xidea-brand-sheen" cx="30%" cy="22%" r="70%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.42)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>
        <rect
          fill="url(#xidea-brand-tile)"
          height="56"
          rx="18"
          width="56"
          x="4"
          y="4"
        />
        <rect
          fill="url(#xidea-brand-sheen)"
          height="56"
          rx="18"
          width="56"
          x="4"
          y="4"
        />
        <rect
          fill="none"
          height="54"
          rx="17"
          stroke="rgba(255,255,255,0.22)"
          width="54"
          x="5"
          y="5"
        />
        <path
          d="M19.5 37.8c2.4 5.8 8.1 9.8 14.7 9.8 8.8 0 16-7.2 16-16 0-4.5-1.9-8.7-5.1-11.6"
          fill="none"
          stroke="rgba(255,255,255,0.3)"
          strokeLinecap="round"
          strokeWidth="2.4"
        />
        <circle
          cx="32"
          cy="32"
          fill="none"
          r="15"
          stroke="rgba(255,255,255,0.96)"
          strokeWidth="3.2"
        />
        <circle
          cx="32"
          cy="32"
          fill="none"
          r="8"
          stroke="rgba(255,255,255,0.92)"
          strokeWidth="2.4"
        />
        <path
          d="M32 13v7"
          fill="none"
          stroke="rgba(255,255,255,0.96)"
          strokeLinecap="round"
          strokeWidth="3"
        />
        <circle
          cx="32"
          cy="11.5"
          fill="#8f5b47"
          r="4.5"
          stroke="rgba(255,255,255,0.42)"
          strokeWidth="1.4"
        />
        <circle
          cx="32"
          cy="32"
          fill="#fff8f1"
          r="2.6"
        />
      </svg>
      <div className="space-y-0.5">
        <p className="text-[1.65rem] leading-none font-semibold tracking-[0.01em] text-[var(--xidea-near-black)]">
          习得
        </p>
        <p className="pl-px text-[10px] leading-none tracking-[0.32em] text-[var(--xidea-stone)]">
          XIDEA
        </p>
      </div>
    </button>
  );
}
