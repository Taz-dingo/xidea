import { useEffect } from "react";
import {
  getAssetSummary,
  getInspectorBootstrap,
  getReviewInspector,
  getThreadContext,
} from "@/lib/agent-client";
import { hydrateRuntimeSnapshotFromLearnerState } from "@/domain/agent-runtime";
import type { WorkspaceData } from "@/app/workspace/hooks/use-data";

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function hasSameIds(
  left: ReadonlyArray<string>,
  right: ReadonlyArray<string>,
): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function useSessionDataSync({
  assetSummaryKey,
  data,
  isAgentRunning,
  messagesLength,
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
    sessionSourceAssetIds,
    setAssetSummaryByKey,
    setSessionReviewInspectors,
    setSessionSnapshots,
    setSessionSourceAssetIds,
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
        if (learner_state !== null) {
          setSessionSnapshots((current) => ({
            ...current,
            [selectedSessionKey]: hydrateRuntimeSnapshotFromLearnerState(learner_state, seedRuntime),
          }));
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
          if (
            selectedSessionType === "project" &&
            !hasSameIds(sessionSourceAssetIds[selectedSessionKey] ?? [], thread_context.source_asset_ids)
          ) {
            setSessionSourceAssetIds((current) => ({
              ...current,
              [selectedSessionKey]: thread_context.source_asset_ids,
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
    sessionSourceAssetIds,
    sessionEntryModesSetter,
    setSessionReviewInspectors,
    setSessionSnapshots,
    setSessionSourceAssetIds,
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
    void getAssetSummary(requestSourceAssetIds, { signal: abortController.signal })
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
    requestSourceAssetIds,
    selectedSessionType,
    setAssetSummaryByKey,
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
          if (sessionEntryModes[selectedSessionKey] !== threadContext.entry_mode) {
            sessionEntryModesSetter((current) => ({
              ...current,
              [selectedSessionKey]: threadContext.entry_mode,
            }));
          }
          if (
            selectedSessionType === "project" &&
            !hasSameIds(sessionSourceAssetIds[selectedSessionKey] ?? [], threadContext.source_asset_ids)
          ) {
            setSessionSourceAssetIds((current) => ({
              ...current,
              [selectedSessionKey]: threadContext.source_asset_ids,
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
    selectedSessionType,
    sessionEntryModes,
    sessionSourceAssetIds,
    sessionEntryModesSetter,
    setSessionReviewInspectors,
    setSessionSourceAssetIds,
  ]);
}
