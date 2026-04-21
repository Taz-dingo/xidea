import { formatActivitySubmissionForAgent } from "@/domain/agent-runtime";
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
import type { WorkspaceData } from "@/app/workspace/hooks/use-data";

export function createSessionActions({
  activeRuntime,
  activeSessionType,
  clearError,
  currentActivity,
  currentActivities,
  currentDeckKey,
  currentActivityKey,
  currentActivityBatchState,
  data,
  error,
  handleCreateSession,
  latestAssistantMessageId,
  onQueueActivityResult,
  prepareSourceAssetsForSend,
  selectedSessionKey,
  selectedSessionKnowledgePointId,
  sendMessage,
}: {
  activeRuntime: {
    state: { recommendedAction: "apply" | "clarify" | "practice" | "review" | "teach" };
  };
  clearError: () => void;
  currentActivity:
    | Parameters<typeof formatActivitySubmissionForAgent>[0]["activity"]
    | null;
  currentActivities: ReadonlyArray<Parameters<typeof formatActivitySubmissionForAgent>[0]["activity"]>;
  currentDeckKey: string | null;
  currentActivityKey: string | null;
  currentActivityBatchState: SessionActivityBatchState | null;
  activeSessionType: "project" | "study" | "review";
  data: WorkspaceData;
  error: Error | undefined;
  handleCreateSession: (
    projectId: string,
    type?: "project" | "study" | "review",
    knowledgePointId?: string | null,
    initialSourceAssetIds?: ReadonlyArray<string>,
  ) => { id: string } | null;
  latestAssistantMessageId: string | null;
  onQueueActivityResult: (result: AgentActivityResult | null) => void;
  prepareSourceAssetsForSend: () => void;
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
    const shouldClearAttachedMaterials = data.selectedSession.type === "project";
    const sessionId = data.selectedSession.id;

    prepareSourceAssetsForSend();

    data.setSessions((current) =>
      current.map((session) =>
        session.id === sessionId
          ? { ...session, summary: sessionSummary, updatedAt: "刚刚", status: "运行中" }
          : session,
      ),
    );
    data.setRunningSessionIds((current) => ({ ...current, [sessionId]: true }));
    void sendMessage({ text });
    if (shouldClearAttachedMaterials) {
      data.setSessionSourceAssetIds((current) =>
        current[sessionId] === undefined || current[sessionId]?.length === 0
          ? current
          : { ...current, [sessionId]: [] },
      );
    }
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
        selectedSessionKey === null ? [] : data.sessionSourceAssetIds[selectedSessionKey] ?? [],
      );
      if (createdSession !== null) {
        if (selectedSessionKey !== null) {
          data.setSessionSourceAssetIds((current) => {
            const next = { ...current };
            delete next[selectedSessionKey];
            return next;
          });
        }
        data.setPendingInitialPrompt({ sessionId: createdSession.id, text, sessionSummary: text });
        data.setDraftPrompt("");
      }
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
      data.setDraftPrompt(value);
    },
    handleSkipActivity,
    handleSubmitActivity,
    handleSubmitPrompt,
    handleToggleProjectMaterial: (assetId: string) => {
      if (selectedSessionKey !== null && activeSessionType === "project") {
        data.setSessionSourceAssetIds((current) => {
          const currentSelection = current[selectedSessionKey] ?? [];
          return {
            ...current,
            [selectedSessionKey]: currentSelection.includes(assetId)
              ? currentSelection.filter((id) => id !== assetId)
              : [...currentSelection, assetId],
          };
        });
      }
    },
    handleUnsetSourceAsset: (assetId: string) => {
      if (selectedSessionKey !== null && activeSessionType === "project") {
        data.setSessionSourceAssetIds((current) => ({
          ...current,
          [selectedSessionKey]: (current[selectedSessionKey] ?? []).filter((id) => id !== assetId),
        }));
      }
    },
  };
}
