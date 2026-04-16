import { useChat } from "@ai-sdk/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { learningUnits, projectContext, sourceAssets } from "@/data/demo";
import { getTutorFixtureScenario } from "@/data/tutor-fixtures";
import {
  buildDefaultAgentPrompt,
  buildMockRuntimeSnapshot,
  getRequestSourceAssetIds,
  hydrateRuntimeSnapshotFromLearnerState,
} from "@/domain/agent-runtime";
import { getLatestUserDraft } from "@/domain/chat-message";
import {
  buildEmptyReviewHeatmap,
  buildReviewHeatmap,
  formatDateLabel,
  getLatestIsoDate,
} from "@/domain/review-heatmap";
import {
  buildGeneratedProfileSummary,
  getActionLabel,
  getErrorMessage,
  getLatestReviewEvent,
} from "@/domain/project-session-runtime";
import type { LearningActivitySubmission, SourceAsset } from "@/domain/types";
import {
  getAgentBaseUrl,
  getAgentHealth,
  getAssetSummary,
  getInspectorBootstrap,
  getReviewInspector,
  getThreadContext,
} from "@/lib/agent-client";
import { createAgentChatTransport } from "@/lib/agent-chat-transport";
import {
  selectFixture,
} from "@/app/project-session-agent-dev-fixture";
import { createProjectSessionAgentActions } from "@/app/project-session-agent-actions";
import type { ProjectWorkspaceData } from "@/app/use-project-workspace-data";

export function useProjectSessionAgent({
  data,
  handleCreateSession,
}: {
  data: ProjectWorkspaceData;
  handleCreateSession: (
    projectId: string,
    type?: "project" | "study" | "review",
    knowledgePointId?: string | null,
    initialSourceAssetIds?: ReadonlyArray<string>,
  ) => { id: string } | null;
}) {
  const selectedSessionKey = data.selectedSession?.id ?? null;
  const selectedSessionKnowledgePointId = data.selectedSession?.knowledgePointId ?? null;
  const selectedUnit = selectedSessionKnowledgePointId
    ? learningUnits.find((unit) => unit.id === selectedSessionKnowledgePointId)
    : undefined;
  const runtimeUnit = selectedUnit ?? data.initialUnit;
  const selectedSourceAssetIds = data.selectedSession
    ? data.sessionSourceAssetIds[data.selectedSession.id] ?? []
    : [];
  const latestUserInput = getLatestUserDraft(
    data.selectedSession ? data.sessionMessagesById[data.selectedSession.id] ?? [] : [],
    data.draftPrompt,
  );
  const seedRuntime = useMemo(
    () => buildMockRuntimeSnapshot(data.initialProfile, runtimeUnit),
    [data.initialProfile, runtimeUnit],
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
  const currentActivities =
    activeRuntime.activities.length > 0
      ? activeRuntime.activities
      : activeRuntime.activity === null
        ? []
        : [activeRuntime.activity];
  const currentActivity = currentActivities[0] ?? null;
  const currentActivityKey =
    currentActivity === null
      ? null
      : `${currentActivity.id}:${activeRuntime.assistantMessage || activeRuntime.decision.reason}`;
  const currentActivityResolution =
    selectedSessionKey === null || currentActivityKey === null
      ? null
      : data.activityResolutionsBySession[selectedSessionKey]?.[currentActivityKey] ?? null;
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
  const effectiveEntryMode = selectedSourceAssetIds.length > 0 ? "material-import" : "chat-question";
  const isMaterialsTrayOpen =
    selectedSessionKey === null
      ? false
      : selectedSourceAssetIds.length > 0 || data.sessionMaterialTrayOpen[selectedSessionKey] === true;
  const activeSourceAssetsRef = useRef<ReadonlyArray<SourceAsset>>(activeSourceAssets);
  activeSourceAssetsRef.current = activeSourceAssets;
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
  const isAgentRunning =
    isUsingDevTutorFixture
      ? false
      : selectedSessionKey !== null && data.runningSessionIds[selectedSessionKey] === true;
  const hasPendingActivity =
    hasStructuredRuntime && currentActivity !== null && currentActivityResolution === null;
  const generatedProfile = buildGeneratedProfileSummary(activeRuntime, latestUserInput);
  const generatedProfileSummary = generatedProfile.summary;
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
    [data],
  );
  const handleTransportRunStateChange = useCallback(
    (sessionId: string, isRunning: boolean) => {
      data.setRunningSessionIds((current) =>
        current[sessionId] === isRunning ? current : { ...current, [sessionId]: isRunning },
      );
    },
    [data],
  );
  const transport = useMemo(
    () =>
      createAgentChatTransport({
        projectId: data.selectedProject.id,
        sessionId: transportSessionId,
        entryMode: effectiveEntryMode,
        project: projectContext,
        getSourceAssets: () => activeSourceAssetsRef.current,
        unit: runtimeUnit,
        getFallbackSnapshot: () =>
          data.sessionSnapshotsRef.current[transportSessionId] ?? activeRuntime,
        onSnapshot: (snapshot) => handleTransportSnapshot(transportSessionId, snapshot),
        onRunStateChange: (nextIsRunning) =>
          handleTransportRunStateChange(transportSessionId, nextIsRunning),
      }),
    [activeRuntime, data.selectedProject.id, data.sessionSnapshotsRef, effectiveEntryMode, handleTransportRunStateChange, handleTransportSnapshot, runtimeUnit, transportSessionId],
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
  const submitDisabled = hasPendingActivity || isAgentRunning || getAgentBaseUrl() === null;

  useEffect(() => {
    if (!data.isDevEnvironment) {
      return;
    }
    const fixtureFromUrl = getTutorFixtureScenario(fixtureIdFromUrl);
    if (fixtureFromUrl !== null && data.devTutorFixtureState?.fixtureId !== fixtureFromUrl.id) {
      data.setDevTutorFixtureState(selectFixture(fixtureFromUrl));
    }
  }, [data, fixtureIdFromUrl]);

  useEffect(() => {
    const agentBaseUrl = getAgentBaseUrl();
    if (agentBaseUrl === null) {
      data.setAgentConnectionState("offline");
      return;
    }
    const abortController = new AbortController();
    data.setAgentConnectionState("checking");
    void getAgentHealth({ signal: abortController.signal })
      .then((healthy) => {
        if (!abortController.signal.aborted) {
          data.setAgentConnectionState(healthy ? "ready" : "offline");
        }
      })
      .catch(() => {
        if (!abortController.signal.aborted) {
          data.setAgentConnectionState("offline");
        }
      });
    return () => abortController.abort();
  }, [data]);

  useEffect(() => {
    data.setDraftPrompt(
      data.selectedSession?.knowledgePointId === null
        ? ""
        : buildDefaultAgentPrompt(runtimeUnit, projectContext),
    );
  }, [data, runtimeUnit]);

  useEffect(() => {
    if (data.selectedSession !== undefined) {
      data.setSessionMessagesById((current) =>
        current[data.selectedSession!.id] === messages
          ? current
          : { ...current, [data.selectedSession!.id]: messages },
      );
    }
  }, [data, messages]);

  useEffect(() => {
    if (data.selectedSession === undefined || error === undefined) {
      return;
    }
    if (currentActivityKey !== null) {
      data.setActivityResolutionsBySession((current) => {
        const nextSessionResolutions = { ...(current[data.selectedSession!.id] ?? {}) };
        delete nextSessionResolutions[currentActivityKey];
        return { ...current, [data.selectedSession!.id]: nextSessionResolutions };
      });
    }
    data.setRunningSessionIds((current) => ({ ...current, [data.selectedSession!.id]: false }));
    data.setSessions((current) =>
      current.map((session) =>
        session.id === data.selectedSession!.id && session.status !== "错误"
          ? { ...session, status: "错误", updatedAt: "刚刚" }
          : session,
      ),
    );
  }, [currentActivityKey, data, error]);

  useEffect(() => {
    if (
      data.agentConnectionState !== "ready" ||
      selectedSessionKey === null ||
      selectedSessionKnowledgePointId === null
    ) {
      return;
    }
    const bootstrapKey = `${selectedSessionKey}:${selectedSessionKnowledgePointId}`;
    if (data.bootstrapLoadedKeysRef.current[bootstrapKey]) {
      return;
    }
    data.bootstrapLoadedKeysRef.current[bootstrapKey] = true;
    const abortController = new AbortController();
    void getInspectorBootstrap(selectedSessionKey, selectedSessionKnowledgePointId, { signal: abortController.signal })
      .then(({ learner_state, review_inspector, thread_context }) => {
        if (abortController.signal.aborted) return;
        if (learner_state !== null) {
          data.setSessionSnapshots((current) => ({
            ...current,
            [selectedSessionKey]: hydrateRuntimeSnapshotFromLearnerState(learner_state, seedRuntime),
          }));
        }
        data.setSessionReviewInspectors((current) => ({ ...current, [selectedSessionKey]: review_inspector }));
        if (thread_context !== null) {
          data.sessionEntryModesSetter((current) => ({ ...current, [selectedSessionKey]: thread_context.entry_mode }));
          data.setSessionSourceAssetIds((current) => ({ ...current, [selectedSessionKey]: thread_context.source_asset_ids }));
        }
      })
      .catch(() => {
        delete data.bootstrapLoadedKeysRef.current[bootstrapKey];
      });
    return () => abortController.abort();
  }, [data, seedRuntime, selectedSessionKey, selectedSessionKnowledgePointId]);

  useEffect(() => {
    if (data.agentConnectionState !== "ready" || assetSummaryKey === "") return;
    const abortController = new AbortController();
    void getAssetSummary(requestSourceAssetIds, { signal: abortController.signal })
      .then((summary) => {
        if (!abortController.signal.aborted) {
          data.setAssetSummaryByKey((current) =>
            current[assetSummaryKey] !== undefined ? current : { ...current, [assetSummaryKey]: summary },
          );
        }
      })
      .catch(() => undefined);
    return () => abortController.abort();
  }, [assetSummaryKey, data, requestSourceAssetIds]);

  useEffect(() => {
    if (
      data.agentConnectionState !== "ready" ||
      selectedSessionKey === null ||
      selectedSessionKnowledgePointId === null ||
      isAgentRunning ||
      messages.length === 0
    ) {
      return;
    }
    const abortController = new AbortController();
    void getReviewInspector(selectedSessionKey, selectedSessionKnowledgePointId, { signal: abortController.signal })
      .then((reviewInspector) => {
        if (!abortController.signal.aborted) {
          data.setSessionReviewInspectors((current) => ({ ...current, [selectedSessionKey]: reviewInspector }));
        }
      })
      .catch(() => undefined);
    void getThreadContext(selectedSessionKey, { signal: abortController.signal })
      .then((threadContext) => {
        if (!abortController.signal.aborted && threadContext !== null) {
          data.sessionEntryModesSetter((current) => ({ ...current, [selectedSessionKey]: threadContext.entry_mode }));
          data.setSessionSourceAssetIds((current) => ({ ...current, [selectedSessionKey]: threadContext.source_asset_ids }));
        }
      })
      .catch(() => undefined);
    return () => abortController.abort();
  }, [data, isAgentRunning, messages.length, selectedSessionKey, selectedSessionKnowledgePointId]);

  useEffect(() => {
    if (data.pendingInitialPrompt === null || data.selectedSession?.id !== data.pendingInitialPrompt.sessionId) {
      return;
    }
    data.setSessions((current) =>
      current.map((session) =>
        session.id === data.pendingInitialPrompt!.sessionId
          ? { ...session, summary: data.pendingInitialPrompt!.sessionSummary, updatedAt: "刚刚", status: "运行中" }
          : session,
      ),
    );
    data.setRunningSessionIds((current) => ({ ...current, [data.pendingInitialPrompt!.sessionId]: true }));
    void sendMessage({ text: data.pendingInitialPrompt.text });
    data.setPendingInitialPrompt(null);
  }, [data, sendMessage]);

  const actions = createProjectSessionAgentActions({
    activeRuntime,
    activeTutorFixture,
    clearError,
    currentActivity,
    currentActivityKey,
    data,
    error,
    handleCreateSession,
    isMaterialsTrayOpen,
    isUsingDevTutorFixture,
    selectedSessionKey,
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
    displayMessages,
    error,
    errorMessage,
    generatedProfileSummary,
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
    submitDisabled,
  };
}
