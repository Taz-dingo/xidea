import { useEffect, useRef, useState, type KeyboardEvent, type ReactElement } from "react";
import type { UIMessage } from "ai";
import { BookOpen, CircleSlash, FileInput, LoaderCircle, SendHorizontal } from "lucide-react";
import { LearningActivityStack } from "@/components/learning-activity-stack";
import { MaterialUploadButton } from "@/components/material-upload-button";
import { MarkdownContent } from "@/components/markdown-content";
import { AssetListGrid, KnowledgePointInlineCard } from "@/components/workspace/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { getMessageText, sanitizeVisibleAssistantText } from "@/domain/chat-message";
import { parseSessionOrchestrationMessage } from "@/domain/session-orchestration";
import {
  ACTIVITY_BATCH_SUMMARY_PREFIX,
  type ActivityResolution,
  type CompletedActivityDeck,
} from "@/domain/project-session-runtime";
import type { KnowledgePointItem } from "@/domain/project-workspace";
import type {
  LearningActivityAttempt,
  LearningActivitySubmission,
  SourceAsset,
} from "@/domain/types";
import type { RuntimeSnapshot } from "@/domain/agent-runtime";
import type { AgentAssetSummary, AgentMaterialRead } from "@/domain/agent-runtime";

function isSyntheticActivityBatchMessage(text: string): boolean {
  return text.trim().startsWith(ACTIVITY_BATCH_SUMMARY_PREFIX);
}

function getVisibleSyntheticActivityBatchMessage(text: string): string {
  const visibleText = text.replace(/请结合[\s\S]*$/u, "").trim();
  return visibleText.endsWith("。") ? visibleText : `${visibleText}。`;
}

function SessionStreamingStatus({
  label,
}: {
  label: string;
}): ReactElement {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-[var(--xidea-border)] bg-[var(--xidea-white)] px-3 py-1.5 text-[12px] text-[var(--xidea-stone)]">
      <span>{label}</span>
      <span className="flex items-center gap-1">
        {[0, 1, 2].map((index) => (
          <span
            className="xidea-dot-wave h-1.5 w-1.5 rounded-full bg-[var(--xidea-terracotta)]/70"
            key={index}
            style={{ ["--xidea-dot-delay" as string]: `${index * 0.15}s` }}
          />
        ))}
      </span>
    </div>
  );
}

function InlineStreamingTail(): ReactElement {
  return (
    <span
      aria-hidden="true"
      className="ml-1 inline-flex items-center gap-0.5 align-baseline text-current"
    >
      {[0, 1, 2].map((index) => (
        <span
          className="xidea-inline-dot-wave inline-block text-[1.05em] leading-none opacity-55"
          key={index}
          style={{ ["--xidea-dot-delay" as string]: `${index * 0.18}s` }}
        >
          .
        </span>
      ))}
    </span>
  );
}

function SessionOrchestrationCard({
  change,
}: {
  change: NonNullable<ReturnType<typeof parseSessionOrchestrationMessage>>;
}): ReactElement {
  const nextSteps = change.plan_snapshot.steps.slice(0, 3);

  return (
    <Card className="w-full max-w-[82%] overflow-hidden rounded-[1rem] border-[#e7c7b7] bg-[linear-gradient(180deg,#fff8f2_0%,#f8eee6_100%)] shadow-none">
      <CardContent className="space-y-3 px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="xidea-kicker text-[var(--xidea-selection-text)]">{change.title}</p>
            <p className="text-sm font-semibold leading-6 text-[var(--xidea-near-black)]">
              {change.plan_snapshot.objective}
            </p>
            <p className="text-[13px] leading-6 text-[var(--xidea-charcoal)]">{change.summary}</p>
          </div>
          <span className="rounded-full border border-[#e0c5b9] bg-[var(--xidea-white)] px-2.5 py-1 text-[11px] text-[var(--xidea-selection-text)]">
            {change.kind === "session_completed"
              ? "本轮完成"
              : change.kind === "plan_adjusted"
                ? "计划调整"
                : "当前编排"}
          </span>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-[0.95rem] border border-[#ead7ca] bg-[var(--xidea-white)] px-3 py-3">
            <p className="text-[11px] tracking-[0.08em] text-[var(--xidea-stone)]">目标</p>
            <p className="mt-2 line-clamp-2 text-[13px] font-medium leading-5 text-[var(--xidea-near-black)]">
              {change.plan_snapshot.objective}
            </p>
          </div>
          <div className="rounded-[0.95rem] border border-[#ead7ca] bg-[var(--xidea-white)] px-3 py-3">
            <p className="text-[11px] tracking-[0.08em] text-[var(--xidea-stone)]">当前焦点</p>
            <p className="mt-2 line-clamp-2 text-[13px] font-medium leading-5 text-[var(--xidea-near-black)]">
              {change.plan_snapshot.current_focus_id === null
                ? "当前候选池已完成"
                : nextSteps.find((step) => step.status === "active")?.title ?? "等待下一步"}
            </p>
          </div>
          <div className="rounded-[0.95rem] border border-[#ead7ca] bg-[var(--xidea-white)] px-3 py-3">
            <p className="text-[11px] tracking-[0.08em] text-[var(--xidea-stone)]">状态</p>
            <p className="mt-2 line-clamp-2 text-[13px] font-medium leading-5 text-[var(--xidea-near-black)]">
              {change.reason ?? change.plan_snapshot.last_change_reason ?? "按当前编排继续推进"}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] tracking-[0.08em] text-[var(--xidea-stone)]">步骤轨道</p>
          <div className="space-y-2">
            {nextSteps.map((step) => (
              <div
                className={
                  step.status === "completed"
                    ? "rounded-[0.95rem] border border-[#c7d9b5] bg-[#f2f8ea] px-3 py-2.5"
                    : step.status === "active"
                      ? "rounded-[0.95rem] border border-[#e0c5b9] bg-[#fff4ec] px-3 py-2.5"
                      : "rounded-[0.95rem] border border-[#ead7ca] bg-[var(--xidea-white)] px-3 py-2.5"
                }
                key={`${change.kind}-${step.knowledge_point_id}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[13px] font-medium text-[var(--xidea-near-black)]">{step.title}</p>
                  <span className="text-[11px] text-[var(--xidea-stone)]">
                    {step.status === "active"
                      ? "当前"
                      : step.status === "completed"
                        ? "已完成"
                        : "待推进"}
                  </span>
                </div>
                <p className="mt-1.5 text-[12px] leading-5 text-[var(--xidea-charcoal)]">{step.reason}</p>
              </div>
            ))}
          </div>
        </div>

        {change.reason ? (
          <p className="text-[12px] leading-5 text-[var(--xidea-stone)]">原因：{change.reason}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function InlineCompletedDeckPreview({
  deck,
}: {
  deck: CompletedActivityDeck;
}): ReactElement {
  return (
    <Card className="rounded-[1rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
      <CardContent className="space-y-3 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="xidea-kicker text-[var(--xidea-stone)]">对应题卡</p>
            <p className="text-sm font-medium text-[var(--xidea-near-black)]">这轮实际做过的卡组</p>
          </div>
          <span className="rounded-full border border-[var(--xidea-border)] bg-[var(--xidea-parchment)] px-2.5 py-1 text-[11px] text-[var(--xidea-stone)]">
            {deck.cards.length} 张
          </span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {deck.cards.map((card) => (
            <div
              className="rounded-[0.9rem] border border-[var(--xidea-border)] bg-[var(--xidea-parchment)] px-3 py-3"
              key={`${deck.deckKey}-${card.activityId}`}
            >
              <p className="line-clamp-2 break-words text-sm font-medium leading-6 text-[var(--xidea-near-black)]">
                {card.activityTitle}
              </p>
              <p className="mt-1 line-clamp-2 break-words text-[13px] leading-5 text-[var(--xidea-stone)]">
                {card.activityPrompt}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-[var(--xidea-stone)]">
                <span>{card.attempts.length} 次尝试</span>
                <span>·</span>
                <span>
                  {card.isCorrect === true ? "已答对" : card.isCorrect === false ? "答错过" : "待确认"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function InlineMaterialContextCard({
  activeAssetSummary,
  activeMaterialRead,
}: {
  activeAssetSummary: AgentAssetSummary | null;
  activeMaterialRead: AgentMaterialRead | null;
}): ReactElement | null {
  const materials = activeMaterialRead?.materials ?? activeAssetSummary?.assets ?? [];
  const summary = activeMaterialRead?.summary ?? activeAssetSummary?.summary ?? "";
  const concepts =
    activeMaterialRead?.keyConcepts.length
      ? activeMaterialRead.keyConcepts
      : activeAssetSummary?.keyConcepts ?? [];

  if (materials.length === 0 && summary.trim() === "" && concepts.length === 0) {
    return null;
  }

  return (
    <Card className="rounded-[1rem] border-[var(--xidea-selection-border)] bg-[var(--xidea-white)] shadow-none">
      <CardContent className="space-y-3 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="xidea-kicker text-[var(--xidea-selection-text)]">这轮材料</p>
            <p className="text-sm font-medium text-[var(--xidea-near-black)]">
              系统就是围绕这些材料继续判断和推进的
            </p>
          </div>
          <span className="rounded-full border border-[var(--xidea-selection-border)] bg-[var(--xidea-selection)] px-2.5 py-1 text-[11px] text-[var(--xidea-selection-text)]">
            {materials.length} 份
          </span>
        </div>
        {summary.trim() !== "" ? (
          <p className="text-[13px] leading-6 text-[var(--xidea-charcoal)]">{summary}</p>
        ) : null}
        {concepts.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {concepts.slice(0, 6).map((concept) => (
              <span
                className="rounded-full border border-[var(--xidea-border)] bg-[var(--xidea-parchment)] px-2.5 py-1 text-[12px] text-[var(--xidea-stone)]"
                key={`inline-material-concept-${concept}`}
              >
                {concept}
              </span>
            ))}
          </div>
        ) : null}
        {materials.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {materials.slice(0, 4).map((material) => (
              <div
                className="rounded-[0.9rem] border border-[var(--xidea-border)] bg-[var(--xidea-parchment)] px-3 py-3"
                key={`inline-material-${material.id}`}
              >
                <p className="line-clamp-2 text-sm font-medium leading-6 text-[var(--xidea-near-black)]">
                  {material.title}
                </p>
                <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-[var(--xidea-stone)]">
                  {material.topic}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function SessionThreadPane({
  activeAssetSummary,
  activeMaterialRead,
  activeRuntime,
  activeSourceAssets,
  activityInputDisabled,
  composerDisabled,
  completedActivityDecks,
  currentActivities,
  currentActivity,
  currentActivityKey,
  currentActivityResolution,
  displayMessages,
  draftPrompt,
  errorMessage,
  hasPendingActivity,
  hasStructuredRuntime,
  isAgentRunning,
  isReplayingDeck,
  pinViewport,
  latestAssistantMessageId,
  onChangeDraftPrompt,
  onOpenKnowledgePoint,
  onSkipActivity,
  onSubmitActivity,
  onSubmitPrompt,
  onToggleProjectMaterial,
  onUploadMaterial,
  onUnsetSourceAsset,
  selectedProjectMaterials,
  selectedSessionId,
  selectedSessionType,
  selectedSourceAssetIds,
  sessionCreatedKnowledgePoints,
}: {
  activeAssetSummary: AgentAssetSummary | null;
  activeMaterialRead: AgentMaterialRead | null;
  activeRuntime: RuntimeSnapshot;
  activeSourceAssets: ReadonlyArray<SourceAsset>;
  activityInputDisabled: boolean;
  composerDisabled: boolean;
  completedActivityDecks: ReadonlyArray<CompletedActivityDeck>;
  currentActivities: RuntimeSnapshot["activities"];
  currentActivity: RuntimeSnapshot["activity"];
  currentActivityKey: string | null;
  currentActivityResolution: ActivityResolution | null;
  displayMessages: ReadonlyArray<UIMessage>;
  draftPrompt: string;
  errorMessage: string | null;
  hasPendingActivity: boolean;
  hasStructuredRuntime: boolean;
  isAgentRunning: boolean;
  isReplayingDeck: boolean;
  pinViewport: boolean;
  latestAssistantMessageId: string | null;
  onChangeDraftPrompt: (value: string) => void;
  onOpenKnowledgePoint: (pointId: string) => void;
  onSkipActivity: (attempts?: ReadonlyArray<LearningActivityAttempt>) => void;
  onSubmitActivity: (submission: LearningActivitySubmission) => void;
  onSubmitPrompt: () => void;
  onToggleProjectMaterial: (assetId: string) => void;
  onUploadMaterial: (file: File) => Promise<void>;
  onUnsetSourceAsset: (assetId: string) => void;
  selectedProjectMaterials: ReadonlyArray<SourceAsset>;
  selectedSessionId: string;
  selectedSessionType: "project" | "study" | "review";
  selectedSourceAssetIds: ReadonlyArray<string>;
  sessionCreatedKnowledgePoints: ReadonlyArray<KnowledgePointItem>;
}): ReactElement {
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const [isMaterialsExpanded, setIsMaterialsExpanded] = useState(false);
  const [isKnowledgeCardsExpanded, setIsKnowledgeCardsExpanded] = useState(false);
  const latestMessage = displayMessages.at(-1);
  const latestMessageText = latestMessage ? getMessageText(latestMessage) : "";
  const latestAssistantMessage = [...displayMessages]
    .reverse()
    .find((message) => message.role === "assistant");
  const latestAssistantText = latestAssistantMessage
    ? getMessageText(latestAssistantMessage)
    : "";
  const streamingPreviewText = sanitizeVisibleAssistantText(activeRuntime.assistantMessage).trim();
  const streamingStatusLabel =
    activeRuntime.streamStatusLabel ?? "正在判断下一步";
  const shouldShowPostReplyStatus =
    isAgentRunning &&
    hasStructuredRuntime &&
    latestAssistantText !== "";
  const shouldShowStreamingPreview =
    isAgentRunning &&
    hasStructuredRuntime &&
    streamingPreviewText !== "" &&
    latestAssistantText === "";
  const shouldShowRunningPlaceholder =
    isAgentRunning &&
    !shouldShowStreamingPreview &&
    latestAssistantText === "" &&
    (latestMessage?.role !== "assistant" || latestMessageText === "");
  const canManageMaterials = selectedSessionType === "project";
  const shouldShowActivityStack =
    currentActivity !== null &&
    (hasStructuredRuntime || isReplayingDeck) &&
    !isAgentRunning &&
    !shouldShowStreamingPreview &&
    !shouldShowRunningPlaceholder;
  const shouldShowSessionTopSection =
    canManageMaterials ||
    selectedSourceAssetIds.length > 0 ||
    sessionCreatedKnowledgePoints.length > 0;
  const shouldCompactThreadLayout =
    displayMessages.length === 0 &&
    !shouldShowStreamingPreview &&
    !shouldShowRunningPlaceholder;
  const canSubmitPrompt = !composerDisabled && draftPrompt.trim() !== "";
  const composerButtonLabel = isAgentRunning
    ? "正在发送"
    : canSubmitPrompt
      ? "发送消息"
      : "当前不可发送";
  const chronologicalDecks = [...completedActivityDecks].reverse();
  const progressOrchestrationTimeline = activeRuntime.orchestration.timeline.filter(
    (change) => change.visibility === "timeline" && change.kind !== "plan_created",
  );
  const currentOrchestrationChange =
    shouldShowActivityStack &&
    activeRuntime.orchestration.latestEvent !== null &&
    activeRuntime.orchestration.latestEvent.visibility === "timeline"
      ? activeRuntime.orchestration.latestEvent
      : null;
  const latestRenderableAssistantMessageId =
    [...displayMessages]
      .reverse()
      .find(
        (message) =>
          message.role === "assistant" && parseSessionOrchestrationMessage(message) === null,
      )?.id ?? null;
  const displayMessageIds = new Set(displayMessages.map((message) => message.id));

  useEffect(() => {
    const textarea = composerRef.current;
    if (textarea === null) {
      return;
    }

    const minHeight = 44;
    const maxHeight = 176;
    textarea.style.height = "0px";
    const nextHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [draftPrompt]);

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();
    if (!canSubmitPrompt) {
      return;
    }

    onSubmitPrompt();
  }

  const threadContent = (
    <div className={`space-y-4 pb-4 ${shouldShowSessionTopSection ? "" : "pt-4"}`}>
      {displayMessages.length === 0 &&
      !shouldShowStreamingPreview &&
      !shouldShowRunningPlaceholder ? (
        <Card className="rounded-[1.1rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
          <CardContent className="px-4 py-4 text-sm leading-6 text-[var(--xidea-stone)]">
            还没有消息。
          </CardContent>
        </Card>
      ) : (
        displayMessages.map((message, messageIndex) => {
          const isAssistant = message.role === "assistant";
          const orchestrationChange = parseSessionOrchestrationMessage(message);
          const rawText = getMessageText(message);
          const liveAssistantText =
            isAssistant &&
            message.id === latestAssistantMessageId &&
            isAgentRunning &&
            streamingPreviewText !== "" &&
            streamingPreviewText.length >= rawText.length
              ? streamingPreviewText
              : rawText;
          const shouldShowInlineStreamingTail =
            isAssistant &&
            message.id === latestAssistantMessageId &&
            isAgentRunning &&
            hasStructuredRuntime &&
            liveAssistantText !== "";
          const isSyntheticBatchMessage =
            !isAssistant && isSyntheticActivityBatchMessage(rawText);
          const syntheticBatchIndex = isSyntheticBatchMessage
            ? displayMessages
                .slice(0, messageIndex + 1)
                .filter((candidate) =>
                  isSyntheticActivityBatchMessage(getMessageText(candidate)),
                ).length - 1
            : -1;
          const linkedDeck =
            syntheticBatchIndex >= 0 ? chronologicalDecks[syntheticBatchIndex] ?? null : null;
          const linkedOrchestration =
            syntheticBatchIndex >= 0
              ? progressOrchestrationTimeline[syntheticBatchIndex] ?? null
              : null;
          const messageCreatedKnowledgePoints =
            isAssistant && selectedSessionType === "project"
              ? sessionCreatedKnowledgePoints.filter((point) => {
                  const linkedMessageId = point.linkedMessageIdsBySession[selectedSessionId];
                  if (linkedMessageId === message.id) {
                    return true;
                  }
                  const hasVisibleLinkedMessage =
                    linkedMessageId !== undefined && displayMessageIds.has(linkedMessageId);
                  return (
                    !hasVisibleLinkedMessage &&
                    latestRenderableAssistantMessageId === message.id &&
                    point.linkedSessionIds.includes(selectedSessionId)
                  );
                })
              : [];
          const shouldShowInlineMaterialContext =
            isAssistant &&
            selectedSessionType === "project" &&
            latestRenderableAssistantMessageId === message.id &&
            (activeMaterialRead?.materials.length ?? activeAssetSummary?.assets.length ?? 0) > 0;
          if (isAssistant && liveAssistantText === "") {
            return null;
          }
          if (orchestrationChange !== null) {
            return null;
          }

          return (
            <div className="space-y-3" key={message.id}>
              <div
                className={
                  isAssistant
                    ? "flex justify-start"
                    : isSyntheticBatchMessage
                      ? "flex justify-center"
                      : "flex justify-end"
                }
              >
                {isAssistant ? (
                  <div className="w-full max-w-[82%] py-0.5">
                    <MarkdownContent
                      content={liveAssistantText}
                      trailingInline={shouldShowInlineStreamingTail ? <InlineStreamingTail /> : undefined}
                    />
                  </div>
                ) : isSyntheticBatchMessage ? (
                  <Card className="w-full max-w-[78%] rounded-[1rem] border-[var(--xidea-border)] bg-[var(--xidea-parchment)] shadow-none">
                    <CardContent className="space-y-1.5 px-4 py-3">
                      <p className="xidea-kicker text-[var(--xidea-stone)]">
                        学习动作结果
                      </p>
                      <p className="text-sm leading-6 text-[var(--xidea-charcoal)]">
                        {getVisibleSyntheticActivityBatchMessage(rawText)}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="w-full max-w-[72%] rounded-[1rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
                    <CardContent className="px-3 py-2.5 text-sm leading-6 text-[var(--xidea-charcoal)]">
                      <div>{rawText}</div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {isAssistant &&
              message.id === latestAssistantMessageId &&
              shouldShowActivityStack ? (
                <div className="w-full max-w-[82%] pl-1 space-y-3">
                  {currentOrchestrationChange !== null ? (
                    <SessionOrchestrationCard change={currentOrchestrationChange} />
                  ) : null}
                  <LearningActivityStack
                    activities={currentActivities}
                    disabled={activityInputDisabled}
                    isReplay={isReplayingDeck}
                    key={`${selectedSessionId}-${currentActivityKey ?? currentActivity.id}`}
                    onSkip={onSkipActivity}
                    onSubmit={onSubmitActivity}
                    resolution={currentActivityResolution}
                  />
                </div>
              ) : null}

              {isAssistant && messageCreatedKnowledgePoints.length > 0 ? (
                <div className="w-full max-w-[82%] pl-1">
                  <Card className="rounded-[1rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
                    <CardContent className="space-y-3 px-4 py-4">
                      <div className="space-y-1">
                        <p className="xidea-kicker text-[var(--xidea-selection-text)]">
                          这轮生成的知识卡
                        </p>
                        <p className="text-sm leading-6 text-[var(--xidea-charcoal)]">
                          点开可以继续查看详情，或从这里进入后续学习和复习。
                        </p>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {messageCreatedKnowledgePoints.map((point) => (
                          <KnowledgePointInlineCard
                            key={`session-created-inline-${point.id}`}
                            onClick={() => onOpenKnowledgePoint(point.id)}
                            point={point}
                          />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : null}

              {shouldShowInlineMaterialContext ? (
                <div className="w-full max-w-[82%] pl-1">
                  <InlineMaterialContextCard
                    activeAssetSummary={activeAssetSummary}
                    activeMaterialRead={activeMaterialRead}
                  />
                </div>
              ) : null}

              {isSyntheticBatchMessage && linkedOrchestration !== null ? (
                <div className="w-full max-w-[82%] pl-1">
                  <SessionOrchestrationCard change={linkedOrchestration} />
                </div>
              ) : null}

              {isSyntheticBatchMessage && linkedDeck !== null ? (
                <div className="w-full max-w-[82%] pl-1">
                  <InlineCompletedDeckPreview deck={linkedDeck} />
                </div>
              ) : null}

              {isAssistant &&
              message.id === latestAssistantMessageId &&
              shouldShowPostReplyStatus ? (
                <div className="w-full max-w-[82%] pl-1">
                  <SessionStreamingStatus label={streamingStatusLabel} />
                </div>
              ) : null}
            </div>
          );
        })
      )}

      {shouldShowStreamingPreview || shouldShowRunningPlaceholder ? (
        <div className="space-y-3">
          <div className="flex justify-start">
            <div className="w-full max-w-[82%] py-0.5">
              {shouldShowStreamingPreview ? (
                <div className="space-y-3">
                  <MarkdownContent content={streamingPreviewText} />
                  <SessionStreamingStatus label={streamingStatusLabel} />
                </div>
              ) : (
                <div>
                  <SessionStreamingStatus label={streamingStatusLabel} />
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <CardContent className="flex min-h-0 flex-col gap-4 p-0">
      {shouldShowSessionTopSection ? (
        <>
          <div className="px-5 pt-5 lg:px-6">
            <div className="space-y-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                {canManageMaterials ? (
                  <div
                    className="relative w-fit max-w-full after:absolute after:left-0 after:right-0 after:top-full after:h-3 after:content-['']"
                    onBlurCapture={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                        setIsMaterialsExpanded(false);
                      }
                    }}
                    onFocusCapture={() => setIsMaterialsExpanded(true)}
                    onMouseEnter={() => setIsMaterialsExpanded(true)}
                    onMouseLeave={() => setIsMaterialsExpanded(false)}
                  >
                    <button
                      className="inline-flex items-center gap-2 rounded-full border border-[var(--xidea-selection-border)] bg-[var(--xidea-white)] px-3 py-1.5"
                      onClick={() => setIsMaterialsExpanded((current) => !current)}
                      type="button"
                    >
                      <FileInput className="h-4 w-4 text-[var(--xidea-selection-text)]" />
                      <p className="xidea-kicker text-[var(--xidea-selection-text)]">材料</p>
                      {selectedSourceAssetIds.length > 0 ? (
                        <Badge
                          className="border-[var(--xidea-selection-border)] bg-[var(--xidea-selection)] text-[var(--xidea-selection-text)] shadow-none"
                          variant="outline"
                        >
                          已附 {selectedSourceAssetIds.length} 份
                        </Badge>
                      ) : null}
                    </button>
                    <div
                      className="pointer-events-auto absolute left-0 top-[calc(100%+0.5rem)] z-20 w-[min(36rem,calc(100vw-8rem))] overflow-hidden rounded-[1.25rem] transition-[max-height,opacity,transform] duration-200 ease-out"
                      style={{
                        maxHeight: isMaterialsExpanded ? "36rem" : "0px",
                        opacity: isMaterialsExpanded ? 1 : 0,
                        visibility: isMaterialsExpanded ? "visible" : "hidden",
                        transform: isMaterialsExpanded ? "translateY(0)" : "translateY(6px)",
                      }}
                    >
                      <div className="space-y-3 rounded-[1.25rem] border border-[var(--xidea-border)] bg-[var(--xidea-white)] p-3 shadow-[0_20px_40px_rgba(20,20,19,0.10)]">
                        <div className="flex items-center justify-between gap-3">
                          <p className="xidea-kicker text-[var(--xidea-selection-text)]">项目材料</p>
                          <MaterialUploadButton label="上传新材料" onUpload={onUploadMaterial} />
                        </div>
                        {activeSourceAssets.length > 0 ? (
                          <div className="space-y-2">
                            <p className="text-[12px] text-[var(--xidea-stone)]">这轮已附材料</p>
                            <div className="flex flex-wrap gap-2">
                              {activeSourceAssets.map((asset) => (
                                <button
                                  className="rounded-full border border-[var(--xidea-selection-border)] bg-[var(--xidea-selection)] px-3 py-1.5 text-[12px] text-[var(--xidea-selection-text)] transition-colors hover:bg-[#f2e6df]"
                                  key={asset.id}
                                  onClick={() => onUnsetSourceAsset(asset.id)}
                                  type="button"
                                >
                                  {asset.title}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        <AssetListGrid
                          assets={selectedProjectMaterials}
                          className="grid gap-2 sm:grid-cols-2"
                          emptyText="当前项目还没有材料。"
                          expandOnHover
                          onAssetClick={onToggleProjectMaterial}
                          selectedAssetIds={selectedSourceAssetIds}
                        />
                      </div>
                    </div>
                  </div>
                ) : null}
                {selectedSessionType === "project" && sessionCreatedKnowledgePoints.length > 0 ? (
                  <div
                    className="relative w-fit max-w-full after:absolute after:left-0 after:right-0 after:top-full after:h-3 after:content-['']"
                    onBlurCapture={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                        setIsKnowledgeCardsExpanded(false);
                      }
                    }}
                    onFocusCapture={() => setIsKnowledgeCardsExpanded(true)}
                    onMouseEnter={() => setIsKnowledgeCardsExpanded(true)}
                    onMouseLeave={() => setIsKnowledgeCardsExpanded(false)}
                  >
                    <button
                      className="inline-flex items-center gap-2 rounded-full border border-[var(--xidea-selection-border)] bg-[var(--xidea-white)] px-3 py-1.5"
                      onClick={() => setIsKnowledgeCardsExpanded((current) => !current)}
                      type="button"
                    >
                      <BookOpen className="h-4 w-4 text-[var(--xidea-selection-text)]" />
                      <p className="xidea-kicker text-[var(--xidea-selection-text)]">知识卡</p>
                      <Badge
                        className="border-[var(--xidea-selection-border)] bg-[var(--xidea-selection)] text-[var(--xidea-selection-text)] shadow-none"
                        variant="outline"
                      >
                        {sessionCreatedKnowledgePoints.length} 张
                      </Badge>
                    </button>
                    <div
                      className="pointer-events-auto absolute left-0 top-[calc(100%+0.5rem)] z-20 w-[min(48rem,calc(100vw-8rem))] overflow-hidden rounded-[1.25rem] transition-[max-height,opacity,transform] duration-200 ease-out"
                      style={{
                        maxHeight: isKnowledgeCardsExpanded ? "32rem" : "0px",
                        opacity: isKnowledgeCardsExpanded ? 1 : 0,
                        visibility: isKnowledgeCardsExpanded ? "visible" : "hidden",
                        transform: isKnowledgeCardsExpanded ? "translateY(0)" : "translateY(6px)",
                      }}
                    >
                      <div className="space-y-3 rounded-[1.25rem] border border-[var(--xidea-border)] bg-[var(--xidea-white)] p-3 shadow-[0_20px_40px_rgba(20,20,19,0.10)]">
                        <div className="space-y-1">
                          <p className="xidea-kicker text-[var(--xidea-selection-text)]">本会话知识卡</p>
                          <p className="text-sm leading-6 text-[var(--xidea-charcoal)]">
                            这轮沉淀出的知识卡会先收在这里，后面可以继续进入学习和复习。
                          </p>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                          {sessionCreatedKnowledgePoints.map((point) => (
                            <KnowledgePointInlineCard
                              key={`session-created-top-${point.id}`}
                              onClick={() => onOpenKnowledgePoint(point.id)}
                              point={point}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
                {!canManageMaterials && selectedSourceAssetIds.length > 0 ? (
                  <Badge
                    className="border-[var(--xidea-selection-border)] bg-[var(--xidea-selection)] text-[var(--xidea-selection-text)] shadow-none"
                    variant="outline"
                  >
                    已附 {selectedSourceAssetIds.length} 份材料
                  </Badge>
                ) : null}
              </div>

            </div>
          </div>

          <Separator className="bg-[var(--xidea-border)]" />
        </>
      ) : null}

      {shouldCompactThreadLayout || !pinViewport ? (
        <div className="px-5 lg:px-6">{threadContent}</div>
      ) : (
        <div className="min-h-0 px-5 lg:max-h-[calc(100svh-22rem)] lg:overflow-y-auto lg:px-6 lg:pr-3">
          {threadContent}
        </div>
      )}

      <div className="shrink-0 px-5 pb-4 pt-3 lg:px-6">
        <div className="flex items-end gap-3">
          <Textarea
            className="h-11 max-h-44 min-h-0 flex-1 rounded-[1rem] border-[var(--xidea-sand)] bg-[var(--xidea-white)] px-4 py-3 text-sm leading-6 text-[var(--xidea-charcoal)] shadow-none focus-visible:ring-[var(--xidea-selection-border)]"
            disabled={composerDisabled}
            onChange={(event) => onChangeDraftPrompt(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            placeholder={
              hasPendingActivity
                ? "先完成当前学习动作或跳过，再继续对话。"
                : canManageMaterials && selectedSourceAssetIds.length > 0
                  ? "补一句你希望系统先围绕这些材料判断什么。"
                  : selectedSessionType === "project"
                    ? "输入这轮想推进的方向、材料判断或知识点沉淀诉求。"
                    : "输入这轮想验证的问题。"
            }
            ref={composerRef}
            value={draftPrompt}
          />

          <Button
            aria-label={composerButtonLabel}
            className="h-11 w-11 shrink-0 rounded-full bg-[var(--xidea-terracotta)] p-0 text-[var(--xidea-ivory)] hover:bg-[var(--xidea-terracotta)]/90"
            disabled={!canSubmitPrompt}
            onClick={onSubmitPrompt}
            title={composerButtonLabel}
            type="button"
          >
            {isAgentRunning ? (
              <LoaderCircle className="h-4.5 w-4.5 animate-spin" />
            ) : canSubmitPrompt ? (
              <SendHorizontal className="h-4.5 w-4.5" />
            ) : (
              <CircleSlash className="h-4.5 w-4.5" />
            )}
          </Button>
        </div>

        {errorMessage ? (
          <div className="mt-3 rounded-[1rem] border border-[#ebd5cc] bg-[#f9efea] px-4 py-3 text-sm leading-6 text-[var(--xidea-selection-text)]">
            {errorMessage}
          </div>
        ) : null}
      </div>
    </CardContent>
  );
}
