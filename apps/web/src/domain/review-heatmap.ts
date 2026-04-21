import type { AgentReviewEvent } from "@/domain/agent-runtime";

export const REVIEW_HEATMAP_LOOKBACK_DAYS = 366;

export interface ReviewHeatmapCell {
  readonly dateKey: string;
  readonly tooltip: string;
  readonly intensity: 0 | 1 | 2 | 3 | 4;
}

export function formatDateLabel(value: string | null): string | null {
  if (value === null || value.trim() === "") {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString().slice(0, 10);
}

export function getLatestIsoDate(
  values: ReadonlyArray<string | null | undefined>,
): string | null {
  let latestValue: string | null = null;
  let latestTime = -Infinity;

  for (const value of values) {
    if (value === null || value === undefined || value.trim() === "") {
      continue;
    }

    const timestamp = new Date(value).getTime();
    if (Number.isNaN(timestamp) || timestamp <= latestTime) {
      continue;
    }

    latestValue = value;
    latestTime = timestamp;
  }

  return latestValue;
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function buildReviewHeatmap(
  reviewEvents: ReadonlyArray<AgentReviewEvent>,
  lastReviewedAt: string | null,
  nextReviewAt: string | null,
  weekCount = 5,
): ReadonlyArray<ReadonlyArray<ReviewHeatmapCell>> {
  const totalDays = weekCount * 7;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const eventMap = new Map<
    string,
    { intensity: ReviewHeatmapCell["intensity"]; notes: string[] }
  >();

  for (const event of reviewEvents) {
    const date = formatDateLabel(event.event_at);
    if (date === null) {
      continue;
    }

    const existing = eventMap.get(date);
    const nextIntensity = event.event_kind === "reviewed" ? 4 : 2;
    const nextNotes = existing?.notes ?? [];
    nextNotes.push(
      event.event_kind === "reviewed"
        ? "已发生一次真实复盘"
        : `已安排复盘：${event.review_reason ?? "等待本轮回拉"}`,
    );
    eventMap.set(date, {
      intensity: existing
        ? (Math.max(existing.intensity, nextIntensity) as ReviewHeatmapCell["intensity"])
        : nextIntensity,
      notes: nextNotes,
    });
  }

  const cells: ReviewHeatmapCell[] = [];

  for (let index = totalDays - 1; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - index);

    const dateKey = toDateKey(date);
    const event = eventMap.get(dateKey);
    let intensity: 0 | 1 | 2 | 3 | 4 = event?.intensity ?? 0;
    const notes = event?.notes ?? [];

    if (lastReviewedAt !== null && dateKey === lastReviewedAt) {
      intensity = Math.max(intensity, 4) as ReviewHeatmapCell["intensity"];
      notes.push("当前 learner state 记录：最近一次复盘");
    }

    if (nextReviewAt !== null && dateKey === nextReviewAt) {
      intensity = Math.max(intensity, 1) as ReviewHeatmapCell["intensity"];
      notes.push("当前 Review Engine 计划：下一次复盘");
    }

    const tooltip =
      notes.length === 0 ? `${dateKey} 暂无复习动作` : `${dateKey} ${notes.join(" / ")}`;

    cells.push({
      dateKey,
      tooltip,
      intensity,
    });
  }

  return Array.from({ length: weekCount }, (_, weekIndex) =>
    cells.slice(weekIndex * 7, weekIndex * 7 + 7),
  );
}

export function buildEmptyReviewHeatmap(
  weekCount = 5,
): ReadonlyArray<ReadonlyArray<ReviewHeatmapCell>> {
  const totalDays = weekCount * 7;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cells = Array.from({ length: totalDays }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (totalDays - index - 1));

    return {
      dateKey: toDateKey(date),
      tooltip: `${toDateKey(date)} 暂无复习动作`,
      intensity: 0 as const,
    };
  });

  return Array.from({ length: weekCount }, (_, weekIndex) =>
    cells.slice(weekIndex * 7, weekIndex * 7 + 7),
  );
}
