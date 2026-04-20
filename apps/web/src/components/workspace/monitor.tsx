import type { ReactElement, ReactNode } from "react";
import type { ReviewHeatmapCell } from "@/domain/review-heatmap";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function InspectorCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}): ReactElement {
  return (
    <Card className="rounded-[1.25rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
      <CardHeader className="pb-4">
        <CardTitle className="xidea-kicker text-[var(--xidea-stone)]">{title}</CardTitle>
        {description ? (
          <CardDescription className="text-sm leading-6 text-[var(--xidea-stone)]">{description}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

export function MonitorSection({
  title,
  accent,
  children,
}: {
  title: string;
  accent?: string;
  children: ReactNode;
}): ReactElement {
  return (
    <Card className="min-w-0 overflow-hidden rounded-[1.1rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
      <CardHeader className="px-4 pb-3 pt-4">
        <CardTitle className="xidea-kicker text-[var(--xidea-stone)]">
          {title}
          {accent ? <span className="ml-2 text-[var(--xidea-selection-text)]">{accent}</span> : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="min-w-0 space-y-3 px-4 pb-4 pt-0">{children}</CardContent>
    </Card>
  );
}

export function CompactNote({
  label,
  value,
}: {
  label: string;
  value: string;
}): ReactElement {
  return (
    <div className="flex min-w-0 items-start gap-2 rounded-[0.95rem] bg-[var(--xidea-parchment)] px-3 py-2.5">
      <span className="shrink-0 pt-0.5 text-[11px] uppercase tracking-[0.14em] text-[var(--xidea-stone)]">
        {label}
      </span>
      <span className="min-w-0 flex-1 break-words text-right text-sm leading-5 text-[var(--xidea-charcoal)]">
        {value}
      </span>
    </div>
  );
}

function getHeatmapCellClass(intensity: ReviewHeatmapCell["intensity"]): string {
  switch (intensity) {
    case 0:
      return "bg-[var(--xidea-parchment)]";
    case 1:
      return "bg-[#e7d8cf]";
    case 2:
      return "bg-[#ddb9a8]";
    case 3:
      return "bg-[#d98e70]";
    case 4:
      return "bg-[var(--xidea-terracotta)]";
  }
}

export function ReviewHeatmap({
  compact = false,
  rangeLabel,
  showTooltip = true,
  weeks,
}: {
  compact?: boolean;
  rangeLabel?: string;
  showTooltip?: boolean;
  weeks: ReadonlyArray<ReadonlyArray<ReviewHeatmapCell>>;
}): ReactElement {
  const isDense = compact || weeks.length > 16;
  const resolvedRangeLabel =
    rangeLabel ?? (weeks.length >= 48 ? "近 1 年轨迹" : `近 ${weeks.length} 周轨迹`);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto pb-1">
        <div className="flex w-max gap-1.5">
        {weeks.map((week, weekIndex) => (
          <div className="grid gap-1.5" key={`review-week-${weekIndex}`}>
            {week.map((cell) => (
              <div
                className="group relative"
                key={cell.dateKey}
              >
                <div
                  aria-label={showTooltip ? cell.tooltip : undefined}
                  className={`${isDense ? "h-3 w-3 rounded-[3px]" : "h-4 w-4 rounded-[4px]"} border border-[var(--xidea-border)] ${getHeatmapCellClass(cell.intensity)}`}
                  title={showTooltip ? cell.tooltip : undefined}
                />
                {showTooltip ? (
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-max max-w-[220px] -translate-x-1/2 rounded-[0.75rem] border border-[var(--xidea-border)] bg-[var(--xidea-white)] px-2.5 py-2 text-[11px] leading-5 text-[var(--xidea-charcoal)] shadow-[0_10px_24px_rgba(0,0,0,0.08)] group-hover:block">
                    {cell.tooltip}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 text-[11px] text-[var(--xidea-stone)]">
        <span>{resolvedRangeLabel}</span>
        <div className="flex items-center gap-1.5">
          <span>低</span>
          {[0, 1, 2, 3, 4].map((intensity) => (
            <span
              className={`${isDense ? "h-2.5 w-2.5 rounded-[2px]" : "h-3 w-3 rounded-[3px]"} border border-[var(--xidea-border)] ${getHeatmapCellClass(intensity as ReviewHeatmapCell["intensity"])}`}
              key={`review-legend-${intensity}`}
            />
          ))}
          <span>高</span>
        </div>
      </div>
    </div>
  );
}

export function WorkspaceNavButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count?: number;
  onClick: () => void;
}): ReactElement {
  return (
    <button
      className={
        active
          ? "flex w-full items-center justify-between rounded-[0.95rem] border border-[var(--xidea-selection-border)] bg-[var(--xidea-selection)] px-3 py-2 text-left"
          : "flex w-full items-center justify-between rounded-[0.95rem] border border-transparent px-3 py-2 text-left hover:border-[var(--xidea-border)] hover:bg-[var(--xidea-white)]"
      }
      onClick={onClick}
      type="button"
    >
      <span className="text-sm font-medium text-[var(--xidea-near-black)]">{label}</span>
      {count !== undefined ? (
        <span className="text-[12px] text-[var(--xidea-stone)]">{count}</span>
      ) : null}
    </button>
  );
}
