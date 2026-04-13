import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";
import {
  buildAgentRequest,
  normalizeAgentRunResult,
  type AgentEntryMode,
  type RuntimeSnapshot,
} from "@/domain/agent-runtime";
import type { LearnerProfile, LearningUnit, ProjectContext, SourceAsset } from "@/domain/types";
import { runAgentV0 } from "@/lib/agent-client";

function getLatestUserText(messages: UIMessage[]): string {
  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user");
  if (latestUserMessage === undefined) {
    return "";
  }

  return latestUserMessage.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
}

function buildAssistantStream(chunks: UIMessageChunk[]): ReadableStream<UIMessageChunk> {
  return new ReadableStream<UIMessageChunk>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
}

export function createAgentChatTransport(input: {
  readonly entryMode: AgentEntryMode;
  readonly profile: LearnerProfile;
  readonly project: ProjectContext;
  readonly sourceAssets: ReadonlyArray<SourceAsset>;
  readonly unit: LearningUnit;
  readonly onSnapshot: (snapshot: RuntimeSnapshot) => void;
}): ChatTransport<UIMessage> {
  return {
    async sendMessages({ messages, abortSignal }) {
      const prompt = getLatestUserText(messages);
      const result = await runAgentV0(
        buildAgentRequest({
          entryMode: input.entryMode,
          profile: input.profile,
          project: input.project,
          prompt,
          sourceAssets: input.sourceAssets,
          unit: input.unit,
        }),
        { signal: abortSignal },
      );

      input.onSnapshot(normalizeAgentRunResult(result));

      const messageId = `assistant-${Date.now()}`;
      const textChunks = result.events
        .filter((event): event is Extract<(typeof result.events)[number], { event: "text-delta" }> => event.event === "text-delta")
        .map((event) => event.delta)
        .filter((delta) => delta.trim().length > 0);

      const fallbackText = result.graph_state.assistant_message?.trim() ?? "";
      const deltas = textChunks.length > 0 ? textChunks : fallbackText ? [fallbackText] : ["Agent 已完成本轮判断。"];

      const streamChunks: UIMessageChunk[] = [{ type: "text-start", id: messageId }];

      for (const delta of deltas) {
        streamChunks.push({
          type: "text-delta",
          id: messageId,
          delta,
        });
      }

      streamChunks.push({ type: "text-end", id: messageId });
      return buildAssistantStream(streamChunks);
    },
    async reconnectToStream() {
      return null;
    },
  };
}
