import type { ReactElement } from "react";
import { tutorFixtureScenarios } from "@/data/tutor-fixtures";
import { sourceAssets } from "@/data/demo";
import { X } from "lucide-react";
import { WorkspaceHeader } from "@/app/workspace/ui/header";
import { useSessionAgent } from "@/app/workspace/agent/use-session-agent";
import { useWorkspaceActions } from "@/app/workspace/hooks/use-actions";
import { useWorkspaceData } from "@/app/workspace/hooks/use-data";
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

  return (
    <main className="xidea-shell min-h-screen bg-[var(--xidea-parchment)] text-[var(--xidea-near-black)]">
      <div className="relative mx-auto min-h-screen max-w-[1520px] px-3 py-3 lg:px-4 lg:py-4">
        <div className="space-y-4">
          <WorkspaceHeader
            isProjectMetaEditing={data.isEditingProjectMeta}
            onCancelProjectMetaEditing={actions.handleCancelEditingProjectMeta}
            onChangeProjectMetaDraft={data.setProjectMetaDraft}
            onCreateProject={actions.handleStartCreatingProject}
            onEditProject={actions.handleOpenProjectMetaEditor}
            onGoHome={actions.handleGoHome}
            onGoWorkspace={() => actions.handleSelectProject(data.selectedProject.id)}
            onSaveProjectMeta={actions.handleSaveProjectMeta}
            onSearchChange={data.setSearchQuery}
            onStartProjectSession={() =>
              actions.handleCreateSession(data.selectedProject.id, "project")
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
            onUploadProjectMaterial={actions.handleUploadProjectMaterial}
            projectAssets={data.selectedProjectAssets}
            projectMaterialCount={model.projectMaterialCount}
            projectMetaDraft={data.projectMetaDraft}
            projectSessionCount={data.selectedProjectSessions.length}
            projectStats={model.projectStats}
            reviewDisabled={model.reviewTargetPoint === null}
            screen={data.screen}
            searchQuery={data.searchQuery}
            selectedProjectDescription={data.selectedProject.description}
            selectedProjectName={data.selectedProject.name}
            selectedProjectRules={data.selectedProject.specialRules}
            selectedProjectTopic={data.selectedProject.topic}
            selectedProjectUpdatedAt={data.selectedProject.updatedAt}
            studyDisabled={model.studyTargetPoint === null}
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
              {data.selectedSession === undefined ? (
                <WorkspaceBrowseScreen
                  filteredKnowledgePoints={model.filteredKnowledgePoints}
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
                  onSubmitPendingPrompt={session.handleSubmitPrompt}
                  onWorkspaceSectionChange={data.setWorkspaceSection}
                  pendingPrompt={data.draftPrompt}
                  pendingSessionIntent={data.pendingSessionIntent}
                  profileSummary={model.browseProfileSummary}
                  projectReviewHeatmap={model.projectReviewHeatmap}
                  projectStats={model.projectStats}
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
                  completedActivityDecks={session.completedActivityDecks}
                  displayMessages={session.displayMessages}
                  draftPrompt={data.draftPrompt}
                  errorMessage={session.errorMessage}
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
                  onEditKnowledgePoint={actions.handleOpenKnowledgePointEditor}
                  onOpenKnowledgePoint={actions.handleOpenKnowledgePoint}
                  onOpenProjectMetaEditor={actions.handleOpenProjectMetaEditor}
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
                  onUploadMaterial={actions.handleUploadProjectMaterialAndAttach}
                  onUnsetSourceAsset={session.handleUnsetSourceAsset}
                  onWorkspaceSectionChange={actions.handleSessionWorkspaceSectionChange}
                  projectStats={model.projectStats}
                  relatedKnowledgePoints={model.relatedKnowledgePoints}
                  requestSourceAssetIds={session.requestSourceAssetIds}
                  selectedProject={data.selectedProject}
                  selectedProjectMaterials={data.selectedProjectMaterials}
                  selectedProjectSessions={data.selectedProjectSessions}
                  selectedSession={data.selectedSession}
                  selectedSourceAssetIds={session.selectedSourceAssetIds}
                  selectedUnitTitle={session.selectedUnitTitle}
                  activityInputDisabled={session.activityInputDisabled}
                  composerDisabled={session.composerDisabled}
                  tutorFixtureScenarios={tutorFixtureScenarios}
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
                className="max-h-[88vh] w-full max-w-[1360px] overflow-y-auto"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="mb-3 flex justify-end">
                  <Button
                    className="h-10 w-10 rounded-full bg-[var(--xidea-white)] p-0"
                    onClick={actions.handleCloseKnowledgePointDialog}
                    type="button"
                    variant="outline"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
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
                  reviewHeatmap={model.knowledgePointReviewHeatmap}
                  reviewHistorySummary={model.knowledgePointReviewHistorySummary}
                  selectedSessionId={data.selectedSessionId}
                  showBackButton={false}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
