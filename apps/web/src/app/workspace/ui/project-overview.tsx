import type { ReactElement } from "react";
import {
  FilePenLine,
  GraduationCap,
  MessageSquareText,
  RefreshCcw,
  Sparkles,
} from "lucide-react";
import { MaterialUploadButton } from "@/components/material-upload-button";
import type { ProjectStats } from "@/domain/project-workspace";
import type { SourceAsset } from "@/domain/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AssetListItem } from "@/components/workspace/core";
import { Textarea } from "@/components/ui/textarea";

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

function ActionModule({
  children,
  label,
}: {
  children: ReactElement;
  label: string;
}): ReactElement {
  return (
    <div className="space-y-2 rounded-[1.1rem] border border-[var(--xidea-border)] bg-[var(--xidea-ivory)] p-3">
      <p className="text-[11px] tracking-[0.1em] text-[var(--xidea-stone)]">{label}</p>
      {children}
    </div>
  );
}

export function ProjectOverviewPanel({
  isEditing,
  onCancelEditing,
  onChangeDraft,
  onEditProject,
  onSaveProjectMeta,
  onStartProjectSession,
  onStartReview,
  onStartStudy,
  onUploadProjectMaterial,
  projectAssets,
  projectMaterialCount,
  projectMaterials,
  projectMetaDraft,
  projectSessionCount,
  projectStats,
  reviewDisabled,
  selectedProjectDescription,
  selectedProjectName,
  selectedProjectRules,
  selectedProjectTopic,
  selectedProjectUpdatedAt,
  studyDisabled,
}: {
  isEditing: boolean;
  onCancelEditing: () => void;
  onChangeDraft: (draft: {
    readonly topic: string;
    readonly description: string;
    readonly specialRulesText: string;
    readonly materialIds: ReadonlyArray<string>;
  }) => void;
  onEditProject: () => void;
  onSaveProjectMeta: () => void;
  onStartProjectSession: () => void;
  onStartReview: () => void;
  onStartStudy: () => void;
  onUploadProjectMaterial: (file: File) => Promise<void>;
  projectAssets: ReadonlyArray<SourceAsset>;
  projectMaterialCount: number;
  projectMaterials: ReadonlyArray<SourceAsset>;
  projectMetaDraft: {
    readonly topic: string;
    readonly description: string;
    readonly specialRulesText: string;
    readonly materialIds: ReadonlyArray<string>;
  };
  projectSessionCount: number;
  projectStats: ProjectStats;
  reviewDisabled: boolean;
  selectedProjectDescription: string;
  selectedProjectName: string;
  selectedProjectRules: ReadonlyArray<string>;
  selectedProjectTopic: string;
  selectedProjectUpdatedAt: string;
  studyDisabled: boolean;
}): ReactElement {
  const visibleMaterials = isEditing ? projectAssets : projectMaterials;

  return (
    <Card className="xidea-card-motion rounded-[1.4rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
      <CardContent className="space-y-4 p-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="xidea-kicker text-[var(--xidea-selection-text)]">当前项目</span>
              <span className="rounded-full border border-[var(--xidea-selection-border)] bg-[var(--xidea-selection)] px-2.5 py-1 text-[12px] text-[var(--xidea-selection-text)]">
                项目研讨与学习编排
              </span>
            </div>
            <p className="text-[1.45rem] font-semibold tracking-[0.01em] text-[var(--xidea-near-black)]">
              {selectedProjectName}
            </p>
            {isEditing ? (
              <div className="space-y-3">
                <label className="block space-y-2 text-sm text-[var(--xidea-charcoal)]">
                  <span className="font-medium text-[var(--xidea-near-black)]">当前主题</span>
                  <input
                    className="w-full rounded-[0.95rem] border border-[var(--xidea-border)] bg-[var(--xidea-ivory)] px-3 py-2 outline-none focus:border-[var(--xidea-selection-border)]"
                    onChange={(event) =>
                      onChangeDraft({ ...projectMetaDraft, topic: event.target.value })
                    }
                    value={projectMetaDraft.topic}
                  />
                </label>
                <label className="block space-y-2 text-sm text-[var(--xidea-charcoal)]">
                  <span className="font-medium text-[var(--xidea-near-black)]">项目说明</span>
                  <Textarea
                    className="min-h-28 rounded-[0.95rem] border-[var(--xidea-border)] bg-[var(--xidea-ivory)] text-sm leading-7 text-[var(--xidea-charcoal)] focus-visible:ring-[var(--xidea-selection-border)]"
                    onChange={(event) =>
                      onChangeDraft({ ...projectMetaDraft, description: event.target.value })
                    }
                    value={projectMetaDraft.description}
                  />
                </label>
                <label className="block space-y-2 text-sm text-[var(--xidea-charcoal)]">
                  <span className="font-medium text-[var(--xidea-near-black)]">特殊约束</span>
                  <Textarea
                    className="min-h-24 rounded-[0.95rem] border-[var(--xidea-border)] bg-[var(--xidea-ivory)] text-sm leading-7 text-[var(--xidea-charcoal)] focus-visible:ring-[var(--xidea-selection-border)]"
                    onChange={(event) =>
                      onChangeDraft({
                        ...projectMetaDraft,
                        specialRulesText: event.target.value,
                      })
                    }
                    value={projectMetaDraft.specialRulesText}
                  />
                </label>
              </div>
            ) : (
              <>
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
                    {selectedProjectRules.slice(0, 4).map((rule) => (
                      <span
                        className="rounded-full border border-[var(--xidea-border)] bg-[var(--xidea-parchment)] px-3 py-1 text-[12px] text-[var(--xidea-charcoal)]"
                        key={rule}
                      >
                        {rule}
                      </span>
                    ))}
                  </div>
                ) : null}
              </>
            )}
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <ProjectInfoPill label="知识卡" value={`${projectStats.total} 张`} />
              <ProjectInfoPill label="待复习" value={`${projectStats.dueReview} 张`} />
              <ProjectInfoPill label="会话" value={`${projectSessionCount} 个`} />
              <ProjectInfoPill label="最近更新" value={selectedProjectUpdatedAt} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <ActionModule
              label="项目推进"
            >
              <Button className="h-11 w-full rounded-full" onClick={onStartProjectSession} type="button" variant="outline">
                <MessageSquareText className="h-4 w-4" />
                研讨
              </Button>
            </ActionModule>
            <ActionModule label="学习编排">
              <div className="xidea-card-motion flex items-center gap-1 rounded-[0.95rem] border border-[var(--xidea-border)] bg-[var(--xidea-parchment)] p-1">
                <Button
                  className="h-10 min-w-0 flex-1 rounded-[0.75rem] bg-[var(--xidea-terracotta)] text-[var(--xidea-ivory)] hover:bg-[var(--xidea-terracotta)]/90"
                  disabled={studyDisabled}
                  onClick={onStartStudy}
                  type="button"
                >
                  <GraduationCap className="h-4 w-4" />
                  学习
                </Button>
                <Button
                  className="h-10 min-w-0 flex-1 rounded-[0.75rem]"
                  disabled={reviewDisabled}
                  onClick={onStartReview}
                  type="button"
                  variant="outline"
                >
                  <RefreshCcw className="h-4 w-4" />
                  复习
                </Button>
              </div>
            </ActionModule>
            <ActionModule label="项目设置">
              <div className="space-y-2">
                {isEditing ? (
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                    <Button
                      className="h-11 w-full rounded-full bg-[var(--xidea-terracotta)] text-[var(--xidea-ivory)] hover:bg-[var(--xidea-terracotta)]/90"
                      onClick={onSaveProjectMeta}
                      type="button"
                    >
                      保存
                    </Button>
                    <Button className="h-11 w-full rounded-full" onClick={onCancelEditing} type="button" variant="outline">
                      取消
                    </Button>
                  </div>
                ) : (
                  <Button className="h-11 w-full rounded-full" onClick={onEditProject} type="button" variant="outline">
                    <FilePenLine className="h-4 w-4" />
                    编辑
                  </Button>
                )}
                <p className="text-sm text-[var(--xidea-stone)]">
                  {projectSessionCount} 个会话 · {projectMaterialCount} 份材料
                </p>
              </div>
            </ActionModule>
            <div className="space-y-3 rounded-[1.1rem] border border-[var(--xidea-border)] bg-[var(--xidea-ivory)] p-3 sm:col-span-3 xl:col-span-1">
              <div className="space-y-1">
                <p className="text-[11px] tracking-[0.1em] text-[var(--xidea-stone)]">项目材料</p>
                <p className="text-sm text-[var(--xidea-charcoal)]">
                  {isEditing ? "在这里直接调整材料池并上传新材料。" : "当前项目挂接的材料来源。"}
                </p>
              </div>
              {isEditing ? (
                <div className="flex justify-end">
                  <MaterialUploadButton label="上传材料" onUpload={onUploadProjectMaterial} />
                </div>
              ) : null}
              <div className="grid gap-2 sm:grid-cols-2">
                {visibleMaterials.length > 0 ? (
                  visibleMaterials.map((asset) => (
                    <AssetListItem
                      asset={asset}
                      key={asset.id}
                      onClick={
                        isEditing
                          ? () =>
                              onChangeDraft({
                                ...projectMetaDraft,
                                materialIds: projectMetaDraft.materialIds.includes(asset.id)
                                  ? projectMetaDraft.materialIds.filter((id) => id !== asset.id)
                                  : [...projectMetaDraft.materialIds, asset.id],
                              })
                          : undefined
                      }
                      selected={isEditing && projectMetaDraft.materialIds.includes(asset.id)}
                    />
                  ))
                ) : (
                  <p className="text-sm text-[var(--xidea-stone)]">
                    {isEditing ? "当前材料池还是空的，先上传材料。" : "当前还没有项目材料。"}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
