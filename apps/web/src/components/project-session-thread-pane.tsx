import type { ReactElement } from "react";
import type { UIMessage } from "ai";
import { FileInput } from "lucide-react";
import { LearningActivityStack } from "@/components/learning-activity-stack";
import { MarkdownContent } from "@/components/markdown-content";
import { getAssetKindLabel } from "@/components/project-workspace-core-primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { getMessageText } from "@/domain/chat-message";
import type { ActivityResolution } from "@/domain/project-session-runtime";
import type { LearningActivitySubmission, SourceAsset } from "@/domain/types";
import type { RuntimeSnapshot } from "@/domain/agent-runtime";

export function ProjectSessionThreadPane({
  activeRuntime,
  activeSourceAssets,
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
  onSkipActivity,
  onSubmitActivity,
  onSubmitPrompt,
  onToggleProjectMaterial,
  onToggleMaterialsTray,
  onUnsetSourceAsset,
  selectedProjectMaterials,
  selectedSessionId,
  selectedSourceAssetIds,
  submitDisabled,
}: {
  activeRuntime: RuntimeSnapshot;
  activeSourceAssets: ReadonlyArray<SourceAsset>;
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
  onSkipActivity: () => void;
  onSubmitActivity: (submission: LearningActivitySubmission) => void;
  onSubmitPrompt: () => void;
  onToggleProjectMaterial: (assetId: string) => void;
  onToggleMaterialsTray: () => void;
  onUnsetSourceAsset: (assetId: string) => void;
  selectedProjectMaterials: ReadonlyArray<SourceAsset>;
  selectedSessionId: string;
  selectedSourceAssetIds: ReadonlyArray<string>;
  submitDisabled: boolean;
}): ReactElement {
  return (
    <CardContent className="flex min-h-0 flex-1 flex-col gap-4 p-0">
      <div className="px-5 pt-5 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Button
              className="rounded-full border-[var(--xidea-border)] bg-[var(--xidea-white)] text-[var(--xidea-charcoal)] hover:border-[var(--xidea-selection-border)] hover:bg-[#f8f6f1]"
              onClick={onToggleMaterialsTray}
              type="button"
              variant="outline"
            >
              <FileInput className="h-4 w-4" />
              {isMaterialsTrayOpen ? "收起材料" : "添加材料"}
            </Button>
            {selectedSourceAssetIds.length > 0 ? (
              <Badge
                className="border-[var(--xidea-selection-border)] bg-[var(--xidea-selection)] text-[var(--xidea-selection-text)] shadow-none"
                variant="outline"
              >
                已附 {selectedSourceAssetIds.length} 份材料
              </Badge>
            ) : (
              <span className="text-sm text-[var(--xidea-stone)]">
                当前先按纯对话推进，需要时再把材料挂进这一轮。
              </span>
            )}
          </div>

          {selectedSourceAssetIds.length > 0 ? (
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
      </div>

      <Separator className="bg-[var(--xidea-border)]" />

      <div className="min-h-0 flex-1 px-5 lg:px-6">
        <ScrollArea className="h-full pr-3">
          <div className="space-y-4 pb-4">
            {isMaterialsTrayOpen ? (
              <section className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f5ede9] text-[var(--xidea-terracotta)]">
                    <FileInput className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="xidea-kicker text-[var(--xidea-stone)]">材料</p>
                    <p className="text-sm leading-6 text-[var(--xidea-charcoal)]">
                      这些材料会作为本轮附加上下文一起送给 agent，不需要先切模式。
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  {selectedProjectMaterials.map((asset) => {
                    const selected = selectedSourceAssetIds.includes(asset.id);

                    return (
                      <button
                        className={
                          selected
                            ? "rounded-[1rem] bg-[var(--xidea-selection)] px-4 py-4 text-left transition-colors"
                            : "rounded-[1rem] bg-[var(--xidea-parchment)] px-4 py-4 text-left transition-colors hover:bg-[#f8f2ee]"
                        }
                        key={asset.id}
                        onClick={() => onToggleProjectMaterial(asset.id)}
                        type="button"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-[var(--xidea-near-black)]">
                            {asset.title}
                          </p>
                          <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--xidea-stone)]">
                            {getAssetKindLabel(asset.kind)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-[var(--xidea-charcoal)]">
                          {asset.topic}
                        </p>
                      </button>
                    );
                  })}
                </div>
                {selectedProjectMaterials.length === 0 ? (
                  <Card className="rounded-[1rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
                    <CardContent className="px-4 py-4 text-sm leading-6 text-[var(--xidea-stone)]">
                      当前 project 还没有材料。先到 More 里的“编辑 Project Meta”把材料加入项目池，再挂进 session。
                    </CardContent>
                  </Card>
                ) : null}
              </section>
            ) : null}

            {displayMessages.length === 0 ? (
              <Card className="rounded-[1.1rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
                <CardContent className="px-4 py-4 text-sm leading-6 text-[var(--xidea-stone)]">
                  当前 session 还没有消息。你可以先输入问题、补材料，或让系统直接开始学习 / 复习。
                </CardContent>
              </Card>
            ) : (
              displayMessages.map((message) => {
                const isAssistant = message.role === "assistant";
                const rawText = getMessageText(message);
                if (isAssistant && rawText === "") {
                  return null;
                }

                return (
                  <div className="space-y-3" key={message.id}>
                    <div className={isAssistant ? "flex justify-start" : "flex justify-end"}>
                      {isAssistant ? (
                        <div className="w-full max-w-[82%] py-0.5">
                          <div className="mb-1.5 flex items-center gap-2">
                            <span className="xidea-kicker text-[var(--xidea-selection-text)]">
                              Agent
                            </span>
                          </div>
                          <MarkdownContent content={rawText} />
                        </div>
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
                    hasStructuredRuntime &&
                    currentActivity !== null ? (
                      <div className="w-full max-w-[82%] pl-1">
                        <LearningActivityStack
                          activities={currentActivities}
                          disabled={submitDisabled}
                          key={`${selectedSessionId}-${currentActivityKey ?? currentActivity.id}`}
                          onSkip={onSkipActivity}
                          onSubmit={onSubmitActivity}
                          resolution={currentActivityResolution}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="shrink-0 border-t border-[var(--xidea-border)] px-5 py-4 lg:px-6">
        <Card className="rounded-[1.2rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
          <CardContent className="p-4">
            <div className="relative">
              <Textarea
                className="min-h-28 rounded-[1rem] border-[var(--xidea-sand)] bg-[var(--xidea-ivory)] pr-28 pb-12 text-sm leading-7 text-[var(--xidea-charcoal)] shadow-none focus-visible:ring-[var(--xidea-selection-border)]"
                disabled={submitDisabled}
                onChange={(event) => onChangeDraftPrompt(event.target.value)}
                placeholder={
                  hasPendingActivity
                    ? "先完成当前学习动作或跳过，再继续对话。"
                    : selectedSourceAssetIds.length > 0
                      ? "补一句你希望系统围绕这些材料先判断什么、澄清什么，或生成什么训练动作。"
                      : "输入这一轮你想推进的问题或材料。"
                }
                value={draftPrompt}
              />

              <Button
                className="absolute bottom-3 right-3 rounded-full bg-[var(--xidea-terracotta)] px-4 text-[var(--xidea-ivory)] hover:bg-[var(--xidea-terracotta)]/90"
                disabled={submitDisabled}
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
                这轮先完成上面的学习动作，或者选择跳过，再继续自由对话。
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </CardContent>
  );
}
