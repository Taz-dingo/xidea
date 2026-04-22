import type { ReactElement } from "react";
import {
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  Sparkles,
} from "lucide-react";
import type { AgentWorkspaceProjectConsolidation } from "@/domain/agent-workspace";
import type { ProjectConsolidationStatus } from "@/app/workspace/hooks/data/use-project-consolidation";
import { Card, CardContent } from "@/components/ui/card";
import { MetricTile } from "@/components/workspace/core";

function formatRelativeDateLabel(value: string | null | undefined): string {
  if (value === null || value === undefined || value.trim() === "") {
    return "刚刚";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));
  const diffHours = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60)));
  const diffDays = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  if (diffMs < 1000 * 60) {
    return "刚刚";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m 前`;
  }
  if (diffHours < 24) {
    return `${diffHours}h 前`;
  }
  if (diffDays <= 6) {
    return `${diffDays}d 前`;
  }

  return date.toISOString().slice(0, 10);
}

function buildSummary(snapshot: AgentWorkspaceProjectConsolidation | null): string {
  if (snapshot === null) {
    return "系统会在你回到主题时自动整理这轮学习状态，收口待复习项、待处理建议和下一步动作。";
  }

  const projectMemorySummary = snapshot.project_memory?.summary?.trim();
  if (projectMemorySummary) {
    return projectMemorySummary;
  }

  const currentStage = snapshot.project_learning_profile?.current_stage?.trim();
  if (currentStage) {
    return currentStage;
  }

  const firstRecommendedAction = snapshot.recommended_actions[0]?.trim();
  if (firstRecommendedAction) {
    return firstRecommendedAction;
  }

  return "系统已经收口当前主题的学习状态，可以直接据此决定下一步要继续学习、复习还是确认建议项。";
}

function getStatusMeta(status: ProjectConsolidationStatus, hasSnapshot: boolean): {
  readonly icon: ReactElement;
  readonly label: string;
  readonly description: string;
} {
  if (status === "ready") {
    return {
      icon: <CheckCircle2 className="h-4 w-4 text-[#6f8d77]" />,
      label: "已更新",
      description: "已切到最新主题收口结果",
    };
  }

  if (status === "refreshing") {
    return {
      icon: <LoaderCircle className="h-4 w-4 animate-spin text-[var(--xidea-selection-text)]" />,
      label: "更新中",
      description: "正在后台刷新最新主题收口结果",
    };
  }

  if (status === "error") {
    return {
      icon: <AlertCircle className="h-4 w-4 text-[#b37a7f]" />,
      label: hasSnapshot ? "显示上一版" : "刷新失败",
      description: hasSnapshot
        ? "最新结果刷新失败，当前先显示上一版收口结果"
        : "当前还没拿到可展示的主题收口结果",
    };
  }

  if (status === "loading") {
    return {
      icon: <LoaderCircle className="h-4 w-4 animate-spin text-[var(--xidea-selection-text)]" />,
      label: "整理中",
      description: "正在读取并刷新当前主题收口结果",
    };
  }

  return {
    icon: <Sparkles className="h-4 w-4 text-[var(--xidea-selection-text)]" />,
    label: "待生成",
    description: "进入主题后系统会自动整理最新收口结果",
  };
}

function buildFocusTitles(
  snapshot: AgentWorkspaceProjectConsolidation,
): ReadonlyArray<string> {
  if (snapshot.due_for_review.length > 0) {
    return snapshot.due_for_review.map((point) => point.title);
  }

  if (snapshot.unstable_knowledge_points.length > 0) {
    return snapshot.unstable_knowledge_points.map((point) => point.title);
  }

  if (snapshot.pending_suggestions.length > 0) {
    return snapshot.pending_suggestions.map((suggestion) => suggestion.title);
  }

  return snapshot.stable_knowledge_points.map((point) => point.title);
}

export function SystemCheckpointCard({
  checkpoint,
  status,
  compact = false,
}: {
  checkpoint: AgentWorkspaceProjectConsolidation | null;
  status: ProjectConsolidationStatus;
  compact?: boolean;
}): ReactElement {
  const summary = buildSummary(checkpoint);
  const statusMeta = getStatusMeta(status, checkpoint !== null);
  const focusTitles = checkpoint === null ? [] : buildFocusTitles(checkpoint).slice(0, 3);

  if (compact) {
    return (
      <div className="rounded-[1rem] border border-[var(--xidea-border)] bg-[linear-gradient(180deg,#fffaf5_0%,#f8f1e9_100%)] px-4 py-3">
        <div className="grid grid-cols-[minmax(0,1fr)_56px] items-start gap-x-4 gap-y-2">
          <span className="xidea-kicker text-[var(--xidea-selection-text)]">概览</span>
          <div className="row-span-2 flex justify-end">
            <div
              aria-label={statusMeta.label}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--xidea-border)] bg-[var(--xidea-white)]"
              title={
                checkpoint === null
                  ? statusMeta.label
                  : `${statusMeta.label} · 上次收口 ${formatRelativeDateLabel(checkpoint.generated_at)}`
              }
            >
              {statusMeta.icon}
            </div>
          </div>
          <p className="text-sm leading-6 text-[var(--xidea-charcoal)]">{summary}</p>
          {checkpoint !== null && focusTitles.length > 0 ? (
            <p className="col-span-2 text-[12px] leading-5 text-[var(--xidea-stone)]">
              当前焦点：{focusTitles.join(" / ")}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
      <Card className="rounded-[1.35rem] border-[var(--xidea-border)] bg-[linear-gradient(180deg,#fffaf5_0%,#f8f1e9_100%)] shadow-none">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="xidea-kicker text-[var(--xidea-selection-text)]">概览</span>
            </div>
            <p className="max-w-3xl text-sm leading-6 text-[var(--xidea-charcoal)]">
              {summary}
            </p>
          </div>
          <div className="min-w-[12rem] rounded-[1rem] border border-[var(--xidea-border)] bg-[var(--xidea-white)] px-3 py-2.5">
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--xidea-near-black)]">
              {statusMeta.icon}
              {statusMeta.label}
            </div>
            <p className="mt-1 text-[12px] leading-5 text-[var(--xidea-stone)]">
              {statusMeta.description}
            </p>
            <p className="mt-2 text-[11px] text-[var(--xidea-stone)]">
              {checkpoint === null
                ? "尚未生成可展示结果"
                : `上次收口 ${formatRelativeDateLabel(checkpoint.generated_at)}`}
            </p>
          </div>
        </div>

        {checkpoint !== null ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricTile
                label="活跃知识卡"
                tone="sky"
                value={`${checkpoint.knowledge_point_stats.active}`}
              />
              <MetricTile
                label="待复习"
                tone="amber"
                value={`${checkpoint.knowledge_point_stats.due_for_review}`}
              />
              <MetricTile
                label="待新增建议"
                tone="rose"
                value={`${checkpoint.knowledge_point_stats.pending_create_suggestions}`}
              />
              <MetricTile
                label="待归档建议"
                tone="emerald"
                value={`${checkpoint.knowledge_point_stats.pending_archive_suggestions}`}
              />
            </div>

            {focusTitles.length > 0 ? (
              <div className="space-y-2">
                <p className="xidea-kicker text-[var(--xidea-stone)]">当前焦点</p>
                <div className="flex flex-wrap gap-2">
                  {focusTitles.map((title) => (
                    <span
                      className="rounded-full border border-[var(--xidea-border)] bg-[var(--xidea-white)] px-3 py-1 text-[12px] text-[var(--xidea-charcoal)]"
                      key={title}
                    >
                      {title}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {checkpoint.recommended_actions.length > 0 ? (
              <div className="space-y-2">
                <p className="xidea-kicker text-[var(--xidea-stone)]">系统建议下一步</p>
                <div className="grid gap-2">
                  {checkpoint.recommended_actions.map((action) => (
                    <div
                      className="rounded-[0.95rem] border border-[var(--xidea-border)] bg-[var(--xidea-white)] px-3 py-2.5 text-sm leading-6 text-[var(--xidea-charcoal)]"
                      key={action}
                    >
                      {action}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="rounded-[1rem] border border-dashed border-[var(--xidea-border)] bg-[var(--xidea-white)] px-4 py-4 text-sm leading-6 text-[var(--xidea-stone)]">
            当前还没有足够的 project-level 收口结果。继续跑一轮研讨、学习或复习后，这里会自动开始积累可回看的 checkpoint。
          </div>
        )}
      </CardContent>
    </Card>
  );
}
