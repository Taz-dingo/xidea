import { useChat } from "@ai-sdk/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  type AgentActivityResult,
  type AgentEntryMode,
  type AgentKnowledgePointSuggestion,
  type AgentRequest,
  buildEmptyRuntimeSnapshot,
  getRequestSourceAssetIds,
} from "@/domain/agent-runtime";
import { mergeMessageHistory } from "@/domain/chat-message";
import { toKnowledgePointItem } from "@/domain/knowledge-point-sync";
import { buildSessionOrchestrationMessage } from "@/domain/session-orchestration";
import {
  buildEmptyReviewHeatmap,
  buildReviewHeatmap,
  formatDateLabel,
  getLatestIsoDate,
} from "@/domain/review-heatmap";
import {
  buildActivityReplayState,
  buildActivityDeckKey,
  getVisibleActivitiesForBatch,
  type SessionActivityBatchState,
  getErrorMessage,
  getLatestReviewEvent,
} from "@/domain/project-session-runtime";
import { buildPendingSessionId } from "@/domain/project-workspace";
import type { SourceAsset } from "@/domain/types";
import {
  confirmKnowledgePointSuggestion,
  getAgentBaseUrl,
} from "@/lib/agent-client";
import { createAgentChatTransport } from "@/lib/agent-chat-transport";
import { createSessionActions } from "@/app/workspace/agent/session-actions";
import { useAgentHealth } from "@/app/workspace/agent/effects/use-agent-health";
import { useProjectKnowledgeSync } from "@/app/workspace/agent/effects/use-project-knowledge-sync";
import { useProjectMaterialsSync } from "@/app/workspace/agent/effects/use-project-materials-sync";
import { useProjectReviewInspectorsSync } from "@/app/workspace/agent/effects/use-project-review-inspectors-sync";
import { useProjectSessionsSync } from "@/app/workspace/agent/effects/use-project-sessions-sync";
import { useSessionDataSync } from "@/app/workspace/agent/effects/use-session-data-sync";
import { useSessionRuntimeSync } from "@/app/workspace/agent/effects/use-session-runtime-sync";
import type { WorkspaceData } from "@/app/workspace/hooks/use-data";

function buildKnowledgePointLearningUnit(
  point: WorkspaceData["knowledgePoints"][number],
): WorkspaceData["initialUnit"] {
  return {
    id: point.id,
    title: point.title,
    summary: point.description,
    weaknessTags: [],
    candidateModes: ["guided-qa", "contrast-drill"],
    difficulty: 3,
  };
}

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
  const pendingSessionKey =
    data.pendingSessionIntent === null
      ? null
      : buildPendingSessionId({
          projectId: data.pendingSessionIntent.projectId,
          type: data.pendingSessionIntent.type,
          knowledgePointId: data.pendingSessionIntent.knowledgePointId,
        });
  const selectedSessionKey = data.selectedSession?.id ?? pendingSessionKey;
  const fallbackSessionType =
    data.selectedSession?.type ?? data.pendingSessionIntent?.type ?? "project";
  const sessionSnapshotsRef = useRef(data.sessionSnapshots);
  sessionSnapshotsRef.current = data.sessionSnapshots;
  const activeRuntimeRef = useRef<ReturnType<typeof buildEmptyRuntimeSnapshot>>(
    buildEmptyRuntimeSnapshot(data.initialUnit, fallbackSessionType),
  );
  const runtimeFocusKnowledgePointId =
    data.selectedSession === undefined
      ? data.pendingSessionIntent?.knowledgePointId ?? null
      : data.sessionSnapshots[data.selectedSession.id]?.orchestration.current?.current_focus_id ??
        data.selectedSession.knowledgePointId ??
        null;
  const selectedKnowledgePoint =
    runtimeFocusKnowledgePointId === null
      ? undefined
      : data.knowledgePoints.find((point) => point.id === runtimeFocusKnowledgePointId);
  const selectedUnit = runtimeFocusKnowledgePointId
    ? (selectedKnowledgePoint ? buildKnowledgePointLearningUnit(selectedKnowledgePoint) : undefined)
    : undefined;
  const runtimeUnit = selectedUnit ?? data.initialUnit;
  const selectedSourceAssetIds =
    fallbackSessionType === "project" && selectedSessionKey !== null
      ? data.sessionSourceAssetIds[selectedSessionKey] ?? []
      : [];
  const emptyRuntime = useMemo(
    () => buildEmptyRuntimeSnapshot(runtimeUnit, fallbackSessionType),
    [fallbackSessionType, runtimeUnit],
  );
  const persistedMessageCount = data.selectedSession
    ? data.sessionMessagesById[data.selectedSession.id]?.length ?? 0
    : 0;
  const persistedRuntimeSource = data.selectedSession
    ? data.sessionSnapshots[data.selectedSession.id]?.source ?? null
    : null;
  const activeRuntime =
    data.selectedSession === undefined
      ? emptyRuntime
      : data.sessionSnapshots[data.selectedSession.id] ?? emptyRuntime;
  activeRuntimeRef.current = activeRuntime;
  const replayState =
    selectedSessionKey === null
      ? null
      : data.activityReplayStateBySession[selectedSessionKey] ?? null;
  const deckKey =
    replayState?.replayDeckKey ?? buildActivityDeckKey(activeRuntime);
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
  const visibleActivitiesSource = replayState?.activities ?? baseActivities;
  const currentActivities = getVisibleActivitiesForBatch({
    activities: visibleActivitiesSource,
    batchState:
      deckKey !== null && activityBatchState?.deckKey === deckKey ? activityBatchState : null,
    deckKey,
  });
  const currentActivity = currentActivities[0] ?? null;
  const currentActivityKey =
    currentActivity === null
      ? null
      : replayState !== null
        ? `${currentActivity.id}:${replayState.replayDeckKey}`
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
  const sessionMessageCount = persistedMessageCount;
  const isBlankSession =
    data.selectedSession !== undefined &&
    data.selectedSession.knowledgePointId === null &&
    sessionMessageCount === 0 &&
    data.sessionSnapshots[data.selectedSession.id] === undefined &&
    data.draftPrompt.trim() === "";
  const activeSourceAssets = useMemo(
    () => data.selectedProjectAssets.filter((asset) => selectedSourceAssetIds.includes(asset.id)),
    [data.selectedProjectAssets, selectedSourceAssetIds],
  );
  const effectiveEntryMode: AgentEntryMode =
    fallbackSessionType === "project" && selectedSourceAssetIds.length > 0
      ? "material-import"
      : "chat-question";
  const isMaterialsTrayOpen =
    fallbackSessionType !== "project" || selectedSessionKey === null
      ? false
      : selectedSourceAssetIds.length > 0 || data.sessionMaterialTrayOpen[selectedSessionKey] === true;
  const activeSourceAssetsRef = useRef<ReadonlyArray<SourceAsset>>(activeSourceAssets);
  activeSourceAssetsRef.current = activeSourceAssets;
  const pendingSourceAssetsRef = useRef<ReadonlyArray<SourceAsset> | null>(null);
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
  const transportSessionId = data.selectedSession?.id ?? data.selectedProject.id;
  const transportSessionType = fallbackSessionType;
  const requestConfigRef = useRef({
    sessionType: transportSessionType,
    sessionTitle: data.selectedSession?.title ?? null,
    sessionSummary: data.selectedSession?.summary ?? null,
    knowledgePointId: data.selectedSession?.knowledgePointId ?? null,
    entryMode: effectiveEntryMode,
    project: requestProjectContext,
    unit: runtimeUnit,
    targetUnitId: runtimeFocusKnowledgePointId,
  });
  requestConfigRef.current = {
    sessionType: transportSessionType,
    sessionTitle: data.selectedSession?.title ?? null,
    sessionSummary: data.selectedSession?.summary ?? null,
    knowledgePointId: runtimeFocusKnowledgePointId,
    entryMode: effectiveEntryMode,
    project: requestProjectContext,
    unit: runtimeUnit,
    targetUnitId: runtimeFocusKnowledgePointId,
  };
  const handledSuggestionIdsRef = useRef<Set<string>>(new Set());
  const requestSourceAssetIds = useMemo(
    () => getRequestSourceAssetIds(effectiveEntryMode, activeSourceAssets),
    [activeSourceAssets, effectiveEntryMode],
  );
  const assetSummaryKey = requestSourceAssetIds.join("|");
  const activeAssetSummary =
    assetSummaryKey === "" ? null : data.assetSummaryByKey[assetSummaryKey] ?? null;
  const activeMaterialRead =
    assetSummaryKey === "" ? null : data.materialReadByKey[assetSummaryKey] ?? null;
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
  const pendingActivityResultRef = useRef<AgentActivityResult | null>(null);
  const agentBaseUrl = getAgentBaseUrl();
  const isAgentRunning =
    selectedSessionKey !== null && data.runningSessionIds[selectedSessionKey] === true;
  const isAwaitingActivityFollowup = activityBatchState?.awaitingAgent === true;
  const hasPendingActivity =
    currentActivity !== null &&
    currentActivityResolution === null &&
    !isAwaitingActivityFollowup &&
    (hasStructuredRuntime || replayState !== null);
  const latestReviewedLabel = latestReviewedEvent?.event_at
    ? formatDateLabel(latestReviewedEvent.event_at) ?? "待回读"
    : activeRuntime.state.lastReviewedAt ?? "待回读";
  const nextReviewLabel = activeReviewInspector?.scheduledAt
    ? formatDateLabel(activeReviewInspector.scheduledAt) ?? "待安排"
    : activeRuntime.state.nextReviewAt ?? "待安排";
  const selectedUnitTitle = selectedUnit?.title ?? null;

  const handleTransportSnapshot = useCallback(
    (sessionId: string, snapshot: typeof activeRuntime) => {
      data.setSessionSnapshots((current) => ({ ...current, [sessionId]: snapshot }));
      data.setSessions((current) =>
        current.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                knowledgePointId:
                  snapshot.orchestration.current?.current_focus_id ?? session.knowledgePointId,
                status: "已更新",
                updatedAt: "刚刚",
              }
            : session,
        ),
      );
    },
    [data.setSessionSnapshots, data.setSessions],
  );
  const handleTransportOrchestrationEvent = useCallback(
    (sessionId: string, change: Parameters<typeof buildSessionOrchestrationMessage>[0]["change"]) => {
      if (change.visibility !== "timeline") {
        return;
      }
      const nextMessage = buildSessionOrchestrationMessage({ sessionId, change });
      data.setSessionMessagesById((current) => {
        const currentMessages = current[sessionId] ?? [];
        if (currentMessages.some((message) => message.id === nextMessage.id)) {
          return current;
        }
        return {
          ...current,
          [sessionId]: [...currentMessages, nextMessage],
        };
      });
    },
    [data.setSessionMessagesById],
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
        getRequestConfig: () => requestConfigRef.current,
        consumeSourceAssets: () => {
          const queuedSourceAssets = pendingSourceAssetsRef.current;
          pendingSourceAssetsRef.current = null;
          return queuedSourceAssets ?? activeSourceAssetsRef.current;
        },
        consumeActivityResult: () => {
          const nextResult = pendingActivityResultRef.current;
          pendingActivityResultRef.current = null;
          return nextResult;
        },
        getFallbackSnapshot: () =>
          sessionSnapshotsRef.current[transportSessionId] ?? activeRuntimeRef.current,
        onSnapshot: (snapshot) => handleTransportSnapshot(transportSessionId, snapshot),
        onSessionOrchestration: (change) =>
          handleTransportOrchestrationEvent(transportSessionId, change),
        onKnowledgePointSuggestions: (
          suggestions: ReadonlyArray<AgentKnowledgePointSuggestion>,
          request: AgentRequest,
          assistantMessageId: string,
        ) => {
          if (request.session_type !== "project" || request.entry_mode !== "material-import") {
            return;
          }

          for (const suggestion of suggestions) {
            if (suggestion.kind !== "create") {
              continue;
            }
            if (suggestion.status === "accepted" && suggestion.knowledge_point_id !== null) {
              data.setKnowledgePoints((current) =>
                current.map((point) =>
                  point.id !== suggestion.knowledge_point_id
                    ? point
                    : {
                        ...point,
                        linkedSessionIds: point.linkedSessionIds.includes(suggestion.session_id)
                          ? point.linkedSessionIds
                          : [...point.linkedSessionIds, suggestion.session_id],
                        linkedMessageIdsBySession:
                          point.linkedMessageIdsBySession[suggestion.session_id] ===
                          assistantMessageId
                            ? point.linkedMessageIdsBySession
                            : {
                                ...point.linkedMessageIdsBySession,
                                [suggestion.session_id]: assistantMessageId,
                              },
                      },
                ),
              );
              data.setSelectedKnowledgePointId(suggestion.knowledge_point_id);
              continue;
            }
            if (
              suggestion.status !== "pending" ||
              handledSuggestionIdsRef.current.has(suggestion.id)
            ) {
              continue;
            }
            handledSuggestionIdsRef.current.add(suggestion.id);
            void confirmKnowledgePointSuggestion(request.project_id, suggestion.id)
              .then((resolution) => {
                const nextPoint = toKnowledgePointItem(resolution);
                if (nextPoint === null) {
                  return;
                }
                data.setKnowledgePoints((current) => {
                  const previousPoint = current.find((point) => point.id === nextPoint.id);
                  const remainingPoints = current.filter((point) => point.id !== nextPoint.id);
                  const previousLinkedSessionIds = previousPoint?.linkedSessionIds ?? [];
                  const nextLinkedSessionIds = previousLinkedSessionIds.includes(
                    resolution.suggestion.session_id,
                  )
                    ? previousLinkedSessionIds
                    : [
                        ...previousLinkedSessionIds,
                        resolution.suggestion.session_id,
                        ...nextPoint.linkedSessionIds,
                      ].filter(
                        (sessionId, index, array) => array.indexOf(sessionId) === index,
                      );
                  const nextLinkedMessageIdsBySession = {
                    ...(previousPoint?.linkedMessageIdsBySession ?? {}),
                    ...nextPoint.linkedMessageIdsBySession,
                    [resolution.suggestion.session_id]: assistantMessageId,
                  };
                  return [
                    ...remainingPoints,
                    {
                      ...nextPoint,
                      linkedSessionIds: nextLinkedSessionIds,
                      linkedMessageIdsBySession: nextLinkedMessageIdsBySession,
                    },
                  ];
                });
                data.setSelectedKnowledgePointId(nextPoint.id);
              })
              .catch(() => {
                handledSuggestionIdsRef.current.delete(suggestion.id);
              });
          }
        },
        onRunStateChange: (nextIsRunning) =>
          handleTransportRunStateChange(transportSessionId, nextIsRunning),
      }),
    [
      data.selectedProject.id,
      runtimeFocusKnowledgePointId,
      data.selectedSession?.summary,
      data.selectedSession?.title,
      handleTransportOrchestrationEvent,
      handleTransportRunStateChange,
      handleTransportSnapshot,
      data.setKnowledgePoints,
      data.setSelectedKnowledgePointId,
      transportSessionId,
    ],
  );
  const { clearError, error, messages, sendMessage } = useChat({
    id: data.selectedSession?.id ?? data.selectedProject.id ?? "project",
    messages: data.selectedSession ? data.sessionMessagesById[data.selectedSession.id] ?? [] : [],
    transport,
  });
  const persistedMessages =
    data.selectedSession === undefined
      ? []
      : data.sessionMessagesById[data.selectedSession.id] ?? [];
  const displayMessages = useMemo(
    () => {
      if (!isAgentRunning) {
        return persistedMessages.length > 0 ? persistedMessages : messages;
      }
      return mergeMessageHistory(persistedMessages, messages);
    },
    [isAgentRunning, messages, persistedMessages],
  );
  const latestAssistantMessageId =
    [...displayMessages].reverse().find((message) => message.role === "assistant")?.id ?? null;
  const errorMessage = getErrorMessage(error);
  const composerDisabled = hasPendingActivity || isAgentRunning || agentBaseUrl === null;
  const activityInputDisabled =
    isAgentRunning || agentBaseUrl === null || isAwaitingActivityFollowup;

  useProjectMaterialsSync({
    data,
    projectId: data.selectedProject.id,
  });
  useProjectKnowledgeSync({
    data,
    projectId: data.selectedProject.id,
  });
  useProjectSessionsSync({
    data,
    projectId: data.selectedProject.id,
    selectedSessionKey,
  });
  useProjectReviewInspectorsSync({
    data,
    projectSessions: data.selectedProjectSessions,
  });

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
    data.setActivityReplayStateBySession((current) => {
      const currentReplayState = current[selectedSessionKey];
      if (
        currentReplayState === undefined ||
        currentReplayState === null ||
        currentReplayState.replayDeckKey !== activityBatchState.deckKey
      ) {
        return current;
      }

      return {
        ...current,
        [selectedSessionKey]: null,
      };
    });
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
    data.setActivityReplayStateBySession,
    data.setActivityBatchStateBySession,
    latestAssistantMessageId,
    selectedSessionKey,
  ]);

  useEffect(() => {
    if (
      selectedSessionKey === null ||
      activityBatchState === null ||
      !activityBatchState.awaitingAgent ||
      isAgentRunning
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
    isAgentRunning,
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

  useAgentHealth(data);
  useSessionRuntimeSync({
    currentActivityKey,
    data,
    error,
    messages: displayMessages,
    sendMessage,
  });
  useSessionDataSync({
    assetSummaryKey,
    data,
    isAgentRunning,
    messagesLength: displayMessages.length,
    projectId: data.selectedProject.id,
    requestSourceAssetIds,
    fallbackRuntime: emptyRuntime,
    selectedSessionKey,
    selectedSessionKnowledgePointId: runtimeFocusKnowledgePointId,
    selectedSessionType: fallbackSessionType,
  });

  const actions = createSessionActions({
    activeRuntime,
    activeSessionType: fallbackSessionType,
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
    latestAssistantMessageId,
    onQueueActivityResult: (result) => {
      pendingActivityResultRef.current = result;
    },
    prepareSourceAssetsForSend: () => {
      pendingSourceAssetsRef.current = [...activeSourceAssetsRef.current];
    },
    selectedSessionKey,
    selectedSessionKnowledgePointId: runtimeFocusKnowledgePointId,
    sendMessage,
  });
  const handleReplayDeck = useCallback(
    (deck: typeof completedActivityDecks[number]) => {
      if (
        selectedSessionKey === null ||
        isAgentRunning ||
        hasPendingActivity ||
        replayState !== null ||
        activityBatchState?.awaitingAgent === true
      ) {
        return;
      }

      const nextReplayState = buildActivityReplayState(deck);
      if (nextReplayState === null) {
        return;
      }

      if (error !== undefined) {
        clearError();
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
      data.setActivityReplayStateBySession((current) => ({
        ...current,
        [selectedSessionKey]: nextReplayState,
      }));
    },
    [
      activityBatchState?.awaitingAgent,
      clearError,
      data.setActivityBatchStateBySession,
      data.setActivityReplayStateBySession,
      error,
      hasPendingActivity,
      isAgentRunning,
      replayState,
      selectedSessionKey,
    ],
  );

  return {
    activeAssetSummary,
    activeMaterialRead,
    activeReviewInspector,
    activeRuntime,
    activeSourceAssets,
    currentActivities,
    currentActivity,
    currentActivityKey,
    currentActivityResolution,
    completedActivityDecks,
    displayMessages,
    error,
    errorMessage,
    ...actions,
    handleReplayDeck,
    hasPendingActivity,
    hasPersistedState,
    hasStructuredRuntime,
    isAgentRunning,
    isBlankSession,
    isReplayingDeck: replayState !== null,
    isMaterialsTrayOpen,
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
