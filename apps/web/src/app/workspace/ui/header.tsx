import type { ReactElement } from "react";
import {
  ChevronRight,
  FilePenLine,
  GraduationCap,
  MessageSquareText,
  Plus,
  RefreshCcw,
  Search,
  Sparkles,
} from "lucide-react";
import type { ProjectStats } from "@/domain/project-workspace";
import type { SourceAsset } from "@/domain/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InlineProjectMetaEditor } from "@/components/workspace/management";

function BrandLockup({
  onClick,
}: {
  onClick: () => void;
}): ReactElement {
  return (
    <button
      className="flex items-center gap-3 rounded-[1rem] border border-[var(--xidea-border)] bg-[linear-gradient(180deg,#fffdfa_0%,#f5efe7_100%)] px-3 py-2 text-left transition-colors hover:border-[var(--xidea-selection-border)] hover:bg-[var(--xidea-white)]"
      onClick={onClick}
      type="button"
    >
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] bg-[radial-gradient(circle_at_30%_30%,#ffd7c6_0%,#f7a785_38%,#c96442_78%)]">
        <span className="absolute inset-[6px] rounded-full border-2 border-white/85" />
        <span className="absolute inset-[14px] rounded-full border border-white/85" />
        <span className="absolute right-[6px] top-[6px] h-3 w-3 rounded-full bg-[#7f9eb7]" />
        <span className="absolute left-[9px] bottom-[8px] h-2.5 w-2.5 rounded-full bg-white/90" />
      </div>
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

function BreadcrumbButton({
  active = false,
  label,
  onClick,
}: {
  active?: boolean;
  label: string;
  onClick?: () => void;
}): ReactElement {
  if (onClick === undefined || active) {
    return (
      <span className={active ? "text-[var(--xidea-charcoal)]" : ""}>
        {label}
      </span>
    );
  }

  return (
    <button
      className="rounded-sm text-left transition-colors hover:text-[var(--xidea-charcoal)]"
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function ProjectInfoPill({
  label,
  value,
}: {
  label: string;
  value: string;
}): ReactElement {
  return (
    <div className="min-w-0 rounded-[0.95rem] border border-[var(--xidea-border)] bg-[var(--xidea-parchment)] px-3 py-2.5">
      <p className="text-[11px] tracking-[0.08em] text-[var(--xidea-stone)]">{label}</p>
      <p className="mt-1 truncate text-sm font-medium text-[var(--xidea-near-black)]">
        {value}
      </p>
    </div>
  );
}

export function WorkspaceHeader({
  isProjectMetaEditing,
  onCancelProjectMetaEditing,
  onChangeProjectMetaDraft,
  onCreateProject,
  onEditProject,
  onGoHome,
  onGoWorkspace,
  onSaveProjectMeta,
  onSearchChange,
  onStartProjectSession,
  onStartReview,
  onStartStudy,
  onUploadProjectMaterial,
  projectMaterialCount,
  projectMetaDraft,
  projectSessionCount,
  projectStats,
  projectAssets,
  reviewDisabled,
  screen,
  searchQuery,
  selectedProjectDescription,
  selectedProjectName,
  selectedProjectRules,
  selectedProjectTopic,
  selectedProjectUpdatedAt,
  studyDisabled,
}: {
  isProjectMetaEditing: boolean;
  onCancelProjectMetaEditing: () => void;
  onChangeProjectMetaDraft: (draft: {
    readonly topic: string;
    readonly description: string;
    readonly specialRulesText: string;
    readonly materialIds: ReadonlyArray<string>;
  }) => void;
  onCreateProject: () => void;
  onEditProject: () => void;
  onGoHome: () => void;
  onGoWorkspace: () => void;
  onSaveProjectMeta: () => void;
  onSearchChange: (value: string) => void;
  onStartProjectSession: () => void;
  onStartReview: () => void;
  onStartStudy: () => void;
  onUploadProjectMaterial: (file: File) => Promise<void>;
  projectMaterialCount: number;
  projectMetaDraft: {
    readonly topic: string;
    readonly description: string;
    readonly specialRulesText: string;
    readonly materialIds: ReadonlyArray<string>;
  };
  projectSessionCount: number;
  projectStats: ProjectStats;
  projectAssets: ReadonlyArray<SourceAsset>;
  reviewDisabled: boolean;
  screen: "home" | "workspace";
  searchQuery: string;
  selectedProjectDescription: string;
  selectedProjectName: string;
  selectedProjectRules: ReadonlyArray<string>;
  selectedProjectTopic: string;
  selectedProjectUpdatedAt: string;
  studyDisabled: boolean;
}): ReactElement {
  return (
    <Card className="xidea-card-motion rounded-[1.4rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
      <CardContent className="flex flex-col gap-4 px-5 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex items-start gap-3">
            <BrandLockup onClick={onGoHome} />
            <div className="min-w-0 space-y-2">
              <div className="flex min-w-0 flex-wrap items-center gap-1 text-[12px] text-[var(--xidea-stone)]">
                <BreadcrumbButton label="全部项目" onClick={screen === "home" ? undefined : onGoHome} />
                {screen === "workspace" ? (
                  <>
                    <ChevronRight className="h-3.5 w-3.5" />
                    <BreadcrumbButton label={selectedProjectName} onClick={onGoWorkspace} />
                    <ChevronRight className="h-3.5 w-3.5" />
                    <BreadcrumbButton active label="工作台" />
                  </>
                ) : null}
              </div>
              {screen === "home" ? null : (
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
                  <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="xidea-kicker text-[var(--xidea-selection-text)]">当前项目</span>
                          <span className="rounded-full border border-[var(--xidea-selection-border)] bg-[var(--xidea-selection)] px-2.5 py-1 text-[12px] text-[var(--xidea-selection-text)]">
                            项目研讨与学习编排
                          </span>
                        </div>
                        <p className="text-[1.45rem] font-semibold tracking-[0.01em] text-[var(--xidea-near-black)]">
                          {selectedProjectName}
                        </p>
                      </div>
                      <Button
                        className="h-10 rounded-full"
                        onClick={onEditProject}
                        type="button"
                        variant="outline"
                      >
                        <FilePenLine className="h-4 w-4" />
                        编辑
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-[var(--xidea-charcoal)]">
                        <Sparkles className="h-4 w-4 text-[var(--xidea-selection-text)]" />
                        <span className="font-medium text-[var(--xidea-near-black)]">当前主题</span>
                        <span>{selectedProjectTopic}</span>
                      </div>
                      <p className="max-w-4xl text-sm leading-6 text-[var(--xidea-charcoal)]">
                        {selectedProjectDescription}
                      </p>
                      {selectedProjectRules.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {selectedProjectRules.slice(0, 3).map((rule) => (
                            <span
                              className="rounded-full border border-[var(--xidea-border)] bg-[var(--xidea-parchment)] px-3 py-1 text-[12px] text-[var(--xidea-charcoal)]"
                              key={rule}
                            >
                              {rule}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      <ProjectInfoPill label="知识卡" value={`${projectStats.total} 张`} />
                      <ProjectInfoPill label="待复习" value={`${projectStats.dueReview} 张`} />
                      <ProjectInfoPill label="材料" value={`${projectMaterialCount} 份`} />
                      <ProjectInfoPill label="最近更新" value={selectedProjectUpdatedAt} />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 xl:justify-end">
                    <Button className="h-11 min-w-[104px] rounded-full" onClick={onStartProjectSession} type="button" variant="outline">
                      <MessageSquareText className="h-4 w-4" />
                      研讨
                    </Button>
                    <div className="xidea-card-motion flex items-center gap-1 rounded-[1.05rem] border border-[var(--xidea-border)] bg-[var(--xidea-parchment)] p-1">
                      <Button
                        className="h-10 min-w-[96px] rounded-[0.8rem] bg-[var(--xidea-terracotta)] text-[var(--xidea-ivory)] hover:bg-[var(--xidea-terracotta)]/90"
                        disabled={studyDisabled}
                        onClick={onStartStudy}
                        type="button"
                      >
                        <GraduationCap className="h-4 w-4" />
                        学习
                      </Button>
                      <Button
                        className="h-10 min-w-[96px] rounded-[0.8rem]"
                        disabled={reviewDisabled}
                        onClick={onStartReview}
                        type="button"
                        variant="outline"
                      >
                        <RefreshCcw className="h-4 w-4" />
                        复习
                      </Button>
                    </div>
                    <div className="rounded-[1.05rem] border border-[var(--xidea-border)] bg-[linear-gradient(180deg,#fffdfa_0%,#f5efe7_100%)] px-4 py-3 text-right">
                      <p className="text-[11px] tracking-[0.08em] text-[var(--xidea-stone)]">
                        当前工作区
                      </p>
                      <p className="mt-1 text-sm font-medium text-[var(--xidea-near-black)]">
                        {projectSessionCount} 个会话 · {projectMaterialCount} 份材料
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="xidea-card-motion flex min-w-[220px] items-center gap-2 rounded-full border border-[var(--xidea-border)] bg-[var(--xidea-parchment)] px-3 py-2 text-sm text-[var(--xidea-charcoal)]">
              <Search className="h-4 w-4 shrink-0 text-[var(--xidea-stone)]" />
              <input
                className="w-full bg-transparent outline-none placeholder:text-[var(--xidea-stone)]"
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder={screen === "home" ? "搜索项目" : "搜索知识卡"}
                value={searchQuery}
              />
            </label>
            <Button
              className="rounded-full bg-[var(--xidea-terracotta)] text-[var(--xidea-ivory)] hover:bg-[var(--xidea-terracotta)]/90"
              onClick={onCreateProject}
              type="button"
            >
              <Plus className="h-4 w-4" />
              新建项目
            </Button>
          </div>
        </div>

        {screen === "workspace" ? (
          <div
            className={
              isProjectMetaEditing
                ? "xidea-card-motion max-h-[1400px] overflow-hidden border-t border-[var(--xidea-border)] pt-4 transition-[max-height,padding,border-color] duration-300 ease-out"
                : "max-h-0 overflow-hidden border-t border-transparent pt-0 transition-[max-height,padding,border-color] duration-300 ease-out"
            }
          >
            {isProjectMetaEditing ? (
              <InlineProjectMetaEditor
                assets={projectAssets}
                draft={projectMetaDraft}
                onCancel={onCancelProjectMetaEditing}
                onChange={onChangeProjectMetaDraft}
                onSave={onSaveProjectMeta}
                onUploadMaterial={onUploadProjectMaterial}
              />
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
