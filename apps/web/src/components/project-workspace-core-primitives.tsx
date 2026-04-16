import type { ReactElement } from "react";
import type { SourceAsset } from "@/domain/types";
import type {
  KnowledgePointItem,
  KnowledgePointStatus,
  ProjectItem,
  SessionType,
} from "@/domain/project-workspace";
import { getSessionTypeLabel } from "@/domain/project-workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type MetricTone = "emerald" | "amber" | "rose" | "sky";

function getMetricDotClass(tone: MetricTone): string {
  switch (tone) {
    case "emerald":
      return "bg-[#7a9d83]";
    case "amber":
      return "bg-[#b98a4a]";
    case "sky":
      return "bg-[#7f9eb7]";
    case "rose":
      return "bg-[#b37a7f]";
  }
}

export function getAssetKindLabel(kind: SourceAsset["kind"]): string {
  switch (kind) {
    case "audio":
      return "音频";
    case "image":
      return "图片";
    case "note":
      return "笔记";
    case "pdf":
      return "PDF";
    case "video":
      return "视频";
    case "web":
      return "网页";
  }
}

export function getKnowledgePointAccent(status: KnowledgePointStatus): string {
  switch (status) {
    case "active_learning":
      return "border-[#d8c9b9] bg-[#f6ede6] text-[#915d3a]";
    case "active_review":
      return "border-[#d7c8bb] bg-[#f3eee8] text-[#7c5b46]";
    case "archived":
      return "border-[var(--xidea-border)] bg-[var(--xidea-parchment)] text-[var(--xidea-stone)]";
    case "active_unlearned":
      return "border-[var(--xidea-sand)] bg-[var(--xidea-ivory)] text-[var(--xidea-charcoal)]";
  }
}

export function getSessionTypeAccent(type: SessionType): string {
  switch (type) {
    case "project":
      return "border-[#ddc1b4] bg-[#f5eae3] text-[#8f5b47]";
    case "study":
      return "border-[#e3ce96] bg-[#fbf2dd] text-[#9a6a15]";
    case "review":
      return "border-[#bfd1e1] bg-[#eaf2f8] text-[#567b96]";
  }
}

function getReviewTimingAccent(label: string): string {
  if (label.includes("今日") || label.includes("到期")) {
    return "border-[#e1c5bb] bg-[#f8ece7] text-[#9d5b43]";
  }
  if (label.includes("明天")) {
    return "border-[#e7d8a6] bg-[#fbf5df] text-[#98711c]";
  }
  return "border-[var(--xidea-sand)] bg-[var(--xidea-parchment)] text-[var(--xidea-charcoal)]";
}

function getUpdatedAtAccent(label: string): string {
  if (label.includes("刚刚") || label.includes("今天") || label.includes("1h")) {
    return "border-[#cadecf] bg-[#eef5ef] text-[#56795e]";
  }
  if (label.includes("昨天") || label.includes("2d") || label.includes("天前")) {
    return "border-[#d9d4c8] bg-[#f3f0e7] text-[#786c57]";
  }
  return "border-[var(--xidea-sand)] bg-[var(--xidea-parchment)] text-[var(--xidea-charcoal)]";
}

function getMasteryFillCount(mastery: number): number {
  if (mastery >= 80) return 4;
  if (mastery >= 55) return 3;
  if (mastery >= 30) return 2;
  return 1;
}

export function SessionTypeBadge({
  type,
  compact = false,
}: {
  type: SessionType;
  compact?: boolean;
}): ReactElement {
  return (
    <Badge
      className={`border uppercase tracking-[0.12em] shadow-none ${compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-[11px]"} ${getSessionTypeAccent(type)}`}
      variant="outline"
    >
      {getSessionTypeLabel(type)}
    </Badge>
  );
}

export function SessionCard({
  active,
  title,
  type,
  updatedAt,
  onClick,
}: {
  active: boolean;
  title: string;
  type: SessionType;
  updatedAt: string;
  onClick: () => void;
}): ReactElement {
  return (
    <button
      className={
        active
          ? "flex w-full items-center justify-between gap-3 rounded-[0.9rem] border border-[var(--xidea-selection-border)] bg-[var(--xidea-selection)] px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xidea-selection-border)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--xidea-parchment)]"
          : "flex w-full items-center justify-between gap-3 rounded-[0.9rem] border border-transparent bg-transparent px-3 py-2 text-left transition-colors hover:border-[var(--xidea-border)] hover:bg-[var(--xidea-white)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xidea-selection-border)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--xidea-parchment)]"
      }
      onClick={onClick}
      type="button"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <SessionTypeBadge compact type={type} />
          <span
            className={
              active
                ? "shrink-0 text-[11px] text-[var(--xidea-selection-text)]"
                : "shrink-0 text-[11px] text-[var(--xidea-stone)]"
            }
          >
            {updatedAt}
          </span>
        </div>
      </div>
    </button>
  );
}

export function MetricTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: MetricTone;
}): ReactElement {
  return (
    <div className="min-w-0 overflow-hidden rounded-[0.95rem] border border-[var(--xidea-border)] bg-[var(--xidea-parchment)] px-3 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className={`inline-block h-2 w-2 rounded-full ${getMetricDotClass(tone)}`} />
        <span className="truncate text-[11px] uppercase tracking-[0.14em] text-[var(--xidea-stone)]">
          {label}
        </span>
      </div>
      <p className="mt-2 min-w-0 break-words text-sm font-medium leading-5 text-[var(--xidea-near-black)]">
        {value}
      </p>
    </div>
  );
}

export function KnowledgePointCard({
  point,
  onClick,
}: {
  point: KnowledgePointItem;
  onClick: () => void;
}): ReactElement {
  const filledDots = getMasteryFillCount(point.mastery);

  return (
    <button
      className="flex h-full w-full flex-col rounded-[1.2rem] border border-[var(--xidea-border)] bg-[var(--xidea-white)] p-4 text-left shadow-none transition-colors hover:border-[var(--xidea-selection-border)] hover:bg-[#fcfbf7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xidea-selection-border)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--xidea-parchment)]"
      onClick={onClick}
      type="button"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium leading-6 text-[var(--xidea-near-black)]">{point.title}</p>
        <p className="mt-2 text-sm leading-6 text-[var(--xidea-charcoal)]">{point.description}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Badge
          className={`border px-2 py-1 text-[12px] shadow-none ${getKnowledgePointAccent(point.status)}`}
          variant="outline"
        >
          {point.stageLabel}
        </Badge>
        {point.nextReviewLabel ? (
          <Badge
            className={`border px-2 py-1 text-[12px] shadow-none ${getReviewTimingAccent(point.nextReviewLabel)}`}
            variant="outline"
          >
            {point.nextReviewLabel}
          </Badge>
        ) : null}
        <Badge
          className={`border px-2 py-1 text-[12px] shadow-none ${getUpdatedAtAccent(point.updatedAt)}`}
          variant="outline"
        >
          {point.updatedAt}
        </Badge>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {Array.from({ length: 4 }, (_, index) => (
            <span
              className={
                index < filledDots
                  ? "inline-block h-2.5 w-2.5 rounded-full bg-[var(--xidea-terracotta)]"
                  : "inline-block h-2.5 w-2.5 rounded-full bg-[#e6e1d6]"
              }
              key={`${point.id}-dot-${index}`}
            />
          ))}
        </div>
        <span className="text-[12px] text-[var(--xidea-stone)]">掌握度 {point.mastery}%</span>
      </div>
    </button>
  );
}

export function ProjectMetaPanel({
  project,
  materialCount,
  materials,
  sessionCount,
  onClose,
}: {
  project: ProjectItem;
  materialCount: number;
  materials: ReadonlyArray<SourceAsset>;
  sessionCount: number;
  onClose: () => void;
}): ReactElement {
  return (
    <Card className="rounded-[1.25rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="xidea-kicker text-[var(--xidea-selection-text)]">Project Meta</p>
            <p className="text-base font-medium text-[var(--xidea-near-black)]">{project.name}</p>
          </div>
          <Button className="rounded-full" onClick={onClose} type="button" variant="outline">
            收起
          </Button>
        </div>

        <div className="grid gap-2 md:grid-cols-3">
          <MetricTile label="材料" tone="amber" value={`${materialCount} 份`} />
          <MetricTile label="Sessions" tone="sky" value={`${sessionCount} 个`} />
          <MetricTile label="最近更新" tone="emerald" value={project.updatedAt} />
        </div>

        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--xidea-stone)]">Special Rules</p>
          <div className="flex flex-wrap gap-2">
            {project.specialRules.length > 0 ? (
              project.specialRules.map((rule) => (
                <Badge
                  className="border-[var(--xidea-sand)] bg-[var(--xidea-parchment)] px-2 py-1 text-[12px] text-[var(--xidea-charcoal)] shadow-none"
                  key={rule}
                  variant="outline"
                >
                  {rule}
                </Badge>
              ))
            ) : (
              <p className="text-sm text-[var(--xidea-stone)]">当前还没有 special rules。</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--xidea-stone)]">Project Materials</p>
          <div className="space-y-2">
            {materials.length > 0 ? (
              materials.map((material) => (
                <div
                  className="rounded-[0.95rem] border border-[var(--xidea-border)] bg-[var(--xidea-parchment)] px-3 py-3"
                  key={material.id}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-[var(--xidea-near-black)]">{material.title}</p>
                    <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--xidea-stone)]">
                      {getAssetKindLabel(material.kind)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--xidea-charcoal)]">{material.topic}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-[var(--xidea-stone)]">当前还没有 project materials。</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
