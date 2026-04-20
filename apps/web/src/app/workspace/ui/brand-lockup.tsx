import type { ReactElement } from "react";

export function BrandLockup({
  onClick,
}: {
  onClick: () => void;
}): ReactElement {
  return (
    <button
      className="group flex items-center rounded-[1.1rem] border border-[var(--xidea-border)] bg-[linear-gradient(180deg,#fffdfa_0%,#f7f1e9_100%)] px-4 py-3 text-left transition-[border-color,background-color,box-shadow,transform] hover:border-[rgba(201,100,66,0.18)] hover:bg-[var(--xidea-white)] hover:shadow-[0_10px_28px_rgba(111,74,53,0.08)]"
      onClick={onClick}
      type="button"
    >
      <div className="min-w-0">
        <p className="xidea-kaiti truncate text-[2.1rem] leading-none text-[var(--xidea-near-black)]">
          习得
        </p>
        <p className="mt-1 ml-[0.18rem] text-[10px] leading-none tracking-[0.34em] text-[var(--xidea-stone)]">
          XIDEA
        </p>
      </div>
    </button>
  );
}
