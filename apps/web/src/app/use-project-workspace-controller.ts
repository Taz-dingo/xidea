import { useMemo } from "react";
import { getProjectStats, getNextSuggestedAction } from "@/domain/project-workspace";
import {
  buildEmptyReviewHeatmap,
  buildReviewHeatmap,
  formatDateLabel,
  getLatestIsoDate,
} from "@/domain/review-heatmap";
import { getLatestReviewEvent, getRelativeTimeRank } from "@/domain/project-session-runtime";
import {
  filterKnowledgePoints,
  filterProjectSummaries,
  getBrowseProfileSummary,
  getHomeSectionCounts,
  getHomeSectionProjectSummaries,
  getKnowledgePointReviewHistorySummary,
  getProjectSummaries,
  getRecentProjectSummaries,
  getRelatedKnowledgePoints,
  getReviewTargetPoint,
  getStudyTargetPoint,
} from "@/app/project-workspace-selectors";
import { useProjectSessionAgent } from "@/app/use-project-session-agent";
import { useProjectWorkspaceActions } from "@/app/use-project-workspace-actions";
import { useProjectWorkspaceData } from "@/app/use-project-workspace-data";

export function useProjectWorkspaceController() {
  const data = useProjectWorkspaceData();
  const actions = useProjectWorkspaceActions(data);
  const session = useProjectSessionAgent({
    data,
    handleCreateSession: actions.handleCreateSession,
  });

  const projectStats = useMemo(
    () => getProjectStats(data.selectedProjectKnowledgePoints),
    [data.selectedProjectKnowledgePoints],
  );
  const projectMaterialCount = data.selectedProjectMaterials.length;
  const normalizedSearchQuery = data.searchQuery.trim().toLowerCase();
  const projectSummaries = useMemo(
    () => getProjectSummaries(data.projects, data.knowledgePoints),
    [data.knowledgePoints, data.projects],
  );
  const recentProjectSummaries = useMemo(
    () => getRecentProjectSummaries(projectSummaries, getRelativeTimeRank),
    [projectSummaries],
  );
  const homeSectionCounts = useMemo(
    () => getHomeSectionCounts(projectSummaries, recentProjectSummaries),
    [projectSummaries, recentProjectSummaries],
  );
  const homeSectionProjectSummaries = useMemo(
    () =>
      getHomeSectionProjectSummaries({
        homeSection: data.homeSection,
        projectSummaries,
        recentProjectSummaries,
      }),
    [data.homeSection, projectSummaries, recentProjectSummaries],
  );
  const filteredProjectSummaries = useMemo(
    () => filterProjectSummaries(homeSectionProjectSummaries, normalizedSearchQuery),
    [homeSectionProjectSummaries, normalizedSearchQuery],
  );
  const filteredKnowledgePoints = useMemo(
    () =>
      filterKnowledgePoints(
        data.selectedProjectKnowledgePoints.filter((point) => {
          switch (data.workspaceSection) {
            case "archived":
              return point.status === "archived";
            case "due-review":
              return point.status === "active_review";
            case "overview":
              return point.status !== "archived";
          }
        }),
        normalizedSearchQuery,
      ),
    [data.selectedProjectKnowledgePoints, data.workspaceSection, normalizedSearchQuery],
  );
  const continueProjectSummary = filteredProjectSummaries[0] ?? null;
  const continueProjectPoints = useMemo(
    () =>
      continueProjectSummary === null
        ? []
        : data.knowledgePoints.filter(
            (point) => point.projectId === continueProjectSummary.project.id,
          ),
    [continueProjectSummary, data.knowledgePoints],
  );
  const continueActionLabel =
    continueProjectSummary === null ? null : getNextSuggestedAction(continueProjectPoints);
  const continueReviewTargetPoint =
    continueProjectSummary === null
      ? null
      : continueProjectPoints.find((point) => point.status === "active_review") ?? null;
  const browseProfileSummary = getBrowseProfileSummary(
    session.generatedProfileSummary === ""
      ? "系统当前把这个 session 视为「待生成」"
      : `系统当前把这个 session 视为「${session.generatedProfileSummary}」`,
    session.activeRuntime.state.weakSignals[0] ?? "",
  );
  const studyTargetPoint = getStudyTargetPoint(
    data.selectedKnowledgePoint,
    data.selectedProjectKnowledgePoints,
  );
  const reviewTargetPoint = getReviewTargetPoint(
    data.selectedKnowledgePoint,
    data.selectedProjectKnowledgePoints,
  );
  const relatedKnowledgePoints = useMemo(
    () =>
      getRelatedKnowledgePoints({
        selectedKnowledgePoint: data.selectedKnowledgePoint,
        selectedProjectKnowledgePoints: data.selectedProjectKnowledgePoints,
        selectedSession: data.selectedSession,
      }),
    [data.selectedKnowledgePoint, data.selectedProjectKnowledgePoints, data.selectedSession],
  );
  const latestKnowledgePointReviewedEvent = getLatestReviewEvent(
    data.knowledgePointReviewInspectors.flatMap((inspector) => inspector.events),
    "reviewed",
  );
  const knowledgePointReviewHeatmap =
    data.selectedKnowledgePoint === null
      ? buildEmptyReviewHeatmap()
      : buildReviewHeatmap(
          data.knowledgePointReviewInspectors.flatMap((inspector) => inspector.events),
          latestKnowledgePointReviewedEvent?.event_at
            ? formatDateLabel(latestKnowledgePointReviewedEvent.event_at)
            : null,
          formatDateLabel(
            getLatestIsoDate(
              data.knowledgePointReviewInspectors.map((inspector) => inspector.scheduledAt),
            ),
          ),
        );
  const knowledgePointReviewHistorySummary = getKnowledgePointReviewHistorySummary({
    knowledgePointReviewInspectors: data.knowledgePointReviewInspectors,
  });

  return {
    ...data,
    ...actions,
    ...session,
    browseProfileSummary,
    continueActionLabel,
    continueProjectSummary,
    continueReviewTargetPoint,
    filteredKnowledgePoints,
    filteredProjectSummaries,
    homeSectionCounts,
    knowledgePointReviewHeatmap,
    knowledgePointReviewHistorySummary,
    normalizedSearchQuery,
    projectMaterialCount,
    projectStats,
    relatedKnowledgePoints,
    reviewTargetPoint,
    studyTargetPoint,
    handleContinueProject: () => {
      if (continueProjectSummary !== null) {
        actions.handleSelectProject(continueProjectSummary.project.id);
      }
    },
    handleStartContinueReview: () => {
      if (continueProjectSummary !== null) {
        actions.handlePrepareSessionStart(
          continueProjectSummary.project.id,
          "review",
          continueReviewTargetPoint?.id ?? null,
        );
      }
    },
  };
}
