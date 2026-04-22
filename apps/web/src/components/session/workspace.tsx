import type { ReactElement } from "react";
import { ArrowLeft, GraduationCap, MessageSquareText, RefreshCcw } from "lucide-react";
import { CompletedDeckRail } from "@/components/session/deck-rail";
import { SessionThreadPane } from "@/components/session/thread-pane";
import { SessionInspector } from "@/components/session/inspector";
import {
  getSessionDisplayTitle,
  SessionTypeGuide,
  SessionTypeBadge,
} from "@/components/workspace/core";
import { SessionListSection } from "@/components/workspace/session-list";
import { WorkspaceNavButton } from "@/components/workspace/monitor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  AgentAssetSummary,
  AgentMaterialRead,
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
import type {
  LearningActivityAttempt,
  LearningActivitySubmission,
  SourceAsset,
} from "@/domain/types";
import type { UIMessage } from "ai";

export function SessionWorkspace({
  activeAssetSummary,
  activeMaterialRead,
  activeReviewInspector,
  activeRuntime,
  activeSourceAssets,
  activityInputDisabled,
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
  isReplayingDeck,
  latestAssistantMessageId,
  latestReviewedLabel,
  nextReviewLabel,
  onChangeDraftPrompt,
  onDeleteSession,
  onExitSession,
  onOpenKnowledgePoint,
  onReplayDeck,
  onOpenSession,
  onStartProjectSession,
  onStartReview,
  onStartStudy,
  onSkipActivity,
  onSubmitActivity,
  onSubmitPrompt,
  onToggleProjectMaterial,
  onUploadMaterial,
  onUnsetSourceAsset,
  onWorkspaceSectionChange,
  projectStats,
  sessionCreatedKnowledgePoints,
  reviewDisabled,
  requestSourceAssetIds,
  selectedProject,
  selectedProjectMaterials,
  selectedSession,
  selectedSourceAssetIds,
  selectedProjectSessions,
  studyDisabled,
  workspaceSection,
}: {
  activeAssetSummary: AgentAssetSummary | null;
  activeMaterialRead: AgentMaterialRead | null;
  activeReviewInspector: AgentReviewInspector | null;
  activeRuntime: RuntimeSnapshot;
  activeSourceAssets: ReadonlyArray<SourceAsset>;
  activityInputDisabled: boolean;
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
  isReplayingDeck: boolean;
  latestAssistantMessageId: string | null;
  latestReviewedLabel: string;
  nextReviewLabel: string;
  onChangeDraftPrompt: (value: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onExitSession: () => void;
  onOpenKnowledgePoint: (pointId: string) => void;
  onReplayDeck: (deck: CompletedActivityDeck) => void;
  onOpenSession: (sessionId: string) => void;
  onStartProjectSession: () => void;
  onStartReview: () => void;
  onStartStudy: () => void;
  onSkipActivity: (attempts?: ReadonlyArray<LearningActivityAttempt>) => void;
  onSubmitActivity: (submission: LearningActivitySubmission) => void;
  onSubmitPrompt: () => void;
  onToggleProjectMaterial: (assetId: string) => void;
  onUploadMaterial: (file: File) => Promise<void>;
  onUnsetSourceAsset: (assetId: string) => void;
  onWorkspaceSectionChange: (section: WorkspaceSection) => void;
  projectStats: ProjectStats;
  sessionCreatedKnowledgePoints: ReadonlyArray<KnowledgePointItem>;
  reviewDisabled: boolean;
  requestSourceAssetIds: ReadonlyArray<string>;
  selectedProject: ProjectItem;
  selectedProjectMaterials: ReadonlyArray<SourceAsset>;
  selectedSession: SessionItem;
  selectedSourceAssetIds: ReadonlyArray<string>;
  selectedProjectSessions: ReadonlyArray<SessionItem>;
  studyDisabled: boolean;
  workspaceSection: WorkspaceSection;
}): ReactElement {
  const projectSessions = selectedProjectSessions.filter((session) => session.type === "project");
  const learningSessions = selectedProjectSessions.filter((session) => session.type !== "project");
  const isPendingSession = selectedSession.status === "待开始";
  const shouldPinSessionViewport =
    displayMessages.length > 6 ||
    currentActivity !== null ||
    isAgentRunning;

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
            emptyText="当前还没有研讨会话。"
            infoTooltip={<SessionTypeGuide types={["project"]} />}
            onDeleteSession={onDeleteSession}
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
            emptyText="当前还没有学习或复习会话。"
            infoTooltip={<SessionTypeGuide types={["study", "review"]} />}
            onDeleteSession={onDeleteSession}
            onOpenSession={onOpenSession}
            selectedSessionId={selectedSession.id}
            sessions={learningSessions}
            title="学习与复习"
          />
        </CardContent>
      </Card>

      <Card
        className={`xidea-card-motion flex min-h-0 flex-col overflow-hidden rounded-[1.4rem] border-[var(--xidea-border)] bg-[var(--xidea-ivory)] shadow-none lg:overflow-visible lg:max-h-[calc(100svh-6.5rem)]`}
      >
        <CardHeader className="gap-3 border-b border-[var(--xidea-border)] px-5 pb-4 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Button
                aria-label="返回主题工作台"
                className="mt-0.5 h-9 w-9 shrink-0 rounded-full border-[var(--xidea-border)] p-0 text-[var(--xidea-charcoal)] hover:bg-[var(--xidea-parchment)]"
                onClick={onExitSession}
                type="button"
                variant="ghost"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <CardTitle className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--xidea-near-black)]">
                  {getSessionDisplayTitle(selectedSession.title, selectedSession.type)}
                </CardTitle>
                <div className="flex shrink-0 items-center gap-2">
                  <SessionTypeBadge type={selectedSession.type} />
                  <span className="rounded-full border border-[var(--xidea-border)] bg-[var(--xidea-white)] px-2.5 py-1 text-[11px] text-[var(--xidea-stone)]">
                    {selectedSession.status}
                  </span>
                </div>
              </div>
            </div>
            {isPendingSession ? <div className="shrink-0" /> : null}
          </div>
        </CardHeader>

        {selectedSession.type !== "project" && completedActivityDecks.length > 0 ? (
          <CompletedDeckRail
            decks={completedActivityDecks}
            onReplayDeck={onReplayDeck}
            replayDisabled={isAgentRunning || hasPendingActivity || isReplayingDeck}
          />
        ) : null}

        <SessionThreadPane
          activeAssetSummary={activeAssetSummary}
          activeMaterialRead={activeMaterialRead}
          activeRuntime={activeRuntime}
          activeSourceAssets={activeSourceAssets}
          activityInputDisabled={activityInputDisabled}
          composerDisabled={composerDisabled}
          completedActivityDecks={completedActivityDecks}
          currentActivities={currentActivities}
          currentActivity={currentActivity}
          currentActivityKey={currentActivityKey}
          currentActivityResolution={currentActivityResolution}
          displayMessages={displayMessages}
          draftPrompt={draftPrompt}
          errorMessage={errorMessage}
          hasPendingActivity={hasPendingActivity}
          isReplayingDeck={isReplayingDeck}
          hasStructuredRuntime={hasStructuredRuntime}
          isAgentRunning={isAgentRunning}
          latestAssistantMessageId={latestAssistantMessageId}
          pinViewport={shouldPinSessionViewport}
          onChangeDraftPrompt={onChangeDraftPrompt}
          onOpenKnowledgePoint={onOpenKnowledgePoint}
          onSkipActivity={onSkipActivity}
          onSubmitActivity={onSubmitActivity}
          onSubmitPrompt={onSubmitPrompt}
          sessionCreatedKnowledgePoints={sessionCreatedKnowledgePoints}
          onToggleProjectMaterial={onToggleProjectMaterial}
          onUploadMaterial={onUploadMaterial}
          onUnsetSourceAsset={onUnsetSourceAsset}
          selectedProjectMaterials={selectedProjectMaterials}
          selectedSessionId={selectedSession.id}
          selectedSessionType={selectedSession.type}
          selectedSourceAssetIds={selectedSourceAssetIds}
        />
      </Card>

      <div className="min-h-0 lg:max-h-[calc(100svh-5.75rem)] lg:overflow-y-auto lg:pr-1">
        <SessionInspector
          activeReviewInspector={activeReviewInspector}
          activeRuntime={activeRuntime}
          completedActivityDecks={completedActivityDecks}
          hasPersistedState={hasPersistedState}
          hasStructuredRuntime={hasStructuredRuntime}
          isReplayDisabled={isAgentRunning || hasPendingActivity || isReplayingDeck}
          latestReviewedLabel={latestReviewedLabel}
          nextReviewLabel={nextReviewLabel}
          onReplayDeck={onReplayDeck}
          selectedProject={selectedProject}
          selectedSessionStatus={selectedSession.status}
          selectedSessionType={selectedSession.type}
        />
      </div>
    </div>
  );
}
