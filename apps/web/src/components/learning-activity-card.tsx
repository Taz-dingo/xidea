import { useEffect, useState, type ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { MODE_LABELS } from "@/domain/planner";
import type { LearningActivity, LearningActivitySubmission } from "@/domain/types";

function getKindLabel(kind: LearningActivity["kind"]): string {
  switch (kind) {
    case "coach-followup":
      return "导师追问";
    case "quiz":
      return "对比辨析";
    case "recall":
      return "主动回忆";
  }
}

export function LearningActivityCard({
  activity,
  disabled,
  resolution,
  onSkip,
  onSubmit,
}: {
  activity: LearningActivity;
  disabled: boolean;
  resolution: "submitted" | "skipped" | null;
  onSkip?: () => void;
  onSubmit: (submission: LearningActivitySubmission) => void;
}): ReactElement {
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");

  useEffect(() => {
    setSelectedChoiceId(null);
    setDraftText("");
  }, [activity.id]);

  const isResolved = resolution !== null;
  const canSubmit =
    activity.input.type === "choice"
      ? selectedChoiceId !== null
      : draftText.trim().length >= activity.input.minLength;

  return (
    <Card className="rounded-[1rem] border-[var(--xidea-selection-border)] bg-[#fcf6f2] shadow-none">
      <CardHeader className="space-y-3 pb-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            className="border-[var(--xidea-selection-border)] bg-[var(--xidea-white)] text-[var(--xidea-selection-text)] shadow-none"
            variant="outline"
          >
            当前动作
          </Badge>
          <Badge
            className="border-[var(--xidea-border)] bg-[var(--xidea-parchment)] text-[var(--xidea-stone)] shadow-none"
            variant="outline"
          >
            {getKindLabel(activity.kind)}
          </Badge>
          {activity.mode !== null ? (
            <Badge
              className="border-[var(--xidea-border)] bg-[var(--xidea-parchment)] text-[var(--xidea-charcoal)] shadow-none"
              variant="outline"
            >
              {MODE_LABELS[activity.mode]}
            </Badge>
          ) : null}
        </div>

        <div className="space-y-2">
          <CardTitle className="text-base font-medium text-[var(--xidea-near-black)]">
            {activity.title}
          </CardTitle>
          <p className="text-sm leading-7 text-[var(--xidea-charcoal)]">{activity.prompt}</p>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_200px]">
          <div className="space-y-3">
            {activity.input.type === "choice" ? (
              <div className="space-y-3">
                {activity.input.choices.map((choice) => {
                  const selected = selectedChoiceId === choice.id;

                  return (
                    <button
                      className={
                        selected
                            ? "w-full rounded-[0.95rem] border border-[var(--xidea-selection-border)] bg-[var(--xidea-selection)] px-3 py-2.5 text-left transition-colors"
                          : "w-full rounded-[0.95rem] border border-[var(--xidea-border)] bg-[var(--xidea-white)] px-3 py-2.5 text-left transition-colors hover:border-[var(--xidea-selection-border)] hover:bg-[#fff8f4]"
                      }
                      disabled={disabled || isResolved}
                      key={choice.id}
                      onClick={() => {
                        setSelectedChoiceId(choice.id);
                      }}
                      type="button"
                    >
                      <p className="text-sm font-medium leading-6 text-[var(--xidea-near-black)]">
                        {choice.label}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[var(--xidea-charcoal)]">
                        {choice.detail}
                      </p>
                    </button>
                  );
                })}

                <Textarea
                  className="min-h-[5.5rem] rounded-[0.95rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] text-sm leading-6 text-[var(--xidea-charcoal)] shadow-none focus-visible:ring-[var(--xidea-selection-border)]"
                  disabled={disabled || isResolved}
                  onChange={(event) => {
                    setDraftText(event.target.value);
                  }}
                  placeholder="可选：补一句你为什么这样判断，系统会据此决定下一轮是追问还是改排。"
                  value={draftText}
                />
              </div>
            ) : (
              <Textarea
                className="min-h-[7rem] rounded-[0.95rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] text-sm leading-6 text-[var(--xidea-charcoal)] shadow-none focus-visible:ring-[var(--xidea-selection-border)]"
                disabled={disabled || isResolved}
                onChange={(event) => {
                  setDraftText(event.target.value);
                }}
                placeholder={activity.input.placeholder}
                value={draftText}
              />
            )}
          </div>

          <div className="space-y-3 rounded-[0.95rem] bg-[var(--xidea-white)] px-3 py-3">
            <div>
              <p className="xidea-kicker text-[var(--xidea-stone)]">目标</p>
              <p className="mt-2 text-sm leading-6 text-[var(--xidea-charcoal)]">
                {activity.objective}
              </p>
            </div>

            <div>
              <p className="xidea-kicker text-[var(--xidea-stone)]">触发原因</p>
              <p className="mt-2 text-sm leading-6 text-[var(--xidea-charcoal)]">
                {activity.support}
              </p>
            </div>

            <div>
              <p className="xidea-kicker text-[var(--xidea-stone)]">证据</p>
              <div className="mt-2 space-y-2">
                {activity.evidence.map((item, index) => (
                  <div className="flex items-start gap-2 text-sm leading-6 text-[var(--xidea-charcoal)]" key={`${item}-${index}`}>
                    <span className="mt-2 inline-block h-1.5 w-1.5 rounded-full bg-[var(--xidea-terracotta)]" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--xidea-stone)]">
            {resolution === "submitted"
              ? "这轮作答已经发给 agent，接下来会基于你的表现继续决定动作。"
              : resolution === "skipped"
                ? "这轮动作已跳过，agent 会根据当前状态重新安排下一步。"
                : "先完成这一轮动作，再继续下一轮对话。"}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {onSkip ? (
              <Button
                className="rounded-full border-[var(--xidea-border)] bg-[var(--xidea-white)] px-4 text-[var(--xidea-charcoal)] hover:bg-[var(--xidea-parchment)]"
                disabled={disabled || isResolved}
                onClick={onSkip}
                type="button"
                variant="outline"
              >
                先跳过
              </Button>
            ) : null}
            <Button
              className="rounded-full bg-[var(--xidea-terracotta)] px-4 text-[var(--xidea-ivory)] hover:bg-[var(--xidea-terracotta)]/90"
              disabled={disabled || isResolved || !canSubmit}
              onClick={() => {
                const selectedChoice =
                  activity.input.type === "choice"
                    ? activity.input.choices.find((choice) => choice.id === selectedChoiceId) ?? null
                    : null;

                onSubmit({
                  activityId: activity.id,
                  kind: activity.kind,
                  selectedChoiceId,
                  responseText:
                    draftText.trim() ||
                    selectedChoice?.detail ||
                    selectedChoice?.label ||
                    "",
                });
              }}
              type="button"
            >
              {activity.submitLabel}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
