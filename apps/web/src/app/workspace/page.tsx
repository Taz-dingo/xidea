import type { ReactElement } from "react";
import { tutorFixtureScenarios } from "@/data/tutor-fixtures";
import { sourceAssets } from "@/data/demo";
import { WorkspaceHeader } from "@/app/workspace/ui/header";
import { WorkspaceHero } from "@/app/workspace/ui/hero";
import { useSessionAgent } from "@/app/workspace/agent/use-session-agent";
import { useWorkspaceActions } from "@/app/workspace/hooks/use-actions";
import { useWorkspaceData } from "@/app/workspace/hooks/use-data";
import { useWorkspacePageModel } from "@/app/workspace/hooks/use-page-model";
import { KnowledgePointDetailScreen } from "@/components/workspace/detail";
import { SessionWorkspace } from "@/components/session/workspace";
import {
  CreateProjectPanel,
  EditMetaPanel,
} from "@/components/workspace/management";
import { MetaPanel } from "@/components/workspace/core";
import { HomeScreen } from "@/components/workspace/screens/home";
import { WorkspaceBrowseScreen } from "@/components/workspace/screens/browse";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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
                onToggleProjectMeta={actions.handleToggleProjectMeta}
                projectName={data.selectedProject.name}
                projectTopic={data.selectedProject.topic}
                reviewDisabled={model.reviewTargetPoint === null}
                studyDisabled={model.studyTargetPoint === null}
              />

              {data.isProjectMetaOpen ? (
                <div className="space-y-4">
                  <MetaPanel
                    materialCount={model.projectMaterialCount}
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
                  reviewHeatmap={model.knowledgePointReviewHeatmap}
                  reviewHistorySummary={model.knowledgePointReviewHistorySummary}
                  selectedSessionId={data.selectedSessionId}
                />
              ) : data.selectedSession === undefined ? (
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
                  onTogglePendingMaterial={actions.handleTogglePendingMaterial}
                  onWorkspaceSectionChange={data.setWorkspaceSection}
                  pendingPrompt={data.draftPrompt}
                  pendingSessionIntent={data.pendingSessionIntent}
                  profileSummary={model.browseProfileSummary}
                  projectMaterialCount={model.projectMaterialCount}
                  projectMaterials={data.selectedProjectMaterials}
                  projectStats={model.projectStats}
                  selectedProjectSessions={data.selectedProjectSessions}
                  workspaceSection={data.workspaceSection}
                />
              ) : (
                <SessionWorkspace
                  activeAssetSummary={session.activeAssetSummary}
                  activeKnowledgePointSuggestion={
                    data.selectedSession?.type === "project"
                      ? data.selectedSessionKnowledgePointSuggestion
                      : null
                  }
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
                  onDismissKnowledgePointSuggestion={() =>
                    actions.handleDismissKnowledgePointSuggestion(data.selectedSession!.id)
                  }
                  onCloseSession={() => data.setSelectedSessionId("")}
                  onDisableTutorFixture={session.handleDisableTutorFixture}
                  onAcceptKnowledgePointSuggestion={() =>
                    actions.handleAcceptKnowledgePointSuggestion(data.selectedSession!.id)
                  }
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
