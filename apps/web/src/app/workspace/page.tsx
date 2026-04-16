import type { ReactElement } from "react";
import { useMemo } from "react";
import { tutorFixtureScenarios } from "@/data/tutor-fixtures";
import { sourceAssets } from "@/data/demo";
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
  getReviewTargetPoint,
  getStudyTargetPoint,
  getVisibleKnowledgePoints,
} from "@/app/workspace/selectors";
import { WorkspaceHeader } from "@/app/workspace/header";
import { WorkspaceHero } from "@/app/workspace/hero";
import { useSessionAgent } from "@/app/workspace/use-session-agent";
import { useWorkspaceActions } from "@/app/workspace/use-actions";
import { useWorkspaceData } from "@/app/workspace/use-data";
import { KnowledgePointDetailScreen } from "@/components/workspace/detail";
import { SessionWorkspace } from "@/components/session/workspace";
import {
  CreateProjectPanel,
  EditMetaPanel,
} from "@/components/workspace/management";
import { MetaPanel } from "@/components/workspace/core";
import {
  HomeScreen,
  WorkspaceBrowseScreen,
} from "@/components/workspace/screens";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function WorkspacePage(): ReactElement {
  const data = useWorkspaceData();
  const actions = useWorkspaceActions(data);
  const session = useSessionAgent({
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
  const visibleKnowledgePoints = useMemo(
    () => getVisibleKnowledgePoints(data.selectedProjectKnowledgePoints, data.workspaceSection),
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
  const continueActionLabel =
    continueProjectSummary === null ? null : getNextSuggestedAction(continueProjectPoints);
  const continueReviewTargetPoint =
    continueProjectSummary === null
      ? null
      : continueProjectPoints.find((point) => point.status === "active_review") ?? null;
  const browseProfileSummary = getBrowseProfileSummary(
    session.activeRuntime.stateSource === ""
      ? "系统当前把这个 session 视为「待生成」"
      : session.activeRuntime.stateSource,
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

  return (
    <main className="xidea-shell min-h-screen bg-[var(--xidea-parchment)] text-[var(--xidea-near-black)]">
      <div className="relative mx-auto min-h-screen max-w-[1520px] px-3 py-3 lg:px-4 lg:py-4">
        <div className="space-y-4">
          <WorkspaceHeader
            onCreateProject={actions.handleStartCreatingProject}
            onGoHome={actions.handleGoHome}
            onSearchChange={data.setSearchQuery}
            screen={data.screen}
            searchQuery={data.searchQuery}
            selectedProjectName={data.selectedProject.name}
          />

          {data.isCreatingProject ? (
            <CreateProjectPanel
              assets={sourceAssets}
              draft={data.projectDraft}
              onCancel={actions.handleCancelCreatingProject}
              onChange={data.setProjectDraft}
              onSave={actions.handleSaveProject}
            />
          ) : null}

          {data.screen === "home" ? (
            <HomeScreen
              continueProjectSummary={continueProjectSummary}
              continueActionLabel={continueActionLabel}
              filteredProjects={filteredProjectSummaries}
              homeSection={data.homeSection}
              homeSectionCounts={homeSectionCounts}
              onContinueProject={() => {
                if (continueProjectSummary !== null) {
                  actions.handleSelectProject(continueProjectSummary.project.id);
                }
              }}
              onHomeSectionChange={data.setHomeSection}
              onOpenProject={actions.handleSelectProject}
              onStartReview={() => {
                if (continueProjectSummary !== null) {
                  actions.handlePrepareSessionStart(
                    continueProjectSummary.project.id,
                    "review",
                    continueReviewTargetPoint?.id ?? null,
                  );
                }
              }}
              totalProjects={data.projects.length}
            />
          ) : (
            <div className="space-y-4">
              <WorkspaceHero
                description={data.selectedProject.description}
                isDetailScreen={data.screen === "detail"}
                onBack={actions.handleBackToWorkspace}
                onStartProjectSession={() =>
                  actions.handleCreateSession(data.selectedProject.id, "project")
                }
                onStartReview={() =>
                  actions.handlePrepareSessionStart(
                    data.selectedProject.id,
                    "review",
                    reviewTargetPoint?.id ?? null,
                  )
                }
                onStartStudy={() =>
                  actions.handlePrepareSessionStart(
                    data.selectedProject.id,
                    "study",
                    studyTargetPoint?.id ?? null,
                  )
                }
                onToggleProjectMeta={actions.handleToggleProjectMeta}
                projectName={data.selectedProject.name}
                projectTopic={data.selectedProject.topic}
                reviewDisabled={reviewTargetPoint === null}
                studyDisabled={studyTargetPoint === null}
              />

              {data.isProjectMetaOpen ? (
                <div className="space-y-4">
                  <MetaPanel
                    materialCount={projectMaterialCount}
                    materials={data.selectedProjectMaterials}
                    onClose={actions.handleCancelEditingProjectMeta}
                    project={data.selectedProject}
                    sessionCount={data.selectedProjectSessions.length}
                  />
                  <Card className="rounded-[1.35rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
                    <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
                      <div className="space-y-2">
                        <p className="xidea-kicker text-[var(--xidea-selection-text)]">Project Settings</p>
                        <p className="text-sm leading-6 text-[var(--xidea-charcoal)]">
                          继续调整当前 project 的主题、规则和材料池，不需要回到首页重建。
                        </p>
                      </div>
                      <Button
                        className="rounded-full"
                        onClick={actions.handleStartEditingProjectMeta}
                        type="button"
                        variant="outline"
                      >
                        编辑 Project Meta
                      </Button>
                    </CardContent>
                  </Card>

                  {data.isEditingProjectMeta ? (
                    <EditMetaPanel
                      assets={sourceAssets}
                      draft={data.projectMetaDraft}
                      onCancel={actions.handleCancelEditingProjectMeta}
                      onChange={data.setProjectMetaDraft}
                      onSave={actions.handleSaveProjectMeta}
                    />
                  ) : null}
                </div>
              ) : null}

              {data.screen === "detail" && data.selectedKnowledgePoint !== null ? (
                <KnowledgePointDetailScreen
                  draft={data.knowledgePointDraft}
                  isArchiveConfirmationOpen={
                    data.archiveConfirmationPointId === data.selectedKnowledgePoint.id
                  }
                  isEditing={data.isEditingKnowledgePoint}
                  knowledgePoint={data.selectedKnowledgePoint}
                  knowledgePointAssets={data.selectedKnowledgePointAssets}
                  onCancelArchiveConfirmation={() => data.setArchiveConfirmationPointId(null)}
                  onCancelEditing={actions.handleCancelKnowledgePointEditing}
                  onChangeDraft={data.setKnowledgePointDraft}
                  onConfirmArchive={() =>
                    actions.handleArchiveKnowledgePoint(data.selectedKnowledgePoint!.id)
                  }
                  onOpenSession={(sessionId) => {
                    data.setPendingSessionIntent(null);
                    data.setSelectedSessionId(sessionId);
                    data.setScreen("workspace");
                  }}
                  onSave={actions.handleSaveKnowledgePoint}
                  onStartArchiveConfirmation={() =>
                    actions.handleStartArchiveConfirmation(data.selectedKnowledgePoint!.id)
                  }
                  onStartEditing={actions.handleStartEditingKnowledgePoint}
                  onStartReview={() =>
                    actions.handlePrepareSessionStart(
                      data.selectedProject.id,
                      "review",
                      data.selectedKnowledgePoint!.id,
                    )
                  }
                  onStartStudy={() =>
                    actions.handlePrepareSessionStart(
                      data.selectedProject.id,
                      "study",
                      data.selectedKnowledgePoint!.id,
                    )
                  }
                  relatedSessions={data.knowledgePointRelatedSessions}
                  reviewHeatmap={knowledgePointReviewHeatmap}
                  reviewHistorySummary={knowledgePointReviewHistorySummary}
                  selectedSessionId={data.selectedSessionId}
                />
              ) : data.selectedSession === undefined ? (
                <WorkspaceBrowseScreen
                  filteredKnowledgePoints={filteredKnowledgePoints}
                  normalizedSearchQuery={normalizedSearchQuery}
                  onCancelPendingSession={() => {
                    data.setPendingSessionIntent(null);
                    data.setDraftPrompt("");
                  }}
                  onChangePendingPrompt={session.handleChangeDraftPrompt}
                  onOpenKnowledgePoint={actions.handleOpenKnowledgePoint}
                  onOpenSession={(sessionId) => {
                    data.setPendingSessionIntent(null);
                    data.setSelectedSessionId(sessionId);
                  }}
                  onSubmitPendingPrompt={session.handleSubmitPrompt}
                  onTogglePendingMaterial={actions.handleTogglePendingMaterial}
                  onWorkspaceSectionChange={data.setWorkspaceSection}
                  pendingPrompt={data.draftPrompt}
                  pendingSessionIntent={data.pendingSessionIntent}
                  profileSummary={browseProfileSummary}
                  projectMaterialCount={projectMaterialCount}
                  projectMaterials={data.selectedProjectMaterials}
                  projectStats={projectStats}
                  selectedProjectSessions={data.selectedProjectSessions}
                  workspaceSection={data.workspaceSection}
                />
              ) : (
                <SessionWorkspace
                  activeAssetSummary={session.activeAssetSummary}
                  activeReviewInspector={session.activeReviewInspector}
                  activeRuntime={session.activeRuntime}
                  activeSourceAssets={session.activeSourceAssets}
                  activeTutorFixtureId={session.activeTutorFixtureId}
                  agentConnectionState={data.agentConnectionState}
                  currentActivities={session.currentActivities}
                  currentActivity={session.currentActivity}
                  currentActivityKey={session.currentActivityKey}
                  currentActivityResolution={session.currentActivityResolution}
                  displayMessages={session.displayMessages}
                  draftPrompt={data.draftPrompt}
                  errorMessage={session.errorMessage}
                  generatedProfileSummary={session.generatedProfileSummary}
                  hasPendingActivity={session.hasPendingActivity}
                  hasPersistedState={session.hasPersistedState}
                  hasStructuredRuntime={session.hasStructuredRuntime}
                  isAgentRunning={session.isAgentRunning}
                  isBlankSession={session.isBlankSession}
                  isDevEnvironment={data.isDevEnvironment}
                  isMaterialsTrayOpen={session.isMaterialsTrayOpen}
                  isUsingDevTutorFixture={session.isUsingDevTutorFixture}
                  latestAssistantMessageId={session.latestAssistantMessageId}
                  latestReviewedLabel={session.latestReviewedLabel}
                  nextReviewLabel={session.nextReviewLabel}
                  onChangeDraftPrompt={session.handleChangeDraftPrompt}
                  onCloseSession={() => data.setSelectedSessionId("")}
                  onDisableTutorFixture={session.handleDisableTutorFixture}
                  onOpenKnowledgePoint={actions.handleOpenKnowledgePoint}
                  onOpenSession={(sessionId) => {
                    data.setPendingSessionIntent(null);
                    data.setSelectedSessionId(sessionId);
                  }}
                  onSelectTutorFixture={session.handleSelectTutorFixture}
                  onSkipActivity={session.handleSkipActivity}
                  onSubmitActivity={session.handleSubmitActivity}
                  onSubmitPrompt={session.handleSubmitPrompt}
                  onToggleMaterialsTray={session.handleToggleMaterialsTray}
                  onToggleProjectMaterial={session.handleToggleProjectMaterial}
                  onUnsetSourceAsset={session.handleUnsetSourceAsset}
                  onWorkspaceSectionChange={actions.handleSessionWorkspaceSectionChange}
                  projectStats={projectStats}
                  relatedKnowledgePoints={relatedKnowledgePoints}
                  requestSourceAssetIds={session.requestSourceAssetIds}
                  reviewHeatmap={session.reviewHeatmap}
                  selectedProject={data.selectedProject}
                  selectedProjectMaterials={data.selectedProjectMaterials}
                  selectedProjectSessions={data.selectedProjectSessions}
                  selectedSession={data.selectedSession}
                  selectedSourceAssetIds={session.selectedSourceAssetIds}
                  selectedUnitTitle={session.selectedUnitTitle}
                  submitDisabled={session.submitDisabled}
                  tutorFixtureScenarios={tutorFixtureScenarios}
                  workspaceSection={data.workspaceSection}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
