import type { ReactElement } from "react";
import {
  FileImage,
  FileText,
  Globe,
  GraduationCap,
  MessagesSquare,
  RotateCcw,
  Video,
  Volume2,
} from "lucide-react";
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

function getAssetKindIcon(kind: SourceAsset["kind"]): ReactElement {
  switch (kind) {
    case "audio":
      return <Volume2 className="h-4 w-4" />;
    case "image":
      return <FileImage className="h-4 w-4" />;
    case "note":
      return <FileText className="h-4 w-4" />;
    case "pdf":
      return <FileText className="h-4 w-4" />;
    case "video":
      return <Video className="h-4 w-4" />;
    case "web":
      return <Globe className="h-4 w-4" />;
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

export function getSessionDisplayTitle(title: string, type: SessionType): string {
  const label = getSessionTypeLabel(type);
  const normalized = title.trim();
  const colonPrefix = new RegExp(`^${label}[：:]\\s*`);
  return normalized.replace(colonPrefix, "").trim() || normalized;
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

function getMasteryFillCount(mastery: number): number {
  if (mastery >= 80) return 4;
  if (mastery >= 55) return 3;
  if (mastery >= 30) return 2;
  return 1;
}

function getSessionTypeIcon(type: SessionType): ReactElement {
  switch (type) {
    case "project":
      return <MessagesSquare className="h-3.5 w-3.5" />;
    case "study":
      return <GraduationCap className="h-3.5 w-3.5" />;
    case "review":
      return <RotateCcw className="h-3.5 w-3.5" />;
  }
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
      className={`border shadow-none ${compact ? "gap-1 px-1.5 py-0.5 text-[10px]" : "gap-1 px-2 py-1 text-[11px]"} ${getSessionTypeAccent(type)}`}
      variant="outline"
    >
      {getSessionTypeIcon(type)}
      {getSessionTypeLabel(type)}
    </Badge>
  );
}

export function SessionCard({
  active,
  showTypeBadge = true,
  title,
  type,
  updatedAt,
  onClick,
}: {
  active: boolean;
  showTypeBadge?: boolean;
  title: string;
  type: SessionType;
  updatedAt: string;
  onClick: () => void;
}): ReactElement {
  const visibleTitle = getSessionDisplayTitle(title, type);

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
        {showTypeBadge ? (
          <>
            <p className="truncate text-sm font-medium">{visibleTitle}</p>
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
          </>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 flex-1 truncate text-sm font-medium">{visibleTitle}</p>
            <span
              className={
                active
                  ? "shrink-0 pt-0.5 text-[11px] text-[var(--xidea-selection-text)]"
                  : "shrink-0 pt-0.5 text-[11px] text-[var(--xidea-stone)]"
              }
            >
              {updatedAt}
            </span>
          </div>
        )}
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
        <span className="truncate text-[11px] tracking-[0.08em] text-[var(--xidea-stone)]">
          {label}
        </span>
      </div>
      <p className="mt-2 min-w-0 break-words text-sm font-medium leading-5 text-[var(--xidea-near-black)]">
        {value}
      </p>
    </div>
  );
}

export function AssetListItem({
  asset,
  selected = false,
  onClick,
}: {
  asset: SourceAsset;
  selected?: boolean;
  onClick?: () => void;
}): ReactElement {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] border border-[var(--xidea-border)] bg-[var(--xidea-white)] text-[var(--xidea-selection-text)]">
          {getAssetKindIcon(asset.kind)}
        </div>
        <span className="shrink-0 rounded-full border border-[var(--xidea-border)] bg-[var(--xidea-white)] px-2 py-0.5 text-[10px] tracking-[0.08em] text-[var(--xidea-stone)]">
          {getAssetKindLabel(asset.kind)}
        </span>
      </div>
      <div className="space-y-1">
        <p className="line-clamp-2 text-sm font-medium leading-5 text-[var(--xidea-near-black)]">
          {asset.title}
        </p>
        <p className="line-clamp-2 text-sm leading-6 text-[var(--xidea-charcoal)]">{asset.topic}</p>
      </div>
    </>
  );

  const className = selected
    ? "flex h-full min-h-[132px] w-full flex-col gap-3 rounded-[1rem] border border-[var(--xidea-selection-border)] bg-[var(--xidea-selection)] p-3 text-left transition-colors"
    : "flex h-full min-h-[132px] w-full flex-col gap-3 rounded-[1rem] border border-[var(--xidea-border)] bg-[var(--xidea-parchment)] p-3 text-left transition-colors hover:border-[var(--xidea-selection-border)] hover:bg-[#faf4ef]";

  if (onClick) {
    return (
      <button className={className} onClick={onClick} type="button">
        {content}
      </button>
    );
  }

  return (
    <div className={className}>{content}</div>
  );
}

export function AssetListGrid({
  assets,
  className = "grid gap-2 sm:grid-cols-2",
  emptyText,
  onAssetClick,
  selectedAssetIds = [],
}: {
  assets: ReadonlyArray<SourceAsset>;
  className?: string;
  emptyText: string;
  onAssetClick?: (assetId: string) => void;
  selectedAssetIds?: ReadonlyArray<string>;
}): ReactElement {
  if (assets.length === 0) {
    return <p className="text-sm text-[var(--xidea-stone)]">{emptyText}</p>;
  }

  return (
    <div className={className}>
      {assets.map((asset) => (
        <AssetListItem
          asset={asset}
          key={asset.id}
          onClick={onAssetClick ? () => onAssetClick(asset.id) : undefined}
          selected={selectedAssetIds.includes(asset.id)}
        />
      ))}
    </div>
  );
}

export function AssetCompactList({
  assets,
  emptyText,
  maxHeightClassName = "max-h-[24rem]",
  onAssetClick,
  selectedAssetIds = [],
}: {
  assets: ReadonlyArray<SourceAsset>;
  emptyText: string;
  maxHeightClassName?: string;
  onAssetClick?: (assetId: string) => void;
  selectedAssetIds?: ReadonlyArray<string>;
}): ReactElement {
  if (assets.length === 0) {
    return <p className="text-sm text-[var(--xidea-stone)]">{emptyText}</p>;
  }

  return (
    <div className={`${maxHeightClassName} overflow-y-auto overscroll-contain pr-1`}>
      <div className="space-y-2 pr-2">
        {assets.map((asset) => {
          const selected = selectedAssetIds.includes(asset.id);
          const className = selected
            ? "grid grid-cols-[44px_minmax(0,1fr)] gap-3 rounded-[1rem] border border-[var(--xidea-selection-border)] bg-[var(--xidea-selection)] p-3 text-left transition-colors"
            : "grid grid-cols-[44px_minmax(0,1fr)] gap-3 rounded-[1rem] border border-[var(--xidea-border)] bg-[var(--xidea-parchment)] p-3 text-left transition-colors hover:border-[var(--xidea-selection-border)] hover:bg-[#faf4ef]";

          const content = (
            <>
              <div className="flex h-11 w-11 items-center justify-center rounded-[0.95rem] border border-[var(--xidea-border)] bg-[var(--xidea-white)] text-[var(--xidea-selection-text)]">
                {getAssetKindIcon(asset.kind)}
              </div>
              <div className="min-w-0 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <p className="line-clamp-2 text-sm font-medium leading-5 text-[var(--xidea-near-black)]">
                    {asset.title}
                  </p>
                  <span className="shrink-0 rounded-full border border-[var(--xidea-border)] bg-[var(--xidea-white)] px-2 py-0.5 text-[10px] tracking-[0.08em] text-[var(--xidea-stone)]">
                    {getAssetKindLabel(asset.kind)}
                  </span>
                </div>
                <p className="line-clamp-2 text-sm leading-6 text-[var(--xidea-charcoal)]">{asset.topic}</p>
              </div>
            </>
          );

          if (onAssetClick) {
            return (
              <button className={className} key={asset.id} onClick={() => onAssetClick(asset.id)} type="button">
                {content}
              </button>
            );
          }

          return (
            <div className={className} key={asset.id}>
              {content}
            </div>
          );
        })}
      </div>
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
      className="group flex h-full w-full flex-col rounded-[1.3rem] border border-[#e6dbcf] bg-[linear-gradient(180deg,#fffdf9_0%,#f8f2ea_100%)] p-4 text-left shadow-none transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--xidea-selection-border)] hover:shadow-[0_18px_36px_rgba(177,112,82,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xidea-selection-border)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--xidea-parchment)]"
      onClick={onClick}
      type="button"
    >
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <Badge
            className={`border px-2 py-1 text-[12px] shadow-none ${getKnowledgePointAccent(point.status)}`}
            variant="outline"
          >
            {point.stageLabel}
          </Badge>
          <span className="text-[12px] text-[var(--xidea-stone)]">{point.updatedAt}</span>
        </div>
        <p className="text-sm font-medium leading-6 text-[var(--xidea-near-black)]">{point.title}</p>
        <p className="text-sm leading-6 text-[var(--xidea-charcoal)]">{point.description}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {point.nextReviewLabel ? (
          <Badge
            className={`border px-2 py-1 text-[12px] shadow-none ${getReviewTimingAccent(point.nextReviewLabel)}`}
            variant="outline"
          >
            {point.nextReviewLabel}
          </Badge>
        ) : null}
        {point.archiveSuggestion !== null ? (
          <Badge
            className="border-[#d8c9b9] bg-[#f6ede6] px-2 py-1 text-[12px] text-[#915d3a] shadow-none"
            variant="outline"
          >
            系统建议归档
          </Badge>
        ) : null}
      </div>

      <div className="mt-auto flex items-center gap-3 pt-5">
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-[var(--xidea-stone)]">掌握程度</span>
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
        </div>
      </div>
    </button>
  );
}

export function MetaPanel({
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
            <p className="xidea-kicker text-[var(--xidea-selection-text)]">项目信息</p>
            <p className="text-base font-medium text-[var(--xidea-near-black)]">{project.name}</p>
          </div>
          <Button className="rounded-full" onClick={onClose} type="button" variant="outline">
            收起
          </Button>
        </div>

        <div className="grid gap-2 md:grid-cols-3">
          <MetricTile label="材料" tone="amber" value={`${materialCount} 份`} />
          <MetricTile label="会话" tone="sky" value={`${sessionCount} 个`} />
          <MetricTile label="最近更新" tone="emerald" value={project.updatedAt} />
        </div>

        <div className="space-y-2">
          <p className="text-[11px] tracking-[0.08em] text-[var(--xidea-stone)]">特殊约束</p>
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
              <p className="text-sm text-[var(--xidea-stone)]">当前还没有特殊约束。</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] tracking-[0.08em] text-[var(--xidea-stone)]">项目材料</p>
          <div className="space-y-2">
            {materials.length > 0 ? (
              materials.map((material) => (
                <div
                  className="rounded-[0.95rem] border border-[var(--xidea-border)] bg-[var(--xidea-parchment)] px-3 py-3"
                  key={material.id}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-[var(--xidea-near-black)]">{material.title}</p>
                    <span className="text-[11px] tracking-[0.08em] text-[var(--xidea-stone)]">
                      {getAssetKindLabel(material.kind)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--xidea-charcoal)]">{material.topic}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-[var(--xidea-stone)]">当前还没有项目材料。</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
