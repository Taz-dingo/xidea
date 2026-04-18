import type { ReactElement } from "react";

export function BrandLockup({
  onClick,
}: {
  onClick: () => void;
}): ReactElement {
  return (
    <button
      className="group flex items-center gap-3 rounded-[1rem] border border-[var(--xidea-border)] bg-[linear-gradient(180deg,#fffdfa_0%,#f5efe7_100%)] px-3 py-2 text-left transition-colors hover:border-[var(--xidea-selection-border)] hover:bg-[var(--xidea-white)]"
      onClick={onClick}
      type="button"
    >
      <svg
        aria-hidden="true"
        className="h-14 w-14 shrink-0"
        viewBox="0 0 64 64"
      >
        <defs>
          <linearGradient id="xidea-brand-bg" x1="10%" x2="86%" y1="8%" y2="92%">
            <stop offset="0%" stopColor="#ffd7c6" />
            <stop offset="45%" stopColor="#f7a785" />
            <stop offset="100%" stopColor="#c96442" />
          </linearGradient>
        </defs>
        <rect
          fill="url(#xidea-brand-bg)"
          height="56"
          rx="16"
          width="56"
          x="4"
          y="4"
        />
        <g className="xidea-logo-spin">
          <circle
            cx="31"
            cy="32"
            fill="none"
            r="16"
            stroke="rgba(255,255,255,0.92)"
            strokeWidth="2.8"
          />
          <path
            d="M21 42c2.6 3.8 6.9 6 11.7 6 7.8 0 14.2-6.4 14.2-14.2S40.5 19.6 32.7 19.6c-4.8 0-9.1 2.3-11.7 6"
            fill="none"
            stroke="rgba(255,255,255,0.9)"
            strokeLinecap="round"
            strokeWidth="4"
          />
          <circle cx="48.5" cy="18.5" fill="#7f9eb7" r="4.6" />
          <circle cx="19.5" cy="46" fill="rgba(255,255,255,0.95)" r="3.2" />
        </g>
        <circle
          className="xidea-logo-breathe"
          cx="32"
          cy="32"
          fill="none"
          r="8.5"
          stroke="rgba(255,255,255,0.92)"
          strokeWidth="2"
        />
      </svg>
      <div className="space-y-0.5">
        <p className="text-lg font-semibold tracking-[0.02em] text-[var(--xidea-near-black)]">
          习得
        </p>
        <p className="text-[11px] tracking-[0.18em] text-[var(--xidea-stone)]">
          XIDEA
        </p>
      </div>
    </button>
  );
}
