import { useEffect } from "react";
import { buildDefaultAgentPrompt } from "@/domain/agent-runtime";
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
  messages: UIMessage[];
  projectContext: Parameters<typeof buildDefaultAgentPrompt>[1];
  runtimeUnit: Parameters<typeof buildDefaultAgentPrompt>[0];
  sendMessage: (message: { text: string }) => PromiseLike<void> | void;
}): void {
  useEffect(() => {
    data.setDraftPrompt(
      data.selectedSession?.knowledgePointId === null
        ? ""
        : buildDefaultAgentPrompt(runtimeUnit, projectContext),
    );
  }, [data, projectContext, runtimeUnit]);

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
}
