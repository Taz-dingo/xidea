import { formatActivitySubmissionForAgent } from "@/domain/agent-runtime";
import type { TutorFixtureScenario } from "@/data/tutor-fixtures";
import {
  buildAggregateActivityResult,
  buildActivityBatchSummaryMessage,
  buildCompletedActivityDeck,
  createActivityBatchResult,
  getActionLabel,
  type SessionActivityBatchState,
} from "@/domain/project-session-runtime";
import type { AgentActivityResult } from "@/domain/agent-runtime";
import type { LearningActivityAttempt, LearningActivitySubmission } from "@/domain/types";
import {
  buildFreeReplyFixtureState,
  buildSubmittedFixtureState,
  buildSkippedFixtureState,
  selectFixture,
  setDevTutorFixtureQueryParam,
} from "@/app/workspace/agent/session-fixture";
import type { WorkspaceData } from "@/app/workspace/hooks/use-data";

export function createSessionActions({
  activeRuntime,
  activeTutorFixture,
  clearError,
  currentActivity,
  currentActivities,
  currentDeckKey,
  currentActivityKey,
  currentActivityBatchState,
  data,
  error,
  handleCreateSession,
  isMaterialsTrayOpen,
  isUsingDevTutorFixture,
  latestAssistantMessageId,
  onQueueActivityResult,
  selectedSessionKey,
  selectedSessionKnowledgePointId,
  sendMessage,
}: {
  activeRuntime: {
    state: { recommendedAction: "apply" | "clarify" | "practice" | "review" | "teach" };
  };
  activeTutorFixture:
    | {
        id: string;
        skipReply: string;
        submitReply: string;
        submitErrorMessage: string | null;
      }
    | null;
  clearError: () => void;
  currentActivity:
    | Parameters<typeof formatActivitySubmissionForAgent>[0]["activity"]
    | null;
  currentActivities: ReadonlyArray<Parameters<typeof formatActivitySubmissionForAgent>[0]["activity"]>;
  currentDeckKey: string | null;
  currentActivityKey: string | null;
  currentActivityBatchState: SessionActivityBatchState | null;
  data: WorkspaceData;
  error: Error | undefined;
  handleCreateSession: (
    projectId: string,
    type?: "project" | "study" | "review",
    knowledgePointId?: string | null,
    initialSourceAssetIds?: ReadonlyArray<string>,
  ) => { id: string } | null;
  isMaterialsTrayOpen: boolean;
  isUsingDevTutorFixture: boolean;
  latestAssistantMessageId: string | null;
  onQueueActivityResult: (result: AgentActivityResult | null) => void;
  selectedSessionKey: string | null;
  selectedSessionKnowledgePointId: string | null;
  sendMessage: (message: { text: string }) => PromiseLike<void> | void;
}) {
  function buildNextBatchState(
    nextResult: ReturnType<typeof createActivityBatchResult>,
    awaitingAgent: boolean,
  ): SessionActivityBatchState | null {
    if (currentDeckKey === null) {
      return null;
    }

    const baseState: SessionActivityBatchState =
      currentActivityBatchState?.deckKey === currentDeckKey
        ? currentActivityBatchState
        : {
            assistantMessageIdBeforeSend: latestAssistantMessageId,
            awaitingAgent: false,
            currentIndex: 0,
            deckKey: currentDeckKey,
            results: [],
          };

    return {
      ...baseState,
      assistantMessageIdBeforeSend: latestAssistantMessageId,
      awaitingAgent,
      currentIndex: awaitingAgent ? baseState.currentIndex : baseState.currentIndex + 1,
      results: [...baseState.results, nextResult],
    };
  }

  function handleSendToAgent(text: string, sessionSummary: string): void {
    if (data.selectedSession === undefined) {
      return;
    }

    data.setSessions((current) =>
      current.map((session) =>
        session.id === data.selectedSession!.id
          ? { ...session, summary: sessionSummary, updatedAt: "刚刚", status: "运行中" }
          : session,
      ),
    );
    data.setRunningSessionIds((current) => ({ ...current, [data.selectedSession!.id]: true }));
    void sendMessage({ text });
  }

  function handleSubmitPrompt(): void {
    const text = data.draftPrompt.trim();
    if (text === "") {
      return;
    }

    if (data.selectedSession === undefined) {
      if (data.pendingSessionIntent === null) {
        return;
      }

      const createdSession = handleCreateSession(
        data.pendingSessionIntent.projectId,
        data.pendingSessionIntent.type,
        data.pendingSessionIntent.knowledgePointId,
      );
      if (createdSession !== null) {
        data.setPendingInitialPrompt({ sessionId: createdSession.id, text, sessionSummary: text });
        data.setDraftPrompt("");
      }
      return;
    }

    if (isUsingDevTutorFixture) {
      data.setDevTutorFixtureState((current) =>
        current === null ? current : buildFreeReplyFixtureState(current, text),
      );
      data.setDraftPrompt("");
      return;
    }

    handleSendToAgent(text, text);
    data.setDraftPrompt("");
  }

  function handleSubmitActivity(submission: LearningActivitySubmission): void {
    if (data.selectedSession === undefined || currentActivity === null || currentActivityKey === null) {
      return;
    }
    if (error !== undefined) {
      clearError();
    }

    if (isUsingDevTutorFixture && activeTutorFixture !== null) {
      data.setActivityResolutionsBySession((current) => ({
        ...current,
        [data.selectedSession!.id]: {
          ...(current[data.selectedSession!.id] ?? {}),
          [currentActivityKey]: "submitted",
        },
      }));
      if (activeTutorFixture.submitErrorMessage !== null) {
        data.setDevTutorFixtureState((current) =>
          current === null
            ? current
            : { ...current, errorMessage: activeTutorFixture.submitErrorMessage },
        );
        return;
      }

      const submissionText = formatActivitySubmissionForAgent({ activity: currentActivity, submission });
      data.setDevTutorFixtureState((current) =>
        current === null
          ? current
          : buildSubmittedFixtureState(current, submissionText, activeTutorFixture.submitReply),
      );
      return;
    }

    const nextBatchState = buildNextBatchState(
      createActivityBatchResult({
        activity: currentActivity,
        knowledgePointId: selectedSessionKnowledgePointId,
        submission,
        action: "submit",
      }),
      currentActivities.length === 1,
    );
    if (nextBatchState === null) {
      return;
    }

    data.setActivityBatchStateBySession((current) => ({
      ...current,
      [data.selectedSession!.id]: nextBatchState,
    }));

    if (currentActivities.length > 1) {
      return;
    }

    const completedDeck =
      currentDeckKey === null
        ? null
        : buildCompletedActivityDeck({
            deckKey: currentDeckKey,
            sessionId: data.selectedSession.id,
            sessionType: data.selectedSession.type,
            results: nextBatchState.results,
          });
    if (completedDeck !== null) {
      data.setCompletedActivityDecksBySession((current) => ({
        ...current,
        [data.selectedSession!.id]: [
          completedDeck,
          ...(current[data.selectedSession!.id] ?? []).filter(
            (deck) => deck.deckKey !== completedDeck.deckKey,
          ),
        ].slice(0, 8),
      }));
    }

    const aggregatedResult = buildAggregateActivityResult({
      fallbackKnowledgePointId: selectedSessionKnowledgePointId,
      results: nextBatchState.results,
      runId: `run-${Date.now()}`,
      sessionId: data.selectedSession.id,
      sessionType: data.selectedSession.type,
      projectId: data.selectedSession.projectId,
    });
    onQueueActivityResult(aggregatedResult);
    handleSendToAgent(
      buildActivityBatchSummaryMessage(nextBatchState.results),
      `完成 ${nextBatchState.results.length} 张卡 / ${getActionLabel(activeRuntime.state.recommendedAction)}`,
    );
  }

  function handleSkipActivity(attempts: ReadonlyArray<LearningActivityAttempt> = []): void {
    if (data.selectedSession === undefined || currentActivity === null || currentActivityKey === null) {
      return;
    }
    if (error !== undefined) {
      clearError();
    }

    if (isUsingDevTutorFixture && activeTutorFixture !== null) {
      data.setActivityResolutionsBySession((current) => ({
        ...current,
        [data.selectedSession!.id]: {
          ...(current[data.selectedSession!.id] ?? {}),
          [currentActivityKey]: "skipped",
        },
      }));
      data.setDevTutorFixtureState((current) =>
        current === null
          ? current
          : buildSkippedFixtureState(current, currentActivity.title, activeTutorFixture.skipReply),
      );
      return;
    }

    const nextBatchState = buildNextBatchState(
      createActivityBatchResult({
        activity: currentActivity,
        knowledgePointId: selectedSessionKnowledgePointId,
        submission:
          attempts.length === 0
            ? null
            : {
                activityId: currentActivity.id,
                kind: currentActivity.kind,
                responseText: "",
                selectedChoiceId: null,
                isCorrect: false,
                attempts,
                finalFeedback: null,
                finalAnalysis: attempts.at(-1)?.analysis ?? null,
              },
        action: "skip",
      }),
      currentActivities.length === 1,
    );
    if (nextBatchState === null) {
      return;
    }

    data.setActivityBatchStateBySession((current) => ({
      ...current,
      [data.selectedSession!.id]: nextBatchState,
    }));

    if (currentActivities.length > 1) {
      return;
    }

    const completedDeck =
      currentDeckKey === null
        ? null
        : buildCompletedActivityDeck({
            deckKey: currentDeckKey,
            sessionId: data.selectedSession.id,
            sessionType: data.selectedSession.type,
            results: nextBatchState.results,
          });
    if (completedDeck !== null) {
      data.setCompletedActivityDecksBySession((current) => ({
        ...current,
        [data.selectedSession!.id]: [
          completedDeck,
          ...(current[data.selectedSession!.id] ?? []).filter(
            (deck) => deck.deckKey !== completedDeck.deckKey,
          ),
        ].slice(0, 8),
      }));
    }

    const aggregatedResult = buildAggregateActivityResult({
      fallbackKnowledgePointId: selectedSessionKnowledgePointId,
      results: nextBatchState.results,
      runId: `run-${Date.now()}`,
      sessionId: data.selectedSession.id,
      sessionType: data.selectedSession.type,
      projectId: data.selectedSession.projectId,
    });
    onQueueActivityResult(aggregatedResult);
    handleSendToAgent(
      buildActivityBatchSummaryMessage(nextBatchState.results),
      `完成 ${nextBatchState.results.length} 张卡 / ${getActionLabel(activeRuntime.state.recommendedAction)}`,
    );
  }

  return {
    handleChangeDraftPrompt: (value: string) => {
      if (error !== undefined) {
        clearError();
      }
      if (isUsingDevTutorFixture) {
        data.setDevTutorFixtureState((current) =>
          current === null ? current : { ...current, errorMessage: null },
        );
      }
      data.setDraftPrompt(value);
    },
    handleDisableTutorFixture: () => {
      setDevTutorFixtureQueryParam(null);
      data.setDevTutorFixtureState(null);
    },
    handleSelectTutorFixture: (fixture: TutorFixtureScenario) => {
      data.setDevTutorFixtureState(selectFixture(fixture));
    },
    handleSkipActivity,
    handleSubmitActivity,
    handleSubmitPrompt,
    handleToggleMaterialsTray: () => {
      if (selectedSessionKey !== null && data.selectedSession?.type === "project") {
        data.setSessionMaterialTrayOpen((current) => ({
          ...current,
          [selectedSessionKey]: !isMaterialsTrayOpen,
        }));
      }
    },
    handleToggleProjectMaterial: (assetId: string) => {
      if (data.selectedSession?.type === "project") {
        data.setSessionSourceAssetIds((current) => {
          const currentSelection = current[data.selectedSession!.id] ?? [];
          return {
            ...current,
            [data.selectedSession!.id]: currentSelection.includes(assetId)
              ? currentSelection.filter((id) => id !== assetId)
              : [...currentSelection, assetId],
          };
        });
      }
    },
    handleUnsetSourceAsset: (assetId: string) => {
      if (data.selectedSession?.type === "project") {
        data.setSessionSourceAssetIds((current) => ({
          ...current,
          [data.selectedSession!.id]: (current[data.selectedSession!.id] ?? []).filter(
            (id) => id !== assetId,
          ),
        }));
      }
    },
  };
}
