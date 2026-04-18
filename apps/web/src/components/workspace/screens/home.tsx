import type { ReactElement } from "react";
import { FolderKanban, RefreshCcw, Sparkles } from "lucide-react";
import type { HomeSection, ProjectItem, ProjectStats } from "@/domain/project-workspace";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MetricTile } from "@/components/workspace/core";
import { WorkspaceNavButton } from "@/components/workspace/monitor";

interface ProjectCardSummary {
  readonly project: ProjectItem;
  readonly stats: ProjectStats;
}

export function HomeScreen({
  continueProjectSummary,
  continueActionLabel,
  filteredProjects,
  homeSection,
  homeSectionCounts,
  onContinueProject,
  onHomeSectionChange,
  onOpenProject,
  onStartReview,
  totalProjects,
}: {
  continueProjectSummary: ProjectCardSummary | null;
  continueActionLabel: string | null;
  filteredProjects: ReadonlyArray<ProjectCardSummary>;
  homeSection: HomeSection;
  homeSectionCounts: {
    readonly recent: number;
    readonly dueReview: number;
    readonly archived: number;
  };
  onContinueProject: () => void;
  onHomeSectionChange: (section: HomeSection) => void;
  onOpenProject: (projectId: string) => void;
  onStartReview: () => void;
  totalProjects: number;
}): ReactElement {
  return (
    <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
      <Card className="rounded-[1.4rem] border-[var(--xidea-border)] bg-[#f1f0ea] shadow-none">
        <CardContent className="space-y-2 p-3">
          <WorkspaceNavButton
            active={homeSection === "all-projects"}
            count={totalProjects}
            label="全部项目"
            onClick={() => onHomeSectionChange("all-projects")}
          />
          <WorkspaceNavButton
            active={homeSection === "recent"}
            count={homeSectionCounts.recent}
            label="最近打开"
            onClick={() => onHomeSectionChange("recent")}
          />
          <WorkspaceNavButton
            active={homeSection === "due-review"}
            count={homeSectionCounts.dueReview}
            label="待复习"
            onClick={() => onHomeSectionChange("due-review")}
          />
          <WorkspaceNavButton
            active={homeSection === "archived"}
            count={homeSectionCounts.archived}
            label="已归档"
            onClick={() => onHomeSectionChange("archived")}
          />
        </CardContent>
      </Card>

      <div className="space-y-4">
        {continueProjectSummary ? (
          <Card className="rounded-[1.5rem] border-[var(--xidea-border)] bg-[linear-gradient(180deg,#fffaf4_0%,#f7efe6_100%)] shadow-none">
            <CardContent className="space-y-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="xidea-kicker text-[var(--xidea-selection-text)]">继续推进</p>
                  <div className="flex items-center gap-2">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--xidea-selection)] text-[var(--xidea-selection-text)]">
                      <FolderKanban className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-lg font-medium text-[var(--xidea-near-black)]">
                        {continueProjectSummary.project.name}
                      </h2>
                      <p className="text-sm text-[var(--xidea-charcoal)]">
                        {continueProjectSummary.project.topic}
                      </p>
                    </div>
                  </div>
                  <p className="max-w-3xl text-sm leading-6 text-[var(--xidea-charcoal)]">
                    {continueActionLabel ?? "继续当前研讨"}
                  </p>
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--xidea-selection)] text-[var(--xidea-selection-text)]">
                  <Sparkles className="h-5 w-5" />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <MetricTile
                  label="知识点"
                  tone="amber"
                  value={`${continueProjectSummary.stats.total} 个`}
                />
                <MetricTile
                  label="待复习"
                  tone="sky"
                  value={`${continueProjectSummary.stats.dueReview} 个`}
                />
                <MetricTile
                  label="最近更新"
                  tone="emerald"
                  value={continueProjectSummary.project.updatedAt}
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  className="rounded-full bg-[var(--xidea-terracotta)] text-[var(--xidea-ivory)] hover:bg-[var(--xidea-terracotta)]/90"
                  onClick={onContinueProject}
                  type="button"
                >
                  进入项目
                </Button>
                <Button className="rounded-full" onClick={onStartReview} type="button" variant="outline">
                  <RefreshCcw className="h-4 w-4" />
                  开始复习
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {filteredProjects.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredProjects.map(({ project, stats }) => (
              <Card
                className="group rounded-[1.35rem] border-[#ded3c6] bg-[linear-gradient(180deg,#fffefb_0%,#f7f0e8_100%)] shadow-none transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--xidea-selection-border)] hover:shadow-[0_18px_36px_rgba(177,112,82,0.08)]"
                key={project.id}
              >
                <CardContent className="space-y-4 p-5">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="xidea-kicker text-[var(--xidea-selection-text)]">项目</p>
                        <p className="text-base font-medium text-[var(--xidea-near-black)]">
                          {project.name}
                        </p>
                      </div>
                      <span className="text-[12px] text-[var(--xidea-stone)]">{project.updatedAt}</span>
                    </div>
                    <p className="text-sm leading-6 text-[var(--xidea-charcoal)]">
                      {project.description}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <MetricTile label="知识点" tone="amber" value={`${stats.total}`} />
                    <MetricTile label="待复习" tone="sky" value={`${stats.dueReview}`} />
                  </div>
                  <p className="text-sm text-[var(--xidea-charcoal)]">
                    当前主题：{project.topic}
                  </p>
                  <Button
                    className="w-full rounded-full border-[var(--xidea-selection-border)] group-hover:bg-[var(--xidea-selection)]"
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
              没找到匹配的项目，可以换个关键词再试。
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
