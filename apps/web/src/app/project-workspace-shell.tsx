import type { ReactElement } from "react";
import {
  ArrowLeft,
  MessageSquareText,
  MoreHorizontal,
  Plus,
  Search,
} from "lucide-react";
import type { useProjectWorkspaceController } from "@/app/use-project-workspace-controller";
import { KnowledgePointDetailScreen } from "@/components/project-workspace-detail";
import { ProjectSessionWorkspace } from "@/components/project-session-workspace";
import {
  CreateProjectPanel,
  EditProjectMetaPanel,
} from "@/components/project-workspace-management";
import {
  HomeScreen,
  WorkspaceBrowseScreen,
} from "@/components/project-workspace-screens";
import { ProjectMetaPanel } from "@/components/project-workspace-primitives";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { sourceAssets } from "@/data/demo";
import { tutorFixtureScenarios } from "@/data/tutor-fixtures";

export function ProjectWorkspaceShell({
  controller,
}: {
  controller: ReturnType<typeof useProjectWorkspaceController>;
}): ReactElement {
  const {
    activeAssetSummary,
    activeReviewInspector,
    activeRuntime,
    activeSourceAssets,
    activeTutorFixtureId,
    agentConnectionState,
    archiveConfirmationPointId,
    browseProfileSummary,
    continueActionLabel,
    continueProjectSummary,
    continueReviewTargetPoint,
    currentActivities,
    currentActivity,
    currentActivityKey,
    currentActivityResolution,
    displayMessages,
    draftPrompt,
    errorMessage,
    filteredKnowledgePoints,
    filteredProjectSummaries,
    generatedProfileSummary,
    handleArchiveKnowledgePoint,
    handleBackToWorkspace,
    handleCancelCreatingProject,
    handleCancelEditingProjectMeta,
    handleCancelKnowledgePointEditing,
    handleCancelPendingSession,
    handleChangeDraftPrompt,
    handleCloseProjectMeta,
    handleCloseSession,
    handleContinueProject,
    handleDisableTutorFixture,
    handleGoHome,
    handleOpenKnowledgePoint,
    handleOpenSession,
    handlePrepareSessionStart,
    handleSaveKnowledgePoint,
    handleSaveProject,
    handleSaveProjectMeta,
    handleSelectProject,
    handleSelectTutorFixture,
    handleSessionWorkspaceSectionChange,
    handleSkipActivity,
    handleStartArchiveConfirmation,
    handleStartContinueReview,
    handleStartCreatingProject,
    handleStartEditingKnowledgePoint,
    handleStartEditingProjectMeta,
    handleSubmitActivity,
    handleSubmitPrompt,
    handleToggleMaterialsTray,
    handleTogglePendingMaterial,
    handleToggleProjectMaterial,
    handleToggleProjectMeta,
    handleUnsetSourceAsset,
    hasPendingActivity,
    hasPersistedState,
    hasStructuredRuntime,
    homeSection,
    homeSectionCounts,
    isAgentRunning,
    isBlankSession,
    isCreatingProject,
    isDevEnvironment,
    isEditingKnowledgePoint,
    isEditingProjectMeta,
    isMaterialsTrayOpen,
    isProjectMetaOpen,
    isUsingDevTutorFixture,
    knowledgePointDraft,
    knowledgePointReviewHeatmap,
    knowledgePointReviewHistorySummary,
    knowledgePointRelatedSessions,
    latestAssistantMessageId,
    latestReviewedLabel,
    nextReviewLabel,
    normalizedSearchQuery,
    pendingSessionIntent,
    projectDraft,
    projectMaterialCount,
    projectMetaDraft,
    projectStats,
    projects,
    relatedKnowledgePoints,
    requestSourceAssetIds,
    reviewHeatmap,
    screen,
    searchQuery,
    selectedKnowledgePoint,
    selectedKnowledgePointAssets,
    selectedProject,
    selectedProjectMaterials,
    selectedProjectSessions,
    selectedSession,
    selectedSessionId,
    selectedSourceAssetIds,
    selectedUnitTitle,
    setHomeSection,
    setKnowledgePointDraft,
    setProjectDraft,
    setProjectMetaDraft,
    setSearchQuery,
    submitDisabled,
    studyTargetPoint,
    workspaceSection,
  } = controller;

  return (
    <main className="xidea-shell min-h-screen bg-[var(--xidea-parchment)] text-[var(--xidea-near-black)]">
      <div className="relative mx-auto min-h-screen max-w-[1520px] px-3 py-3 lg:px-4 lg:py-4">
        <div className="space-y-4">
          <Card className="rounded-[1.4rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
            <CardContent className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <button
                  className="rounded-full border border-[var(--xidea-border)] bg-[var(--xidea-parchment)] px-3 py-1.5 text-sm font-medium text-[var(--xidea-near-black)]"
                  onClick={handleGoHome}
                  type="button"
                >
                  Xidea
                </button>
                <div className="min-w-0">
                  <p className="xidea-kicker">Project-centric learning workspace</p>
                  <p className="text-sm text-[var(--xidea-stone)]">
                    {screen === "home"
                      ? "先选 project，再进入知识点池或 session 工作态。"
                      : `${selectedProject.name} / ${screen === "detail" ? "Knowledge Point Detail" : "Project Workspace"}`}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="flex min-w-[220px] items-center gap-2 rounded-full border border-[var(--xidea-border)] bg-[var(--xidea-parchment)] px-3 py-2 text-sm text-[var(--xidea-charcoal)]">
                  <Search className="h-4 w-4 shrink-0 text-[var(--xidea-stone)]" />
                  <input
                    className="w-full bg-transparent outline-none placeholder:text-[var(--xidea-stone)]"
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={screen === "home" ? "搜索 project" : "搜索 knowledge point"}
                    value={searchQuery}
                  />
                </label>
                <Button
                  className="rounded-full bg-[var(--xidea-terracotta)] text-[var(--xidea-ivory)] hover:bg-[var(--xidea-terracotta)]/90"
                  onClick={handleStartCreatingProject}
                  type="button"
                >
                  <Plus className="h-4 w-4" />
                  新建 Project
                </Button>
              </div>
            </CardContent>
          </Card>

          {isCreatingProject ? (
            <CreateProjectPanel
              assets={sourceAssets}
              draft={projectDraft}
              onCancel={handleCancelCreatingProject}
              onChange={setProjectDraft}
              onSave={handleSaveProject}
            />
          ) : null}

          {screen === "home" ? (
            <HomeScreen
              continueProjectSummary={continueProjectSummary}
              continueActionLabel={continueActionLabel}
              filteredProjects={filteredProjectSummaries}
              homeSection={homeSection}
              homeSectionCounts={homeSectionCounts}
              onContinueProject={handleContinueProject}
              onHomeSectionChange={setHomeSection}
              onOpenProject={handleSelectProject}
              onStartReview={handleStartContinueReview}
              totalProjects={projects.length}
            />
          ) : (
            <div className="space-y-4">
              <Card className="rounded-[1.45rem] border-[var(--xidea-border)] bg-[var(--xidea-ivory)] shadow-none">
                <CardContent className="space-y-4 p-6">
                  {screen === "detail" ? (
                    <button
                      className="inline-flex items-center gap-2 rounded-full border border-[var(--xidea-border)] bg-[var(--xidea-white)] px-3 py-1.5 text-sm text-[var(--xidea-charcoal)]"
                      onClick={handleBackToWorkspace}
                      type="button"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      返回 Project Workspace
                    </button>
                  ) : null}
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <p className="xidea-kicker text-[var(--xidea-selection-text)]">Project Workspace</p>
                      <h1 className="text-2xl font-medium text-[var(--xidea-near-black)]">
                        {selectedProject.name}
                      </h1>
                      <p className="text-sm leading-7 text-[var(--xidea-charcoal)]">
                        {selectedProject.topic}
                      </p>
                      <p className="max-w-4xl text-sm leading-7 text-[var(--xidea-stone)]">
                        {selectedProject.description}
                      </p>
                    </div>

                    {screen !== "detail" ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          className="rounded-full bg-[var(--xidea-terracotta)] text-[var(--xidea-ivory)] hover:bg-[var(--xidea-terracotta)]/90"
                          disabled={studyTargetPoint === undefined}
                          onClick={() =>
                            handlePrepareSessionStart(
                              selectedProject.id,
                              "study",
                              studyTargetPoint?.id ?? null,
                            )
                          }
                          type="button"
                        >
                          学习
                        </Button>
                        <Button
                          className="rounded-full"
                          disabled={continueReviewTargetPoint === undefined}
                          onClick={() =>
                            handlePrepareSessionStart(
                              selectedProject.id,
                              "review",
                              continueReviewTargetPoint?.id ?? null,
                            )
                          }
                          type="button"
                          variant="outline"
                        >
                          复习
                        </Button>
                        <Button
                          className="rounded-full"
                          onClick={() => controller.handleCreateSession(selectedProject.id, "project")}
                          type="button"
                          variant="outline"
                        >
                          <MessageSquareText className="h-4 w-4" />
                          新建 project session
                        </Button>
                        <Button
                          className="rounded-full"
                          onClick={handleToggleProjectMeta}
                          type="button"
                          variant="outline"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                          More
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              {isProjectMetaOpen ? (
                <div className="space-y-4">
                  <ProjectMetaPanel
                    materialCount={projectMaterialCount}
                    materials={selectedProjectMaterials}
                    onClose={handleCloseProjectMeta}
                    project={selectedProject}
                    sessionCount={selectedProjectSessions.length}
                  />
                  <Card className="rounded-[1.35rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
                    <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
                      <div className="space-y-2">
                        <p className="xidea-kicker text-[var(--xidea-selection-text)]">
                          Project Settings
                        </p>
                        <p className="text-sm leading-6 text-[var(--xidea-charcoal)]">
                          继续调整当前 project 的主题、规则和材料池，不需要回到首页重建。
                        </p>
                      </div>
                      <Button
                        className="rounded-full"
                        onClick={handleStartEditingProjectMeta}
                        type="button"
                        variant="outline"
                      >
                        编辑 Project Meta
                      </Button>
                    </CardContent>
                  </Card>

                  {isEditingProjectMeta ? (
                    <EditProjectMetaPanel
                      assets={sourceAssets}
                      draft={projectMetaDraft}
                      onCancel={handleCancelEditingProjectMeta}
                      onChange={setProjectMetaDraft}
                      onSave={handleSaveProjectMeta}
                    />
                  ) : null}
                </div>
              ) : null}

              {screen === "detail" && selectedKnowledgePoint !== null ? (
                <KnowledgePointDetailScreen
                  draft={knowledgePointDraft}
                  isArchiveConfirmationOpen={
                    archiveConfirmationPointId === selectedKnowledgePoint.id
                  }
                  isEditing={isEditingKnowledgePoint}
                  knowledgePoint={selectedKnowledgePoint}
                  knowledgePointAssets={selectedKnowledgePointAssets}
                  onCancelArchiveConfirmation={() => controller.setArchiveConfirmationPointId(null)}
                  onCancelEditing={handleCancelKnowledgePointEditing}
                  onChangeDraft={setKnowledgePointDraft}
                  onConfirmArchive={() => handleArchiveKnowledgePoint(selectedKnowledgePoint.id)}
                  onOpenSession={handleOpenSession}
                  onSave={handleSaveKnowledgePoint}
                  onStartArchiveConfirmation={() =>
                    handleStartArchiveConfirmation(selectedKnowledgePoint.id)
                  }
                  onStartEditing={handleStartEditingKnowledgePoint}
                  onStartReview={() =>
                    handlePrepareSessionStart(selectedProject.id, "review", selectedKnowledgePoint.id)
                  }
                  onStartStudy={() =>
                    handlePrepareSessionStart(selectedProject.id, "study", selectedKnowledgePoint.id)
                  }
                  relatedSessions={knowledgePointRelatedSessions}
                  reviewHeatmap={knowledgePointReviewHeatmap}
                  reviewHistorySummary={knowledgePointReviewHistorySummary}
                  selectedSessionId={selectedSessionId}
                />
              ) : selectedSession === undefined ? (
                <WorkspaceBrowseScreen
                  filteredKnowledgePoints={filteredKnowledgePoints}
                  normalizedSearchQuery={normalizedSearchQuery}
                  onCancelPendingSession={handleCancelPendingSession}
                  onChangePendingPrompt={handleChangeDraftPrompt}
                  onOpenKnowledgePoint={handleOpenKnowledgePoint}
                  onOpenSession={handleOpenSession}
                  onSubmitPendingPrompt={handleSubmitPrompt}
                  onTogglePendingMaterial={handleTogglePendingMaterial}
                  onWorkspaceSectionChange={controller.setWorkspaceSection}
                  pendingPrompt={draftPrompt}
                  pendingSessionIntent={pendingSessionIntent}
                  profileSummary={browseProfileSummary}
                  projectMaterialCount={projectMaterialCount}
                  projectMaterials={selectedProjectMaterials}
                  projectStats={projectStats}
                  selectedProjectSessions={selectedProjectSessions}
                  workspaceSection={workspaceSection}
                />
              ) : (
                <ProjectSessionWorkspace
                  activeAssetSummary={activeAssetSummary}
                  activeReviewInspector={activeReviewInspector}
                  activeRuntime={activeRuntime}
                  activeSourceAssets={activeSourceAssets}
                  activeTutorFixtureId={activeTutorFixtureId}
                  agentConnectionState={agentConnectionState}
                  currentActivities={currentActivities}
                  currentActivity={currentActivity}
                  currentActivityKey={currentActivityKey}
                  currentActivityResolution={currentActivityResolution}
                  displayMessages={displayMessages}
                  draftPrompt={draftPrompt}
                  errorMessage={errorMessage}
                  generatedProfileSummary={generatedProfileSummary}
                  hasPendingActivity={hasPendingActivity}
                  hasPersistedState={hasPersistedState}
                  hasStructuredRuntime={hasStructuredRuntime}
                  isAgentRunning={isAgentRunning}
                  isBlankSession={isBlankSession}
                  isDevEnvironment={isDevEnvironment}
                  isMaterialsTrayOpen={isMaterialsTrayOpen}
                  isUsingDevTutorFixture={isUsingDevTutorFixture}
                  latestAssistantMessageId={latestAssistantMessageId}
                  latestReviewedLabel={latestReviewedLabel}
                  nextReviewLabel={nextReviewLabel}
                  onChangeDraftPrompt={handleChangeDraftPrompt}
                  onCloseSession={handleCloseSession}
                  onDisableTutorFixture={handleDisableTutorFixture}
                  onOpenKnowledgePoint={handleOpenKnowledgePoint}
                  onOpenSession={handleOpenSession}
                  onSelectTutorFixture={handleSelectTutorFixture}
                  onSkipActivity={handleSkipActivity}
                  onSubmitActivity={handleSubmitActivity}
                  onSubmitPrompt={handleSubmitPrompt}
                  onToggleMaterialsTray={handleToggleMaterialsTray}
                  onToggleProjectMaterial={handleToggleProjectMaterial}
                  onUnsetSourceAsset={handleUnsetSourceAsset}
                  onWorkspaceSectionChange={handleSessionWorkspaceSectionChange}
                  projectStats={projectStats}
                  relatedKnowledgePoints={relatedKnowledgePoints}
                  requestSourceAssetIds={requestSourceAssetIds}
                  reviewHeatmap={reviewHeatmap}
                  selectedProject={selectedProject}
                  selectedProjectMaterials={selectedProjectMaterials}
                  selectedProjectSessions={selectedProjectSessions}
                  selectedSession={selectedSession}
                  selectedSourceAssetIds={selectedSourceAssetIds}
                  selectedUnitTitle={selectedUnitTitle}
                  submitDisabled={submitDisabled}
                  tutorFixtureScenarios={tutorFixtureScenarios}
                  workspaceSection={workspaceSection}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
