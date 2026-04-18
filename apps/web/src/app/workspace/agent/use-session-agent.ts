import { useChat } from "@ai-sdk/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { learningUnits, sourceAssets } from "@/data/demo";
import { getTutorFixtureScenario } from "@/data/tutor-fixtures";
import {
  type AgentActivityResult,
  buildMockRuntimeSnapshot,
  getRequestSourceAssetIds,
} from "@/domain/agent-runtime";
import {
  buildEmptyReviewHeatmap,
  buildReviewHeatmap,
  formatDateLabel,
  getLatestIsoDate,
} from "@/domain/review-heatmap";
import {
  buildActivityDeckKey,
  getVisibleActivitiesForBatch,
  type SessionActivityBatchState,
  getErrorMessage,
  getLatestReviewEvent,
} from "@/domain/project-session-runtime";
import type { SourceAsset } from "@/domain/types";
import {
  getAgentBaseUrl,
} from "@/lib/agent-client";
import { createAgentChatTransport } from "@/lib/agent-chat-transport";
import { createSessionActions } from "@/app/workspace/agent/session-actions";
import { useAgentHealth } from "@/app/workspace/agent/effects/use-agent-health";
import { useFixtureSync } from "@/app/workspace/agent/effects/use-fixture-sync";
import { useSessionDataSync } from "@/app/workspace/agent/effects/use-session-data-sync";
import { useSessionRuntimeSync } from "@/app/workspace/agent/effects/use-session-runtime-sync";
import type { WorkspaceData } from "@/app/workspace/hooks/use-data";

export function useSessionAgent({
  data,
  handleCreateSession,
}: {
  data: WorkspaceData;
  handleCreateSession: (
    projectId: string,
    type?: "project" | "study" | "review",
    knowledgePointId?: string | null,
    initialSourceAssetIds?: ReadonlyArray<string>,
  ) => { id: string } | null;
}) {
  const selectedSessionKey = data.selectedSession?.id ?? null;
  const selectedSessionKnowledgePointId = data.selectedSession?.knowledgePointId ?? null;
  const fallbackSessionType =
    data.selectedSession?.type ?? data.pendingSessionIntent?.type ?? "project";
  const sessionSnapshotsRef = useRef(data.sessionSnapshots);
  sessionSnapshotsRef.current = data.sessionSnapshots;
  const activeRuntimeRef = useRef<ReturnType<typeof buildMockRuntimeSnapshot>>(
    buildMockRuntimeSnapshot(data.initialProfile, data.initialUnit, fallbackSessionType),
  );
  const selectedUnit = selectedSessionKnowledgePointId
    ? learningUnits.find((unit) => unit.id === selectedSessionKnowledgePointId)
    : undefined;
  const runtimeUnit = selectedUnit ?? data.initialUnit;
  const selectedSourceAssetIds =
    data.selectedSession?.type === "project"
      ? data.sessionSourceAssetIds[data.selectedSession.id] ?? []
      : [];
  const seedRuntime = useMemo(
    () => buildMockRuntimeSnapshot(data.initialProfile, runtimeUnit, fallbackSessionType),
    [data.initialProfile, fallbackSessionType, runtimeUnit],
  );
  const fixtureIdFromUrl =
    data.isDevEnvironment && typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("mockTutor")
      : null;
  const activeTutorFixture =
    data.devTutorFixtureState === null
      ? null
      : getTutorFixtureScenario(data.devTutorFixtureState.fixtureId);
  const isUsingDevTutorFixture = activeTutorFixture !== null;
  const activeRuntime =
    data.selectedSession === undefined
      ? seedRuntime
      : isUsingDevTutorFixture
        ? data.devTutorFixtureState?.snapshot ?? seedRuntime
        : data.sessionSnapshots[data.selectedSession.id] ?? seedRuntime;
  activeRuntimeRef.current = activeRuntime;
  const deckKey = buildActivityDeckKey(activeRuntime);
  const activityBatchState =
    selectedSessionKey === null
      ? null
      : ((data.activityBatchStateBySession[selectedSessionKey] as SessionActivityBatchState | undefined) ??
          null);
  const baseActivities =
    activeRuntime.activities.length > 0
      ? activeRuntime.activities
      : activeRuntime.activity === null
        ? []
        : [activeRuntime.activity];
  const currentActivities = getVisibleActivitiesForBatch({
    activities: baseActivities,
    batchState:
      deckKey !== null && activityBatchState?.deckKey === deckKey ? activityBatchState : null,
    deckKey,
  });
  const currentActivity = currentActivities[0] ?? null;
  const currentActivityKey =
    currentActivity === null
      ? null
      : `${currentActivity.id}:${activeRuntime.assistantMessage || activeRuntime.decision.reason}`;
  const currentActivityResolution =
    selectedSessionKey === null || currentActivityKey === null
      ? null
      : data.activityResolutionsBySession[selectedSessionKey]?.[currentActivityKey] ?? null;
  const completedActivityDecks =
    selectedSessionKey === null
      ? []
      : data.completedActivityDecksBySession[selectedSessionKey] ?? [];
  const hasPersistedState =
    activeRuntime.source === "hydrated-state" || activeRuntime.source === "live-agent";
  const hasStructuredRuntime = activeRuntime.source === "live-agent";
  const sessionMessageCount = data.selectedSession
    ? data.sessionMessagesById[data.selectedSession.id]?.length ?? 0
    : 0;
  const isBlankSession =
    data.selectedSession !== undefined &&
    data.selectedSession.knowledgePointId === null &&
    sessionMessageCount === 0 &&
    data.sessionSnapshots[data.selectedSession.id] === undefined &&
    data.draftPrompt.trim() === "";
  const activeSourceAssets = useMemo(
    () => sourceAssets.filter((asset) => selectedSourceAssetIds.includes(asset.id)),
    [selectedSourceAssetIds],
  );
  const effectiveEntryMode =
    fallbackSessionType === "project" && selectedSourceAssetIds.length > 0
      ? "material-import"
      : "chat-question";
  const isMaterialsTrayOpen =
    fallbackSessionType !== "project" || selectedSessionKey === null
      ? false
      : selectedSourceAssetIds.length > 0 || data.sessionMaterialTrayOpen[selectedSessionKey] === true;
  const activeSourceAssetsRef = useRef<ReadonlyArray<SourceAsset>>(activeSourceAssets);
  activeSourceAssetsRef.current = activeSourceAssets;
  const requestProjectContext = useMemo(
    () => ({
      name: data.selectedProject.name,
      goal: data.selectedProject.description,
      currentThread:
        data.selectedSession?.summary ??
        `当前 project 聚焦：${data.selectedProject.topic}`,
      successSignal: "当前 project 的知识点、学习动作和状态回写能够前后一致。",
      orchestrationWhy:
        "这是一条项目型学习链路，应该由系统结合 project context、材料和状态决定下一步。",
    }),
    [data.selectedProject.description, data.selectedProject.name, data.selectedProject.topic, data.selectedSession?.summary],
  );
  const requestSourceAssetIds = useMemo(
    () => getRequestSourceAssetIds(effectiveEntryMode, activeSourceAssets),
    [activeSourceAssets, effectiveEntryMode],
  );
  const assetSummaryKey = requestSourceAssetIds.join("|");
  const activeAssetSummary =
    assetSummaryKey === "" ? null : data.assetSummaryByKey[assetSummaryKey] ?? null;
  const activeReviewInspector = data.selectedSession
    ? data.sessionReviewInspectors[data.selectedSession.id] ?? null
    : null;
  const latestReviewedEvent = activeReviewInspector
    ? getLatestReviewEvent(activeReviewInspector.events, "reviewed")
    : null;
  const reviewHeatmap =
    isBlankSession || !hasPersistedState
      ? buildEmptyReviewHeatmap()
      : buildReviewHeatmap(
          activeReviewInspector?.events ?? [],
          latestReviewedEvent?.event_at
            ? formatDateLabel(latestReviewedEvent.event_at)
            : activeRuntime.state.lastReviewedAt,
          activeReviewInspector?.scheduledAt
            ? formatDateLabel(activeReviewInspector.scheduledAt)
            : activeRuntime.state.nextReviewAt,
        );
  const transportSessionId = data.selectedSession?.id ?? data.selectedProject.id;
  const transportSessionType = fallbackSessionType;
  const pendingActivityResultRef = useRef<AgentActivityResult | null>(null);
  const agentBaseUrl = getAgentBaseUrl();
  const isAgentRunning =
    isUsingDevTutorFixture
      ? false
      : selectedSessionKey !== null && data.runningSessionIds[selectedSessionKey] === true;
  const isAwaitingActivityFollowup = activityBatchState?.awaitingAgent === true;
  const hasPendingActivity =
    hasStructuredRuntime &&
    currentActivity !== null &&
    currentActivityResolution === null &&
    !isAwaitingActivityFollowup;
  const latestReviewedLabel = latestReviewedEvent?.event_at
    ? formatDateLabel(latestReviewedEvent.event_at) ?? "待回读"
    : activeRuntime.state.lastReviewedAt ?? "待回读";
  const nextReviewLabel = activeReviewInspector?.scheduledAt
    ? formatDateLabel(activeReviewInspector.scheduledAt) ?? "待安排"
    : activeRuntime.state.nextReviewAt ?? "待安排";
  const selectedUnitTitle = selectedUnit?.title ?? null;
  const activeTutorFixtureId = activeTutorFixture?.id ?? null;

  const handleTransportSnapshot = useCallback(
    (sessionId: string, snapshot: typeof activeRuntime) => {
      data.setSessionSnapshots((current) => ({ ...current, [sessionId]: snapshot }));
      data.setSessions((current) =>
        current.map((session) =>
          session.id === sessionId ? { ...session, status: "已更新", updatedAt: "刚刚" } : session,
        ),
      );
    },
    [data.setSessionSnapshots, data.setSessions],
  );
  const handleTransportRunStateChange = useCallback(
    (sessionId: string, isRunning: boolean) => {
      data.setRunningSessionIds((current) =>
        current[sessionId] === isRunning ? current : { ...current, [sessionId]: isRunning },
      );
    },
    [data.setRunningSessionIds],
  );
  const transport = useMemo(
    () =>
      createAgentChatTransport({
        projectId: data.selectedProject.id,
        sessionId: transportSessionId,
        sessionType: transportSessionType,
        entryMode: effectiveEntryMode,
        project: requestProjectContext,
        getSourceAssets: () => activeSourceAssetsRef.current,
        unit: runtimeUnit,
        targetUnitId: selectedSessionKnowledgePointId,
        consumeActivityResult: () => {
          const nextResult = pendingActivityResultRef.current;
          pendingActivityResultRef.current = null;
          return nextResult;
        },
        getFallbackSnapshot: () =>
          sessionSnapshotsRef.current[transportSessionId] ?? activeRuntimeRef.current,
        onSnapshot: (snapshot) => handleTransportSnapshot(transportSessionId, snapshot),
        onRunStateChange: (nextIsRunning) =>
          handleTransportRunStateChange(transportSessionId, nextIsRunning),
      }),
    [
      data.selectedProject.id,
      effectiveEntryMode,
      handleTransportRunStateChange,
      handleTransportSnapshot,
      requestProjectContext,
      runtimeUnit,
      selectedSessionKnowledgePointId,
      transportSessionId,
      transportSessionType,
    ],
  );
  const { clearError, error, messages, sendMessage } = useChat({
    id: data.selectedSession?.id ?? data.selectedProject.id ?? "project",
    messages: data.selectedSession ? data.sessionMessagesById[data.selectedSession.id] ?? [] : [],
    transport,
  });
  const displayMessages = isUsingDevTutorFixture ? data.devTutorFixtureState?.messages ?? [] : messages;
  const latestAssistantMessageId =
    [...displayMessages].reverse().find((message) => message.role === "assistant")?.id ?? null;
  const errorMessage = isUsingDevTutorFixture
    ? data.devTutorFixtureState?.errorMessage ?? null
    : getErrorMessage(error);
  const composerDisabled = hasPendingActivity || isAgentRunning || agentBaseUrl === null;
  const activityInputDisabled =
    isAgentRunning || agentBaseUrl === null || isAwaitingActivityFollowup;

  useEffect(() => {
    if (selectedSessionKey === null || activityBatchState === null || deckKey === null) {
      return;
    }

    if (activityBatchState.deckKey === deckKey) {
      return;
    }

    data.setActivityBatchStateBySession((current) => {
      if (current[selectedSessionKey] === undefined) {
        return current;
      }
      const next = { ...current };
      delete next[selectedSessionKey];
      return next;
    });
  }, [
    activityBatchState,
    data.setActivityBatchStateBySession,
    deckKey,
    selectedSessionKey,
  ]);

  useEffect(() => {
    if (
      selectedSessionKey === null ||
      activityBatchState === null ||
      !activityBatchState.awaitingAgent ||
      latestAssistantMessageId === null ||
      latestAssistantMessageId === activityBatchState.assistantMessageIdBeforeSend
    ) {
      return;
    }

    pendingActivityResultRef.current = null;
    data.setActivityBatchStateBySession((current) => {
      if (current[selectedSessionKey] === undefined) {
        return current;
      }
      const next = { ...current };
      delete next[selectedSessionKey];
      return next;
    });
  }, [
    activityBatchState,
    data.setActivityBatchStateBySession,
    latestAssistantMessageId,
    selectedSessionKey,
  ]);

  useEffect(() => {
    if (
      selectedSessionKey === null ||
      error === undefined ||
      activityBatchState === null ||
      !activityBatchState.awaitingAgent
    ) {
      return;
    }

    pendingActivityResultRef.current = null;
    data.setActivityBatchStateBySession((current) => {
      const sessionState = current[selectedSessionKey];
      if (sessionState === undefined || !sessionState.awaitingAgent) {
        return current;
      }

      return {
        ...current,
        [selectedSessionKey]: {
          ...sessionState,
          awaitingAgent: false,
          results: sessionState.results.slice(0, -1),
        },
      };
    });
  }, [
    activityBatchState,
    data.setActivityBatchStateBySession,
    error,
    selectedSessionKey,
  ]);

  useFixtureSync({ data, fixtureIdFromUrl });
  useAgentHealth(data);
  useSessionRuntimeSync({
    currentActivityKey,
    data,
    error,
    messages,
    projectContext: requestProjectContext,
    runtimeUnit,
    sendMessage,
  });
  useSessionDataSync({
    assetSummaryKey,
    data,
    isAgentRunning,
    messagesLength: messages.length,
    requestSourceAssetIds,
    seedRuntime,
    selectedSessionKey,
    selectedSessionKnowledgePointId,
    selectedSessionType: fallbackSessionType,
  });

  const actions = createSessionActions({
    activeRuntime,
    activeTutorFixture,
    clearError,
    currentActivity,
    currentActivities,
    currentDeckKey: deckKey,
    currentActivityKey,
    currentActivityBatchState:
      deckKey !== null && activityBatchState?.deckKey === deckKey ? activityBatchState : null,
    data,
    error,
    handleCreateSession,
    isMaterialsTrayOpen,
    isUsingDevTutorFixture,
    latestAssistantMessageId,
    onQueueActivityResult: (result) => {
      pendingActivityResultRef.current = result;
    },
    selectedSessionKey,
    selectedSessionKnowledgePointId,
    sendMessage,
  });

  return {
    activeAssetSummary,
    activeReviewInspector,
    activeRuntime,
    activeSourceAssets,
    activeTutorFixtureId,
    currentActivities,
    currentActivity,
    currentActivityKey,
    currentActivityResolution,
    completedActivityDecks,
    displayMessages,
    error,
    errorMessage,
    ...actions,
    hasPendingActivity,
    hasPersistedState,
    hasStructuredRuntime,
    isAgentRunning,
    isBlankSession,
    isMaterialsTrayOpen,
    isUsingDevTutorFixture,
    latestAssistantMessageId,
    latestReviewedEvent,
    latestReviewedLabel,
    nextReviewLabel,
    requestSourceAssetIds,
    reviewHeatmap,
    selectedSourceAssetIds,
    selectedUnit,
    selectedUnitTitle,
    activityInputDisabled,
    composerDisabled,
  };
}
