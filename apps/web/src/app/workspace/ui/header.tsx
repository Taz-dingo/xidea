import type { ReactElement } from "react";
import { ChevronRight, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function WorkspaceHeader({
  onCreateProject,
  onGoHome,
  onSearchChange,
  screen,
  selectedProjectDescription,
  searchQuery,
  selectedProjectName,
  selectedProjectTopic,
}: {
  onCreateProject: () => void;
  onGoHome: () => void;
  onSearchChange: (value: string) => void;
  screen: "home" | "workspace" | "detail";
  selectedProjectDescription: string;
  searchQuery: string;
  selectedProjectName: string;
  selectedProjectTopic: string;
}): ReactElement {
  const breadcrumbItems =
    screen === "home"
      ? ["全部项目"]
      : screen === "detail"
        ? ["全部项目", selectedProjectName, "知识卡"]
        : ["全部项目", selectedProjectName, "工作台"];

  return (
    <Card className="xidea-card-motion rounded-[1.4rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
      <CardContent className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
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
            <div className="min-w-0">
              <p className="xidea-kicker">学习工作台</p>
              {screen === "home" ? (
                <p className="text-sm leading-6 text-[var(--xidea-stone)]">
                  先选一个项目，再进入知识卡、研讨或学习会话。
                </p>
              ) : (
                <div className="space-y-1">
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
      </CardContent>
    </Card>
  );
}
