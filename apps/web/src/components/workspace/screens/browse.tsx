import type { ReactElement } from "react";
import { GraduationCap, MessageSquareText, RefreshCcw } from "lucide-react";
import type {
  KnowledgePointItem,
  ProjectStats,
  SessionItem,
  SessionType,
  WorkspaceSection,
} from "@/domain/project-workspace";
import { getSessionTypeDescription } from "@/domain/project-workspace";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  KnowledgePointCard,
  SessionTypeBadge,
} from "@/components/workspace/core";
import { SessionListSection } from "@/components/workspace/session-list";
import { WorkspaceNavButton } from "@/components/workspace/monitor";

export function WorkspaceBrowseScreen({
  filteredKnowledgePoints,
  isEditingProjectMeta,
  normalizedSearchQuery,
  onCancelPendingSession,
  onChangePendingPrompt,
  onOpenKnowledgePoint,
  onOpenSession,
  onStartProjectSession,
  onStartReview,
  onStartStudy,
  onSubmitPendingPrompt,
  pendingPrompt,
  pendingSessionIntent,
  projectStats,
  reviewDisabled,
  selectedProjectSessions,
  studyDisabled,
  workspaceSection,
  onWorkspaceSectionChange,
}: {
  filteredKnowledgePoints: ReadonlyArray<KnowledgePointItem>;
  isEditingProjectMeta: boolean;
  normalizedSearchQuery: string;
  onCancelPendingSession: () => void;
  onChangePendingPrompt: (value: string) => void;
  onOpenKnowledgePoint: (pointId: string) => void;
  onOpenSession: (sessionId: string) => void;
  onStartProjectSession: () => void;
  onStartReview: () => void;
  onStartStudy: () => void;
  onSubmitPendingPrompt: () => void;
  pendingPrompt: string;
  pendingSessionIntent: {
    readonly type: SessionType;
    readonly knowledgePointTitle: string | null;
  } | null;
  projectStats: ProjectStats;
  reviewDisabled: boolean;
  selectedProjectSessions: ReadonlyArray<SessionItem>;
  studyDisabled: boolean;
  workspaceSection: WorkspaceSection;
  onWorkspaceSectionChange: (section: WorkspaceSection) => void;
}): ReactElement {
  const projectSessions = selectedProjectSessions.filter((session) => session.type === "project");
  const learningSessions = selectedProjectSessions.filter((session) => session.type !== "project");

  return (
    <div className="grid gap-4 lg:grid-cols-[312px_minmax(0,1fr)]">
      <Card className="rounded-[1.4rem] border-[var(--xidea-border)] bg-[#f1f0ea] shadow-none">
        <CardContent className="space-y-4 p-3">
          <div className="space-y-2">
            <WorkspaceNavButton
              active={workspaceSection === "overview"}
              count={projectStats.total - projectStats.archived}
              label="总览"
              onClick={() => onWorkspaceSectionChange("overview")}
            />
            <WorkspaceNavButton
              active={workspaceSection === "due-review"}
              count={projectStats.dueReview}
              label="待复习"
              onClick={() => onWorkspaceSectionChange("due-review")}
            />
            <WorkspaceNavButton
              active={workspaceSection === "archived"}
              count={projectStats.archived}
              label="已归档"
              onClick={() => onWorkspaceSectionChange("archived")}
            />
          </div>

          <SessionListSection
            actions={
              <Button
                className="h-10 w-full rounded-[0.9rem] border-[var(--xidea-selection-border)] bg-[var(--xidea-white)] text-[var(--xidea-near-black)] hover:bg-[var(--xidea-selection)]"
                onClick={onStartProjectSession}
                type="button"
                variant="outline"
              >
                <MessageSquareText className="h-4 w-4" />
                研讨
              </Button>
            }
            description={getSessionTypeDescription("project")}
            emptyText="当前还没有研讨会话。"
            onOpenSession={onOpenSession}
            sessions={projectSessions}
            showTypeBadge={false}
            title="研讨会话"
          />

          <SessionListSection
            actions={
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  className="h-10 min-w-0 rounded-[0.9rem] bg-[var(--xidea-terracotta)] text-[var(--xidea-ivory)] hover:bg-[var(--xidea-terracotta)]/90"
                  disabled={studyDisabled}
                  onClick={onStartStudy}
                  type="button"
                >
                  <GraduationCap className="h-4 w-4" />
                  学习
                </Button>
                <Button
                  className="h-10 min-w-0 rounded-[0.9rem] border-[var(--xidea-selection-border)] bg-[var(--xidea-white)] hover:bg-[var(--xidea-selection)]"
                  disabled={reviewDisabled}
                  onClick={onStartReview}
                  type="button"
                  variant="outline"
                >
                  <RefreshCcw className="h-4 w-4" />
                  复习
                </Button>
              </div>
            }
            description="学习负责推进新知识，复习负责回拉和校准。"
            emptyText="当前还没有学习或复习会话。"
            onOpenSession={onOpenSession}
            sessions={learningSessions}
            title="学习与复习"
          />
        </CardContent>
      </Card>

      <div className="space-y-4">
        {pendingSessionIntent ? (
          <Card className="rounded-[1.35rem] border-[var(--xidea-selection-border)] bg-[#fcf8f4] shadow-none">
            <CardContent className="space-y-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <p className="xidea-kicker text-[var(--xidea-selection-text)]">准备开始</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <SessionTypeBadge type={pendingSessionIntent.type} />
                    <p className="text-sm font-medium text-[var(--xidea-near-black)]">
                      {pendingSessionIntent.type === "project"
                        ? "开始一轮研讨"
                        : pendingSessionIntent.knowledgePointTitle
                          ? `围绕「${pendingSessionIntent.knowledgePointTitle}」开始一轮${pendingSessionIntent.type === "study" ? "学习" : "复习"}`
                          : `开始一轮${pendingSessionIntent.type === "study" ? "学习" : "复习"}`}
                    </p>
                  </div>
                  <p className="text-sm leading-6 text-[var(--xidea-charcoal)]">
                    {pendingSessionIntent.type === "project"
                      ? "先说清这轮想推进的方向、材料或问题，再进入会话。"
                      : "先说清这轮真正想验证什么，再进入会话。"}
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
                    pendingSessionIntent.type === "project"
                      ? "例如：先围绕这个主题梳理材料线索，并指出还缺哪几个关键知识点。"
                      : pendingSessionIntent.type === "study"
                        ? "例如：先帮我找出这个知识点最容易混淆的边界。"
                        : "例如：先检查我对这个知识点的判断是不是稳定。"
                  }
                  value={pendingPrompt}
                />
                <Button
                  className="absolute bottom-3 right-3 rounded-full bg-[var(--xidea-terracotta)] px-4 text-[var(--xidea-ivory)] hover:bg-[var(--xidea-terracotta)]/90"
                  disabled={pendingPrompt.trim() === ""}
                  onClick={onSubmitPendingPrompt}
                  type="button"
                >
                  发送并开始
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {filteredKnowledgePoints.length > 0 ? (
          <Card className="rounded-[1.35rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
            <CardContent className="space-y-4 p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="space-y-1">
                  <p className="xidea-kicker text-[var(--xidea-selection-text)]">知识卡</p>
                  <p className="text-sm leading-6 text-[var(--xidea-charcoal)]">
                    当前共 {filteredKnowledgePoints.length} 张，展示当前工作区里的活跃知识卡。
                  </p>
                </div>
                <p className="text-[12px] text-[var(--xidea-stone)]">
                  {workspaceSection === "overview"
                    ? "展示当前活跃知识卡"
                    : workspaceSection === "due-review"
                      ? "展示待复习知识卡"
                      : "展示已归档知识卡"}
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredKnowledgePoints.map((point) => (
                  <KnowledgePointCard
                    key={point.id}
                    onClick={() => onOpenKnowledgePoint(point.id)}
                    point={point}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-[1.3rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
            <CardContent className="px-5 py-6 text-sm text-[var(--xidea-stone)]">
              {normalizedSearchQuery === ""
                ? "当前筛选下还没有知识卡，可以先补材料或继续研讨。"
                : "没找到匹配的知识卡，换个关键词再试。"}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
