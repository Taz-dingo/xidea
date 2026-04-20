import { useMemo } from "react";
import type { RuntimeSnapshot } from "@/domain/agent-runtime";
import { getNextSuggestedAction, getProjectStats } from "@/domain/project-workspace";
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
  getSessionCreatedKnowledgePoints,
  getReviewTargetPoint,
  getStudyTargetPoint,
  getVisibleKnowledgePoints,
} from "@/app/workspace/model/selectors";
import type { WorkspaceData } from "@/app/workspace/hooks/use-data";

export function useWorkspacePageModel({
  activeRuntime,
  data,
}: {
  activeRuntime: RuntimeSnapshot;
  data: WorkspaceData;
}) {
  const normalizedSearchQuery = data.searchQuery.trim().toLowerCase();
  const projectMaterialCount = data.selectedProjectMaterials.length;
  const projectStats = useMemo(
    () => getProjectStats(data.selectedProjectKnowledgePoints),
    [data.selectedProjectKnowledgePoints],
  );
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
  const homeProjects = useMemo(
    () =>
      getHomeSectionProjectSummaries({
        homeSection: data.homeSection,
        projectSummaries,
        recentProjectSummaries,
      }),
    [data.homeSection, projectSummaries, recentProjectSummaries],
  );
  const filteredProjectSummaries = useMemo(
    () => filterProjectSummaries(homeProjects, normalizedSearchQuery),
    [homeProjects, normalizedSearchQuery],
  );
  const visibleKnowledgePoints = useMemo(
    () =>
      getVisibleKnowledgePoints(
        data.selectedProjectKnowledgePoints,
        data.workspaceSection,
      ),
    [data.selectedProjectKnowledgePoints, data.workspaceSection],
  );
  const filteredKnowledgePoints = useMemo(
    () => filterKnowledgePoints(visibleKnowledgePoints, normalizedSearchQuery),
    [normalizedSearchQuery, visibleKnowledgePoints],
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
  const continueActionLabel = useMemo(
    () =>
      continueProjectSummary === null
        ? null
        : getNextSuggestedAction(continueProjectPoints),
    [continueProjectPoints, continueProjectSummary],
  );
  const continueReviewTargetPoint = useMemo(
    () =>
      continueProjectSummary === null
        ? null
        : continueProjectPoints.find((point) => point.status === "active_review") ?? null,
    [continueProjectPoints, continueProjectSummary],
  );
  const browseProfileSummary = useMemo(
    () =>
      getBrowseProfileSummary(
        activeRuntime.stateSource === ""
          ? "系统当前把这轮会话视为「待生成」"
          : activeRuntime.stateSource,
        activeRuntime.state.weakSignals[0] ?? "",
      ),
    [activeRuntime.state.weakSignals, activeRuntime.stateSource],
  );
  const studyTargetPoint = useMemo(
    () =>
      getStudyTargetPoint(
        data.selectedKnowledgePoint,
        data.selectedProjectKnowledgePoints,
      ),
    [data.selectedKnowledgePoint, data.selectedProjectKnowledgePoints],
  );
  const reviewTargetPoint = useMemo(
    () =>
      getReviewTargetPoint(
        data.selectedKnowledgePoint,
        data.selectedProjectKnowledgePoints,
      ),
    [data.selectedKnowledgePoint, data.selectedProjectKnowledgePoints],
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
  const sessionCreatedKnowledgePoints = useMemo(
    () =>
      getSessionCreatedKnowledgePoints(
        data.selectedProjectKnowledgePoints,
        data.selectedSession ?? null,
      ),
    [data.selectedProjectKnowledgePoints, data.selectedSession],
  );
  const reviewEvents = useMemo(
    () =>
      data.knowledgePointReviewInspectors.flatMap((inspector) => inspector.events),
    [data.knowledgePointReviewInspectors],
  );
  const latestKnowledgePointReviewedEvent = useMemo(
    () => getLatestReviewEvent(reviewEvents, "reviewed"),
    [reviewEvents],
  );
  const knowledgePointReviewHeatmap = useMemo(
    () =>
      data.selectedKnowledgePoint === null
        ? buildEmptyReviewHeatmap()
        : buildReviewHeatmap(
            reviewEvents,
            latestKnowledgePointReviewedEvent?.event_at
              ? formatDateLabel(latestKnowledgePointReviewedEvent.event_at)
              : null,
            formatDateLabel(
              getLatestIsoDate(
                data.knowledgePointReviewInspectors.map(
                  (inspector) => inspector.scheduledAt,
                ),
              ),
            ),
          ),
    [
      data.knowledgePointReviewInspectors,
      data.selectedKnowledgePoint,
      latestKnowledgePointReviewedEvent?.event_at,
      reviewEvents,
    ],
  );
  const projectReviewHeatmap = useMemo(
    () =>
      reviewEvents.length === 0
        ? buildEmptyReviewHeatmap()
        : buildReviewHeatmap(
            reviewEvents,
            latestKnowledgePointReviewedEvent?.event_at
              ? formatDateLabel(latestKnowledgePointReviewedEvent.event_at)
              : null,
            formatDateLabel(
              getLatestIsoDate(
                data.knowledgePointReviewInspectors.map(
                  (inspector) => inspector.scheduledAt,
                ),
              ),
            ),
          ),
    [
      data.knowledgePointReviewInspectors,
      latestKnowledgePointReviewedEvent?.event_at,
      reviewEvents,
    ],
  );
  const projectReviewHeatmapExpanded = useMemo(
    () =>
      reviewEvents.length === 0
        ? buildEmptyReviewHeatmap(52)
        : buildReviewHeatmap(
            reviewEvents,
            latestKnowledgePointReviewedEvent?.event_at
              ? formatDateLabel(latestKnowledgePointReviewedEvent.event_at)
              : null,
            formatDateLabel(
              getLatestIsoDate(
                data.knowledgePointReviewInspectors.map(
                  (inspector) => inspector.scheduledAt,
                ),
              ),
            ),
            52,
          ),
    [
      data.knowledgePointReviewInspectors,
      latestKnowledgePointReviewedEvent?.event_at,
      reviewEvents,
    ],
  );
  const knowledgePointReviewHistorySummary = useMemo(
    () =>
      getKnowledgePointReviewHistorySummary({
        knowledgePointReviewInspectors: data.knowledgePointReviewInspectors,
      }),
    [data.knowledgePointReviewInspectors],
  );

  return {
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
    projectReviewHeatmap,
    projectReviewHeatmapExpanded,
    projectMaterialCount,
    projectStats,
    relatedKnowledgePoints,
    sessionCreatedKnowledgePoints,
    reviewTargetPoint,
    studyTargetPoint,
  };
}
