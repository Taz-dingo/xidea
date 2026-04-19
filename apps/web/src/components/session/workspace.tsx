import type { ReactElement } from "react";
import { FileInput, GraduationCap, MessageSquareText, RefreshCcw } from "lucide-react";
import { CompletedDeckRail } from "@/components/session/deck-rail";
import { SessionThreadPane } from "@/components/session/thread-pane";
import { SessionInspector } from "@/components/session/inspector";
import {
  getSessionDisplayTitle,
  SessionTypeBadge,
} from "@/components/workspace/core";
import { SessionListSection } from "@/components/workspace/session-list";
import { WorkspaceNavButton } from "@/components/workspace/monitor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  AgentAssetSummary,
  AgentReviewInspector,
  RuntimeSnapshot,
} from "@/domain/agent-runtime";
import type {
  ActivityResolution,
  CompletedActivityDeck,
} from "@/domain/project-session-runtime";
import type {
  KnowledgePointItem,
  ProjectItem,
  ProjectStats,
  SessionItem,
  WorkspaceSection,
} from "@/domain/project-workspace";
import { getSessionTypeDescription } from "@/domain/project-workspace";
import type {
  LearningActivityAttempt,
  LearningActivitySubmission,
  SourceAsset,
} from "@/domain/types";
import type { TutorFixtureScenario } from "@/data/tutor-fixtures";
import type { UIMessage } from "ai";

export function SessionWorkspace({
  activeAssetSummary,
  activeReviewInspector,
  activeRuntime,
  activeSourceAssets,
  activeTutorFixtureId,
  activityInputDisabled,
  agentConnectionState,
  composerDisabled,
  currentActivities,
  currentActivity,
  currentActivityKey,
  currentActivityResolution,
  completedActivityDecks,
  displayMessages,
  draftPrompt,
  errorMessage,
  hasPendingActivity,
  hasPersistedState,
  hasStructuredRuntime,
  isAgentRunning,
  isBlankSession,
  isDevEnvironment,
  isMaterialsTrayOpen,
  isUsingDevTutorFixture,
  latestAssistantMessageId,
  latestReviewedLabel,
  nextReviewLabel,
  onChangeDraftPrompt,
  onCloseSession,
  onDisableTutorFixture,
  onEditKnowledgePoint,
  onOpenKnowledgePoint,
  onOpenProjectMetaEditor,
  onOpenSession,
  onStartProjectSession,
  onStartReview,
  onStartStudy,
  onSelectTutorFixture,
  onSkipActivity,
  onSubmitActivity,
  onSubmitPrompt,
  onToggleProjectMaterial,
  onToggleMaterialsTray,
  onUploadMaterial,
  onUnsetSourceAsset,
  onWorkspaceSectionChange,
  projectStats,
  relatedKnowledgePoints,
  reviewDisabled,
  requestSourceAssetIds,
  selectedProject,
  selectedProjectMaterials,
  selectedSession,
  selectedSourceAssetIds,
  selectedUnitTitle,
  selectedProjectSessions,
  tutorFixtureScenarios,
  studyDisabled,
  workspaceSection,
}: {
  activeAssetSummary: AgentAssetSummary | null;
  activeReviewInspector: AgentReviewInspector | null;
  activeRuntime: RuntimeSnapshot;
  activeSourceAssets: ReadonlyArray<SourceAsset>;
  activeTutorFixtureId: string | null;
  activityInputDisabled: boolean;
  agentConnectionState: "checking" | "ready" | "offline";
  composerDisabled: boolean;
  currentActivities: RuntimeSnapshot["activities"];
  currentActivity: RuntimeSnapshot["activity"];
  currentActivityKey: string | null;
  currentActivityResolution: ActivityResolution | null;
  completedActivityDecks: ReadonlyArray<CompletedActivityDeck>;
  displayMessages: ReadonlyArray<UIMessage>;
  draftPrompt: string;
  errorMessage: string | null;
  hasPendingActivity: boolean;
  hasPersistedState: boolean;
  hasStructuredRuntime: boolean;
  isAgentRunning: boolean;
  isBlankSession: boolean;
  isDevEnvironment: boolean;
  isMaterialsTrayOpen: boolean;
  isUsingDevTutorFixture: boolean;
  latestAssistantMessageId: string | null;
  latestReviewedLabel: string;
  nextReviewLabel: string;
  onChangeDraftPrompt: (value: string) => void;
  onCloseSession: () => void;
  onDisableTutorFixture: () => void;
  onEditKnowledgePoint: (pointId: string) => void;
  onOpenKnowledgePoint: (pointId: string) => void;
  onOpenProjectMetaEditor: () => void;
  onOpenSession: (sessionId: string) => void;
  onStartProjectSession: () => void;
  onStartReview: () => void;
  onStartStudy: () => void;
  onSelectTutorFixture: (fixture: TutorFixtureScenario) => void;
  onSkipActivity: (attempts?: ReadonlyArray<LearningActivityAttempt>) => void;
  onSubmitActivity: (submission: LearningActivitySubmission) => void;
  onSubmitPrompt: () => void;
  onToggleProjectMaterial: (assetId: string) => void;
  onToggleMaterialsTray: () => void;
  onUploadMaterial: (file: File) => Promise<void>;
  onUnsetSourceAsset: (assetId: string) => void;
  onWorkspaceSectionChange: (section: WorkspaceSection) => void;
  projectStats: ProjectStats;
  relatedKnowledgePoints: ReadonlyArray<KnowledgePointItem>;
  reviewDisabled: boolean;
  requestSourceAssetIds: ReadonlyArray<string>;
  selectedProject: ProjectItem;
  selectedProjectMaterials: ReadonlyArray<SourceAsset>;
  selectedSession: SessionItem;
  selectedSourceAssetIds: ReadonlyArray<string>;
  selectedUnitTitle: string | null;
  selectedProjectSessions: ReadonlyArray<SessionItem>;
  tutorFixtureScenarios: ReadonlyArray<TutorFixtureScenario>;
  studyDisabled: boolean;
  workspaceSection: WorkspaceSection;
}): ReactElement {
  const projectSessions = selectedProjectSessions.filter((session) => session.type === "project");
  const learningSessions = selectedProjectSessions.filter((session) => session.type !== "project");

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[292px_minmax(0,1fr)_320px]">
      <Card className="rounded-[1.4rem] border-[var(--xidea-border)] bg-[#f1f0ea] shadow-none">
        <CardContent className="space-y-4 p-3">
          <div className="space-y-2">
            <WorkspaceNavButton
              active={workspaceSection === "overview"}
              count={projectStats.total - projectStats.archived}
              label="总览"
              onClick={() => onWorkspaceSectionChange("overview")}
            />
            <WorkspaceNavButton
              active={workspaceSection === "due-review"}
              count={projectStats.dueReview}
              label="待复习"
              onClick={() => onWorkspaceSectionChange("due-review")}
            />
            <WorkspaceNavButton
              active={workspaceSection === "archived"}
              count={projectStats.archived}
              label="已归档"
              onClick={() => onWorkspaceSectionChange("archived")}
            />
          </div>

          <SessionListSection
            actions={
              <Button
                className="h-10 w-full rounded-[0.9rem] border-[var(--xidea-selection-border)] bg-[var(--xidea-white)] text-[var(--xidea-near-black)] hover:bg-[var(--xidea-selection)]"
                onClick={onStartProjectSession}
                type="button"
                variant="outline"
              >
                <MessageSquareText className="h-4 w-4" />
                研讨
              </Button>
            }
            description={getSessionTypeDescription("project")}
            emptyText="当前还没有研讨会话。"
            onOpenSession={onOpenSession}
            selectedSessionId={selectedSession.id}
            sessions={projectSessions}
            showTypeBadge={false}
            title="研讨会话"
          />

          <SessionListSection
            actions={
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  className="h-10 min-w-0 rounded-[0.9rem] bg-[var(--xidea-terracotta)] text-[var(--xidea-ivory)] hover:bg-[var(--xidea-terracotta)]/90"
                  disabled={studyDisabled}
                  onClick={onStartStudy}
                  type="button"
                >
                  <GraduationCap className="h-4 w-4" />
                  学习
                </Button>
                <Button
                  className="h-10 min-w-0 rounded-[0.9rem] border-[var(--xidea-selection-border)] bg-[var(--xidea-white)] hover:bg-[var(--xidea-selection)]"
                  disabled={reviewDisabled}
                  onClick={onStartReview}
                  type="button"
                  variant="outline"
                >
                  <RefreshCcw className="h-4 w-4" />
                  复习
                </Button>
              </div>
            }
            description="学习负责推进，复习负责校准。"
            emptyText="当前还没有学习或复习会话。"
            onOpenSession={onOpenSession}
            selectedSessionId={selectedSession.id}
            sessions={learningSessions}
            title="学习与复习"
          />
        </CardContent>
      </Card>

      <Card className="xidea-card-motion flex min-h-0 flex-col overflow-hidden rounded-[1.4rem] border-[var(--xidea-border)] bg-[var(--xidea-ivory)] shadow-none">
        <CardHeader className="gap-3 border-b border-[var(--xidea-border)] px-5 pb-4 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="truncate text-sm font-medium text-[var(--xidea-near-black)]">
                {getSessionDisplayTitle(selectedSession.title, selectedSession.type)}
              </CardTitle>
              <CardDescription className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--xidea-stone)]">
                <SessionTypeBadge type={selectedSession.type} />
                <span>{selectedSession.status}</span>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                className="border-[var(--xidea-border)] bg-[var(--xidea-white)] text-[var(--xidea-stone)] shadow-none"
                variant="outline"
              >
                {isAgentRunning
                  ? "实时处理中"
                  : agentConnectionState === "offline"
                    ? "连接离线"
                    : activeRuntime.source === "live-agent"
                      ? "实时 Agent"
                      : activeRuntime.source === "hydrated-state"
                        ? "已回填"
                        : agentConnectionState === "ready"
                          ? "可用"
                          : "检查中"}
              </Badge>
              <Button className="rounded-full" onClick={onCloseSession} type="button" variant="outline">
                关闭 session
              </Button>
            </div>
          </div>
        </CardHeader>

        {selectedSession.type !== "project" && completedActivityDecks.length > 0 ? (
          <CompletedDeckRail decks={completedActivityDecks} />
        ) : null}

        <SessionThreadPane
          activeRuntime={activeRuntime}
          activeSourceAssets={activeSourceAssets}
          activityInputDisabled={activityInputDisabled}
          composerDisabled={composerDisabled}
          currentActivities={currentActivities}
          currentActivity={currentActivity}
          currentActivityKey={currentActivityKey}
          currentActivityResolution={currentActivityResolution}
          displayMessages={displayMessages}
          draftPrompt={draftPrompt}
          errorMessage={errorMessage}
          hasPendingActivity={hasPendingActivity}
          hasStructuredRuntime={hasStructuredRuntime}
          isAgentRunning={isAgentRunning}
          isMaterialsTrayOpen={isMaterialsTrayOpen}
          latestAssistantMessageId={latestAssistantMessageId}
          onChangeDraftPrompt={onChangeDraftPrompt}
          onOpenProjectMetaEditor={onOpenProjectMetaEditor}
          onSkipActivity={onSkipActivity}
          onSubmitActivity={onSubmitActivity}
          onSubmitPrompt={onSubmitPrompt}
          onToggleMaterialsTray={onToggleMaterialsTray}
          onToggleProjectMaterial={onToggleProjectMaterial}
          onUploadMaterial={onUploadMaterial}
          onUnsetSourceAsset={onUnsetSourceAsset}
          selectedProjectMaterials={selectedProjectMaterials}
          selectedSessionId={selectedSession.id}
          selectedSessionType={selectedSession.type}
          selectedSourceAssetIds={selectedSourceAssetIds}
        />
      </Card>

      <SessionInspector
        activeAssetSummary={activeAssetSummary}
        activeReviewInspector={activeReviewInspector}
        activeRuntime={activeRuntime}
        activeTutorFixtureId={activeTutorFixtureId}
        completedActivityDecks={completedActivityDecks}
        hasPersistedState={hasPersistedState}
        hasStructuredRuntime={hasStructuredRuntime}
        isBlankSession={isBlankSession}
        isDevEnvironment={isDevEnvironment}
        isUsingDevTutorFixture={isUsingDevTutorFixture}
        latestReviewedLabel={latestReviewedLabel}
        nextReviewLabel={nextReviewLabel}
        onDisableTutorFixture={onDisableTutorFixture}
        onEditKnowledgePoint={onEditKnowledgePoint}
        onOpenKnowledgePoint={onOpenKnowledgePoint}
        onSelectTutorFixture={onSelectTutorFixture}
        relatedKnowledgePoints={relatedKnowledgePoints}
        requestSourceAssetIds={requestSourceAssetIds}
        selectedProject={selectedProject}
        selectedSessionStatus={selectedSession.status}
        selectedSessionType={selectedSession.type}
        selectedSourceAssetIds={selectedSourceAssetIds}
        selectedUnitTitle={selectedUnitTitle}
        tutorFixtureScenarios={tutorFixtureScenarios}
      />
    </div>
  );
}
