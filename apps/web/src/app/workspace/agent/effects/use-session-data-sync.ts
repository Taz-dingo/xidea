import { useEffect } from "react";
import {
  getAssetSummary,
  getThreadActivityDecks,
  getInspectorBootstrap,
  getReviewInspector,
  getThreadContext,
} from "@/lib/agent-client";
import {
  hydrateRuntimeSnapshotFromLearnerState,
  hydrateRuntimeSnapshotFromThreadContext,
} from "@/domain/agent-runtime";
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
  seedRuntime,
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
  seedRuntime: ReturnType<typeof hydrateRuntimeSnapshotFromLearnerState>;
  selectedSessionKey: string | null;
  selectedSessionKnowledgePointId: string | null;
  selectedSessionType: "project" | "study" | "review";
}): void {
  const {
    agentConnectionState,
    assetSummaryByKey,
    bootstrapLoadedKeys,
    clearBootstrapLoaded,
    markBootstrapLoaded,
    sessionEntryModes,
    sessionEntryModesSetter,
    setAssetSummaryByKey,
    setCompletedActivityDecksBySession,
    setSessionReviewInspectors,
    setSessionSnapshots,
  } = data;

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
            const baseSnapshot = current[selectedSessionKey] ?? seedRuntime;
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
            const baseSnapshot = current[selectedSessionKey] ?? seedRuntime;
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
          current[selectedSessionKey] === review_inspector
            ? current
            : { ...current, [selectedSessionKey]: review_inspector },
        );
        if (thread_context !== null) {
          if (sessionEntryModes[selectedSessionKey] !== thread_context.entry_mode) {
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
    seedRuntime,
    selectedSessionKey,
    selectedSessionKnowledgePointId,
    selectedSessionType,
    sessionEntryModes,
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
      selectedSessionKey === null ||
      selectedSessionType === "project" ||
      isAgentRunning ||
      messagesLength === 0
    ) {
      return;
    }
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
            currentDecks.every((deck, index) => {
              const nextDeck = decks[index];
              return (
                nextDeck !== undefined &&
                deck.deckKey === nextDeck.deckKey &&
                deck.completedAt === nextDeck.completedAt &&
                deck.cards.length === nextDeck.cards.length
              );
            });
          if (same) {
            return current;
          }
          return { ...current, [selectedSessionKey]: decks };
        });
      })
      .catch(() => undefined);
    return () => abortController.abort();
  }, [
    agentConnectionState,
    isAgentRunning,
    messagesLength,
    selectedSessionKey,
    selectedSessionType,
    setCompletedActivityDecksBySession,
  ]);

  useEffect(() => {
    if (
      agentConnectionState !== "ready" ||
      selectedSessionKey === null ||
      selectedSessionKnowledgePointId === null ||
      isAgentRunning ||
      messagesLength === 0
    ) {
      return;
    }
    const abortController = new AbortController();
    void getReviewInspector(selectedSessionKey, selectedSessionKnowledgePointId, { signal: abortController.signal })
      .then((reviewInspector) => {
        if (!abortController.signal.aborted) {
          setSessionReviewInspectors((current) =>
            current[selectedSessionKey] === reviewInspector
              ? current
              : { ...current, [selectedSessionKey]: reviewInspector },
          );
        }
      })
      .catch(() => undefined);
    void getThreadContext(selectedSessionKey, { signal: abortController.signal })
      .then((threadContext) => {
        if (!abortController.signal.aborted && threadContext !== null) {
          setSessionSnapshots((current) => ({
            ...current,
            [selectedSessionKey]: hydrateRuntimeSnapshotFromThreadContext(
              threadContext,
              current[selectedSessionKey] ?? seedRuntime,
            ),
          }));
          if (sessionEntryModes[selectedSessionKey] !== threadContext.entry_mode) {
            sessionEntryModesSetter((current) => ({
              ...current,
              [selectedSessionKey]: threadContext.entry_mode,
            }));
          }
        }
      })
      .catch(() => undefined);
    return () => abortController.abort();
  }, [
    agentConnectionState,
    isAgentRunning,
    messagesLength,
    selectedSessionKey,
    selectedSessionKnowledgePointId,
    sessionEntryModes,
    sessionEntryModesSetter,
    setCompletedActivityDecksBySession,
    setSessionReviewInspectors,
  ]);
}
