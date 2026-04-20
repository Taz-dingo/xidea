import type { ReactElement } from "react";
import type { UIMessage } from "ai";
import { FileInput } from "lucide-react";
import { LearningActivityStack } from "@/components/learning-activity-stack";
import { MaterialUploadButton } from "@/components/material-upload-button";
import { MarkdownContent } from "@/components/markdown-content";
import { AssetListGrid, KnowledgePointInlineCard } from "@/components/workspace/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { getMessageText, sanitizeVisibleAssistantText } from "@/domain/chat-message";
import {
  ACTIVITY_BATCH_SUMMARY_PREFIX,
  type ActivityResolution,
} from "@/domain/project-session-runtime";
import type { KnowledgePointItem } from "@/domain/project-workspace";
import type {
  LearningActivityAttempt,
  LearningActivitySubmission,
  SourceAsset,
} from "@/domain/types";
import type { RuntimeSnapshot } from "@/domain/agent-runtime";

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

export function SessionThreadPane({
  activeRuntime,
  activeSourceAssets,
  activityInputDisabled,
  composerDisabled,
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
  isMaterialsTrayOpen,
  latestAssistantMessageId,
  onChangeDraftPrompt,
  onOpenKnowledgePoint,
  onSkipActivity,
  onSubmitActivity,
  onSubmitPrompt,
  onToggleProjectMaterial,
  onToggleMaterialsTray,
  onUploadMaterial,
  onUnsetSourceAsset,
  selectedProjectMaterials,
  selectedSessionId,
  selectedSessionType,
  selectedSourceAssetIds,
  sessionCreatedKnowledgePoints,
}: {
  activeRuntime: RuntimeSnapshot;
  activeSourceAssets: ReadonlyArray<SourceAsset>;
  activityInputDisabled: boolean;
  composerDisabled: boolean;
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
  isMaterialsTrayOpen: boolean;
  latestAssistantMessageId: string | null;
  onChangeDraftPrompt: (value: string) => void;
  onOpenKnowledgePoint: (pointId: string) => void;
  onSkipActivity: (attempts?: ReadonlyArray<LearningActivityAttempt>) => void;
  onSubmitActivity: (submission: LearningActivitySubmission) => void;
  onSubmitPrompt: () => void;
  onToggleProjectMaterial: (assetId: string) => void;
  onToggleMaterialsTray: () => void;
  onUploadMaterial: (file: File) => Promise<void>;
  onUnsetSourceAsset: (assetId: string) => void;
  selectedProjectMaterials: ReadonlyArray<SourceAsset>;
  selectedSessionId: string;
  selectedSessionType: "project" | "study" | "review";
  selectedSourceAssetIds: ReadonlyArray<string>;
  sessionCreatedKnowledgePoints: ReadonlyArray<KnowledgePointItem>;
}): ReactElement {
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
    latestAssistantText !== "" &&
    (activeRuntime.streamStatusPhase === "preparing-followup" ||
      activeRuntime.streamStatusPhase === "writing-state");
  const shouldShowStreamingPreview =
    isAgentRunning &&
    hasStructuredRuntime &&
    streamingPreviewText !== "" &&
    latestAssistantText === "";
  const shouldShowRunningPlaceholder =
    isAgentRunning &&
    !shouldShowStreamingPreview &&
    (latestMessage?.role !== "assistant" || latestMessageText === "");
  const canManageMaterials = selectedSessionType === "project";
  const shouldShowActivityStack =
    hasStructuredRuntime &&
    currentActivity !== null &&
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
    !shouldShowRunningPlaceholder &&
    !(canManageMaterials && isMaterialsTrayOpen);
  const threadContent = (
    <div className="space-y-4 pb-4">
      {canManageMaterials && isMaterialsTrayOpen ? (
        <section className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f5ede9] text-[var(--xidea-terracotta)]">
              <FileInput className="h-4 w-4" />
            </div>
            <div>
              <p className="xidea-kicker text-[var(--xidea-stone)]">材料</p>
            </div>
          </div>
          <div className="flex justify-end">
            <MaterialUploadButton label="上传新材料" onUpload={onUploadMaterial} />
          </div>
          <AssetListGrid
            assets={selectedProjectMaterials}
            className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4"
            emptyText="当前项目还没有材料。"
            onAssetClick={onToggleProjectMaterial}
            selectedAssetIds={selectedSourceAssetIds}
          />
        </section>
      ) : null}

      {displayMessages.length === 0 &&
      !shouldShowStreamingPreview &&
      !shouldShowRunningPlaceholder ? (
        <Card className="rounded-[1.1rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
          <CardContent className="px-4 py-4 text-sm leading-6 text-[var(--xidea-stone)]">
            还没有消息。
          </CardContent>
        </Card>
      ) : (
        displayMessages.map((message) => {
          const isAssistant = message.role === "assistant";
          const rawText = getMessageText(message);
          const isSyntheticBatchMessage =
            !isAssistant && isSyntheticActivityBatchMessage(rawText);
          const messageCreatedKnowledgePoints =
            isAssistant && selectedSessionType === "project"
              ? sessionCreatedKnowledgePoints.filter(
                  (point) =>
                    point.linkedMessageIdsBySession[selectedSessionId] === message.id,
                )
              : [];
          if (isAssistant && rawText === "") {
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
                    <MarkdownContent content={rawText} />
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
                <div className="w-full max-w-[82%] pl-1">
                  <LearningActivityStack
                    activities={currentActivities}
                    disabled={activityInputDisabled}
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

              {isAssistant &&
              message.id === latestAssistantMessageId &&
              shouldShowPostReplyStatus ? (
                <div className="w-full max-w-[82%] pl-1">
                  <div className="rounded-[1rem] border border-[var(--xidea-border)] bg-[var(--xidea-white)] px-4 py-3">
                    <SessionStreamingStatus label={streamingStatusLabel} />
                  </div>
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
                <MarkdownContent content={streamingPreviewText} />
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
    <CardContent
      className={`flex min-h-0 flex-col gap-4 p-0 ${shouldCompactThreadLayout ? "" : "flex-1"}`}
    >
      {shouldShowSessionTopSection ? (
        <>
          <div className="px-5 pt-5 lg:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                {canManageMaterials ? (
                  <Button
                    className="rounded-full border-[var(--xidea-border)] bg-[var(--xidea-white)] text-[var(--xidea-charcoal)] hover:border-[var(--xidea-selection-border)] hover:bg-[#f8f6f1]"
                    onClick={onToggleMaterialsTray}
                    type="button"
                    variant="outline"
                  >
                    <FileInput className="h-4 w-4" />
                    {isMaterialsTrayOpen ? "收起材料" : "添加材料"}
                  </Button>
                ) : null}
                {selectedSourceAssetIds.length > 0 ? (
                  <Badge
                    className="border-[var(--xidea-selection-border)] bg-[var(--xidea-selection)] text-[var(--xidea-selection-text)] shadow-none"
                    variant="outline"
                  >
                    已附 {selectedSourceAssetIds.length} 份材料
                  </Badge>
                ) : null}
              </div>

              {canManageMaterials && selectedSourceAssetIds.length > 0 ? (
                <div className="flex flex-wrap justify-end gap-2">
                  {activeSourceAssets.slice(0, 3).map((asset) => (
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
              ) : null}
            </div>
            {selectedSessionType === "project" && sessionCreatedKnowledgePoints.length > 0 ? (
              <div className="mt-3 space-y-2">
                <p className="xidea-kicker text-[var(--xidea-selection-text)]">
                  本会话知识卡
                </p>
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
            ) : null}
          </div>

          <Separator className="bg-[var(--xidea-border)]" />
        </>
      ) : null}

      {shouldShowSessionTopSection ? null : <div className="pt-4" />}

      {shouldCompactThreadLayout ? (
        <div className="px-5 lg:px-6">{threadContent}</div>
      ) : (
        <div className="min-h-0 flex-1 px-5 lg:px-6">
          <ScrollArea className="h-full pr-3">{threadContent}</ScrollArea>
        </div>
      )}

      <div className="shrink-0 border-t border-[var(--xidea-border)] px-5 py-4 lg:px-6">
        <Card className="rounded-[1.2rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
          <CardContent className="p-4">
            <div className="relative">
              <Textarea
                className="min-h-28 rounded-[1rem] border-[var(--xidea-sand)] bg-[var(--xidea-ivory)] pr-28 pb-12 text-sm leading-7 text-[var(--xidea-charcoal)] shadow-none focus-visible:ring-[var(--xidea-selection-border)]"
                disabled={composerDisabled}
                onChange={(event) => onChangeDraftPrompt(event.target.value)}
                placeholder={
                  hasPendingActivity
                    ? "先完成当前学习动作或跳过，再继续对话。"
                    : canManageMaterials && selectedSourceAssetIds.length > 0
                      ? "补一句你希望系统先围绕这些材料判断什么。"
                      : selectedSessionType === "project"
                        ? "输入这轮想推进的方向、材料判断或知识点沉淀诉求。"
                        : "输入这轮想验证的问题。"
                }
                value={draftPrompt}
              />

              <Button
                className="absolute bottom-3 right-3 rounded-full bg-[var(--xidea-terracotta)] px-4 text-[var(--xidea-ivory)] hover:bg-[var(--xidea-terracotta)]/90"
                disabled={composerDisabled}
                onClick={onSubmitPrompt}
                type="button"
              >
                {isAgentRunning ? "运行中..." : "发送"}
              </Button>
            </div>

            {errorMessage ? (
              <Card className="mt-4 rounded-[1rem] border-[#ebd5cc] bg-[#f9efea] shadow-none">
                <CardContent className="px-4 py-3 text-sm leading-6 text-[var(--xidea-selection-text)]">
                  {errorMessage}
                </CardContent>
              </Card>
            ) : hasPendingActivity ? (
              <p className="mt-3 text-sm leading-6 text-[var(--xidea-stone)]">
                先完成上面的动作，或跳过后再继续对话。
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </CardContent>
  );
}
