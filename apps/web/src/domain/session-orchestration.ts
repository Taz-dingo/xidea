import type { UIMessage } from "ai";
import type { AgentSessionOrchestrationEventRecord } from "@/domain/agent-runtime";

const ORCHESTRATION_MESSAGE_PREFIX = "__xidea_session_orchestration__:";

export function buildSessionOrchestrationMessage(input: {
  readonly sessionId: string;
  readonly change: AgentSessionOrchestrationEventRecord;
}): UIMessage {
  const messageId = [
    input.sessionId,
    input.change.kind,
    input.change.created_at ?? input.change.plan_snapshot.current_focus_id ?? "current",
  ].join(":");
  const text = `${ORCHESTRATION_MESSAGE_PREFIX}${JSON.stringify(input.change)}`;

  return {
    id: `session-orchestration:${messageId}`,
    role: "system",
    parts: [{ type: "text", text }],
    content: text,
  } as UIMessage;
}

export function parseSessionOrchestrationMessage(
  message: UIMessage,
): AgentSessionOrchestrationEventRecord | null {
  const text = message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
  if (!text.startsWith(ORCHESTRATION_MESSAGE_PREFIX)) {
    return null;
  }

  try {
    return JSON.parse(text.slice(ORCHESTRATION_MESSAGE_PREFIX.length)) as AgentSessionOrchestrationEventRecord;
  } catch {
    return null;
  }
}
