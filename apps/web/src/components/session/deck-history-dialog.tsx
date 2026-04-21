import type { ReactElement } from "react";
import { RefreshCcw, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  isCompletedDeckReplayable,
  type ActivityBatchResult,
  type CompletedActivityDeck,
} from "@/domain/project-session-runtime";
import { getSessionTypeLabel } from "@/domain/project-workspace";

export function formatDeckCompletionLabel(value: string): string {
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

export function getAttemptStatusLabel(card: ActivityBatchResult): string {
  if (card.action === "skip") {
    return "已跳过";
  }
  if (card.isCorrect === true) {
    return `已完成 · ${card.attempts.length} 次`;
  }
  return "未完成";
}

export function getAttemptStatusClass(card: ActivityBatchResult): string {
  if (card.action === "skip") {
    return "border-[var(--xidea-border)] bg-[var(--xidea-white)] text-[var(--xidea-stone)]";
  }
  if (card.isCorrect === true) {
    return "border-[#bfd6a7] bg-[#f3fbe9] text-[#4f7c2f]";
  }
  return "border-[var(--xidea-selection-border)] bg-[#fff3eb] text-[var(--xidea-selection-text)]";
}

export function SessionDeckBadge({
  sessionType,
}: {
  sessionType: CompletedActivityDeck["sessionType"];
}): ReactElement {
  return (
    <Badge
      className="border-[var(--xidea-border)] bg-[var(--xidea-parchment)] text-[var(--xidea-charcoal)] shadow-none"
      variant="outline"
    >
      {getSessionTypeLabel(sessionType)}卡组
    </Badge>
  );
}

export function DeckHistoryDialog({
  deck,
  onClose,
  onReplay,
  replayDisabled,
}: {
  deck: CompletedActivityDeck | null;
  onClose: () => void;
  onReplay?: (deck: CompletedActivityDeck) => void;
  replayDisabled?: boolean;
}): ReactElement | null {
  if (deck === null) {
    return null;
  }

  const replayable = isCompletedDeckReplayable(deck);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-4 py-8 backdrop-blur-[2px]">
      <Card className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-[1.4rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-[0_24px_80px_rgba(20,20,19,0.18)]">
        <CardContent className="flex max-h-[85vh] flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <SessionDeckBadge sessionType={deck.sessionType} />
                <span className="text-sm text-[var(--xidea-stone)]">
                  {deck.cards.length} 张卡 · {formatDeckCompletionLabel(deck.completedAt)}
                </span>
              </div>
              <div className="space-y-1">
                <p className="text-base font-medium text-[var(--xidea-near-black)]">题卡回看</p>
                <p className="text-sm leading-6 text-[var(--xidea-stone)]">
                  重做会新开一轮同题练习，原有作答轨迹会继续保留。
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onReplay ? (
                <Button
                  className="rounded-full"
                  disabled={!replayable || replayDisabled}
                  onClick={() => onReplay(deck)}
                  type="button"
                  variant="outline"
                >
                  <RefreshCcw className="h-4 w-4" />
                  重做一遍
                </Button>
              ) : null}
              <Button
                aria-label="关闭题卡回看"
                className="rounded-full px-3"
                onClick={onClose}
                type="button"
                variant="outline"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="min-h-0 space-y-3 overflow-y-auto pr-1">
            {deck.cards.map((card, index) => (
              <Card
                className="rounded-[1rem] border-[var(--xidea-border)] bg-[#fffaf5] shadow-none"
                key={`${card.activityId}-${index}`}
              >
                <CardContent className="space-y-3 px-4 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-base font-medium leading-7 text-[var(--xidea-near-black)]">
                        {card.activityTitle}
                      </p>
                      <p className="text-sm leading-7 text-[var(--xidea-charcoal)]">
                        {card.activityPrompt}
                      </p>
                    </div>
                    <Badge
                      className={`shrink-0 whitespace-nowrap px-3 py-1.5 text-sm shadow-none ${getAttemptStatusClass(card)}`}
                      variant="outline"
                    >
                      {getAttemptStatusLabel(card)}
                    </Badge>
                  </div>

                  {card.attempts.length > 0 ? (
                    <div className="space-y-2">
                      {card.attempts.map((attempt) => (
                        <div
                          className="rounded-[0.9rem] border border-[var(--xidea-border)] bg-[var(--xidea-white)] px-3 py-3"
                          key={`${card.activityId}-${attempt.attemptNumber}`}
                        >
                          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium leading-6 text-[var(--xidea-near-black)]">
                                第 {attempt.attemptNumber} 次：{attempt.responseText || "未作答"}
                              </p>
                            </div>
                            <span
                              className={
                                attempt.isCorrect === true
                                  ? "shrink-0 whitespace-nowrap text-[12px] text-[#5a8c34]"
                                  : attempt.isCorrect === false
                                    ? "shrink-0 whitespace-nowrap text-[12px] text-[#cc6d48]"
                                    : "shrink-0 whitespace-nowrap text-[12px] text-[var(--xidea-stone)]"
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
                            <p className="mt-1.5 text-[13px] leading-6 text-[var(--xidea-charcoal)]">
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
                    <p className="text-[12px] leading-5 text-[var(--xidea-stone)]">
                      这一张没有留下作答记录。
                    </p>
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
