import type { ReactElement } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function WorkspaceHeader({
  onCreateProject,
  onGoHome,
  onSearchChange,
  screen,
  searchQuery,
  selectedProjectName,
}: {
  onCreateProject: () => void;
  onGoHome: () => void;
  onSearchChange: (value: string) => void;
  screen: "home" | "workspace" | "detail";
  searchQuery: string;
  selectedProjectName: string;
}): ReactElement {
  return (
    <Card className="rounded-[1.4rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
      <CardContent className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <button
            className="rounded-full border border-[var(--xidea-border)] bg-[var(--xidea-parchment)] px-3 py-1.5 text-sm font-medium text-[var(--xidea-near-black)]"
            onClick={onGoHome}
            type="button"
          >
            Xidea
          </button>
          <div className="min-w-0">
            <p className="xidea-kicker">Project-centric learning workspace</p>
            <p className="text-sm text-[var(--xidea-stone)]">
              {screen === "home"
                ? "先选 project，再进入知识点池或 session 工作态。"
                : `${selectedProjectName} / ${screen === "detail" ? "Knowledge Point Detail" : "Project Workspace"}`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-w-[220px] items-center gap-2 rounded-full border border-[var(--xidea-border)] bg-[var(--xidea-parchment)] px-3 py-2 text-sm text-[var(--xidea-charcoal)]">
            <Search className="h-4 w-4 shrink-0 text-[var(--xidea-stone)]" />
            <input
              className="w-full bg-transparent outline-none placeholder:text-[var(--xidea-stone)]"
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={screen === "home" ? "搜索 project" : "搜索 knowledge point"}
              value={searchQuery}
            />
          </label>
          <Button
            className="rounded-full bg-[var(--xidea-terracotta)] text-[var(--xidea-ivory)] hover:bg-[var(--xidea-terracotta)]/90"
            onClick={onCreateProject}
            type="button"
          >
            <Plus className="h-4 w-4" />
            新建 Project
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
