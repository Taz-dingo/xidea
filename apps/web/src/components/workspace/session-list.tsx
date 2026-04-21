import { useEffect, useState, type ReactElement, type ReactNode } from "react";
import { ChevronDown, ChevronUp, Info } from "lucide-react";
import type { SessionItem } from "@/domain/project-workspace";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SessionCard } from "@/components/workspace/core";

const SESSION_LIST_COLLAPSED_MAX_HEIGHT = "max-h-[13.5rem]";
const SESSION_LIST_EXPANDED_HEIGHT = "h-[24rem]";
const SESSION_LIST_EXPAND_THRESHOLD = 4;

export function SessionListSection({
  actions,
  emptyText,
  infoTooltip,
  onDeleteSession,
  onOpenSession,
  selectedSessionId = null,
  sessions,
  showTypeBadge = true,
  title,
}: {
  actions?: ReactNode;
  emptyText: string;
  infoTooltip?: ReactNode;
  onDeleteSession?: (sessionId: string) => void;
  onOpenSession: (sessionId: string) => void;
  selectedSessionId?: string | null;
  sessions: ReadonlyArray<SessionItem>;
  showTypeBadge?: boolean;
  title: string;
}): ReactElement {
  const [isExpanded, setIsExpanded] = useState(false);
  const [deleteArmedSessionId, setDeleteArmedSessionId] = useState<string | null>(null);
  const canExpand = sessions.length > SESSION_LIST_EXPAND_THRESHOLD;

  useEffect(() => {
    if (deleteArmedSessionId === null) {
      return;
    }

    const timeoutId = window.setTimeout(() => setDeleteArmedSessionId(null), 2200);
    return () => window.clearTimeout(timeoutId);
  }, [deleteArmedSessionId]);

  const cards = (
    <div className="space-y-2">
      {sessions.map((session) => (
        <SessionCard
          active={session.id === selectedSessionId}
          deleteArmed={deleteArmedSessionId === session.id}
          key={session.id}
          onDelete={
            onDeleteSession
              ? () => {
                  if (deleteArmedSessionId === session.id) {
                    setDeleteArmedSessionId(null);
                    onDeleteSession(session.id);
                    return;
                  }
                  setDeleteArmedSessionId(session.id);
                }
              : undefined
          }
          onClick={() => onOpenSession(session.id)}
          showTypeBadge={showTypeBadge}
          title={session.title}
          type={session.type}
          updatedAt={session.updatedAt}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-3 rounded-[1rem] border border-[var(--xidea-border)] bg-[var(--xidea-white)] p-3">
      <div className="flex items-center gap-2">
        <p className="xidea-kicker text-[var(--xidea-stone)]">{title}</p>
        {infoTooltip ? (
          <div className="group relative">
            <button
              aria-label={`${title}说明`}
              className="flex h-5 w-5 items-center justify-center rounded-full border border-[var(--xidea-border)] bg-[var(--xidea-white)] text-[var(--xidea-stone)] transition-colors hover:border-[var(--xidea-selection-border)] hover:text-[var(--xidea-selection-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xidea-selection-border)] focus-visible:ring-offset-2"
              type="button"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
            <div className="pointer-events-none absolute left-0 top-full z-20 mt-2 hidden w-[17rem] rounded-[0.95rem] border border-[var(--xidea-border)] bg-[var(--xidea-white)] px-3 py-3 shadow-[0_18px_36px_rgba(20,20,19,0.10)] group-hover:block group-focus-within:block">
              {infoTooltip}
            </div>
          </div>
        ) : null}
      </div>

      {actions ? <div className="space-y-2">{actions}</div> : null}

      {sessions.length > 0 ? (
        <>
          {canExpand && isExpanded ? (
            <ScrollArea className={SESSION_LIST_EXPANDED_HEIGHT}>
              <div className="pr-3">{cards}</div>
            </ScrollArea>
          ) : (
            <div className={canExpand ? `relative overflow-hidden ${SESSION_LIST_COLLAPSED_MAX_HEIGHT}` : undefined}>
              {cards}
              {canExpand ? (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[var(--xidea-white)] via-[var(--xidea-white)]/90 to-transparent" />
              ) : null}
            </div>
          )}

          {canExpand ? (
            <div className="flex justify-end">
              <Button
                aria-expanded={isExpanded}
                className="h-8 rounded-full px-3 text-[12px] text-[var(--xidea-stone)] hover:text-[var(--xidea-selection-text)]"
                onClick={() => setIsExpanded((value) => !value)}
                type="button"
                variant="ghost"
              >
                {isExpanded ? (
                  <>
                    收起
                    <ChevronUp className="h-3.5 w-3.5" />
                  </>
                ) : (
                  <>
                    展开
                    <ChevronDown className="h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-[var(--xidea-stone)]">{emptyText}</p>
      )}
    </div>
  );
}
