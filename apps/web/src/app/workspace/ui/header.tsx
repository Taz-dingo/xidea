import type { ReactElement } from "react";
import { ChevronRight, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BrandLockup } from "@/app/workspace/ui/brand-lockup";

function BreadcrumbButton({
  active = false,
  label,
  onClick,
}: {
  active?: boolean;
  label: string;
  onClick?: () => void;
}): ReactElement {
  if (onClick === undefined || active) {
    return (
      <span className={active ? "text-[var(--xidea-charcoal)]" : ""}>
        {label}
      </span>
    );
  }

  return (
    <button
      className="rounded-sm text-left transition-colors hover:text-[var(--xidea-charcoal)]"
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

export function WorkspaceHeader({
  onCreateProject,
  onGoHome,
  onGoWorkspace,
  onSearchChange,
  screen,
  searchQuery,
  selectedProjectName,
}: {
  onCreateProject: () => void;
  onGoHome: () => void;
  onGoWorkspace: () => void;
  onSearchChange: (value: string) => void;
  screen: "home" | "workspace";
  searchQuery: string;
  selectedProjectName: string;
}): ReactElement {
  return (
    <Card className="xidea-card-motion rounded-[1.4rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
      <CardContent className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex items-center gap-3">
          <BrandLockup onClick={onGoHome} />
          <div className="min-w-0 space-y-2">
            <div className="flex min-w-0 flex-wrap items-center gap-1 text-[12px] text-[var(--xidea-stone)]">
              <BreadcrumbButton
                active={screen === "home"}
                label="全部项目"
                onClick={screen === "home" ? undefined : onGoHome}
              />
              {screen === "workspace" ? (
                <>
                  <ChevronRight className="h-3.5 w-3.5" />
                  <BreadcrumbButton active label={selectedProjectName} onClick={onGoWorkspace} />
                </>
              ) : null}
            </div>
            <p className="text-sm text-[var(--xidea-stone)]">
              {screen === "home"
                ? "项目、知识卡与学习会话在这里汇总。"
                : "项目工作台"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="xidea-card-motion flex min-w-[220px] items-center gap-2 rounded-full border border-[var(--xidea-border)] bg-[var(--xidea-parchment)] px-3 py-2 text-sm text-[var(--xidea-charcoal)]">
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
