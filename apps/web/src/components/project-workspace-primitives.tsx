import { ChevronRight } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
        <p
          className={
            active
              ? "mt-1 text-[11px] uppercase tracking-[0.14em] text-[var(--xidea-selection-text)]/80"
              : "mt-1 text-[11px] uppercase tracking-[0.14em] text-[var(--xidea-stone)]"
          }
        >
          {getSessionTypeLabel(type)}
        </p>
      </div>
      <span
        className={
          active
            ? "shrink-0 text-[11px] text-[var(--xidea-selection-text)]"
            : "shrink-0 text-[11px] text-[var(--xidea-stone)]"
        }
      >
        {updatedAt}
      </span>
    </button>
  );
}

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
        <CardTitle className="xidea-kicker text-[var(--xidea-stone)]">
          {title}
        </CardTitle>
        {description ? (
          <CardDescription className="text-sm text-[var(--xidea-stone)]">
            {description}
          </CardDescription>
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
          {accent ? (
            <span className="ml-2 text-[var(--xidea-selection-text)]">
              {accent}
            </span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="min-w-0 space-y-3 px-4 pb-4 pt-0">
        {children}
      </CardContent>
    </Card>
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
        <span
          className={`inline-block h-2 w-2 rounded-full ${getMetricDotClass(tone)}`}
        />
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
      <span className="text-sm font-medium text-[var(--xidea-near-black)]">
        {label}
      </span>
      {count !== undefined ? (
        <span className="text-[12px] text-[var(--xidea-stone)]">{count}</span>
      ) : null}
    </button>
  );
}

export function KnowledgePointCard({
  point,
  onClick,
}: {
  point: KnowledgePointItem;
  onClick: () => void;
}): ReactElement {
  const filledDots = Math.max(1, Math.round(point.mastery / 34));

  return (
    <button
      className="flex h-full flex-col rounded-[1.2rem] border border-[var(--xidea-border)] bg-[var(--xidea-white)] p-4 text-left shadow-none transition-colors hover:border-[var(--xidea-selection-border)] hover:bg-[#fcfbf7]"
      onClick={onClick}
      type="button"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium leading-6 text-[var(--xidea-near-black)]">
            {point.title}
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--xidea-charcoal)]">
            {point.description}
          </p>
        </div>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[var(--xidea-stone)]" />
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
            className="border-[var(--xidea-sand)] bg-[var(--xidea-parchment)] px-2 py-1 text-[12px] text-[var(--xidea-charcoal)] shadow-none"
            variant="outline"
          >
            {point.nextReviewLabel}
          </Badge>
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {Array.from({ length: 3 }, (_, index) => (
            <span
              className={
                index < filledDots
                  ? "inline-block h-2.5 w-2.5 rounded-full bg-[var(--xidea-terracotta)]"
                  : "inline-block h-2.5 w-2.5 rounded-full bg-[var(--xidea-border)]"
              }
              key={`${point.id}-dot-${index}`}
            />
          ))}
        </div>
        <span className="text-[12px] text-[var(--xidea-stone)]">
          掌握度 {point.mastery}%
        </span>
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
            <p className="xidea-kicker text-[var(--xidea-selection-text)]">
              Project Meta
            </p>
            <p className="text-base font-medium text-[var(--xidea-near-black)]">
              {project.name}
            </p>
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
          <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--xidea-stone)]">
            Special Rules
          </p>
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
              <p className="text-sm text-[var(--xidea-stone)]">
                当前还没有 special rules。
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--xidea-stone)]">
            Project Materials
          </p>
          <div className="space-y-2">
            {materials.length > 0 ? (
              materials.map((material) => (
                <div
                  className="rounded-[0.95rem] border border-[var(--xidea-border)] bg-[var(--xidea-parchment)] px-3 py-3"
                  key={material.id}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-[var(--xidea-near-black)]">
                      {material.title}
                    </p>
                    <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--xidea-stone)]">
                      {getAssetKindLabel(material.kind)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--xidea-charcoal)]">
                    {material.topic}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-[var(--xidea-stone)]">
                当前还没有 project materials。
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
