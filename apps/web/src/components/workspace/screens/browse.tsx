import type { ReactElement } from "react";
import { Brain } from "lucide-react";
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
  MetricTile,
  SessionCard,
  SessionTypeBadge,
} from "@/components/workspace/core";
import { ReviewHeatmap, WorkspaceNavButton } from "@/components/workspace/monitor";
import type { ReviewHeatmapCell } from "@/domain/review-heatmap";

function MasteryPortrait({
  projectStats,
}: {
  projectStats: ProjectStats;
}): ReactElement {
  const totalPoints = Math.max(projectStats.total, 1);
  const masteredRatio = (projectStats.total - projectStats.unlearned - projectStats.dueReview) / totalPoints;
  const stablePercent = Math.max(12, Math.round(masteredRatio * 100));

  return (
    <div className="flex items-center gap-4">
      <div className="relative flex h-24 w-24 items-center justify-center rounded-[1.6rem] border border-[var(--xidea-border)] bg-[linear-gradient(180deg,#fffaf5_0%,#f6efe9_100%)]">
        <div
          className="absolute inset-[18%] rounded-[1.2rem] bg-[radial-gradient(circle_at_50%_35%,rgba(201,100,66,0.22),transparent_55%),radial-gradient(circle_at_50%_78%,rgba(127,158,183,0.2),transparent_52%)]"
          style={{ opacity: stablePercent / 100 }}
        />
        <div className="relative flex h-12 w-12 items-center justify-center rounded-full border border-[var(--xidea-selection-border)] bg-[var(--xidea-white)] text-[var(--xidea-selection-text)]">
          <Brain className="h-6 w-6" />
        </div>
        <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[#c96442]" />
        <span className="absolute bottom-3 left-3 h-2.5 w-2.5 rounded-full bg-[#7f9eb7]" />
        <span className="absolute bottom-4 right-4 h-2 w-2 rounded-full bg-[#b98a4a]" />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium text-[var(--xidea-near-black)]">学习画像</p>
        <p className="text-sm leading-6 text-[var(--xidea-charcoal)]">
          当前稳定掌握约 {stablePercent}% ，其余内容仍在学习或等待复习。
        </p>
        <div className="flex flex-wrap gap-2">
          <SessionTypeBadge type="project" />
          <span className="rounded-full border border-[var(--xidea-border)] bg-[var(--xidea-parchment)] px-3 py-1 text-[12px] text-[var(--xidea-stone)]">
            未学 {projectStats.unlearned}
          </span>
          <span className="rounded-full border border-[var(--xidea-border)] bg-[var(--xidea-parchment)] px-3 py-1 text-[12px] text-[var(--xidea-stone)]">
            待复习 {projectStats.dueReview}
          </span>
        </div>
      </div>
    </div>
  );
}

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
  projectReviewHeatmap,
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
  projectReviewHeatmap: ReadonlyArray<ReadonlyArray<ReviewHeatmapCell>>;
  projectStats: ProjectStats;
  selectedProjectSessions: ReadonlyArray<SessionItem>;
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

          <div className="space-y-2 rounded-[1rem] border border-[var(--xidea-border)] bg-[var(--xidea-white)] p-3">
            <div className="space-y-1">
              <p className="xidea-kicker text-[var(--xidea-stone)]">研讨会话</p>
              <p className="text-sm leading-6 text-[var(--xidea-stone)]">
                {getSessionTypeDescription("project")}
              </p>
            </div>
            {projectSessions.length > 0 ? (
              projectSessions.map((session) => (
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
              <p className="text-sm text-[var(--xidea-stone)]">当前还没有研讨会话。</p>
            )}
          </div>

          <div className="space-y-2 rounded-[1rem] border border-[var(--xidea-border)] bg-[var(--xidea-white)] p-3">
            <div className="space-y-1">
              <p className="xidea-kicker text-[var(--xidea-stone)]">学习与复习</p>
              <p className="text-sm leading-6 text-[var(--xidea-stone)]">
                学习负责推进新知识，复习负责回拉和校准。
              </p>
            </div>
            {learningSessions.length > 0 ? (
              learningSessions.map((session) => (
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
              <p className="text-sm text-[var(--xidea-stone)]">当前还没有学习或复习会话。</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card className="xidea-card-motion rounded-[1.35rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
          <CardContent className="space-y-5 p-5">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.56fr)]">
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="xidea-kicker text-[var(--xidea-selection-text)]">学习画像</p>
                  <p className="text-sm font-medium text-[var(--xidea-near-black)]">
                    {profileSummary.title}
                  </p>
                  <p className="text-sm leading-6 text-[var(--xidea-charcoal)]">
                    {profileSummary.evidence}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)]">
                  <MasteryPortrait projectStats={projectStats} />
                  <div className="grid gap-2 sm:grid-cols-3">
                    <MetricTile label="未学" tone="amber" value={`${projectStats.unlearned}`} />
                    <MetricTile label="待复习" tone="sky" value={`${projectStats.dueReview}`} />
                    <MetricTile label="已归档" tone="rose" value={`${projectStats.archived}`} />
                  </div>
                </div>
              </div>

              <div className="rounded-[1.2rem] border border-[var(--xidea-border)] bg-[var(--xidea-ivory)] p-4">
                <div className="mb-3 space-y-1">
                  <p className="xidea-kicker text-[var(--xidea-stone)]">复习热力图</p>
                  <p className="text-sm leading-6 text-[var(--xidea-charcoal)]">
                    悬停查看每天做了哪些学习或复习动作。
                  </p>
                </div>
                <ReviewHeatmap compact weeks={projectReviewHeatmap} />
              </div>
            </div>
          </CardContent>
        </Card>

        {pendingSessionIntent ? (
          <Card className="rounded-[1.35rem] border-[var(--xidea-selection-border)] bg-[#fcf8f4] shadow-none">
            <CardContent className="space-y-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <p className="xidea-kicker text-[var(--xidea-selection-text)]">准备开始</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <SessionTypeBadge type={pendingSessionIntent.type} />
                    <p className="text-sm font-medium text-[var(--xidea-near-black)]">
                      {pendingSessionIntent.knowledgePointTitle
                        ? `围绕「${pendingSessionIntent.knowledgePointTitle}」开始一轮${pendingSessionIntent.type === "study" ? "学习" : "复习"}`
                        : `开始一轮${pendingSessionIntent.type === "study" ? "学习" : "复习"}`}
                    </p>
                  </div>
                  <p className="text-sm leading-6 text-[var(--xidea-charcoal)]">
                    先说清这轮真正想验证什么，再进入会话。
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
                    当前共 {filteredKnowledgePoints.length} 张，点击可直接查看详情、关联会话和材料。
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
