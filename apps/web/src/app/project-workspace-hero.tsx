import type { ReactElement } from "react";
import { ArrowLeft, MessageSquareText, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function ProjectWorkspaceHero({
  description,
  isDetailScreen,
  onBack,
  onStartProjectSession,
  onStartReview,
  onStartStudy,
  onToggleProjectMeta,
  projectName,
  projectTopic,
  reviewDisabled,
  studyDisabled,
}: {
  description: string;
  isDetailScreen: boolean;
  onBack: () => void;
  onStartProjectSession: () => void;
  onStartReview: () => void;
  onStartStudy: () => void;
  onToggleProjectMeta: () => void;
  projectName: string;
  projectTopic: string;
  reviewDisabled: boolean;
  studyDisabled: boolean;
}): ReactElement {
  return (
    <Card className="rounded-[1.45rem] border-[var(--xidea-border)] bg-[var(--xidea-ivory)] shadow-none">
      <CardContent className="space-y-4 p-6">
        {isDetailScreen ? (
          <button
            className="inline-flex items-center gap-2 rounded-full border border-[var(--xidea-border)] bg-[var(--xidea-white)] px-3 py-1.5 text-sm text-[var(--xidea-charcoal)]"
            onClick={onBack}
            type="button"
          >
            <ArrowLeft className="h-4 w-4" />
            返回 Project Workspace
          </button>
        ) : null}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <p className="xidea-kicker text-[var(--xidea-selection-text)]">Project Workspace</p>
            <h1 className="text-2xl font-medium text-[var(--xidea-near-black)]">{projectName}</h1>
            <p className="text-sm leading-7 text-[var(--xidea-charcoal)]">{projectTopic}</p>
            <p className="max-w-4xl text-sm leading-7 text-[var(--xidea-stone)]">{description}</p>
          </div>

          {isDetailScreen ? null : (
            <div className="flex flex-wrap gap-2">
              <Button
                className="rounded-full bg-[var(--xidea-terracotta)] text-[var(--xidea-ivory)] hover:bg-[var(--xidea-terracotta)]/90"
                disabled={studyDisabled}
                onClick={onStartStudy}
                type="button"
              >
                学习
              </Button>
              <Button className="rounded-full" disabled={reviewDisabled} onClick={onStartReview} type="button" variant="outline">
                复习
              </Button>
              <Button className="rounded-full" onClick={onStartProjectSession} type="button" variant="outline">
                <MessageSquareText className="h-4 w-4" />
                新建 project session
              </Button>
              <Button className="rounded-full" onClick={onToggleProjectMeta} type="button" variant="outline">
                <MoreHorizontal className="h-4 w-4" />
                More
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
