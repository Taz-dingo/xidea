import { useEffect, useRef } from "react";
import { buildDefaultAgentPrompt } from "@/domain/agent-runtime";
import { areSameMessageHistory, mergeMessageHistory } from "@/domain/chat-message";
import type { UIMessage } from "ai";
import type { WorkspaceData } from "@/app/workspace/hooks/use-data";

export function useSessionRuntimeSync({
  currentActivityKey,
  data,
  error,
  messages,
  projectContext,
  runtimeUnit,
  sendMessage,
}: {
  currentActivityKey: string | null;
  data: WorkspaceData;
  error: Error | undefined;
  messages: ReadonlyArray<UIMessage>;
  projectContext: Parameters<typeof buildDefaultAgentPrompt>[1];
  runtimeUnit: Parameters<typeof buildDefaultAgentPrompt>[0];
  sendMessage: (message: { text: string }) => PromiseLike<void> | void;
}): void {
  const selectedSessionId = data.selectedSession?.id ?? null;
  const selectedSessionKnowledgePointId = data.selectedSession?.knowledgePointId ?? null;
  const pendingInitialPrompt = data.pendingInitialPrompt;
  const initializedDraftKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (selectedSessionId === null) {
      initializedDraftKeyRef.current = null;
      return;
    }

    const nextDraftKey = `${selectedSessionId}:${runtimeUnit.id}`;
    if (initializedDraftKeyRef.current === nextDraftKey) {
      return;
    }

    data.setDraftPrompt(
      selectedSessionKnowledgePointId === null
        ? ""
        : buildDefaultAgentPrompt(runtimeUnit, projectContext),
    );
    initializedDraftKeyRef.current = nextDraftKey;
  }, [
    data.setDraftPrompt,
    projectContext,
    runtimeUnit,
    selectedSessionId,
    selectedSessionKnowledgePointId,
  ]);

  useEffect(() => {
    if (selectedSessionId !== null) {
      data.setSessionMessagesById((current) => {
        const currentMessages = current[selectedSessionId] ?? [];
        const mergedMessages = mergeMessageHistory(currentMessages, messages);
        if (areSameMessageHistory(currentMessages, mergedMessages)) {
          return current;
        }
        return { ...current, [selectedSessionId]: mergedMessages };
      });
    }
  }, [data.setSessionMessagesById, messages, selectedSessionId]);

  useEffect(() => {
    if (selectedSessionId === null || error === undefined) {
      return;
    }
    if (currentActivityKey !== null) {
      data.setActivityResolutionsBySession((current) => {
        const nextSessionResolutions = { ...(current[selectedSessionId] ?? {}) };
        delete nextSessionResolutions[currentActivityKey];
        return { ...current, [selectedSessionId]: nextSessionResolutions };
      });
    }
    data.setRunningSessionIds((current) => ({ ...current, [selectedSessionId]: false }));
    data.setSessions((current) =>
      current.map((session) =>
        session.id === selectedSessionId && session.status !== "错误"
          ? { ...session, status: "错误", updatedAt: "刚刚" }
          : session,
      ),
    );
  }, [
    currentActivityKey,
    data.setActivityResolutionsBySession,
    data.setRunningSessionIds,
    data.setSessions,
    error,
    selectedSessionId,
  ]);

  useEffect(() => {
    if (pendingInitialPrompt === null || selectedSessionId !== pendingInitialPrompt.sessionId) {
      return;
    }
    data.setSessions((current) =>
      current.map((session) =>
        session.id === pendingInitialPrompt.sessionId
          ? { ...session, summary: pendingInitialPrompt.sessionSummary, updatedAt: "刚刚", status: "运行中" }
          : session,
      ),
    );
    data.setRunningSessionIds((current) => ({ ...current, [pendingInitialPrompt.sessionId]: true }));
    void sendMessage({ text: pendingInitialPrompt.text });
    data.setPendingInitialPrompt(null);
  }, [
    data.setPendingInitialPrompt,
    data.setRunningSessionIds,
    data.setSessions,
    pendingInitialPrompt,
    selectedSessionId,
    sendMessage,
  ]);
}
