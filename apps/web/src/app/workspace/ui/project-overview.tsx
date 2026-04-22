import type { ReactElement, ReactNode } from "react";
import {
  FilePenLine,
} from "lucide-react";
import type { ProjectStats } from "@/domain/project-workspace";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
      <p className="mt-1 truncate text-sm font-medium text-[var(--xidea-near-black)]">{value}</p>
    </div>
  );
}

export function ProjectOverviewPanel({
  checkpoint,
  insights,
  isEditing,
  onCancelEditing,
  onChangeDraft,
  onEditProject,
  onSaveProjectMeta,
  projectMetaDraft,
  projectSessionCount,
  projectStats,
  selectedProjectDescription,
  selectedProjectTopic,
  selectedProjectRules,
  selectedProjectUpdatedAt,
}: {
  checkpoint?: ReactNode;
  insights?: ReactNode;
  isEditing: boolean;
  onCancelEditing: () => void;
  onChangeDraft: (draft: {
    readonly name: string;
    readonly topic: string;
    readonly description: string;
    readonly specialRulesText: string;
    readonly materialIds: ReadonlyArray<string>;
  }) => void;
  onEditProject: () => void;
  onSaveProjectMeta: () => void;
  projectMetaDraft: {
    readonly name: string;
    readonly topic: string;
    readonly description: string;
    readonly specialRulesText: string;
    readonly materialIds: ReadonlyArray<string>;
  };
  projectSessionCount: number;
  projectStats: ProjectStats;
  selectedProjectDescription: string;
  selectedProjectTopic: string;
  selectedProjectRules: ReadonlyArray<string>;
  selectedProjectUpdatedAt: string;
}): ReactElement {
  return (
    <Card className="xidea-card-motion rounded-[1.4rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
      <CardContent className="space-y-4 p-5">
        {isEditing ? (
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.92fr)]">
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="xidea-kicker text-[var(--xidea-selection-text)]">当前主题</span>
                  <span className="rounded-full border border-[var(--xidea-selection-border)] bg-[var(--xidea-selection)] px-2.5 py-1 text-[12px] text-[var(--xidea-selection-text)]">
                    主题研讨与学习编排
                  </span>
                </div>
                <div className="space-y-3">
                  <label className="block space-y-2 text-sm text-[var(--xidea-charcoal)]">
                    <span className="font-medium text-[var(--xidea-near-black)]">学习主题</span>
                    <input
                      className="w-full rounded-[0.95rem] border border-[var(--xidea-border)] bg-[var(--xidea-ivory)] px-3 py-2 outline-none focus:border-[var(--xidea-selection-border)]"
                      onChange={(event) =>
                        onChangeDraft({
                          ...projectMetaDraft,
                          name: event.target.value,
                          topic: event.target.value,
                        })
                      }
                      value={projectMetaDraft.topic}
                    />
                  </label>
                  <label className="block space-y-2 text-sm text-[var(--xidea-charcoal)]">
                    <span className="font-medium text-[var(--xidea-near-black)]">主题说明</span>
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
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  className="h-11 min-w-[8.5rem] rounded-full bg-[var(--xidea-terracotta)] px-6 text-[var(--xidea-ivory)] hover:bg-[var(--xidea-terracotta)]/90"
                  onClick={onSaveProjectMeta}
                  type="button"
                >
                  保存
                </Button>
                <Button
                  className="h-11 min-w-[8.5rem] rounded-full px-6"
                  onClick={onCancelEditing}
                  type="button"
                  variant="outline"
                >
                  取消
                </Button>
              </div>
            </div>
            {insights ? <div className="min-w-0 self-start">{insights}</div> : null}
          </div>
        ) : (
          <>
            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(520px,0.92fr)]">
              <div className="space-y-5">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="xidea-kicker text-[var(--xidea-selection-text)]">当前主题</span>
                    <span className="rounded-full border border-[var(--xidea-selection-border)] bg-[var(--xidea-selection)] px-2.5 py-1 text-[12px] text-[var(--xidea-selection-text)]">
                      主题研讨与学习编排
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[1.45rem] font-semibold tracking-[0.01em] text-[var(--xidea-near-black)]">
                      {selectedProjectTopic}
                    </p>
                    <Button
                      className="h-9 rounded-full border-[var(--xidea-border)] px-3 text-[var(--xidea-charcoal)] hover:bg-[var(--xidea-parchment)]"
                      onClick={onEditProject}
                      type="button"
                      variant="ghost"
                    >
                      <FilePenLine className="h-4 w-4" />
                      编辑
                    </Button>
                  </div>
                  <p className="max-w-3xl text-sm leading-6 text-[var(--xidea-charcoal)]">
                    {selectedProjectDescription}
                  </p>
                </div>

                {selectedProjectRules.length > 0 ? (
                  <div className="space-y-2">
                    <p className="xidea-kicker text-[var(--xidea-stone)]">主题约束</p>
                    {selectedProjectRules.slice(0, 4).map((rule) => (
                      <div
                        className="rounded-[0.95rem] border border-[var(--xidea-border)] bg-[var(--xidea-parchment)] px-3 py-2.5 text-sm leading-6 text-[var(--xidea-charcoal)]"
                        key={rule}
                      >
                        {rule}
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="space-y-2">
                  <p className="xidea-kicker text-[var(--xidea-stone)]">主题状态</p>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    <ProjectInfoPill label="知识卡" value={`${projectStats.total} 张`} />
                    <ProjectInfoPill label="待复习" value={`${projectStats.dueReview} 张`} />
                    <ProjectInfoPill label="会话" value={`${projectSessionCount} 个`} />
                    <ProjectInfoPill label="最近更新" value={selectedProjectUpdatedAt} />
                  </div>
                </div>

                {checkpoint ? <div className="pt-1">{checkpoint}</div> : null}
              </div>

              {insights ? <div className="min-w-0 self-start">{insights}</div> : null}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
