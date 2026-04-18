import type { ReactElement } from "react";
import type {
  KnowledgePointItem,
  ProjectStats,
  SessionItem,
  SessionType,
  WorkspaceSection,
} from "@/domain/project-workspace";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  MetricTile,
  KnowledgePointCard,
  SessionCard,
  SessionTypeBadge,
} from "@/components/workspace/core";
import { WorkspaceNavButton } from "@/components/workspace/monitor";

export function WorkspaceBrowseScreen({
  filteredKnowledgePoints,
  normalizedSearchQuery,
  onCancelPendingSession,
  onChangePendingPrompt,
  onOpenKnowledgePoint,
  onOpenSession,
  onSubmitPendingPrompt,
  pendingPrompt,
  pendingSessionIntent,
  profileSummary,
  projectStats,
  selectedProjectSessions,
  workspaceSection,
  onWorkspaceSectionChange,
}: {
  filteredKnowledgePoints: ReadonlyArray<KnowledgePointItem>;
  normalizedSearchQuery: string;
  onCancelPendingSession: () => void;
  onChangePendingPrompt: (value: string) => void;
  onOpenKnowledgePoint: (pointId: string) => void;
  onOpenSession: (sessionId: string) => void;
  onSubmitPendingPrompt: () => void;
  pendingPrompt: string;
  pendingSessionIntent: {
    readonly type: Extract<SessionType, "review" | "study">;
    readonly knowledgePointTitle: string | null;
  } | null;
  profileSummary: {
    readonly title: string;
    readonly evidence: string;
  };
  projectStats: ProjectStats;
  selectedProjectSessions: ReadonlyArray<SessionItem>;
  workspaceSection: WorkspaceSection;
  onWorkspaceSectionChange: (section: WorkspaceSection) => void;
}): ReactElement {
  return (
    <div className="grid gap-4 lg:grid-cols-[292px_minmax(0,1fr)]">
      <Card className="rounded-[1.4rem] border-[var(--xidea-border)] bg-[#f1f0ea] shadow-none">
        <CardContent className="space-y-4 p-3">
          <div className="space-y-2">
            <WorkspaceNavButton
              active={workspaceSection === "overview"}
              count={projectStats.total - projectStats.archived}
              label="Overview"
              onClick={() => onWorkspaceSectionChange("overview")}
            />
            <WorkspaceNavButton
              active={workspaceSection === "due-review"}
              count={projectStats.dueReview}
              label="Due Review"
              onClick={() => onWorkspaceSectionChange("due-review")}
            />
            <WorkspaceNavButton
              active={workspaceSection === "archived"}
              count={projectStats.archived}
              label="Archived"
              onClick={() => onWorkspaceSectionChange("archived")}
            />
          </div>

          <div className="space-y-2 rounded-[1rem] border border-[var(--xidea-border)] bg-[var(--xidea-white)] p-3">
            <p className="xidea-kicker text-[var(--xidea-stone)]">Recent Sessions</p>
            {selectedProjectSessions.length > 0 ? (
              selectedProjectSessions.slice(0, 4).map((session) => (
                <SessionCard
                  active={false}
                  key={session.id}
                  onClick={() => onOpenSession(session.id)}
                  title={session.title}
                  type={session.type}
                  updatedAt={session.updatedAt}
                />
              ))
            ) : (
              <p className="text-sm text-[var(--xidea-stone)]">这个 project 还没有 session。</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card className="rounded-[1.35rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
          <CardContent className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div className="space-y-2">
              <p className="xidea-kicker text-[var(--xidea-selection-text)]">Profile Summary</p>
              <p className="text-sm font-medium text-[var(--xidea-near-black)]">
                当前阶段：{profileSummary.title}
              </p>
              <p className="text-sm leading-6 text-[var(--xidea-charcoal)]">
                {profileSummary.evidence}
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <MetricTile label="未学" tone="amber" value={`${projectStats.unlearned}`} />
              <MetricTile label="待复习" tone="sky" value={`${projectStats.dueReview}`} />
              <MetricTile label="已归档" tone="rose" value={`${projectStats.archived}`} />
            </div>
          </CardContent>
        </Card>
        {pendingSessionIntent ? (
          <Card className="rounded-[1.35rem] border-[var(--xidea-selection-border)] bg-[#fcf8f4] shadow-none">
            <CardContent className="space-y-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <p className="xidea-kicker text-[var(--xidea-selection-text)]">Start Session</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <SessionTypeBadge type={pendingSessionIntent.type} />
                    <p className="text-sm font-medium text-[var(--xidea-near-black)]">
                      {pendingSessionIntent.knowledgePointTitle
                        ? `围绕「${pendingSessionIntent.knowledgePointTitle}」开始一轮${pendingSessionIntent.type === "study" ? "学习" : "复习"}`
                        : `开始一轮${pendingSessionIntent.type === "study" ? "学习" : "复习"}`}
                    </p>
                  </div>
                  <p className="text-sm leading-6 text-[var(--xidea-charcoal)]">
                    先输入你真正想推进的问题；发送后才会创建 session。
                  </p>
                </div>
                <Button className="rounded-full" onClick={onCancelPendingSession} type="button" variant="outline">
                  取消
                </Button>
              </div>
              <div className="relative">
                <Textarea
                  className="min-h-28 rounded-[1rem] border-[var(--xidea-sand)] bg-[var(--xidea-ivory)] pr-28 pb-12 text-sm leading-7 text-[var(--xidea-charcoal)] shadow-none focus-visible:ring-[var(--xidea-selection-border)]"
                  onChange={(event) => onChangePendingPrompt(event.target.value)}
                  placeholder={
                    pendingSessionIntent.type === "study"
                      ? "例如：先帮我判断这个知识点最容易混淆的边界，再决定应该怎么学。"
                      : "例如：先帮我检查我对这个知识点的理解是否稳定，再安排复习。"
                  }
                  value={pendingPrompt}
                />
                <Button
                  className="absolute bottom-3 right-3 rounded-full bg-[var(--xidea-terracotta)] px-4 text-[var(--xidea-ivory)] hover:bg-[var(--xidea-terracotta)]/90"
                  disabled={pendingPrompt.trim() === ""}
                  onClick={onSubmitPendingPrompt}
                  type="button"
                >
                  发送并创建
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}
        {filteredKnowledgePoints.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredKnowledgePoints.map((point) => (
              <KnowledgePointCard
                key={point.id}
                onClick={() => onOpenKnowledgePoint(point.id)}
                point={point}
              />
            ))}
          </div>
        ) : (
          <Card className="rounded-[1.3rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
            <CardContent className="px-5 py-6 text-sm text-[var(--xidea-stone)]">
              {normalizedSearchQuery === ""
                ? "当前筛选下还没有知识点，可以先补材料，或从已有 session 继续推进。"
                : "没找到匹配的 knowledge point，可以换个关键词再试。"}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
