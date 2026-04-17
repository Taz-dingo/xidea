import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { KnowledgePointSuggestion } from "@/domain/project-workspace";

export function KnowledgePointSuggestionCard({
  onAccept,
  onDismiss,
  onOpenKnowledgePoint,
  suggestion,
}: {
  onAccept: () => void;
  onDismiss: () => void;
  onOpenKnowledgePoint: (pointId: string) => void;
  suggestion: KnowledgePointSuggestion;
}): ReactElement {
  const isAccepted = suggestion.acceptedKnowledgePointId !== null;

  return (
    <Card className="rounded-[1.15rem] border-[var(--xidea-selection-border)] bg-[var(--xidea-selection)] shadow-none">
      <CardContent className="space-y-4 px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            className="border-[var(--xidea-selection-border)] bg-[var(--xidea-white)] text-[var(--xidea-selection-text)] shadow-none"
            variant="outline"
          >
            知识点建议新增
          </Badge>
          {suggestion.sourceAssetIds.length > 0 ? (
            <span className="text-xs text-[var(--xidea-selection-text)]/80">
              关联 {suggestion.sourceAssetIds.length} 份材料
            </span>
          ) : null}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-[var(--xidea-near-black)]">
            {suggestion.title}
          </p>
          <p className="text-sm leading-6 text-[var(--xidea-charcoal)]">
            {suggestion.description}
          </p>
          <p className="text-xs leading-5 text-[var(--xidea-selection-text)]/85">
            {suggestion.reason}
          </p>
        </div>

        {isAccepted ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--xidea-selection-text)]">
              已加入当前 project 的 knowledge point 池。
            </p>
            <Button
              className="rounded-full"
              onClick={() => onOpenKnowledgePoint(suggestion.acceptedKnowledgePointId!)}
              type="button"
              variant="outline"
            >
              查看知识点
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              className="rounded-full bg-[var(--xidea-terracotta)] text-[var(--xidea-ivory)] hover:bg-[var(--xidea-terracotta)]/90"
              onClick={onAccept}
              type="button"
            >
              确认新增
            </Button>
            <Button className="rounded-full" onClick={onDismiss} type="button" variant="outline">
              忽略
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
