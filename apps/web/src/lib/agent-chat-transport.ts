import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";
import {
  buildAgentRequest,
  type AgentKnowledgePointSuggestion,
  type AgentRequest,
  normalizePartialAgentStreamResult,
  normalizeAgentStreamResult,
  normalizeAgentRunResult,
  type AgentEntryMode,
  type AgentStreamEvent,
  type RuntimeSnapshot,
} from "@/domain/agent-runtime";
import type { SessionType } from "@/domain/project-workspace";
import type { LearningUnit, ProjectContext, SourceAsset } from "@/domain/types";
import { getLearnerUnitState, runAgentV0, runAgentV0Stream } from "@/lib/agent-client";

function sanitizeVisibleAssistantText(text: string): string {
  const withoutThinkBlocks = text.replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, "");
  const withoutDanglingThink = withoutThinkBlocks.replace(/<think\b[^>]*>[\s\S]*$/i, "");
  const withoutWrappers = withoutDanglingThink
    .replace(/^\s*<(answer|output|response|result|json)\b[^>]*>\s*/i, "")
    .replace(/\s*<\/(answer|output|response|result|json)>\s*$/i, "");
  return withoutWrappers.trim();
}

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
  readonly consumeActivityResult?: () => Parameters<typeof buildAgentRequest>[0]["activityResult"];
  readonly projectId: string;
  readonly sessionId: string;
  readonly getRequestConfig: () => {
    readonly sessionType: SessionType;
    readonly sessionTitle: string | null;
    readonly sessionSummary: string | null;
    readonly knowledgePointId: string | null;
    readonly entryMode: AgentEntryMode;
    readonly project: ProjectContext;
    readonly unit: LearningUnit;
    readonly targetUnitId: string | null;
  };
  readonly consumeSourceAssets: () => ReadonlyArray<SourceAsset>;
  readonly getFallbackSnapshot: () => RuntimeSnapshot;
  readonly onSnapshot: (snapshot: RuntimeSnapshot) => void;
  readonly onKnowledgePointSuggestions?: (
    suggestions: ReadonlyArray<AgentKnowledgePointSuggestion>,
    request: AgentRequest,
    assistantMessageId: string,
  ) => void | Promise<void>;
  readonly onRunStateChange?: (isRunning: boolean) => void;
}): ChatTransport<UIMessage> {
  return {
    async sendMessages({ messages, abortSignal }) {
      const prompt = getLatestUserText(messages);
      const requestConfig = input.getRequestConfig();
      const request = buildAgentRequest({
        activityResult: input.consumeActivityResult?.() ?? null,
        projectId: input.projectId,
        sessionId: input.sessionId,
        sessionType: requestConfig.sessionType,
        sessionTitle: requestConfig.sessionTitle,
        sessionSummary: requestConfig.sessionSummary,
        knowledgePointId: requestConfig.knowledgePointId,
        entryMode: requestConfig.entryMode,
        project: requestConfig.project,
        prompt,
        sourceAssets: input.consumeSourceAssets(),
        unit: requestConfig.unit,
        targetUnitId: requestConfig.targetUnitId,
      });
      const messageId = `assistant-${Date.now()}`;

      return new ReadableStream<UIMessageChunk>({
        async start(controller) {
          const streamedEvents: AgentStreamEvent[] = [];
          let started = false;
          input.onRunStateChange?.(true);

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

                input.onSnapshot(
                  normalizePartialAgentStreamResult({
                    events: streamedEvents,
                    fallbackSnapshot: input.getFallbackSnapshot(),
                  }),
                );

                if (event.event !== "text-delta") {
                  if (event.event === "knowledge-point-suggestion") {
                    void input.onKnowledgePointSuggestions?.(
                      event.suggestions,
                      request,
                      messageId,
                    );
                  }
                  return;
                }

                const visibleDelta = sanitizeVisibleAssistantText(event.delta);
                if (visibleDelta.length === 0) {
                  return;
                }

                ensureStarted();
                controller.enqueue({
                  type: "text-delta",
                  id: messageId,
                  delta: visibleDelta,
                });
              },
            });

            const snapshot = normalizePartialAgentStreamResult({
              events: streamedEvents,
              fallbackSnapshot: input.getFallbackSnapshot(),
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

            if (request.target_unit_id === null) {
              return;
            }

            void getLearnerUnitState(input.sessionId, request.target_unit_id, {
              signal: abortSignal,
            })
              .then((learnerState) => {
                input.onSnapshot(
                  normalizeAgentStreamResult({
                    events: streamedEvents,
                    learnerState,
                    fallbackSnapshot: input.getFallbackSnapshot(),
                  }),
                );
              })
              .catch(() => {
                // Keep the stream-completed snapshot when learner-state hydration is unavailable.
              });
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
              const suggestionEvents = fallbackResult.events.filter(
                (
                  event,
                ): event is Extract<
                  (typeof fallbackResult.events)[number],
                  { event: "knowledge-point-suggestion" }
                > => event.event === "knowledge-point-suggestion",
              );
              for (const suggestionEvent of suggestionEvents) {
                void input.onKnowledgePointSuggestions?.(
                  suggestionEvent.suggestions,
                  request,
                  messageId,
                );
              }

              ensureStarted();
              for (const delta of deltas.length > 0 ? deltas : [fallbackText || "Agent 已完成本轮判断。"]) {
                const visibleDelta = sanitizeVisibleAssistantText(delta);
                if (visibleDelta.length === 0) {
                  continue;
                }
                controller.enqueue({
                  type: "text-delta",
                  id: messageId,
                  delta: visibleDelta,
                });
              }
              controller.enqueue({ type: "text-end", id: messageId });
              controller.close();
            } catch (fallbackError) {
              controller.error(fallbackError);
            } finally {
              input.onRunStateChange?.(false);
            }
            return;
          } finally {
            input.onRunStateChange?.(false);
          }
        },
      });
    },
    async reconnectToStream() {
      return null;
    },
  };
}
