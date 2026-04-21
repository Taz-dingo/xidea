import { useEffect, useRef } from "react";
import {
  getAssetSummary,
  getMaterialRead,
  getThreadActivityDecks,
  getInspectorBootstrap,
  getReviewInspector,
  getThreadContext,
} from "@/lib/agent-client";
import {
  mergeReviewInspector,
  hydrateRuntimeSnapshotFromLearnerState,
  hydrateRuntimeSnapshotFromThreadContext,
} from "@/domain/agent-runtime";
import { REVIEW_HEATMAP_LOOKBACK_DAYS } from "@/domain/review-heatmap";
import { buildSessionOrchestrationMessage } from "@/domain/session-orchestration";
import type { WorkspaceData } from "@/app/workspace/hooks/use-data";

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function useSessionDataSync({
  assetSummaryKey,
  data,
  isAgentRunning,
  messagesLength,
  projectId,
  requestSourceAssetIds,
  fallbackRuntime,
  selectedSessionKey,
  selectedSessionKnowledgePointId,
  selectedSessionType,
}: {
  assetSummaryKey: string;
  data: WorkspaceData;
  isAgentRunning: boolean;
  messagesLength: number;
  projectId: string;
  requestSourceAssetIds: ReadonlyArray<string>;
  fallbackRuntime: ReturnType<typeof hydrateRuntimeSnapshotFromLearnerState>;
  selectedSessionKey: string | null;
  selectedSessionKnowledgePointId: string | null;
  selectedSessionType: "project" | "study" | "review";
}): void {
  const syncedActivityDecksKeyRef = useRef<string | null>(null);
  const syncedSessionMetaKeyRef = useRef<string | null>(null);
  const {
    agentConnectionState,
    assetSummaryByKey,
    bootstrapLoadedKeys,
    clearBootstrapLoaded,
    markBootstrapLoaded,
    materialReadByKey,
    sessionEntryModes,
    sessionEntryModesSetter,
    setAssetSummaryByKey,
    setCompletedActivityDecksBySession,
    setMaterialReadByKey,
    setSessionReviewInspectors,
    setSessionSnapshots,
  } = data;
  const selectedSessionEntryMode =
    selectedSessionKey === null ? undefined : sessionEntryModes[selectedSessionKey];

  useEffect(() => {
    if (
      agentConnectionState !== "ready" ||
      selectedSessionKey === null ||
      selectedSessionKnowledgePointId === null
    ) {
      return;
    }
    const bootstrapKey = `${selectedSessionKey}:${selectedSessionKnowledgePointId}`;
    if (bootstrapLoadedKeys[bootstrapKey]) {
      return;
    }
    markBootstrapLoaded(bootstrapKey);
    const abortController = new AbortController();
    void getInspectorBootstrap(selectedSessionKey, selectedSessionKnowledgePointId, { signal: abortController.signal })
      .then(({ learner_state, review_inspector, thread_context }) => {
        if (abortController.signal.aborted) return;
        if (thread_context !== null) {
          setSessionSnapshots((current) => {
            const baseSnapshot = current[selectedSessionKey] ?? fallbackRuntime;
            return {
              ...current,
              [selectedSessionKey]: hydrateRuntimeSnapshotFromThreadContext(
                thread_context,
                learner_state !== null
                  ? hydrateRuntimeSnapshotFromLearnerState(learner_state, baseSnapshot)
                  : baseSnapshot,
              ),
            };
          });
          if (thread_context.orchestration_events.length > 0) {
            data.setSessionMessagesById((current) => {
              const currentMessages = current[selectedSessionKey] ?? [];
              const nextMessages = [
                ...currentMessages,
                ...thread_context.orchestration_events.map((change) =>
                  buildSessionOrchestrationMessage({ sessionId: selectedSessionKey, change }),
                ),
              ];
              return {
                ...current,
                [selectedSessionKey]: nextMessages.filter(
                  (message, index, array) =>
                    array.findIndex((candidate) => candidate.id === message.id) === index,
                ),
              };
            });
          }
        }
        if (learner_state !== null) {
          setSessionSnapshots((current) => {
            const baseSnapshot = current[selectedSessionKey] ?? fallbackRuntime;
            return {
              ...current,
              [selectedSessionKey]: hydrateRuntimeSnapshotFromLearnerState(
                learner_state,
                baseSnapshot,
              ),
            };
          });
        }
        setSessionReviewInspectors((current) =>
          current[selectedSessionKey] ===
            mergeReviewInspector(current[selectedSessionKey], review_inspector)
            ? current
            : {
                ...current,
                [selectedSessionKey]: mergeReviewInspector(
                  current[selectedSessionKey],
                  review_inspector,
                ),
              },
        );
        if (thread_context !== null) {
          if (selectedSessionEntryMode !== thread_context.entry_mode) {
            sessionEntryModesSetter((current) => ({
              ...current,
              [selectedSessionKey]: thread_context.entry_mode,
            }));
          }
        }
      })
      .catch((error) => {
        if (!isAbortError(error)) {
          clearBootstrapLoaded(bootstrapKey);
        }
      });
    return () => abortController.abort();
  }, [
    agentConnectionState,
    bootstrapLoadedKeys,
    clearBootstrapLoaded,
    markBootstrapLoaded,
    fallbackRuntime,
    selectedSessionKey,
    selectedSessionKnowledgePointId,
    selectedSessionType,
    selectedSessionEntryMode,
    sessionEntryModesSetter,
    setSessionReviewInspectors,
    setSessionSnapshots,
  ]);

  useEffect(() => {
    if (
      agentConnectionState !== "ready" ||
      selectedSessionType !== "project" ||
      assetSummaryKey === "" ||
      assetSummaryByKey[assetSummaryKey] !== undefined
    ) {
      return;
    }
    const abortController = new AbortController();
    void getAssetSummary(requestSourceAssetIds, {
      signal: abortController.signal,
      projectId,
    })
      .then((summary) => {
        if (!abortController.signal.aborted) {
          setAssetSummaryByKey((current) =>
            current[assetSummaryKey] !== undefined ? current : { ...current, [assetSummaryKey]: summary },
          );
        }
      })
      .catch(() => undefined);
    return () => abortController.abort();
  }, [
    agentConnectionState,
    assetSummaryByKey,
    assetSummaryKey,
    projectId,
    requestSourceAssetIds,
    selectedSessionType,
    setAssetSummaryByKey,
  ]);

  useEffect(() => {
    if (
      agentConnectionState !== "ready" ||
      selectedSessionType !== "project" ||
      assetSummaryKey === "" ||
      materialReadByKey[assetSummaryKey] !== undefined
    ) {
      return;
    }
    const abortController = new AbortController();
    void getMaterialRead(requestSourceAssetIds, {
      signal: abortController.signal,
      projectId,
      mode: "overview",
      maxChunks: 4,
    })
      .then((materialRead) => {
        if (!abortController.signal.aborted) {
          setMaterialReadByKey((current) =>
            current[assetSummaryKey] !== undefined
              ? current
              : { ...current, [assetSummaryKey]: materialRead },
          );
        }
      })
      .catch(() => undefined);
    return () => abortController.abort();
  }, [
    agentConnectionState,
    assetSummaryKey,
    materialReadByKey,
    projectId,
    requestSourceAssetIds,
    selectedSessionType,
    setMaterialReadByKey,
  ]);

  useEffect(() => {
    if (
      agentConnectionState !== "ready" ||
      selectedSessionKey === null ||
      isAgentRunning ||
      messagesLength === 0
    ) {
      return;
    }
    const syncKey = `${selectedSessionKey}:${messagesLength}`;
    if (syncedActivityDecksKeyRef.current === syncKey) {
      return;
    }
    syncedActivityDecksKeyRef.current = syncKey;
    const abortController = new AbortController();
    void getThreadActivityDecks(selectedSessionKey, { signal: abortController.signal })
      .then((decks) => {
        if (abortController.signal.aborted) {
          return;
        }
        setCompletedActivityDecksBySession((current) => {
          const currentDecks = current[selectedSessionKey] ?? [];
          const same =
            currentDecks.length === decks.length &&
            JSON.stringify(currentDecks) === JSON.stringify(decks);
          if (same) {
            return current;
          }
          return { ...current, [selectedSessionKey]: decks };
        });
      })
      .catch(() => {
        if (syncedActivityDecksKeyRef.current === syncKey) {
          syncedActivityDecksKeyRef.current = null;
        }
      });
    return () => abortController.abort();
  }, [
    agentConnectionState,
    isAgentRunning,
    messagesLength,
    selectedSessionKey,
    setCompletedActivityDecksBySession,
  ]);

  useEffect(() => {
    if (
      agentConnectionState !== "ready" ||
      selectedSessionKey === null ||
      isAgentRunning ||
      messagesLength === 0
    ) {
      return;
    }
    const syncKey = `${selectedSessionKey}:${messagesLength}`;
    if (syncedSessionMetaKeyRef.current === syncKey) {
      return;
    }
    syncedSessionMetaKeyRef.current = syncKey;
    const abortController = new AbortController();
    void getThreadContext(selectedSessionKey, { signal: abortController.signal })
      .then((threadContext) => {
        if (!abortController.signal.aborted && threadContext !== null) {
          setSessionSnapshots((current) => ({
            ...current,
            [selectedSessionKey]: hydrateRuntimeSnapshotFromThreadContext(
              threadContext,
              current[selectedSessionKey] ?? fallbackRuntime,
            ),
          }));
          if (selectedSessionEntryMode !== threadContext.entry_mode) {
            sessionEntryModesSetter((current) => ({
              ...current,
              [selectedSessionKey]: threadContext.entry_mode,
            }));
          }
        }
      })
      .catch(() => {
        if (syncedSessionMetaKeyRef.current === syncKey) {
          syncedSessionMetaKeyRef.current = null;
        }
      });
    if (
      selectedSessionType === "review" &&
      selectedSessionKnowledgePointId !== null
    ) {
      void getReviewInspector(selectedSessionKey, selectedSessionKnowledgePointId, {
        days: REVIEW_HEATMAP_LOOKBACK_DAYS,
        signal: abortController.signal,
      })
        .then((reviewInspector) => {
          if (!abortController.signal.aborted) {
            setSessionReviewInspectors((current) =>
              current[selectedSessionKey] ===
                mergeReviewInspector(current[selectedSessionKey], reviewInspector)
                ? current
                : {
                    ...current,
                    [selectedSessionKey]: mergeReviewInspector(
                      current[selectedSessionKey],
                      reviewInspector,
                    ),
                  },
            );
          }
        })
        .catch(() => {
          if (syncedSessionMetaKeyRef.current === syncKey) {
            syncedSessionMetaKeyRef.current = null;
          }
        });
    }
    return () => abortController.abort();
  }, [
    agentConnectionState,
    isAgentRunning,
    messagesLength,
    selectedSessionKey,
    selectedSessionKnowledgePointId,
    selectedSessionType,
    selectedSessionEntryMode,
    sessionEntryModesSetter,
    setSessionReviewInspectors,
    fallbackRuntime,
  ]);
}
