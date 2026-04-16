import type { ReactElement } from "react";
import { FileInput } from "lucide-react";
import { SessionThreadPane } from "@/components/session/thread-pane";
import { SessionInspector } from "@/components/session/inspector";
import {
  SessionCard,
  SessionTypeBadge,
} from "@/components/workspace/core";
import { WorkspaceNavButton } from "@/components/workspace/monitor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  AgentAssetSummary,
  AgentReviewInspector,
  RuntimeSnapshot,
} from "@/domain/agent-runtime";
import type { ActivityResolution } from "@/domain/project-session-runtime";
import type {
  KnowledgePointItem,
  ProjectItem,
  ProjectStats,
  SessionItem,
  WorkspaceSection,
} from "@/domain/project-workspace";
import type { ReviewHeatmapCell } from "@/domain/review-heatmap";
import type { LearningActivitySubmission, SourceAsset } from "@/domain/types";
import type { TutorFixtureScenario } from "@/data/tutor-fixtures";
import type { UIMessage } from "ai";

export function SessionWorkspace({
  activeAssetSummary,
  activeReviewInspector,
  activeRuntime,
  activeSourceAssets,
  activeTutorFixtureId,
  agentConnectionState,
  currentActivities,
  currentActivity,
  currentActivityKey,
  currentActivityResolution,
  displayMessages,
  draftPrompt,
  errorMessage,
  generatedProfileSummary,
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
  onOpenKnowledgePoint,
  onOpenSession,
  onSelectTutorFixture,
  onSkipActivity,
  onSubmitActivity,
  onSubmitPrompt,
  onToggleProjectMaterial,
  onToggleMaterialsTray,
  onUnsetSourceAsset,
  onWorkspaceSectionChange,
  projectStats,
  relatedKnowledgePoints,
  requestSourceAssetIds,
  reviewHeatmap,
  selectedProject,
  selectedProjectMaterials,
  selectedSession,
  selectedSourceAssetIds,
  selectedUnitTitle,
  selectedProjectSessions,
  submitDisabled,
  tutorFixtureScenarios,
  workspaceSection,
}: {
  activeAssetSummary: AgentAssetSummary | null;
  activeReviewInspector: AgentReviewInspector | null;
  activeRuntime: RuntimeSnapshot;
  activeSourceAssets: ReadonlyArray<SourceAsset>;
  activeTutorFixtureId: string | null;
  agentConnectionState: "checking" | "ready" | "offline";
  currentActivities: RuntimeSnapshot["activities"];
  currentActivity: RuntimeSnapshot["activity"];
  currentActivityKey: string | null;
  currentActivityResolution: ActivityResolution | null;
  displayMessages: ReadonlyArray<UIMessage>;
  draftPrompt: string;
  errorMessage: string | null;
  generatedProfileSummary: string;
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
  onOpenKnowledgePoint: (pointId: string) => void;
  onOpenSession: (sessionId: string) => void;
  onSelectTutorFixture: (fixture: TutorFixtureScenario) => void;
  onSkipActivity: () => void;
  onSubmitActivity: (submission: LearningActivitySubmission) => void;
  onSubmitPrompt: () => void;
  onToggleProjectMaterial: (assetId: string) => void;
  onToggleMaterialsTray: () => void;
  onUnsetSourceAsset: (assetId: string) => void;
  onWorkspaceSectionChange: (section: WorkspaceSection) => void;
  projectStats: ProjectStats;
  relatedKnowledgePoints: ReadonlyArray<KnowledgePointItem>;
  requestSourceAssetIds: ReadonlyArray<string>;
  reviewHeatmap: ReadonlyArray<ReadonlyArray<ReviewHeatmapCell>>;
  selectedProject: ProjectItem;
  selectedProjectMaterials: ReadonlyArray<SourceAsset>;
  selectedSession: SessionItem;
  selectedSourceAssetIds: ReadonlyArray<string>;
  selectedUnitTitle: string | null;
  selectedProjectSessions: ReadonlyArray<SessionItem>;
  submitDisabled: boolean;
  tutorFixtureScenarios: ReadonlyArray<TutorFixtureScenario>;
  workspaceSection: WorkspaceSection;
}): ReactElement {
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[292px_minmax(0,1fr)_320px]">
      <Card className="rounded-[1.4rem] border-[var(--xidea-border)] bg-[#f1f0ea] shadow-none">
        <CardContent className="space-y-4 p-3">
          <div className="space-y-2">
            <WorkspaceNavButton
              active={workspaceSection === "overview"}
              count={projectStats.total - projectStats.archived}
              label="Overview"
              onClick={() => onWorkspaceSectionChange("overview")}
            />
            <WorkspaceNavButton
              active={workspaceSection === "due-review"}
              count={projectStats.dueReview}
              label="Due Review"
              onClick={() => onWorkspaceSectionChange("due-review")}
            />
            <WorkspaceNavButton
              active={workspaceSection === "archived"}
              count={projectStats.archived}
              label="Archived"
              onClick={() => onWorkspaceSectionChange("archived")}
            />
          </div>

          <div className="space-y-2 rounded-[1rem] border border-[var(--xidea-border)] bg-[var(--xidea-white)] p-3">
            <p className="xidea-kicker text-[var(--xidea-stone)]">Recent Sessions</p>
            {selectedProjectSessions.slice(0, 5).map((session) => (
              <SessionCard
                active={session.id === selectedSession.id}
                key={session.id}
                onClick={() => onOpenSession(session.id)}
                title={session.title}
                type={session.type}
                updatedAt={session.updatedAt}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="flex min-h-0 flex-col overflow-hidden rounded-[1.4rem] border-[var(--xidea-border)] bg-[var(--xidea-ivory)] shadow-none">
        <CardHeader className="gap-3 border-b border-[var(--xidea-border)] px-5 pb-4 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="truncate text-sm font-medium text-[var(--xidea-near-black)]">
                {selectedSession.title}
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
                  ? "Streaming"
                  : agentConnectionState === "offline"
                    ? "Offline"
                    : activeRuntime.source === "live-agent"
                      ? "Live Agent"
                      : activeRuntime.source === "hydrated-state"
                        ? "Hydrated"
                        : agentConnectionState === "ready"
                          ? "Agent Ready"
                          : "Checking"}
              </Badge>
              <Button className="rounded-full" onClick={onCloseSession} type="button" variant="outline">
                关闭 session
              </Button>
            </div>
          </div>
        </CardHeader>

        <SessionThreadPane
          activeRuntime={activeRuntime}
          activeSourceAssets={activeSourceAssets}
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
          onSkipActivity={onSkipActivity}
          onSubmitActivity={onSubmitActivity}
          onSubmitPrompt={onSubmitPrompt}
          onToggleMaterialsTray={onToggleMaterialsTray}
          onToggleProjectMaterial={onToggleProjectMaterial}
          onUnsetSourceAsset={onUnsetSourceAsset}
          selectedProjectMaterials={selectedProjectMaterials}
          selectedSessionId={selectedSession.id}
          selectedSourceAssetIds={selectedSourceAssetIds}
          submitDisabled={submitDisabled}
        />
      </Card>

      <SessionInspector
        activeAssetSummary={activeAssetSummary}
        activeReviewInspector={activeReviewInspector}
        activeRuntime={activeRuntime}
        activeTutorFixtureId={activeTutorFixtureId}
        generatedProfileSummary={generatedProfileSummary}
        hasPersistedState={hasPersistedState}
        hasStructuredRuntime={hasStructuredRuntime}
        isBlankSession={isBlankSession}
        isDevEnvironment={isDevEnvironment}
        isUsingDevTutorFixture={isUsingDevTutorFixture}
        latestReviewedLabel={latestReviewedLabel}
        nextReviewLabel={nextReviewLabel}
        onDisableTutorFixture={onDisableTutorFixture}
        onOpenKnowledgePoint={onOpenKnowledgePoint}
        onSelectTutorFixture={onSelectTutorFixture}
        relatedKnowledgePoints={relatedKnowledgePoints}
        requestSourceAssetIds={requestSourceAssetIds}
        reviewHeatmap={reviewHeatmap}
        selectedProject={selectedProject}
        selectedSessionStatus={selectedSession.status}
        selectedSourceAssetIds={selectedSourceAssetIds}
        selectedUnitTitle={selectedUnitTitle}
        tutorFixtureScenarios={tutorFixtureScenarios}
      />
    </div>
  );
}
