import type { ReactElement } from "react";
import {
  ChevronRight,
  FilePenLine,
  GraduationCap,
  MessageSquareText,
  Plus,
  RefreshCcw,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function WorkspaceHeader({
  onCreateProject,
  onEditProject,
  onGoHome,
  onSearchChange,
  onStartProjectSession,
  onStartReview,
  onStartStudy,
  screen,
  reviewDisabled,
  selectedProjectDescription,
  searchQuery,
  selectedProjectName,
  selectedProjectTopic,
  studyDisabled,
}: {
  onCreateProject: () => void;
  onEditProject: () => void;
  onGoHome: () => void;
  onSearchChange: (value: string) => void;
  onStartProjectSession: () => void;
  onStartReview: () => void;
  onStartStudy: () => void;
  screen: "home" | "workspace";
  reviewDisabled: boolean;
  selectedProjectDescription: string;
  searchQuery: string;
  selectedProjectName: string;
  selectedProjectTopic: string;
  studyDisabled: boolean;
}): ReactElement {
  const breadcrumbItems =
    screen === "home"
      ? ["全部项目"]
      : ["全部项目", selectedProjectName, "工作台"];

  return (
    <Card className="xidea-card-motion rounded-[1.4rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
      <CardContent className="flex flex-col gap-4 px-5 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex items-start gap-3">
            <button
              className="rounded-full border border-[var(--xidea-border)] bg-[var(--xidea-parchment)] px-3 py-1.5 text-sm font-medium text-[var(--xidea-near-black)]"
              onClick={onGoHome}
              type="button"
            >
              Xidea
            </button>
            <div className="min-w-0 space-y-2">
              <div className="flex min-w-0 flex-wrap items-center gap-1 text-[12px] text-[var(--xidea-stone)]">
                {breadcrumbItems.map((item, index) => (
                  <div className="flex items-center gap-1" key={`${item}-${index}`}>
                    {index > 0 ? <ChevronRight className="h-3.5 w-3.5" /> : null}
                    <span className={index === breadcrumbItems.length - 1 ? "text-[var(--xidea-charcoal)]" : ""}>
                      {item}
                    </span>
                  </div>
                ))}
              </div>
              {screen === "home" ? null : (
                <div className="min-w-0 space-y-1">
                  <p className="text-base font-medium text-[var(--xidea-near-black)]">
                    {selectedProjectName}
                  </p>
                  <p className="text-sm leading-6 text-[var(--xidea-charcoal)]">
                    {selectedProjectTopic}
                  </p>
                  <p className="line-clamp-1 text-sm leading-6 text-[var(--xidea-stone)]">
                    {selectedProjectDescription}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex min-w-[220px] items-center gap-2 rounded-full border border-[var(--xidea-border)] bg-[var(--xidea-parchment)] px-3 py-2 text-sm text-[var(--xidea-charcoal)]">
              <Search className="h-4 w-4 shrink-0 text-[var(--xidea-stone)]" />
              <input
                className="w-full bg-transparent outline-none placeholder:text-[var(--xidea-stone)]"
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder={screen === "home" ? "搜索项目" : "搜索知识卡"}
                value={searchQuery}
              />
            </label>
            <Button
              className="rounded-full bg-[var(--xidea-terracotta)] text-[var(--xidea-ivory)] hover:bg-[var(--xidea-terracotta)]/90"
              onClick={onCreateProject}
              type="button"
            >
              <Plus className="h-4 w-4" />
              新建项目
            </Button>
          </div>
        </div>

        {screen === "workspace" ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--xidea-border)] pt-3">
            <Button className="h-11 min-w-[96px] rounded-full" onClick={onStartProjectSession} type="button" variant="outline">
              <MessageSquareText className="h-4 w-4" />
              研讨
            </Button>
            <Button
              className="h-11 min-w-[96px] rounded-full bg-[var(--xidea-terracotta)] text-[var(--xidea-ivory)] hover:bg-[var(--xidea-terracotta)]/90"
              disabled={studyDisabled}
              onClick={onStartStudy}
              type="button"
            >
              <GraduationCap className="h-4 w-4" />
              学习
            </Button>
            <Button className="h-11 min-w-[96px] rounded-full" disabled={reviewDisabled} onClick={onStartReview} type="button" variant="outline">
              <RefreshCcw className="h-4 w-4" />
              复习
            </Button>
            <Button className="h-11 min-w-[96px] rounded-full" onClick={onEditProject} type="button" variant="outline">
              <FilePenLine className="h-4 w-4" />
              编辑
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
