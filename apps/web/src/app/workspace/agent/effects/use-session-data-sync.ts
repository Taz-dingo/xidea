import { useEffect } from "react";
import {
  getAssetSummary,
  getInspectorBootstrap,
  getReviewInspector,
  getThreadContext,
} from "@/lib/agent-client";
import { hydrateRuntimeSnapshotFromLearnerState } from "@/domain/agent-runtime";
import type { WorkspaceData } from "@/app/workspace/hooks/use-data";

export function useSessionDataSync({
  assetSummaryKey,
  data,
  isAgentRunning,
  messagesLength,
  requestSourceAssetIds,
  seedRuntime,
  selectedSessionKey,
  selectedSessionKnowledgePointId,
}: {
  assetSummaryKey: string;
  data: WorkspaceData;
  isAgentRunning: boolean;
  messagesLength: number;
  requestSourceAssetIds: ReadonlyArray<string>;
  seedRuntime: ReturnType<typeof hydrateRuntimeSnapshotFromLearnerState>;
  selectedSessionKey: string | null;
  selectedSessionKnowledgePointId: string | null;
}): void {
  useEffect(() => {
    if (
      data.agentConnectionState !== "ready" ||
      selectedSessionKey === null ||
      selectedSessionKnowledgePointId === null
    ) {
      return;
    }
    const bootstrapKey = `${selectedSessionKey}:${selectedSessionKnowledgePointId}`;
    if (data.bootstrapLoadedKeys[bootstrapKey]) {
      return;
    }
    data.markBootstrapLoaded(bootstrapKey);
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
        data.clearBootstrapLoaded(bootstrapKey);
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
      messagesLength === 0
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
  }, [data, isAgentRunning, messagesLength, selectedSessionKey, selectedSessionKnowledgePointId]);
}
