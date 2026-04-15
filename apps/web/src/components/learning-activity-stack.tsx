import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { LearningActivityCard } from "@/components/learning-activity-card";
import type { LearningActivity, LearningActivitySubmission } from "@/domain/types";

function getStackRotation(index: number): string {
  if (index % 2 === 0) {
    return `${Math.min(index + 1, 3) * 1.2}deg`;
  }

  return `-${Math.min(index + 1, 3) * 1.4}deg`;
}

function getKindLabel(kind: LearningActivity["kind"]): string {
  switch (kind) {
    case "coach-followup":
      return "导师追问";
    case "quiz":
      return "对比辨析";
    case "recall":
      return "主动回忆";
  }
}

export function LearningActivityStack({
  activities,
  disabled,
  resolution,
  onSkip,
  onSubmit,
}: {
  activities: ReadonlyArray<LearningActivity>;
  disabled: boolean;
  resolution: "submitted" | "skipped" | null;
  onSkip?: () => void;
  onSubmit: (submission: LearningActivitySubmission) => void;
}): ReactElement | null {
  const currentActivity = activities[0] ?? null;

  if (currentActivity === null) {
    return null;
  }

  const queuedActivities = activities.slice(1, 4);

  return (
    <div className="relative pt-10">
      {queuedActivities
        .slice()
        .reverse()
        .map((activity, index) => {
          const layerIndex = queuedActivities.length - index;

          return (
            <div
              className="pointer-events-none absolute inset-x-4 rounded-[1.2rem] border border-[var(--xidea-selection-border)] bg-[linear-gradient(180deg,#fffaf5_0%,#f8eee8_100%)] shadow-[0_18px_40px_rgba(124,82,57,0.08)]"
              key={activity.id}
              style={{
                top: `${layerIndex * 18}px`,
                transform: `rotate(${getStackRotation(layerIndex)})`,
                zIndex: layerIndex,
              }}
            >
              <div className="space-y-2 px-4 py-4 opacity-85">
                <div className="flex items-center justify-between gap-3">
                  <Badge
                    className="border-[var(--xidea-border)] bg-[var(--xidea-parchment)] text-[var(--xidea-stone)] shadow-none"
                    variant="outline"
                  >
                    {getKindLabel(activity.kind)}
                  </Badge>
                  <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--xidea-stone)]">
                    待续
                  </span>
                </div>
                <p className="text-sm font-medium leading-6 text-[var(--xidea-near-black)]">
                  {activity.title}
                </p>
                <p className="line-clamp-2 text-sm leading-6 text-[var(--xidea-charcoal)]/85">
                  {activity.prompt}
                </p>
              </div>
            </div>
          );
        })}

      <div className="relative z-10">
        {activities.length > 1 ? (
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-2">
              <Badge
                className="border-[var(--xidea-selection-border)] bg-[var(--xidea-selection)] text-[var(--xidea-selection-text)] shadow-none"
                variant="outline"
              >
                当前卡组
              </Badge>
              <span className="text-sm text-[var(--xidea-charcoal)]/80">
                共 {activities.length} 张
              </span>
            </div>
            <span className="text-sm text-[var(--xidea-stone)]">
              先完成最上面这一张
            </span>
          </div>
        ) : null}

        <LearningActivityCard
          activity={currentActivity}
          disabled={disabled}
          onSkip={onSkip}
          onSubmit={onSubmit}
          resolution={resolution}
        />
      </div>
    </div>
  );
}
