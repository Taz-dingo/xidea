import type { ReactElement } from "react";
import { buildPendingSessionId } from "@/domain/project-workspace";
import { WorkspaceHeader } from "@/app/workspace/ui/header";
import { ProjectInsightsStrip } from "@/app/workspace/ui/project-insights";
import { ProjectOverviewPanel } from "@/app/workspace/ui/project-overview";
import { SystemCheckpointCard } from "@/app/workspace/ui/system-checkpoint";
import { useSessionAgent } from "@/app/workspace/agent/use-session-agent";
import { useWorkspaceActions } from "@/app/workspace/hooks/use-actions";
import { useWorkspaceData } from "@/app/workspace/hooks/use-data";
import { useProjectConsolidation } from "@/app/workspace/hooks/data/use-project-consolidation";
import { useWorkspacePageModel } from "@/app/workspace/hooks/use-page-model";
import { KnowledgePointDetailScreen } from "@/components/workspace/detail";
import { SessionWorkspace } from "@/components/session/workspace";
import { CreateProjectPanel } from "@/components/workspace/management";
import { HomeScreen } from "@/components/workspace/screens/home";
import { WorkspaceBrowseScreen } from "@/components/workspace/screens/browse";
import { Button } from "@/components/ui/button";

export function WorkspacePage(): ReactElement {
  const data = useWorkspaceData();
  const actions = useWorkspaceActions(data);
  const session = useSessionAgent({
    data,
    handleCreateSession: actions.handleCreateSession,
  });
  const model = useWorkspacePageModel({
    activeRuntime: session.activeRuntime,
    data,
  });
  const projectConsolidation = useProjectConsolidation({
    agentConnectionState: data.agentConnectionState,
    enabled: data.screen === "workspace",
    projectId: data.selectedProject.id,
  });
  const pendingWorkspaceSession =
    data.pendingSessionIntent === null
      ? null
      : {
          id: buildPendingSessionId({
            projectId: data.pendingSessionIntent.projectId,
            type: data.pendingSessionIntent.type,
            knowledgePointId: data.pendingSessionIntent.knowledgePointId,
          }),
          projectId: data.pendingSessionIntent.projectId,
          type: data.pendingSessionIntent.type,
          knowledgePointId: data.pendingSessionIntent.knowledgePointId,
          title:
            data.pendingSessionIntent.type === "project"
              ? "开始研讨"
              : data.pendingSessionIntent.type === "review"
                ? "开始复习"
                : "开始学习",
          summary:
            data.pendingSessionIntent.type === "project"
              ? "从这轮想推进的方向开始。"
              : data.pendingSessionIntent.knowledgePointTitle
                ? `围绕「${data.pendingSessionIntent.knowledgePointTitle}」开始。`
                : "从这轮想验证的问题开始。",
          updatedAt: "待开始",
          status: "待开始",
        };
  const activeWorkspaceSession = data.selectedSession ?? pendingWorkspaceSession;
  const createProjectAssets = data.projectAssetsByProject[data.projectDraft.id] ?? [];

  return (
    <main className="xidea-shell min-h-screen bg-[var(--xidea-parchment)] text-[var(--xidea-near-black)]">
      <div className="relative mx-auto min-h-screen max-w-[1520px] px-3 py-3 lg:px-4 lg:py-4">
        <div className="space-y-4">
          <WorkspaceHeader
            onCreateProject={actions.handleStartCreatingProject}
            onGoHome={actions.handleGoHome}
            onGoWorkspace={() => actions.handleSelectProject(data.selectedProject.id)}
            onSearchChange={data.setSearchQuery}
            screen={data.screen}
            searchQuery={data.searchQuery}
            selectedProjectTopic={data.selectedProject.topic}
            selectedSessionTitle={activeWorkspaceSession?.title ?? null}
            selectedSessionType={activeWorkspaceSession?.type ?? null}
          />

          {data.screen === "home" ? (
            <HomeScreen
              continueProjectSummary={model.continueProjectSummary}
              continueActionLabel={model.continueActionLabel}
              filteredProjects={model.filteredProjectSummaries}
              homeSection={data.homeSection}
              homeSectionCounts={model.homeSectionCounts}
              onContinueProject={() => {
                if (model.continueProjectSummary !== null) {
                  actions.handleSelectProject(model.continueProjectSummary.project.id);
                }
              }}
              onHomeSectionChange={data.setHomeSection}
              onOpenProject={actions.handleSelectProject}
              onStartReview={() => {
                if (model.continueProjectSummary !== null) {
                  actions.handlePrepareSessionStart(
                    model.continueProjectSummary.project.id,
                    "review",
                    model.continueReviewTargetPoint?.id ?? null,
                  );
                }
              }}
              totalProjects={data.projects.length}
            />
          ) : (
            <div className="space-y-4">
              {activeWorkspaceSession === null ? (
                <>
                  <ProjectOverviewPanel
                    checkpoint={
                      <SystemCheckpointCard
                        checkpoint={projectConsolidation.snapshot}
                        compact
                        status={projectConsolidation.status}
                      />
                    }
                    insights={
                      <ProjectInsightsStrip
                        isEditingProjectMeta={data.isEditingProjectMeta}
                        onDeleteProjectMaterial={actions.handleDeleteProjectMaterial}
                        onToggleProjectMaterial={(assetId) =>
                          data.setProjectMetaDraft((current) => ({
                            ...current,
                            materialIds: current.materialIds.includes(assetId)
                              ? current.materialIds.filter((id) => id !== assetId)
                              : [...current.materialIds, assetId],
                          }))
                        }
                        onUploadProjectMaterial={actions.handleUploadProjectMaterial}
                        profileSummary={model.browseProfileSummary}
                        projectAssets={data.selectedProjectAssets}
                        projectMaterialIds={data.projectMetaDraft.materialIds}
                        projectMaterials={data.selectedProjectMaterials}
                        projectReviewHeatmap={model.projectReviewHeatmap}
                        projectReviewHeatmapExpanded={model.projectReviewHeatmapExpanded}
                        projectStats={model.projectStats}
                      />
                    }
                    isEditing={data.isEditingProjectMeta}
                    onCancelEditing={actions.handleCancelEditingProjectMeta}
                    onChangeDraft={data.setProjectMetaDraft}
                    onEditProject={actions.handleOpenProjectMetaEditor}
                    onSaveProjectMeta={actions.handleSaveProjectMeta}
                    projectMetaDraft={data.projectMetaDraft}
                    projectSessionCount={data.selectedProjectSessions.length}
                    projectStats={model.projectStats}
                    selectedProjectDescription={data.selectedProject.description}
                    selectedProjectTopic={data.selectedProject.topic}
                    selectedProjectRules={data.selectedProject.specialRules}
                    selectedProjectUpdatedAt={data.selectedProject.updatedAt}
                  />
                  <WorkspaceBrowseScreen
                    filteredKnowledgePoints={model.filteredKnowledgePoints}
                    isEditingProjectMeta={data.isEditingProjectMeta}
                    normalizedSearchQuery={model.normalizedSearchQuery}
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
                    onDeleteSession={actions.handleDeleteSession}
                    onStartProjectSession={() =>
                      actions.handlePrepareSessionStart(data.selectedProject.id, "project")
                    }
                    onStartReview={() =>
                      actions.handlePrepareSessionStart(
                        data.selectedProject.id,
                        "review",
                        model.reviewTargetPoint?.id ?? null,
                      )
                    }
                    onStartStudy={() =>
                      actions.handlePrepareSessionStart(
                        data.selectedProject.id,
                        "study",
                        model.studyTargetPoint?.id ?? null,
                      )
                    }
                    onSubmitPendingPrompt={session.handleSubmitPrompt}
                    onWorkspaceSectionChange={data.setWorkspaceSection}
                    pendingPrompt={data.draftPrompt}
                    pendingSessionIntent={data.pendingSessionIntent}
                    projectStats={model.projectStats}
                    reviewDisabled={model.reviewTargetPoint === null}
                    selectedProjectSessions={data.selectedProjectSessions}
                    studyDisabled={model.studyTargetPoint === null}
                    workspaceSection={data.workspaceSection}
                  />
                </>
              ) : (
                <SessionWorkspace
                  activeAssetSummary={session.activeAssetSummary}
                  activeMaterialRead={session.activeMaterialRead}
                  activeReviewInspector={session.activeReviewInspector}
                  activeRuntime={session.activeRuntime}
                  activeSourceAssets={session.activeSourceAssets}
                  currentActivities={session.currentActivities}
                  currentActivity={session.currentActivity}
                  currentActivityKey={session.currentActivityKey}
                  currentActivityResolution={session.currentActivityResolution}
                  completedActivityDecks={session.completedActivityDecks}
                  displayMessages={session.displayMessages}
                  draftPrompt={data.draftPrompt}
                  errorMessage={session.errorMessage}
                  hasPendingActivity={session.hasPendingActivity}
                  hasPersistedState={session.hasPersistedState}
                  hasStructuredRuntime={session.hasStructuredRuntime}
                  isAgentRunning={session.isAgentRunning}
                  isBlankSession={session.isBlankSession || data.selectedSession === undefined}
                  isReplayingDeck={session.isReplayingDeck}
                  latestAssistantMessageId={session.latestAssistantMessageId}
                  latestReviewedLabel={session.latestReviewedLabel}
                  nextReviewLabel={session.nextReviewLabel}
                  onChangeDraftPrompt={session.handleChangeDraftPrompt}
                  onDeleteSession={actions.handleDeleteSession}
                  onExitSession={actions.handleCloseSession}
                  onOpenKnowledgePoint={actions.handleOpenKnowledgePoint}
                  onReplayDeck={session.handleReplayDeck}
                  onOpenSession={(sessionId) => {
                    data.setPendingSessionIntent(null);
                    data.setSelectedSessionId(sessionId);
                  }}
                  onStartProjectSession={() =>
                    actions.handlePrepareSessionStart(data.selectedProject.id, "project")
                  }
                  onStartReview={() =>
                    actions.handlePrepareSessionStart(
                      data.selectedProject.id,
                      "review",
                      model.reviewTargetPoint?.id ?? null,
                    )
                  }
                  onStartStudy={() =>
                    actions.handlePrepareSessionStart(
                      data.selectedProject.id,
                      "study",
                      model.studyTargetPoint?.id ?? null,
                    )
                  }
                  onSkipActivity={session.handleSkipActivity}
                  onSubmitActivity={session.handleSubmitActivity}
                  onSubmitPrompt={session.handleSubmitPrompt}
                  onToggleProjectMaterial={session.handleToggleProjectMaterial}
                  onUploadMaterial={actions.handleUploadProjectMaterialAndAttach}
                  onUnsetSourceAsset={session.handleUnsetSourceAsset}
                  onWorkspaceSectionChange={actions.handleSessionWorkspaceSectionChange}
                  projectStats={model.projectStats}
                  reviewDisabled={model.reviewTargetPoint === null}
                  requestSourceAssetIds={session.requestSourceAssetIds}
                  sessionCreatedKnowledgePoints={model.sessionCreatedKnowledgePoints}
                  selectedProject={data.selectedProject}
                  selectedProjectMaterials={data.selectedProjectMaterials}
                  selectedProjectSessions={data.selectedProjectSessions}
                  selectedSession={activeWorkspaceSession}
                  selectedSourceAssetIds={session.selectedSourceAssetIds}
                  activityInputDisabled={session.activityInputDisabled}
                  composerDisabled={session.composerDisabled}
                  studyDisabled={model.studyTargetPoint === null}
                  workspaceSection={data.workspaceSection}
                />
              )}
            </div>
          )}

          {data.isKnowledgePointDialogOpen && data.selectedKnowledgePoint !== null ? (
            <div
              className="fixed inset-0 z-50 flex items-start justify-center bg-black/20 px-4 py-8 backdrop-blur-[2px]"
              onClick={actions.handleCloseKnowledgePointDialog}
            >
              <div
                className="xidea-modal-pop max-h-[88vh] w-full max-w-[1360px] overflow-y-auto"
                onClick={(event) => event.stopPropagation()}
              >
                <KnowledgePointDetailScreen
                  draft={data.knowledgePointDraft}
                  isArchiveConfirmationOpen={
                    data.archiveConfirmationPointId === data.selectedKnowledgePoint.id
                  }
                  isEditing={data.isEditingKnowledgePoint}
                  knowledgePoint={data.selectedKnowledgePoint}
                  knowledgePointAssets={data.selectedKnowledgePointAssets}
                  onCancelArchiveConfirmation={() => data.setArchiveConfirmationPointId(null)}
                  onBack={actions.handleCloseKnowledgePointDialog}
                  onCancelEditing={actions.handleCancelKnowledgePointEditing}
                  onChangeDraft={data.setKnowledgePointDraft}
                  onConfirmArchive={() =>
                    actions.handleArchiveKnowledgePoint(data.selectedKnowledgePoint!.id)
                  }
                  onDelete={() =>
                    actions.handleDeleteKnowledgePoint(data.selectedKnowledgePoint!.id)
                  }
                  onOpenSession={(sessionId) => {
                    data.setPendingSessionIntent(null);
                    data.setSelectedSessionId(sessionId);
                    data.setScreen("workspace");
                    actions.handleCloseKnowledgePointDialog();
                  }}
                  onSave={actions.handleSaveKnowledgePoint}
                  onStartArchiveConfirmation={() =>
                    actions.handleStartArchiveConfirmation(data.selectedKnowledgePoint!.id)
                  }
                  onStartEditing={actions.handleStartEditingKnowledgePoint}
                  onStartReview={() => {
                    actions.handleQuickStartFocusedSession(
                      data.selectedProject.id,
                      "review",
                      data.selectedKnowledgePoint!.id,
                    );
                    actions.handleCloseKnowledgePointDialog();
                  }}
                  onStartStudy={() => {
                    actions.handleQuickStartFocusedSession(
                      data.selectedProject.id,
                      "study",
                      data.selectedKnowledgePoint!.id,
                    );
                    actions.handleCloseKnowledgePointDialog();
                  }}
                  relatedSessions={data.knowledgePointRelatedSessions}
                  reviewHeatmap={model.knowledgePointReviewHeatmap}
                  reviewHistorySummary={model.knowledgePointReviewHistorySummary}
                  selectedSessionId={data.selectedSessionId}
                  showBackButton={false}
                />
              </div>
            </div>
          ) : null}

          {data.isCreatingProject ? (
            <div
              className="fixed inset-0 z-50 flex items-start justify-center bg-black/20 px-4 py-8 backdrop-blur-[2px]"
              onClick={actions.handleCancelCreatingProject}
            >
              <div
                className="xidea-modal-pop max-h-[88vh] w-full max-w-[1120px] overflow-y-auto"
                onClick={(event) => event.stopPropagation()}
              >
                <CreateProjectPanel
                  assets={createProjectAssets}
                  draft={data.projectDraft}
                  onCancel={actions.handleCancelCreatingProject}
                  onChange={data.setProjectDraft}
                  onDeleteMaterial={actions.handleDeleteProjectDraftMaterial}
                  onSave={actions.handleSaveProject}
                  onUploadMaterial={actions.handleUploadProjectDraftMaterial}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
