import type { ReactElement, ReactNode } from "react";
import { Plus, RefreshCcw, Sparkles } from "lucide-react";
import type {
  KnowledgePointItem,
  ProjectItem,
  ProjectStats,
  SessionItem,
  WorkspaceSection,
} from "@/domain/project-workspace";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  KnowledgePointCard,
  MetricTile,
  SessionCard,
  WorkspaceNavButton,
} from "@/components/project-workspace-primitives";

interface ProjectCardSummary {
  readonly project: ProjectItem;
  readonly stats: ProjectStats;
}

export function HomeScreen({
  continueProject,
  continueActionLabel,
  continueProjectStats,
  filteredProjects,
  onContinueProject,
  onOpenProject,
  onStartReview,
  totalProjects,
}: {
  continueProject: ProjectItem;
  continueActionLabel: string;
  continueProjectStats: ProjectStats;
  filteredProjects: ReadonlyArray<ProjectCardSummary>;
  onContinueProject: () => void;
  onOpenProject: (projectId: string) => void;
  onStartReview: () => void;
  totalProjects: number;
}): ReactElement {
  return (
    <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
      <Card className="rounded-[1.4rem] border-[var(--xidea-border)] bg-[#f1f0ea] shadow-none">
        <CardContent className="space-y-2 p-3">
          <WorkspaceNavButton active count={totalProjects} label="All Projects" onClick={() => undefined} />
          <WorkspaceNavButton active={false} count={1} label="Recent" onClick={() => undefined} />
          <WorkspaceNavButton
            active={false}
            count={continueProjectStats.dueReview}
            label="Due Review"
            onClick={() => undefined}
          />
          <WorkspaceNavButton
            active={false}
            count={continueProjectStats.archived}
            label="Archived"
            onClick={() => undefined}
          />
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card className="rounded-[1.5rem] border-[var(--xidea-border)] bg-[var(--xidea-ivory)] shadow-none">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="xidea-kicker text-[var(--xidea-selection-text)]">Continue</p>
                <h2 className="text-xl font-medium text-[var(--xidea-near-black)]">
                  {continueProject.name}
                </h2>
                <p className="max-w-3xl text-sm leading-7 text-[var(--xidea-charcoal)]">
                  {continueProject.description}
                </p>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--xidea-selection)] text-[var(--xidea-selection-text)]">
                <Sparkles className="h-5 w-5" />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <MetricTile label="知识点" tone="amber" value={`${continueProjectStats.total} 个`} />
              <MetricTile label="待复习" tone="sky" value={`${continueProjectStats.dueReview} 个`} />
              <MetricTile label="下一步" tone="emerald" value={continueActionLabel} />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                className="rounded-full bg-[var(--xidea-terracotta)] text-[var(--xidea-ivory)] hover:bg-[var(--xidea-terracotta)]/90"
                onClick={onContinueProject}
                type="button"
              >
                继续 Project
              </Button>
              <Button className="rounded-full" onClick={onStartReview} type="button" variant="outline">
                <RefreshCcw className="h-4 w-4" />
                开始复习
              </Button>
            </div>
          </CardContent>
        </Card>

        {filteredProjects.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredProjects.map(({ project, stats }) => (
              <Card
                className="rounded-[1.35rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none"
                key={project.id}
              >
                <CardContent className="space-y-4 p-5">
                  <div className="space-y-2">
                    <p className="text-base font-medium text-[var(--xidea-near-black)]">
                      {project.name}
                    </p>
                    <p className="text-sm leading-6 text-[var(--xidea-charcoal)]">
                      {project.topic}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <MetricTile label="知识点" tone="amber" value={`${stats.total}`} />
                    <MetricTile label="待复习" tone="sky" value={`${stats.dueReview}`} />
                  </div>
                  <p className="text-[12px] text-[var(--xidea-stone)]">
                    最近更新：{project.updatedAt}
                  </p>
                  <Button
                    className="w-full rounded-full"
                    onClick={() => onOpenProject(project.id)}
                    type="button"
                    variant="outline"
                  >
                    进入
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="rounded-[1.3rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
            <CardContent className="px-5 py-6 text-sm text-[var(--xidea-stone)]">
              没找到匹配的 project，可以换个关键词再试。
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export function WorkspaceBrowseScreen({
  archiveConfirmation,
  batchActions,
  createKnowledgePointPanel,
  filteredKnowledgePoints,
  normalizedSearchQuery,
  onOpenKnowledgePoint,
  onOpenSession,
  onStartCreatingKnowledgePoint,
  onToggleKnowledgePointSelection,
  profileSummary,
  projectStats,
  selectedKnowledgePointIds,
  selectedProjectSessions,
  workspaceSection,
  onWorkspaceSectionChange,
}: {
  archiveConfirmation: ReactNode;
  batchActions: ReactNode;
  createKnowledgePointPanel: ReactNode;
  filteredKnowledgePoints: ReadonlyArray<KnowledgePointItem>;
  normalizedSearchQuery: string;
  onOpenKnowledgePoint: (pointId: string) => void;
  onOpenSession: (sessionId: string) => void;
  onStartCreatingKnowledgePoint: () => void;
  onToggleKnowledgePointSelection: (pointId: string) => void;
  profileSummary: {
    readonly title: string;
    readonly evidence: string;
  };
  projectStats: ProjectStats;
  selectedKnowledgePointIds: ReadonlyArray<string>;
  selectedProjectSessions: ReadonlyArray<SessionItem>;
  workspaceSection: WorkspaceSection;
  onWorkspaceSectionChange: (section: WorkspaceSection) => void;
}): ReactElement {
  return (
    <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
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

        <Card className="rounded-[1.35rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
          <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <p className="xidea-kicker text-[var(--xidea-selection-text)]">Knowledge Point Pool</p>
              <p className="text-sm leading-6 text-[var(--xidea-charcoal)]">
                先把项目里的知识点补齐，再决定哪些进入学习、哪些进入复习。
              </p>
            </div>
            <Button className="rounded-full" onClick={onStartCreatingKnowledgePoint} type="button" variant="outline">
              <Plus className="h-4 w-4" />
              新增 Knowledge Point
            </Button>
          </CardContent>
        </Card>

        {createKnowledgePointPanel}
        {archiveConfirmation}
        {batchActions}

        {filteredKnowledgePoints.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredKnowledgePoints.map((point) => (
              <KnowledgePointCard
                key={point.id}
                onClick={() => onOpenKnowledgePoint(point.id)}
                onToggleSelect={() => onToggleKnowledgePointSelection(point.id)}
                point={point}
                selected={selectedKnowledgePointIds.includes(point.id)}
              />
            ))}
          </div>
        ) : (
          <Card className="rounded-[1.3rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
            <CardContent className="px-5 py-6 text-sm text-[var(--xidea-stone)]">
              {normalizedSearchQuery === ""
                ? "当前筛选下还没有知识点，可以先新增一个 Knowledge Point，或直接开始新的 project session。"
                : "没找到匹配的 knowledge point，可以换个关键词再试。"}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
