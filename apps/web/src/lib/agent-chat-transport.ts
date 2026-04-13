import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";
import {
  buildAgentRequest,
  normalizeAgentStreamResult,
  normalizeAgentRunResult,
  type AgentEntryMode,
  type AgentStreamEvent,
  type RuntimeSnapshot,
} from "@/domain/agent-runtime";
import type { LearnerProfile, LearningUnit, ProjectContext, SourceAsset } from "@/domain/types";
import { getLearnerUnitState, runAgentV0, runAgentV0Stream } from "@/lib/agent-client";

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

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export function createAgentChatTransport(input: {
  readonly projectId: string;
  readonly sessionId: string;
  readonly entryMode: AgentEntryMode;
  readonly profile: LearnerProfile;
  readonly project: ProjectContext;
  readonly sourceAssets: ReadonlyArray<SourceAsset>;
  readonly unit: LearningUnit;
  readonly fallbackSnapshot: RuntimeSnapshot;
  readonly onSnapshot: (snapshot: RuntimeSnapshot) => void;
}): ChatTransport<UIMessage> {
  return {
    async sendMessages({ messages, abortSignal }) {
      const prompt = getLatestUserText(messages);
      const request = buildAgentRequest({
        projectId: input.projectId,
        sessionId: input.sessionId,
        entryMode: input.entryMode,
        profile: input.profile,
        project: input.project,
        prompt,
        sourceAssets: input.sourceAssets,
        unit: input.unit,
      });
      const messageId = `assistant-${Date.now()}`;

      return new ReadableStream<UIMessageChunk>({
        async start(controller) {
          const streamedEvents: AgentStreamEvent[] = [];
          let started = false;

          const ensureStarted = () => {
            if (started) {
              return;
            }
            controller.enqueue({ type: "text-start", id: messageId });
            started = true;
          };

          try {
            await runAgentV0Stream(request, {
              signal: abortSignal,
              onEvent: (event) => {
                streamedEvents.push(event);

                if (event.event !== "text-delta" || event.delta.trim().length === 0) {
                  return;
                }

                ensureStarted();
                controller.enqueue({
                  type: "text-delta",
                  id: messageId,
                  delta: event.delta,
                });
              },
            });

            const learnerState = await getLearnerUnitState(input.sessionId, input.unit.id, {
              signal: abortSignal,
            }).catch(() => null);

            const snapshot = normalizeAgentStreamResult({
              events: streamedEvents,
              learnerState,
              fallbackSnapshot: input.fallbackSnapshot,
            });

            input.onSnapshot(snapshot);

            if (!started && snapshot.assistantMessage.trim().length > 0) {
              ensureStarted();
              controller.enqueue({
                type: "text-delta",
                id: messageId,
                delta: snapshot.assistantMessage,
              });
            }

            ensureStarted();
            controller.enqueue({ type: "text-end", id: messageId });
            controller.close();
          } catch (error) {
            if (isAbortError(error)) {
              controller.error(error);
              return;
            }

            try {
              const fallbackResult = await runAgentV0(request, { signal: abortSignal });
              input.onSnapshot(normalizeAgentRunResult(fallbackResult));

              const fallbackText = fallbackResult.graph_state.assistant_message?.trim() ?? "";
              const deltas = fallbackResult.events
                .filter(
                  (
                    event,
                  ): event is Extract<(typeof fallbackResult.events)[number], { event: "text-delta" }> =>
                    event.event === "text-delta",
                )
                .map((event) => event.delta)
                .filter((delta) => delta.trim().length > 0);

              ensureStarted();
              for (const delta of deltas.length > 0 ? deltas : [fallbackText || "Agent 已完成本轮判断。"]) {
                controller.enqueue({
                  type: "text-delta",
                  id: messageId,
                  delta,
                });
              }
              controller.enqueue({ type: "text-end", id: messageId });
              controller.close();
            } catch (fallbackError) {
              controller.error(fallbackError);
            }
          }
        },
      });
    },
    async reconnectToStream() {
      return null;
    },
  };
}
