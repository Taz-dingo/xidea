import { useMemo, useState } from "react";
import type { ReactElement } from "react";
import { Layers3, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type {
  ActivityBatchResult,
  CompletedActivityDeck,
} from "@/domain/project-session-runtime";
import { getSessionTypeLabel } from "@/domain/project-workspace";

function formatDeckCompletionLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "刚刚";
  }

  const diffMinutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (diffMinutes < 1) {
    return "刚刚";
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

function SessionDeckBadge({
  deck,
}: {
  deck: CompletedActivityDeck;
}): ReactElement {
  return (
    <Badge
      className="border-[var(--xidea-border)] bg-[var(--xidea-parchment)] text-[var(--xidea-charcoal)] shadow-none"
      variant="outline"
    >
      {getSessionTypeLabel(deck.sessionType)}卡组
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
                <SessionDeckBadge deck={deck} />
                <span className="text-sm text-[var(--xidea-stone)]">
                  {deck.cards.length} 张卡 · {formatDeckCompletionLabel(deck.completedAt)}
                </span>
              </div>
              <p className="text-base font-medium text-[var(--xidea-near-black)]">题卡回看</p>
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

function DeckRailCard({
  deck,
  onOpen,
}: {
  deck: CompletedActivityDeck;
  onOpen: () => void;
}): ReactElement {
  const latestCard = deck.cards.at(-1) ?? deck.cards[0];
  const attempts = deck.cards.reduce((total, card) => total + card.attempts.length, 0);
  const correct = deck.cards.filter((card) => card.isCorrect === true).length;

  return (
    <button
      className="group w-[220px] shrink-0 text-left"
      onClick={onOpen}
      type="button"
    >
      <Card className="rounded-[1rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none transition-transform group-hover:-translate-y-1">
        <CardContent className="space-y-3 px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <SessionDeckBadge deck={deck} />
            <span className="text-[12px] text-[var(--xidea-stone)]">
              {formatDeckCompletionLabel(deck.completedAt)}
            </span>
          </div>
          <div className="space-y-1">
            <p className="line-clamp-1 text-sm font-medium text-[var(--xidea-near-black)]">
              {latestCard?.activityTitle ?? "本轮卡组"}
            </p>
            <p className="line-clamp-2 text-[13px] leading-5 text-[var(--xidea-stone)]">
              {latestCard?.activityPrompt ?? "点击查看本轮全部题卡。"}
            </p>
          </div>
          <div className="flex items-center gap-2 text-[12px] text-[var(--xidea-stone)]">
            <span>{deck.cards.length} 张卡</span>
            <span>·</span>
            <span>{attempts} 次尝试</span>
            <span>·</span>
            <span>{correct} 张答对</span>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

export function CompletedDeckRail({
  decks,
}: {
  decks: ReadonlyArray<CompletedActivityDeck>;
}): ReactElement | null {
  const [openDeckKey, setOpenDeckKey] = useState<string | null>(null);
  const openDeck = useMemo(
    () => decks.find((deck) => deck.deckKey === openDeckKey) ?? null,
    [decks, openDeckKey],
  );

  if (decks.length === 0) {
    return null;
  }

  return (
    <>
      <div className="border-b border-[var(--xidea-border)] px-5 py-4 lg:px-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Layers3 className="h-4 w-4 text-[var(--xidea-selection-text)]" />
                <p className="xidea-kicker text-[var(--xidea-selection-text)]">题卡轨迹</p>
              </div>
              <p className="text-sm leading-6 text-[var(--xidea-charcoal)]">
                当前会话做过的题卡都会留在这里，支持继续回看与溯源。
              </p>
            </div>
            <Badge
              className="border-[var(--xidea-selection-border)] bg-[var(--xidea-selection)] text-[var(--xidea-selection-text)] shadow-none"
              variant="outline"
            >
              共 {decks.length} 组
            </Badge>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {decks.map((deck) => (
              <DeckRailCard
                deck={deck}
                key={deck.deckKey}
                onOpen={() => setOpenDeckKey(deck.deckKey)}
              />
            ))}
          </div>
        </div>
      </div>

      <DeckHistoryDialog deck={openDeck} onClose={() => setOpenDeckKey(null)} />
    </>
  );
}
