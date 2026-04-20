import { useMemo, useState } from "react";
import type { ReactElement } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CompactNote, MonitorSection } from "@/components/workspace/monitor";
import type {
  AgentAssetSummary,
  AgentReviewInspector,
  RuntimeSnapshot,
} from "@/domain/agent-runtime";
import type {
  ActivityBatchResult,
  CompletedActivityDeck,
} from "@/domain/project-session-runtime";
import {
  getSessionTypeLabel,
  type ProjectItem,
} from "@/domain/project-workspace";

function formatDeckCompletionLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "刚刚";
  }

  const diffMinutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (diffMinutes < 1) {
    return "刚刚完成";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} 分钟前`;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getAttemptStatusLabel(card: ActivityBatchResult): string {
  if (card.action === "skip") {
    return "已跳过";
  }
  if (card.isCorrect === true) {
    return `已完成 · ${card.attempts.length} 次`;
  }
  return "未完成";
}

function getAttemptStatusClass(card: ActivityBatchResult): string {
  if (card.action === "skip") {
    return "border-[var(--xidea-border)] bg-[var(--xidea-white)] text-[var(--xidea-stone)]";
  }
  if (card.isCorrect === true) {
    return "border-[#bfd6a7] bg-[#f3fbe9] text-[#4f7c2f]";
  }
  return "border-[var(--xidea-selection-border)] bg-[#fff3eb] text-[var(--xidea-selection-text)]";
}

function DeckStackPreview({
  deck,
  onOpen,
}: {
  deck: CompletedActivityDeck;
  onOpen: () => void;
}): ReactElement {
  const latestCard = deck.cards.at(-1) ?? deck.cards[0];
  const correctCount = deck.cards.filter((card) => card.isCorrect === true).length;
  const totalAttempts = deck.cards.reduce((total, card) => total + card.attempts.length, 0);

  return (
    <button
      className="group relative block w-full text-left"
      onClick={onOpen}
      type="button"
    >
      {[2, 1].map((layer) => (
        <div
          className="pointer-events-none absolute inset-x-4 rounded-[1.05rem] border border-[var(--xidea-border)] bg-[linear-gradient(180deg,#fffdf9_0%,#f3ece6_100%)] opacity-80 transition-transform group-hover:translate-y-[-2px]"
          key={`${deck.deckKey}-layer-${layer}`}
          style={{
            top: `${layer * 10}px`,
            transform: `rotate(${layer % 2 === 0 ? 1.1 : -1}deg)`,
            zIndex: layer,
          }}
        />
      ))}
      <Card className="relative z-10 rounded-[1.15rem] border-[var(--xidea-selection-border)] bg-[var(--xidea-white)] shadow-none transition-transform group-hover:-translate-y-1">
        <CardContent className="space-y-3 px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <SessionBadgeLabel sessionType={deck.sessionType} />
                <span className="text-[12px] text-[var(--xidea-stone)]">
                  {formatDeckCompletionLabel(deck.completedAt)}
                </span>
              </div>
              <p className="text-sm font-medium leading-6 text-[var(--xidea-near-black)]">
                {latestCard?.activityTitle ?? "本轮卡组"}
              </p>
            </div>
            <Badge className="border-[var(--xidea-border)] bg-[var(--xidea-parchment)] text-[var(--xidea-stone)] shadow-none" variant="outline">
              回看
            </Badge>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <CompactInlineNote label="卡片" value={`${deck.cards.length} 张`} />
            <CompactInlineNote label="答对" value={`${correctCount} 张`} />
            <CompactInlineNote label="尝试" value={`${totalAttempts} 次`} />
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

function CompactInlineNote({
  label,
  value,
}: {
  label: string;
  value: string;
}): ReactElement {
  return (
    <div className="rounded-[0.9rem] border border-[var(--xidea-border)] bg-[var(--xidea-parchment)] px-3 py-2">
      <p className="text-[11px] tracking-[0.08em] text-[var(--xidea-stone)]">{label}</p>
      <p className="mt-1 text-sm font-medium text-[var(--xidea-near-black)]">{value}</p>
    </div>
  );
}

function SessionBadgeLabel({
  sessionType,
}: {
  sessionType: CompletedActivityDeck["sessionType"];
}): ReactElement {
  return (
    <Badge className="border-[var(--xidea-border)] bg-[var(--xidea-parchment)] text-[var(--xidea-charcoal)] shadow-none" variant="outline">
      {getSessionTypeLabel(sessionType)}卡组
    </Badge>
  );
}

function DeckHistoryDialog({
  deck,
  onClose,
}: {
  deck: CompletedActivityDeck | null;
  onClose: () => void;
}): ReactElement | null {
  if (deck === null) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-4 py-8 backdrop-blur-[2px]">
      <Card className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-[1.4rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-[0_24px_80px_rgba(20,20,19,0.18)]">
        <CardContent className="flex max-h-[85vh] flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <SessionBadgeLabel sessionType={deck.sessionType} />
                <span className="text-sm text-[var(--xidea-stone)]">
                  {deck.cards.length} 张卡 · {formatDeckCompletionLabel(deck.completedAt)}
                </span>
              </div>
              <p className="text-base font-medium text-[var(--xidea-near-black)]">本轮卡片回看</p>
            </div>
            <Button className="rounded-full" onClick={onClose} type="button" variant="outline">
              <X className="h-4 w-4" />
              关闭
            </Button>
          </div>

          <div className="min-h-0 space-y-3 overflow-y-auto pr-1">
            {deck.cards.map((card) => (
              <Card
                className="rounded-[1rem] border-[var(--xidea-border)] bg-[#fffaf5] shadow-none"
                key={card.activityId}
              >
                <CardContent className="space-y-3 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-6 text-[var(--xidea-near-black)]">
                        {card.activityTitle}
                      </p>
                      <p className="text-[13px] leading-6 text-[var(--xidea-charcoal)]">
                        {card.activityPrompt}
                      </p>
                    </div>
                    <Badge className={`shadow-none ${getAttemptStatusClass(card)}`} variant="outline">
                      {getAttemptStatusLabel(card)}
                    </Badge>
                  </div>

                  {card.attempts.length > 0 ? (
                    <div className="space-y-2">
                      {card.attempts.map((attempt) => (
                        <div
                          className="rounded-[0.9rem] border border-[var(--xidea-border)] bg-[var(--xidea-white)] px-3 py-2.5"
                          key={`${card.activityId}-${attempt.attemptNumber}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-[13px] font-medium text-[var(--xidea-near-black)]">
                              第 {attempt.attemptNumber} 次：{attempt.responseText || "未作答"}
                            </p>
                            <span
                              className={
                                attempt.isCorrect === true
                                  ? "text-[12px] text-[#5a8c34]"
                                  : attempt.isCorrect === false
                                    ? "text-[12px] text-[#cc6d48]"
                                    : "text-[12px] text-[var(--xidea-stone)]"
                              }
                            >
                              {attempt.isCorrect === true
                                ? "答对"
                                : attempt.isCorrect === false
                                  ? "纠偏中"
                                  : "已提交"}
                            </span>
                          </div>
                          {attempt.feedback ? (
                            <p className="mt-1.5 text-[12px] leading-5 text-[var(--xidea-charcoal)]">
                              {attempt.feedback}
                            </p>
                          ) : null}
                          {attempt.analysis ? (
                            <p className="mt-1 text-[12px] leading-5 text-[var(--xidea-stone)]">
                              分析：{attempt.analysis}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[12px] leading-5 text-[var(--xidea-stone)]">这一张没有留下作答记录。</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function SessionInspector({
  activeAssetSummary,
  activeReviewInspector,
  activeRuntime,
  completedActivityDecks,
  hasPersistedState,
  hasStructuredRuntime,
  isBlankSession,
  latestReviewedLabel,
  nextReviewLabel,
  requestSourceAssetIds,
  selectedProject,
  selectedSessionStatus,
  selectedSessionType,
  selectedSourceAssetIds,
}: {
  activeAssetSummary: AgentAssetSummary | null;
  activeReviewInspector: AgentReviewInspector | null;
  activeRuntime: RuntimeSnapshot;
  completedActivityDecks: ReadonlyArray<CompletedActivityDeck>;
  hasPersistedState: boolean;
  hasStructuredRuntime: boolean;
  isBlankSession: boolean;
  latestReviewedLabel: string;
  nextReviewLabel: string;
  requestSourceAssetIds: ReadonlyArray<string>;
  selectedProject: ProjectItem;
  selectedSessionStatus: string;
  selectedSessionType: "project" | "study" | "review";
  selectedSourceAssetIds: ReadonlyArray<string>;
}): ReactElement {
  const [openDeckKey, setOpenDeckKey] = useState<string | null>(null);
  const previewDecks = useMemo(
    () => completedActivityDecks.slice(0, 3),
    [completedActivityDecks],
  );
  const openDeck =
    completedActivityDecks.find((deck) => deck.deckKey === openDeckKey) ?? null;

  return (
    <>
      <div className="space-y-4">
        <MonitorSection title="本轮上下文">
          <CompactNote label="项目" value={selectedProject.name} />
          <CompactNote label="会话" value={selectedSessionStatus} />
          <CompactNote
            label="模式"
            value={
              hasStructuredRuntime
                ? activeRuntime.decision.title
                : selectedSessionType === "project"
                  ? "研讨对话"
                  : `${getSessionTypeLabel(selectedSessionType)}编排`
            }
          />
          <p className="text-[13px] leading-6 text-[var(--xidea-stone)]">
            {hasPersistedState
              ? activeRuntime.stateSource
              : "当前还没有回读到真实 learner state，这一栏会在会话有真实交互后变得更具体。"}
          </p>
        </MonitorSection>

        {selectedSessionType === "review" ? (
          <MonitorSection title="复习提示">
            <CompactNote label="上次复习" value={latestReviewedLabel} />
            <CompactNote label="下次安排" value={nextReviewLabel} />
            <p className="text-[13px] leading-6 text-[var(--xidea-stone)]">
              {activeReviewInspector === null
                ? "当前会话还没有回读到真实复习轨迹；完成一轮交互后会继续刷新。"
                : activeReviewInspector.summary}
            </p>
          </MonitorSection>
        ) : null}

        {selectedSessionType !== "project" && previewDecks.length > 0 ? (
          <MonitorSection title="已完成卡组" accent={`${completedActivityDecks.length} 组`}>
            <div className="space-y-4">
              {previewDecks.map((deck) => (
                <DeckStackPreview
                  deck={deck}
                  key={deck.deckKey}
                  onOpen={() => setOpenDeckKey(deck.deckKey)}
                />
              ))}
            </div>
          </MonitorSection>
        ) : null}

        {selectedSessionType === "project" ? (
          <MonitorSection title="材料上下文">
            <CompactNote
              label="材料"
              value={
                isBlankSession
                  ? "0 份"
                  : selectedSourceAssetIds.length > 0
                    ? `${requestSourceAssetIds.length} 份已附加`
                    : `${requestSourceAssetIds.length} 份已关联`
              }
            />
            <CompactNote
              label="摘要"
              value={activeAssetSummary?.summary ?? "等待读取真实材料上下文"}
            />
            {activeAssetSummary?.keyConcepts.length ? (
              <div className="flex flex-wrap gap-2">
                {activeAssetSummary.keyConcepts.slice(0, 4).map((concept) => (
                  <Badge
                    className="border-[var(--xidea-sand)] bg-[var(--xidea-ivory)] px-2 py-1 text-[12px] text-[var(--xidea-charcoal)] shadow-none"
                    key={concept}
                    variant="outline"
                  >
                    {concept}
                  </Badge>
                ))}
              </div>
            ) : null}
          </MonitorSection>
        ) : null}
      </div>

      <DeckHistoryDialog deck={openDeck} onClose={() => setOpenDeckKey(null)} />
    </>
  );
}
