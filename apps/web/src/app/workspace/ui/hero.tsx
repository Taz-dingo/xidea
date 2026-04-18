import type { ReactElement } from "react";
import {
  FilePenLine,
  GraduationCap,
  MessagesSquare,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function WorkspaceHero({
  isDetailScreen,
  onStartProjectSession,
  onStartReview,
  onStartStudy,
  onToggleProjectMeta,
  reviewDisabled,
  studyDisabled,
}: {
  isDetailScreen: boolean;
  onStartProjectSession: () => void;
  onStartReview: () => void;
  onStartStudy: () => void;
  onToggleProjectMeta: () => void;
  reviewDisabled: boolean;
  studyDisabled: boolean;
}): ReactElement | null {
  if (isDetailScreen) {
    return null;
  }

  return (
    <Card className="xidea-card-motion rounded-[1.45rem] border-[var(--xidea-border)] bg-[var(--xidea-ivory)] shadow-none">
      <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <p className="xidea-kicker text-[var(--xidea-selection-text)]">开始下一步</p>
          <p className="text-sm leading-6 text-[var(--xidea-charcoal)]">
            先用研讨确认方向，再把稳定的知识点送进学习或复习。
          </p>
        </div>

        <div className="flex flex-wrap gap-3 rounded-[1.2rem] border border-[var(--xidea-border)] bg-[var(--xidea-white)] p-2">
          <div className="flex flex-wrap gap-2 rounded-[1rem] border border-[var(--xidea-border)] bg-[var(--xidea-ivory)] p-1.5">
            <Button className="rounded-full" onClick={onStartProjectSession} type="button" variant="outline">
              <MessagesSquare className="h-4 w-4" />
              开始研讨
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 rounded-[1rem] border border-[var(--xidea-border)] bg-[var(--xidea-ivory)] p-1.5">
            <Button
              className="rounded-full bg-[var(--xidea-terracotta)] text-[var(--xidea-ivory)] hover:bg-[var(--xidea-terracotta)]/90"
              disabled={studyDisabled}
              onClick={onStartStudy}
              type="button"
            >
              <GraduationCap className="h-4 w-4" />
              学习
            </Button>
            <Button className="rounded-full" disabled={reviewDisabled} onClick={onStartReview} type="button" variant="outline">
              <RotateCcw className="h-4 w-4" />
              复习
            </Button>
          </div>
          <Button className="rounded-full" onClick={onToggleProjectMeta} type="button" variant="outline">
            <FilePenLine className="h-4 w-4" />
            编辑
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
