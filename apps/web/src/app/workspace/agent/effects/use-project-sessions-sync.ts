import { useEffect, useMemo, useRef } from "react";
import type { UIMessage } from "ai";
import type { AgentMessage, AgentProjectThreadRecord } from "@/domain/agent-runtime";
import { areSameMessageHistory, mergeMessageHistory } from "@/domain/chat-message";
import type { SessionItem } from "@/domain/project-workspace";
import { getThreadMessages, listProjectThreads } from "@/lib/agent-client";
import type { WorkspaceData } from "@/app/workspace/hooks/use-data";

function formatSessionUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMinutes < 5) {
    return "刚刚";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} 分钟前`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24 && now.toDateString() === date.toDateString()) {
    return `${diffHours} 小时前`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (yesterday.toDateString() === date.toDateString()) {
    return "昨天";
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays} 天前`;
  }

  return value.slice(0, 10);
}

function toSessionItem(thread: AgentProjectThreadRecord): SessionItem {
  return {
    id: thread.thread_id,
    projectId: thread.project_id,
    type: thread.session_type,
    knowledgePointId: thread.knowledge_point_id,
    title: thread.title,
    summary: thread.summary,
    updatedAt: formatSessionUpdatedAt(thread.updated_at),
    status: thread.status,
  };
}

function toUiMessages(messages: ReadonlyArray<AgentMessage>, threadId: string): UIMessage[] {
  return messages.map((message, index) => ({
    id:
      message.message_id !== undefined
        ? `${threadId}-message-${message.message_id}`
        : `${threadId}-${message.role}-${message.created_at ?? index}-${index}`,
    role: message.role,
    parts: [{ type: "text", text: message.content }],
  }));
}

function hasSameSessions(left: ReadonlyArray<SessionItem>, right: ReadonlyArray<SessionItem>): boolean {
  return (
    left.length === right.length &&
    left.every((session, index) => {
      const next = right[index];
      return (
        next !== undefined &&
        session.id === next.id &&
        session.type === next.type &&
        session.knowledgePointId === next.knowledgePointId &&
        session.title === next.title &&
        session.summary === next.summary &&
        session.updatedAt === next.updatedAt &&
        session.status === next.status
      );
    })
  );
}

export function useProjectSessionsSync({
  data,
  projectId,
  selectedSessionKey,
}: {
  data: WorkspaceData;
  projectId: string;
  selectedSessionKey: string | null;
}): void {
  const {
    agentConnectionState,
    sessions,
    setSessionEntryModes,
    setSessionMessagesById,
    setSessions,
  } = data;
  const hydratedMessageSessionIdsRef = useRef<Set<string>>(new Set());
  const selectedSessionExists = useMemo(
    () =>
      selectedSessionKey !== null &&
      sessions.some((session) => session.id === selectedSessionKey),
    [selectedSessionKey, sessions],
  );

  useEffect(() => {
    hydratedMessageSessionIdsRef.current.clear();
  }, [projectId]);

  useEffect(() => {
    if (agentConnectionState !== "ready") {
      return;
    }

    const abortController = new AbortController();
    void listProjectThreads(projectId, { signal: abortController.signal })
      .then((threads) => {
        if (abortController.signal.aborted) {
          return;
        }

        const hydratedSessions = threads.map(toSessionItem);
        setSessions((current) => {
          const otherProjects = current.filter((session) => session.projectId !== projectId);
          if (hasSameSessions(current.filter((session) => session.projectId === projectId), hydratedSessions)) {
            return current;
          }
          return [...hydratedSessions, ...otherProjects];
        });

        setSessionEntryModes((current) => {
          let changed = false;
          const next = { ...current };
          for (const thread of threads) {
            if (next[thread.thread_id] !== thread.entry_mode) {
              next[thread.thread_id] = thread.entry_mode;
              changed = true;
            }
          }
          return changed ? next : current;
        });
      })
      .catch(() => undefined);

    return () => abortController.abort();
  }, [
    agentConnectionState,
    projectId,
    setSessionEntryModes,
    setSessions,
  ]);

  useEffect(() => {
    if (
      agentConnectionState !== "ready" ||
      selectedSessionKey === null ||
      !selectedSessionExists ||
      hydratedMessageSessionIdsRef.current.has(selectedSessionKey)
    ) {
      return;
    }

    const abortController = new AbortController();
    void getThreadMessages(selectedSessionKey, { signal: abortController.signal })
      .then((messages) => {
        if (abortController.signal.aborted) {
          return;
        }
        hydratedMessageSessionIdsRef.current.add(selectedSessionKey);
        const nextMessages = toUiMessages(messages, selectedSessionKey);
        setSessionMessagesById((current) => {
          const currentMessages = current[selectedSessionKey] ?? [];
          const mergedMessages = mergeMessageHistory(currentMessages, nextMessages);
          if (areSameMessageHistory(currentMessages, mergedMessages)) {
            return current;
          }
          return {
            ...current,
            [selectedSessionKey]: mergedMessages,
          };
        });
      })
      .catch(() => undefined);

    return () => abortController.abort();
  }, [
    agentConnectionState,
    selectedSessionKey,
    selectedSessionExists,
    setSessionMessagesById,
  ]);
}
