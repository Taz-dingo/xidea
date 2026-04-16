import type { AgentReviewInspector } from "@/domain/agent-runtime";
import { getProjectStats, type KnowledgePointItem, type ProjectItem, type SessionItem } from "@/domain/project-workspace";
import type { SourceAsset } from "@/domain/types";
import type {
  BrowseProfileSummary,
  HomeSectionCounts,
  HomeSectionSelectionParams,
  KnowledgeReviewSummaryParams,
  ProjectSummaryItem,
  RelatedKnowledgeParams,
} from "@/app/project-workspace-controller-types";

export function getSelectedProject(
  projects: ReadonlyArray<ProjectItem>,
  selectedProjectId: string,
  initialProject: ProjectItem,
): ProjectItem {
  return projects.find((project) => project.id === selectedProjectId) ?? projects[0] ?? initialProject;
}

export function getSelectedProjectKnowledgePoints(
  knowledgePoints: ReadonlyArray<KnowledgePointItem>,
  projectId: string,
): ReadonlyArray<KnowledgePointItem> {
  return knowledgePoints.filter((point) => point.projectId === projectId);
}

export function getSelectedKnowledgePoint(
  points: ReadonlyArray<KnowledgePointItem>,
  selectedKnowledgePointId: string,
): KnowledgePointItem | null {
  return points.find((point) => point.id === selectedKnowledgePointId) ?? points[0] ?? null;
}

export function getSelectedKnowledgePointAssets(
  assets: ReadonlyArray<SourceAsset>,
  point: KnowledgePointItem | null,
): ReadonlyArray<SourceAsset> {
  return point === null
    ? []
    : assets.filter((asset) => point.sourceAssetIds.includes(asset.id));
}

export function getSelectedProjectSessions(
  sessions: ReadonlyArray<SessionItem>,
  projectId: string,
): ReadonlyArray<SessionItem> {
  return sessions.filter((session) => session.projectId === projectId);
}

export function getKnowledgePointRelatedSessions(
  selectedKnowledgePoint: KnowledgePointItem | null,
  selectedProjectSessions: ReadonlyArray<SessionItem>,
): ReadonlyArray<SessionItem> {
  return selectedKnowledgePoint === null
    ? []
    : selectedProjectSessions.filter(
        (session) => session.knowledgePointId === selectedKnowledgePoint.id,
      );
}

export function getKnowledgePointReviewInspectors(
  sessions: ReadonlyArray<SessionItem>,
  sessionReviewInspectors: Record<string, AgentReviewInspector | null>,
): ReadonlyArray<AgentReviewInspector> {
  return sessions
    .map((session) => sessionReviewInspectors[session.id])
    .filter(
      (inspector): inspector is AgentReviewInspector =>
        inspector !== null && inspector !== undefined,
    );
}

export function getSelectedProjectMaterials(
  assets: ReadonlyArray<SourceAsset>,
  projectMaterialIds: ReadonlyArray<string>,
): ReadonlyArray<SourceAsset> {
  return assets.filter((asset) => projectMaterialIds.includes(asset.id));
}

export function getVisibleKnowledgePoints(
  selectedProjectKnowledgePoints: ReadonlyArray<KnowledgePointItem>,
  workspaceSection: "overview" | "due-review" | "archived",
): ReadonlyArray<KnowledgePointItem> {
  switch (workspaceSection) {
    case "archived":
      return selectedProjectKnowledgePoints.filter((point) => point.status === "archived");
    case "due-review":
      return selectedProjectKnowledgePoints.filter((point) => point.status === "active_review");
    case "overview":
      return selectedProjectKnowledgePoints.filter((point) => point.status !== "archived");
  }
}

export function getProjectSummaries(
  projects: ReadonlyArray<ProjectItem>,
  knowledgePoints: ReadonlyArray<KnowledgePointItem>,
): ReadonlyArray<ProjectSummaryItem> {
  return projects.map((project) => ({
    project,
    stats: getProjectStats(knowledgePoints.filter((point) => point.projectId === project.id)),
  }));
}

export function getRecentProjectSummaries(
  projectSummaries: ReadonlyArray<ProjectSummaryItem>,
  getRelativeTimeRank: (label: string) => number,
): ReadonlyArray<ProjectSummaryItem> {
  return [...projectSummaries]
    .sort(
      (left, right) =>
        getRelativeTimeRank(right.project.updatedAt) -
        getRelativeTimeRank(left.project.updatedAt),
    )
    .slice(0, Math.min(projectSummaries.length, 4));
}

export function getHomeSectionCounts(
  projectSummaries: ReadonlyArray<ProjectSummaryItem>,
  recentProjectSummaries: ReadonlyArray<ProjectSummaryItem>,
): HomeSectionCounts {
  return {
    recent: recentProjectSummaries.length,
    dueReview: projectSummaries.filter(({ stats }) => stats.dueReview > 0).length,
    archived: projectSummaries.filter(({ stats }) => stats.archived > 0).length,
  };
}

export function getHomeSectionProjectSummaries({
  homeSection,
  projectSummaries,
  recentProjectSummaries,
}: HomeSectionSelectionParams): ReadonlyArray<ProjectSummaryItem> {
  switch (homeSection) {
    case "all-projects":
      return projectSummaries;
    case "recent":
      return recentProjectSummaries;
    case "due-review":
      return projectSummaries.filter(({ stats }) => stats.dueReview > 0);
    case "archived":
      return projectSummaries.filter(({ stats }) => stats.archived > 0);
  }
}

export function filterProjectSummaries(
  projectSummaries: ReadonlyArray<ProjectSummaryItem>,
  normalizedSearchQuery: string,
): ReadonlyArray<ProjectSummaryItem> {
  if (normalizedSearchQuery === "") {
    return projectSummaries;
  }

  return projectSummaries.filter(({ project }) =>
    [project.name, project.topic, project.description]
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearchQuery),
  );
}

export function filterKnowledgePoints(
  knowledgePoints: ReadonlyArray<KnowledgePointItem>,
  normalizedSearchQuery: string,
): ReadonlyArray<KnowledgePointItem> {
  if (normalizedSearchQuery === "") {
    return knowledgePoints;
  }

  return knowledgePoints.filter((point) =>
    [point.title, point.description, point.stageLabel]
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearchQuery),
  );
}

export function getBrowseProfileSummary(title: string, evidence: string): BrowseProfileSummary {
  return {
    title: title.replace("系统当前把这个 session 视为", "").replace(/[「」]/g, ""),
    evidence,
  };
}

export function getStudyTargetPoint(
  selectedKnowledgePoint: KnowledgePointItem | null,
  selectedProjectKnowledgePoints: ReadonlyArray<KnowledgePointItem>,
): KnowledgePointItem | null {
  return (
    (selectedKnowledgePoint?.status === "active_unlearned" ? selectedKnowledgePoint : null) ??
    selectedProjectKnowledgePoints.find((point) => point.status === "active_unlearned") ??
    selectedKnowledgePoint
  );
}

export function getReviewTargetPoint(
  selectedKnowledgePoint: KnowledgePointItem | null,
  selectedProjectKnowledgePoints: ReadonlyArray<KnowledgePointItem>,
): KnowledgePointItem | null {
  return (
    (selectedKnowledgePoint?.status === "active_review" ? selectedKnowledgePoint : null) ??
    selectedProjectKnowledgePoints.find((point) => point.status === "active_review") ??
    selectedKnowledgePoint
  );
}

export function getRelatedKnowledgePoints({
  selectedKnowledgePoint,
  selectedProjectKnowledgePoints,
  selectedSession,
}: RelatedKnowledgeParams): ReadonlyArray<KnowledgePointItem> {
  if (
    selectedSession?.knowledgePointId !== null &&
    selectedSession?.knowledgePointId !== undefined
  ) {
    return selectedProjectKnowledgePoints.filter(
      (point) => point.id === selectedSession.knowledgePointId,
    );
  }

  if (selectedKnowledgePoint !== null) {
    return [selectedKnowledgePoint];
  }

  return selectedProjectKnowledgePoints.slice(0, 3);
}

export function getKnowledgePointReviewHistorySummary({
  knowledgePointReviewInspectors,
}: KnowledgeReviewSummaryParams): string {
  return knowledgePointReviewInspectors.length > 0
    ? "热力图汇总这个知识点在相关 sessions 里的复习安排与完成记录。"
    : "当前还没有回读到这个知识点的真实复习记录；打开相关 session 后会回填热力图。";
}
