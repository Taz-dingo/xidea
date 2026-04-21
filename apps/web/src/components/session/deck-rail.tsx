import { useMemo, useState } from "react";
import type { ReactElement } from "react";
import { Layers3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  DeckHistoryDialog,
  formatDeckCompletionLabel,
  SessionDeckBadge,
} from "@/components/session/deck-history-dialog";
import type {
  CompletedActivityDeck,
} from "@/domain/project-session-runtime";

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
      className="w-[220px] shrink-0 overflow-hidden rounded-[1rem] text-left"
      onClick={onOpen}
      type="button"
    >
      <Card className="h-full overflow-hidden rounded-[1rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none transition-transform hover:-translate-y-1">
        <CardContent className="min-w-0 space-y-3 overflow-hidden px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <SessionDeckBadge sessionType={deck.sessionType} />
            <span className="text-[12px] text-[var(--xidea-stone)]">
              {formatDeckCompletionLabel(deck.completedAt)}
            </span>
          </div>
          <div className="min-w-0 space-y-1 overflow-hidden">
            <p className="line-clamp-2 break-words text-sm font-medium leading-6 text-[var(--xidea-near-black)]">
              {latestCard?.activityTitle ?? "本轮卡组"}
            </p>
            <p className="line-clamp-2 break-words text-[13px] leading-5 text-[var(--xidea-stone)]">
              {latestCard?.activityPrompt ?? "点击查看本轮全部题卡。"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-[var(--xidea-stone)]">
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
  onReplayDeck,
  replayDisabled = false,
}: {
  decks: ReadonlyArray<CompletedActivityDeck>;
  onReplayDeck: (deck: CompletedActivityDeck) => void;
  replayDisabled?: boolean;
}): ReactElement | null {
  const [openDeckKey, setOpenDeckKey] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const openDeck = useMemo(
    () => decks.find((deck) => deck.deckKey === openDeckKey) ?? null,
    [decks, openDeckKey],
  );

  if (decks.length === 0) {
    return null;
  }

  return (
    <>
      <div className="relative z-20 border-b border-[var(--xidea-border)] px-5 py-3 lg:px-6">
        <div
          className="relative w-fit max-w-full after:absolute after:left-0 after:right-0 after:top-full after:h-3 after:content-['']"
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setIsExpanded(false);
            }
          }}
          onFocusCapture={() => setIsExpanded(true)}
          onMouseEnter={() => setIsExpanded(true)}
          onMouseLeave={() => setIsExpanded(false)}
        >
          <button
            className="inline-flex items-center gap-2 rounded-full border border-[var(--xidea-selection-border)] bg-[var(--xidea-white)] px-3 py-1.5"
            onClick={() => setIsExpanded((current) => !current)}
            type="button"
          >
            <Layers3 className="h-4 w-4 text-[var(--xidea-selection-text)]" />
            <p className="xidea-kicker text-[var(--xidea-selection-text)]">题卡轨迹</p>
            <Badge
              className="border-[var(--xidea-selection-border)] bg-[var(--xidea-selection)] text-[var(--xidea-selection-text)] shadow-none"
              variant="outline"
            >
              {decks.length} 组
            </Badge>
          </button>

          <div
            className="pointer-events-auto absolute left-0 top-[calc(100%+0.5rem)] z-20 w-[min(56rem,calc(100vw-8rem))] overflow-hidden rounded-[1.25rem] transition-[max-height,opacity,transform] duration-200 ease-out"
            style={{
              maxHeight: isExpanded ? "32rem" : "0px",
              opacity: isExpanded ? 1 : 0,
              visibility: isExpanded ? "visible" : "hidden",
              transform: isExpanded ? "translateY(0)" : "translateY(6px)",
            }}
          >
            <div className="min-w-0 space-y-3 overflow-hidden rounded-[1.25rem] border border-[var(--xidea-border)] bg-[var(--xidea-white)] p-4 shadow-[0_20px_40px_rgba(20,20,19,0.10)]">
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

              <div className="w-full overflow-x-auto overflow-y-hidden pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="flex w-max min-w-full gap-3 pr-3">
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
          </div>
        </div>
      </div>

      <DeckHistoryDialog
        deck={openDeck}
        onClose={() => setOpenDeckKey(null)}
        onReplay={(deck) => {
          onReplayDeck(deck);
          setOpenDeckKey(null);
        }}
        replayDisabled={replayDisabled}
      />
    </>
  );
}
